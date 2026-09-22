import os
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware

from database import (
    get_db_connection, init_db,
    COMMON_PLACE_LOCATIONS, VALUABLE_CATEGORIES, KEC_DEPARTMENTS
)
from auth import create_access_token, decode_access_token, hash_password, verify_password
from schemas import (
    ActivitySummary,
    AdminAnalyticsOut,
    AuthResponse,
    CategoryItem,
    ClaimCreate,
    ClaimOut,
    ClaimVerifyRequest,
    DepartmentCreate,
    DepartmentOut,
    DepartmentUpdate,
    DeptStats,
    GeminiAnalysisOut,
    GeminiAnalysisRequest,
    ItemCreate,
    ItemEscalateRequest,
    ItemHandoverRequest,
    ItemOut,
    LoginRequest,
    MessageCreate,
    MessageOut,
    NotificationOut,
    SignupRequest,
    UserOut,
)
from gemini_vision import analyze_item_image

ESCALATION_HOURS = int(os.getenv("ESCALATION_HOURS", "24"))
DEPT_ESCALATION_DAYS = int(os.getenv("DEPT_ESCALATION_DAYS", "7"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
        print("[FASTAPI] Startup: PostgreSQL database and all tables ready.")
    except Exception as e:
        print(f"[FASTAPI] Startup DB init warning: {e}")
    yield


app = FastAPI(
    title="Campus Lost & Found API",
    description="Backend for Kongu Campus Lost and Found system — with Department & Admin portals",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Auth Helpers
# ==========================================
def get_current_user_from_token(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to validate bearer token and fetch user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired"
        )

    email = payload["sub"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, role, department, department_code, phone, created_at FROM users WHERE email = %s",
                (email,)
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            return user
    finally:
        conn.close()


def require_department_admin(current_user: dict = Depends(get_current_user_from_token)) -> dict:
    if current_user["role"] not in ("department_admin", "admin"):
        raise HTTPException(status_code=403, detail="Department admin access required")
    return current_user


def require_admin(current_user: dict = Depends(get_current_user_from_token)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    email = payload["sub"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, role, department, department_code, phone, created_at FROM users WHERE email = %s",
                (email,)
            )
            return cur.fetchone()
    except Exception:
        return None
    finally:
        conn.close()


def _is_common_place(location: str) -> bool:
    if not location:
        return False
    loc = location.strip().lower()
    return any(c in loc for c in COMMON_PLACE_LOCATIONS)


def _detect_department_from_location(location: str) -> Optional[dict]:
    if not location:
        return None
    loc_clean = location.upper().strip()
    words = [w.strip(",.- ()[]") for w in loc_clean.split()]
    for dept in KEC_DEPARTMENTS:
        code = dept["code"].upper()
        name = dept["name"].upper()
        if code in words or f" {code} " in f" {loc_clean} " or name in loc_clean:
            return dept
    return None


def _is_valuable_category(category: str) -> bool:
    return category.strip().lower() in VALUABLE_CATEGORIES


def _item_to_out(item: dict) -> ItemOut:
    d = dict(item)
    if d.get("reporter_name"):
        d["reporter_name"] = d["reporter_name"].split()[0]
    return ItemOut(**d)


# ==========================================
# Root & Auth Endpoints
# ==========================================
@app.get("/")
def root():
    return {
        "app": "Campus Lost & Found Backend",
        "status": "online",
        "institution": "Kongu Engineering College (@kongu.edu)",
        "version": "3.0.0"
    }


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest):
    clean_email = req.email.strip().lower()

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (clean_email,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email is already registered. Please log in instead."
                )

            hashed_pwd = hash_password(req.password)
            cur.execute(
                """
                INSERT INTO users (name, email, password, role, department, department_code, phone)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, email, role, department, department_code, phone, created_at;
                """,
                (
                    req.name.strip(), clean_email, hashed_pwd, req.role.value,
                    req.department, req.department_code, req.phone
                )
            )
            new_user = cur.fetchone()
            conn.commit()

            token = create_access_token({
                "sub": new_user["email"],
                "id": new_user["id"],
                "role": new_user["role"],
                "name": new_user["name"]
            })
            return AuthResponse(
                message="User registered successfully",
                access_token=token,
                token_type="bearer",
                user=UserOut(**new_user)
            )
    finally:
        conn.close()


@app.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest):
    clean_email = req.email.strip().lower()
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, password, role, department, department_code, phone, created_at FROM users WHERE email = %s",
                (clean_email,)
            )
            user_row = cur.fetchone()
            if not user_row or not verify_password(req.password, user_row["password"]):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

            token = create_access_token({
                "sub": user_row["email"],
                "id": user_row["id"],
                "role": user_row["role"],
                "name": user_row["name"]
            })
            user_out = UserOut(
                id=user_row["id"], name=user_row["name"], email=user_row["email"],
                role=user_row["role"], department=user_row["department"],
                department_code=user_row["department_code"], phone=user_row["phone"],
                created_at=user_row["created_at"]
            )
            return AuthResponse(
                message="Login successful",
                access_token=token,
                token_type="bearer",
                user=user_out
            )
    finally:
        conn.close()


@app.get("/auth/me", response_model=UserOut)
def get_current_user(current_user: dict = Depends(get_current_user_from_token)):
    return UserOut(**current_user)


@app.get("/departments")
def list_departments():
    """Return all KEC departments for dropdown selection."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM departments ORDER BY code ASC")
            depts = cur.fetchall()
            return [dict(d) for d in depts]
    finally:
        conn.close()


@app.post("/departments", status_code=status.HTTP_201_CREATED)
def create_department(
    dept: DepartmentCreate,
    current_user: dict = Depends(require_admin)
):
    """Admin adds a new department or center."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM departments WHERE UPPER(code) = UPPER(%s)", (dept.code.strip(),))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Department with code '{dept.code.upper()}' already exists")
            cur.execute("""
                INSERT INTO departments (code, name, office_location, hod_email, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                RETURNING id, code, name, office_location, hod_email, created_at;
            """, (dept.code.strip().upper(), dept.name.strip(), dept.office_location, dept.hod_email))
            new_dept = cur.fetchone()
            conn.commit()
            return dict(new_dept)
    finally:
        conn.close()


@app.put("/departments/{dept_id}")
def update_department(
    dept_id: int,
    dept: DepartmentUpdate,
    current_user: dict = Depends(require_admin)
):
    """Admin updates department details."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM departments WHERE id = %s", (dept_id,))
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Department not found")

            name = dept.name if dept.name is not None else existing["name"]
            loc = dept.office_location if dept.office_location is not None else existing["office_location"]
            email = dept.hod_email if dept.hod_email is not None else existing["hod_email"]

            cur.execute("""
                UPDATE departments SET name = %s, office_location = %s, hod_email = %s
                WHERE id = %s
                RETURNING id, code, name, office_location, hod_email, created_at;
            """, (name, loc, email, dept_id))
            updated = cur.fetchone()
            conn.commit()
            return dict(updated)
    finally:
        conn.close()


@app.delete("/departments/{dept_id}")
def delete_department(
    dept_id: int,
    current_user: dict = Depends(require_admin)
):
    """Admin deletes a department."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM departments WHERE id = %s", (dept_id,))
            dept = cur.fetchone()
            if not dept:
                raise HTTPException(status_code=404, detail="Department not found")

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE assigned_department = %s", (dept["code"],))
            cnt = cur.fetchone()["cnt"]
            if cnt > 0:
                raise HTTPException(status_code=400, detail=f"Cannot delete department: {cnt} items currently assigned to {dept['code']}")

            cur.execute("DELETE FROM departments WHERE id = %s", (dept_id,))
            conn.commit()
            return {"message": f"Department {dept['code']} deleted successfully"}
    finally:
        conn.close()


@app.get("/categories")
def get_categories(authorization: Optional[str] = Header(None)):
    user_role = "guest"
    user_name = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            user_role = payload.get("role", "student")
            user_name = payload.get("name", "Student")

    categories = [
        {"id": "all",        "title": "All",         "count": 12, "icon": "sparkles",  "priority": True},
        {"id": "id_cards",   "title": "ID Cards",    "count": 28, "icon": "id-card",   "priority": True},
        {"id": "wallets",    "title": "Wallets",     "count": 19, "icon": "wallet",     "priority": False},
        {"id": "keys",       "title": "Keys",        "count": 14, "icon": "key",        "priority": False},
        {"id": "electronics","title": "Electronics", "count": 23, "icon": "plug",       "priority": True},
        {"id": "bags",       "title": "Bags",        "count": 16, "icon": "bag",        "priority": False},
        {"id": "shoes",      "title": "Shoes",       "count": 8,  "icon": "shoe",       "priority": False},
        {"id": "books",      "title": "Books",       "count": 31, "icon": "book",       "priority": False},
        {"id": "jewelry",    "title": "Jewelry",     "count": 5,  "icon": "gem",        "priority": True},
        {"id": "others",     "title": "Others",      "count": 42, "icon": "box",        "priority": False},
    ]

    role_privileges = {
        "role": user_role,
        "user_name": user_name,
        "can_report_lost": True,
        "can_report_found": True,
        "valuable_custody_access": user_role in ["non_teaching_staff", "staff", "department_admin", "admin"],
        "moderation_view": user_role in ["department_admin", "admin"],
        "is_department_admin": user_role == "department_admin",
        "is_admin": user_role == "admin",
        "badge": (
            "Admin Console" if user_role == "admin"
            else "Dept. Console" if user_role == "department_admin"
            else "Staff Console" if user_role in ["staff", "non_teaching_staff"]
            else "Student"
        )
    }

    return {"categories": categories, "role_privileges": role_privileges}


# ==========================================
# Items Feed & Listings
# ==========================================
@app.get("/items", response_model=List[ItemOut])
def get_items(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    location: Optional[str] = Query(None),
    sort: Optional[str] = Query("recent"),
    report_type: Optional[str] = Query("found"),
    escalation_level: Optional[str] = Query(None),
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM items WHERE 1=1"
            params = []

            if report_type and report_type != "all":
                query += " AND report_type = %s"
                params.append(report_type)

            if category and category.lower() not in ["all", ""]:
                query += " AND LOWER(category) = LOWER(%s)"
                params.append(category)

            if status_filter and status_filter.lower() not in ["all", ""]:
                query += " AND LOWER(status) = LOWER(%s)"
                params.append(status_filter)

            if location and location.lower() not in ["all", ""]:
                query += " AND LOWER(location) = LOWER(%s)"
                params.append(location)

            if escalation_level and escalation_level != "all":
                query += " AND escalation_level = %s"
                params.append(escalation_level)

            if search and search.strip():
                query += " AND (title ILIKE %s OR description ILIKE %s OR location ILIKE %s)"
                term = f"%{search.strip()}%"
                params.extend([term, term, term])

            query += " ORDER BY created_at " + ("ASC" if sort == "oldest" else "DESC")

            cur.execute(query, tuple(params))
            items = cur.fetchall()
            return [_item_to_out(dict(it)) for it in items]
    finally:
        conn.close()


@app.get("/items/my-activity")
def get_my_activity(current_user: dict = Depends(get_current_user_from_token)):
    uid = current_user["id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE user_id = %s AND report_type = 'lost' ORDER BY created_at DESC", (uid,))
            lost_rows = cur.fetchall()

            cur.execute("SELECT * FROM items WHERE user_id = %s AND report_type = 'found' ORDER BY created_at DESC", (uid,))
            found_rows = cur.fetchall()

            cur.execute(
                "SELECT * FROM items WHERE (user_id = %s OR id IN (SELECT item_id FROM claims WHERE claimant_id = %s)) AND status = 'Matched' ORDER BY created_at DESC",
                (uid, uid)
            )
            match_rows = cur.fetchall()

            cur.execute(
                "SELECT * FROM items WHERE (user_id = %s OR id IN (SELECT item_id FROM claims WHERE claimant_id = %s)) AND status = 'Recovered' ORDER BY created_at DESC",
                (uid, uid)
            )
            rec_rows = cur.fetchall()

            return {
                "my_lost_reports": [_item_to_out(dict(r)) for r in lost_rows],
                "my_found_reports": [_item_to_out(dict(r)) for r in found_rows],
                "my_matches": [_item_to_out(dict(r)) for r in match_rows],
                "recovered_history": [_item_to_out(dict(r)) for r in rec_rows],
            }
    finally:
        conn.close()


@app.get("/items/{item_id}", response_model=ItemOut)
def get_item_detail(item_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")
            return _item_to_out(dict(item))
    finally:
        conn.close()


# ==========================================
# Report Item Form (Lost & Found)
# ==========================================
@app.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item_report(
    req: ItemCreate,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Submit a new Lost or Found item report.
    - Valuable items → immediately escalate to department
    - Common-place found items → route to admin after 24h
    - Auto-match on same category from opposite report type
    """
    is_val = req.is_valuable
    if _is_valuable_category(req.category):
        is_val = True

    default_images = {
        "shoes":       "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
        "wallets":     "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80",
        "id cards":    "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80",
        "electronics": "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80",
        "bags":        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
        "keys":        "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
        "books":       "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
        "jewelry":     "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80",
        "others":      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
    }
    img_url = req.image_url or default_images.get(req.category.lower(), default_images["others"])
    date_str = req.incident_date or datetime.now().strftime("%Y-%m-%d")
    time_str = req.incident_time or datetime.now().strftime("%I:%M %p")
    initial_status = "Reported" if req.report_type == "lost" else "Found"

    # Determine escalation level & department assignment
    escalation_level = "user"
    assigned_dept_code = None
    assigned_dept_name = None
    assigned_office = None

    if req.report_type == "found" and is_val:
        # Valuable item found → immediate department escalation
        escalation_level = "department"
        initial_status = "Escalated to Department"
        detected_dept = _detect_department_from_location(req.location)
        if detected_dept:
            assigned_dept_code = detected_dept["code"]
            assigned_dept_name = detected_dept["name"]
        elif current_user.get("department_code"):
            assigned_dept_code = current_user["department_code"]
            assigned_dept_name = current_user["department"]
        else:
            assigned_dept_code = "CSE"
            assigned_dept_name = "Computer Science & Engineering"

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Insert report
            cur.execute("""
                INSERT INTO items (
                    user_id, report_type, title, category, description,
                    image_url, location, incident_date, incident_time,
                    is_valuable, status, reporter_name, reporter_role,
                    assigned_department, assigned_department_name, escalation_level,
                    assigned_office, escalation_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
            """, (
                current_user["id"], req.report_type.lower(), req.title.strip(),
                req.category, req.description.strip(), img_url,
                req.location, date_str, time_str,
                is_val, initial_status, current_user["name"], current_user["role"],
                assigned_dept_code, assigned_dept_name, escalation_level,
                assigned_office,
                datetime.now(timezone.utc) if is_val and req.report_type == "found" else None
            ))
            new_item = cur.fetchone()

            # Log escalation if immediate
            if escalation_level == "department":
                cur.execute("""
                    INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                    VALUES (%s, 'user', 'department', 'Valuable item — immediate department escalation', 'system');
                """, (new_item["id"],))

                # Notify reporter
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Valuable Item Escalated', %s, 'info', %s);
                """, (
                    current_user["id"],
                    f"Your found item '{new_item['title']}' has been escalated to the {assigned_dept_name} department for secure handling.",
                    new_item["id"]
                ))

            # Smart auto-match algorithm
            if escalation_level == "user":
                opp_type = "found" if req.report_type == "lost" else "lost"
                cur.execute("""
                    SELECT id, title, user_id FROM items
                    WHERE report_type = %s AND LOWER(category) = LOWER(%s)
                      AND status NOT IN ('Recovered', 'Escalated to Department', 'At Admin Office')
                    LIMIT 1;
                """, (opp_type, req.category))
                potential_match = cur.fetchone()

                if potential_match:
                    cur.execute("UPDATE items SET status = 'Matched' WHERE id IN (%s, %s);",
                                (new_item["id"], potential_match["id"]))
                    new_item = dict(new_item)
                    new_item["status"] = "Matched"

                    notif_msg = f"Potential match found between '{new_item['title']}' and '{potential_match['title']}'!"
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id)
                        VALUES (%s, 'Auto-Match Alert', %s, 'match', %s);
                    """, (current_user["id"], notif_msg, new_item["id"]))

                    if potential_match["user_id"]:
                        cur.execute("""
                            INSERT INTO notifications (user_id, title, message, type, item_id)
                            VALUES (%s, 'Auto-Match Alert', %s, 'match', %s);
                        """, (potential_match["user_id"], notif_msg, potential_match["id"]))

                    sys_chat = f"System Match: '{new_item['title']}' matched with '{potential_match['title']}'. Please verify identifying details before pickup."
                    cur.execute("""
                        INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                        VALUES (%s, 'Campus Match Bot', 'system', %s, TRUE);
                    """, (new_item["id"], sys_chat))

            conn.commit()
            d = dict(new_item)
            d["reporter_name"] = current_user["name"].split()[0]
            return ItemOut(**d)
    finally:
        conn.close()


# ==========================================
# Escalation Endpoints
# ==========================================
@app.post("/items/{item_id}/escalate-to-department")
def escalate_to_department(
    item_id: int,
    req: ItemEscalateRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Manually (or auto) escalate an item to a department.
    Called when: 24h passes with no match, or item is valuable.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            dept_code = req.target_department_code or current_user.get("department_code") or "CSE"
            dept_name = next(
                (d["name"] for d in KEC_DEPARTMENTS if d["code"] == dept_code),
                dept_code
            )

            cur.execute("""
                UPDATE items SET
                    escalation_level = 'department',
                    status = 'Escalated to Department',
                    assigned_department = %s,
                    assigned_department_name = %s,
                    escalation_at = NOW()
                WHERE id = %s;
            """, (dept_code, dept_name, item_id))

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, %s, 'department', %s, %s);
            """, (item_id, item["escalation_level"] or "user", req.reason or "No owner match within 24 hours", current_user["name"]))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Item Escalated to Department', %s, 'info', %s);
                """, (
                    item["user_id"],
                    f"Your report '{item['title']}' has been forwarded to the {dept_name} department.",
                    item_id
                ))

            conn.commit()
            return {"message": f"Item escalated to {dept_name} department", "department": dept_code}
    finally:
        conn.close()


@app.post("/items/{item_id}/escalate-to-admin")
def escalate_to_admin(
    item_id: int,
    req: ItemEscalateRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Escalate item to Admin Office.
    Triggered for: common-place items with no owner after 24h,
    or department items with no owner after 7 days.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            cur.execute("""
                UPDATE items SET
                    escalation_level = 'admin',
                    status = 'At Admin Office',
                    assigned_office = 'Central Lost & Found Office',
                    admin_received_at = NOW(),
                    escalation_at = NOW()
                WHERE id = %s;
            """, (item_id,))

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, %s, 'admin', %s, %s);
            """, (
                item_id,
                item["escalation_level"] or "department",
                req.reason or "No owner response — forwarded to Admin Office",
                current_user["name"]
            ))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Item at Admin Office', %s, 'info', %s);
                """, (
                    item["user_id"],
                    f"'{item['title']}' is now at the Central Lost & Found Office. Visit the Admin Office to collect it.",
                    item_id
                ))

            conn.commit()
            return {"message": "Item escalated to Admin Office", "office": "Central Lost & Found Office"}
    finally:
        conn.close()


# ==========================================
# Check & Auto-Escalate (24h Cron-style)
# ==========================================
@app.post("/system/auto-escalate")
def auto_escalate_items(current_user: dict = Depends(require_admin)):
    """
    Admin-triggered batch escalation check.
    - Found items with no match after 24h → escalate to department
    - Department items with no owner after 7 days → escalate to admin
    - Common-place found items with no match after 24h → escalate to admin
    """
    conn = get_db_connection()
    escalated = []
    try:
        with conn.cursor() as cur:
            threshold_24h = datetime.now(timezone.utc) - timedelta(hours=ESCALATION_HOURS)
            threshold_7d = datetime.now(timezone.utc) - timedelta(days=DEPT_ESCALATION_DAYS)

            # 1. Found items (user level, no match) after 24h
            cur.execute("""
                SELECT * FROM items
                WHERE report_type = 'found'
                  AND escalation_level = 'user'
                  AND status IN ('Found', 'Reported')
                  AND created_at < %s;
            """, (threshold_24h,))
            items_24h = cur.fetchall()

            for item in items_24h:
                loc = (item["location"] or "").strip()
                if _is_common_place(loc):
                    # Common place → admin
                    cur.execute("""
                        UPDATE items SET escalation_level='admin', status='At Admin Office',
                        assigned_office='Central Lost & Found Office', admin_received_at=NOW(), escalation_at=NOW()
                        WHERE id=%s;
                    """, (item["id"],))
                    cur.execute("""
                        INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                        VALUES (%s, 'user', 'admin', 'Common-place location, no owner after 24h', 'system');
                    """, (item["id"],))
                else:
                    # Dept area → detect dept from location or reporter's dept
                    dept_code = "CSE"
                    dept_name = "Computer Science & Engineering"
                    detected = _detect_department_from_location(loc)
                    if detected:
                        dept_code = detected["code"]
                        dept_name = detected["name"]
                    elif item.get("user_id"):
                        cur.execute("SELECT department_code, department FROM users WHERE id = %s", (item["user_id"],))
                        u = cur.fetchone()
                        if u and u.get("department_code"):
                            dept_code = u["department_code"]
                            dept_name = u["department"]
                    cur.execute("""
                        UPDATE items SET escalation_level='department', status='Escalated to Department',
                        assigned_department=%s, assigned_department_name=%s, escalation_at=NOW()
                        WHERE id=%s;
                    """, (dept_code, dept_name, item["id"]))
                    cur.execute("""
                        INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                        VALUES (%s, 'user', 'department', '24-hour limit reached: Control transferred to Department Office.', 'system');
                    """, (item["id"],))

                    # Message to finder in item chat
                    handover_msg = (
                        f"⚠️ 24-Hour Threshold Reached: Control of this item has been transferred to the {dept_name} ({dept_code}) Department Office. "
                        f"Dear finder, please hand over the physical product to the {dept_code} Department Office desk. "
                        f"The department desk will safely hold the item and verify the rightful owner upon pickup."
                    )
                    cur.execute("""
                        INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                        VALUES (%s, 'Department Desk Routing', 'system', %s, TRUE);
                    """, (item["id"], handover_msg))

                    # Notification to the finder
                    if item.get("user_id"):
                        cur.execute("""
                            INSERT INTO notifications (user_id, title, message, type, item_id)
                            VALUES (%s, %s, %s, 'escalation', %s);
                        """, (
                            item["user_id"],
                            f"Submit Item to {dept_code} Department Office",
                            f"Your found item '{item['title']}' reached the 24-hour holding limit. Please submit it at the {dept_name} Office Desk for safe custody and owner handover.",
                            item["id"]
                        ))

                escalated.append(item["id"])

            # 2. Department items with no owner after 7 days → admin
            cur.execute("""
                SELECT * FROM items
                WHERE escalation_level = 'department'
                  AND status IN ('Escalated to Department', 'With Department')
                  AND escalation_at < %s;
            """, (threshold_7d,))
            dept_items = cur.fetchall()

            for item in dept_items:
                cur.execute("""
                    UPDATE items SET escalation_level='admin', status='At Admin Office',
                    assigned_office='Central Lost & Found Office', admin_received_at=NOW()
                    WHERE id=%s;
                """, (item["id"],))
                cur.execute("""
                    INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                    VALUES (%s, 'department', 'admin', 'Unclaimed at department after 7 days — forwarded to Central Admin Office', 'system');
                """, (item["id"],))

                admin_msg = (
                    f"🏢 Forwarded to Central Super Admin Office: After 7 days at department level, "
                    f"custody and final disposition have been transferred to Central Lost & Found Office."
                )
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Central Admin Routing', 'system', %s, TRUE);
                """, (item["id"], admin_msg))

                if item.get("user_id"):
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id)
                        VALUES (%s, 'Item at Central Admin Office', %s, 'escalation', %s);
                    """, (
                        item["user_id"],
                        f"'{item['title']}' has been forwarded to the Central Lost & Found (Super Admin) Office.",
                        item["id"]
                    ))

                escalated.append(item["id"])

            conn.commit()
            return {"escalated_item_ids": escalated, "total": len(escalated)}
    finally:
        conn.close()


# ==========================================
# Department Admin Endpoints
# ==========================================
@app.get("/department/items")
def get_department_items(
    status_filter: Optional[str] = Query(None, alias="status"),
    report_type: Optional[str] = Query(None),
    current_user: dict = Depends(require_department_admin)
):
    """Department admin sees all items progressing in their department."""
    dept_code = current_user.get("department_code")
    if not dept_code and current_user["role"] != "admin":
        raise HTTPException(status_code=400, detail="Department not assigned to your account")

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM items WHERE 1=1"
            params = []

            if current_user["role"] == "department_admin" and dept_code:
                query += " AND (assigned_department = %s OR UPPER(assigned_department) = UPPER(%s))"
                params.extend([dept_code, dept_code])
            elif current_user["role"] == "admin":
                query += " AND escalation_level IN ('department', 'admin')"

            if report_type and report_type.lower() != "all":
                query += " AND LOWER(report_type) = LOWER(%s)"
                params.append(report_type)

            if status_filter and status_filter.lower() != "all":
                query += " AND LOWER(status) = LOWER(%s)"
                params.append(status_filter)

            query += " ORDER BY escalation_at DESC NULLS LAST, created_at DESC"
            cur.execute(query, tuple(params))
            items = cur.fetchall()
            return [dict(it) for it in items]
    finally:
        conn.close()


@app.get("/department/stats")
def get_department_stats(current_user: dict = Depends(require_department_admin)):
    """Department stats summary for dashboard header."""
    dept_code = current_user.get("department_code")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            base = "SELECT COUNT(*) as cnt FROM items WHERE (assigned_department = %s OR UPPER(assigned_department) = UPPER(%s))"
            stats = {}

            for label, condition in [
                ("total",      ""),
                ("pending",    " AND status = 'Escalated to Department'"),
                ("with_dept",  " AND status = 'With Department'"),
                ("verified",   " AND status = 'Verified by Department'"),
                ("recovered",  " AND status = 'Recovered'"),
                ("valuable",   " AND is_valuable = TRUE"),
                ("lost",       " AND report_type = 'lost'"),
                ("at_admin",   " AND escalation_level = 'admin'"),
            ]:
                cur.execute(base + condition, (dept_code, dept_code))
                stats[label] = cur.fetchone()["cnt"]

            return stats
    finally:
        conn.close()


@app.post("/department/items/{item_id}/verify")
def department_verify_item(
    item_id: int,
    req: ItemHandoverRequest,
    current_user: dict = Depends(require_department_admin)
):
    """
    Department delivers item to the owner student who comes to the office.
    Collects owner name, roll number, phone number, date, and staff handover by.
    (Owner ID card image is NOT required for department desk handover).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            if (current_user["role"] == "department_admin" and
                    item["assigned_department"] != current_user.get("department_code")):
                raise HTTPException(status_code=403, detail="This item is not assigned to your department")

            staff_name = req.handover_by or current_user["name"]

            cur.execute("""
                UPDATE items SET
                    status = 'Recovered',
                    handover_at = NOW(),
                    handover_by = %s,
                    owner_name = %s,
                    owner_roll_no = %s,
                    owner_phone = %s,
                    owner_id_card_image = %s,
                    handover_notes = %s
                WHERE id = %s;
            """, (
                staff_name,
                req.owner_name.strip(),
                req.owner_roll_no.strip(),
                req.owner_phone.strip(),
                req.owner_id_card_image,
                req.notes,
                item_id
            ))

            # Chat message confirming handover
            log_msg = (
                f"✅ Department Handover Complete: Handed over to owner {req.owner_name} "
                f"(Roll No: {req.owner_roll_no}, Phone: {req.owner_phone}). "
                f"Verified & delivered by {staff_name}."
            )
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Department Desk', 'department_admin', %s, TRUE);
            """, (item_id, log_msg))

            # Notify original reporter
            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Item Recovered!', %s, 'recovery', %s);
                """, (
                    item["user_id"],
                    f"'{item['title']}' has been delivered to owner {req.owner_name} by the {item['assigned_department_name'] or 'Department'} Office.",
                    item_id
                ))

            conn.commit()
            return {
                "message": "Item successfully delivered to owner and marked Recovered",
                "owner_name": req.owner_name,
                "owner_roll_no": req.owner_roll_no,
                "handover_by": staff_name
            }
    finally:
        conn.close()


@app.post("/department/items/{item_id}/receive")
def department_receive_item(
    item_id: int,
    current_user: dict = Depends(require_department_admin)
):
    """Department confirms physical receipt of item from student finder."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            cur.execute("""
                UPDATE items SET
                    status = 'With Department',
                    dept_received_at = NOW()
                WHERE id = %s;
            """, (item_id,))

            msg_text = (
                f"📦 Physical Item Received: The {item['assigned_department_name'] or 'Department'} Office has received "
                f"physical custody of '{item['title']}'. Stored safely at Department Desk for owner pickup."
            )
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Department Desk', 'department_admin', %s, TRUE);
            """, (item_id, msg_text))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Department Desk Received Item', %s, 'info', %s);
                """, (
                    item["user_id"],
                    f"Department desk confirmed physical custody of '{item['title']}'. Thank you for your cooperation!",
                    item_id
                ))

            conn.commit()
            return {"message": "Item marked as received into Department custody"}
    finally:
        conn.close()


@app.post("/department/items/{item_id}/escalate-to-admin")
def department_escalate_to_super_admin(
    item_id: int,
    req: ItemEscalateRequest,
    current_user: dict = Depends(require_department_admin)
):
    """
    Department desk forwards the item process to Super Admin.
    Control and custody move to Super Admin Office to handle thereafter.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            cur.execute("""
                UPDATE items SET
                    escalation_level = 'admin',
                    status = 'At Admin Office',
                    assigned_office = 'Central Lost & Found Office',
                    admin_received_at = NOW(),
                    escalation_at = NOW()
                WHERE id = %s;
            """, (item_id,))

            reason = req.reason or "Department desk forwarded item to Central Super Admin Office for final handling"
            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, 'department', 'admin', %s, %s);
            """, (item_id, reason, current_user["name"]))

            transfer_msg = (
                f"🏢 Forwarded to Super Admin: The {item['assigned_department_name'] or 'Department'} desk has submitted "
                f"this item to the Central Lost & Found Office. Super Admin Office will manage all subsequent custody, "
                f"claim verification, and owner handover."
            )
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Department Desk Transfer', 'system', %s, TRUE);
            """, (item_id, transfer_msg))

            # Notify Super Admins
            cur.execute("SELECT id FROM users WHERE role = 'admin'")
            admin_users = cur.fetchall()
            for adm in admin_users:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'New Item Submitted by Department', %s, 'escalation', %s);
                """, (
                    adm["id"],
                    f"'{item['title']}' forwarded from {item['assigned_department']} desk by {current_user['name']}.",
                    item_id
                ))

            conn.commit()
            return {"message": "Item forwarded to Super Admin Office successfully", "office": "Central Lost & Found Office"}
    finally:
        conn.close()


# ==========================================
# Admin Analytics & Office Endpoints
# ==========================================
@app.get("/admin/items")
def get_admin_items(
    status_filter: Optional[str] = Query(None, alias="status"),
    scope: Optional[str] = Query("admin"),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin)
):
    """Admin sees items: either admin office custody (scope='admin') or campus-wide (scope='all')."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM items WHERE 1=1"
            params = []
            if scope == "admin":
                query += " AND escalation_level = 'admin'"
            elif scope == "department":
                query += " AND escalation_level = 'department'"
            elif scope == "user":
                query += " AND escalation_level = 'user'"

            if department:
                query += " AND (UPPER(assigned_department) = UPPER(%s) OR UPPER(assigned_department_name) = UPPER(%s))"
                params.extend([department, department])

            if status_filter:
                query += " AND LOWER(status) = LOWER(%s)"
                params.append(status_filter)

            query += " ORDER BY admin_received_at DESC NULLS LAST, created_at DESC"
            cur.execute(query, tuple(params))
            items = cur.fetchall()
            return [dict(it) for it in items]
    finally:
        conn.close()


@app.post("/admin/items/{item_id}/close")
def admin_close_item(
    item_id: int,
    req: ItemHandoverRequest,
    current_user: dict = Depends(require_admin)
):
    """
    Admin marks item as delivered to owner from Central Admin Office.
    Collects owner name, roll number, phone number, date, and admin staff name.
    (Owner ID card image is NOT required for admin office handover).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            admin_name = req.handover_by or current_user["name"]

            cur.execute("""
                UPDATE items SET
                    status = 'Recovered',
                    handover_at = NOW(),
                    handover_by = %s,
                    owner_name = %s,
                    owner_roll_no = %s,
                    owner_phone = %s,
                    owner_id_card_image = %s,
                    handover_notes = %s
                WHERE id = %s;
            """, (
                admin_name,
                req.owner_name.strip(),
                req.owner_roll_no.strip(),
                req.owner_phone.strip(),
                req.owner_id_card_image,
                req.notes,
                item_id
            ))

            log_msg = (
                f"✅ Central Admin Office Handover Complete: Delivered to owner {req.owner_name} "
                f"(Roll No: {req.owner_roll_no}, Phone: {req.owner_phone}). "
                f"Verified & handed over by {admin_name}."
            )
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Central Admin Office', 'admin', %s, TRUE);
            """, (item_id, log_msg))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Item Recovered at Admin Office!', %s, 'recovery', %s);
                """, (
                    item["user_id"],
                    f"'{item['title']}' has been delivered to owner {req.owner_name} from the Central Lost & Found Office.",
                    item_id
                ))

            conn.commit()
            return {
                "message": "Item successfully delivered to owner from Admin Office",
                "owner_name": req.owner_name,
                "owner_roll_no": req.owner_roll_no,
                "handover_by": admin_name
            }
    finally:
        conn.close()


@app.post("/items/{item_id}/deliver-to-owner")
def deliver_item_to_owner(
    item_id: int,
    req: ItemHandoverRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Direct student-to-student handover:
    Finder student gives the found product directly to the owner student.
    MANDATORY: Requires owner_name, owner_roll_no, owner_phone, AND owner_id_card_image!
    """
    if not req.owner_id_card_image or not req.owner_id_card_image.strip():
        raise HTTPException(
            status_code=400,
            detail="Item owner ID card image is required for student-to-student direct handover confirmation."
        )

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            # Must be the finder (or staff)
            if item["user_id"] != current_user["id"] and current_user["role"] not in ("admin", "department_admin"):
                raise HTTPException(status_code=403, detail="Only the finder or staff can finalize direct delivery")

            finder_name = current_user["name"]

            cur.execute("""
                UPDATE items SET
                    status = 'Recovered',
                    handover_at = NOW(),
                    handover_by = %s,
                    owner_name = %s,
                    owner_roll_no = %s,
                    owner_phone = %s,
                    owner_id_card_image = %s,
                    handover_notes = %s
                WHERE id = %s;
            """, (
                finder_name,
                req.owner_name.strip(),
                req.owner_roll_no.strip(),
                req.owner_phone.strip(),
                req.owner_id_card_image.strip(),
                req.notes,
                item_id
            ))

            log_msg = (
                f"🤝 Student Direct Handover Completed: Delivered directly to owner {req.owner_name} "
                f"(Roll No: {req.owner_roll_no}, Phone: {req.owner_phone}). "
                f"ID Card verified by finder {finder_name}."
            )
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Direct Student Delivery', 'system', %s, TRUE);
            """, (item_id, log_msg))

            conn.commit()
            return {
                "message": "Student direct handover verified and recorded as Recovered",
                "owner_name": req.owner_name,
                "owner_roll_no": req.owner_roll_no,
                "verified_by": finder_name
            }
    finally:
        conn.close()


@app.delete("/admin/items/{item_id}")
def admin_delete_item(
    item_id: int,
    current_user: dict = Depends(require_admin)
):
    """Admin deletes an invalid/duplicate item report and cascades related records."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            cur.execute("DELETE FROM claims WHERE item_id = %s", (item_id,))
            cur.execute("DELETE FROM messages WHERE item_id = %s", (item_id,))
            cur.execute("DELETE FROM notifications WHERE item_id = %s", (item_id,))
            cur.execute("DELETE FROM escalation_history WHERE item_id = %s", (item_id,))
            cur.execute("DELETE FROM items WHERE id = %s", (item_id,))
            conn.commit()
            return {"message": f"Item #{item_id} ('{item['title']}') successfully deleted"}
    finally:
        conn.close()


@app.get("/admin/analytics")
def get_admin_analytics(current_user: dict = Depends(require_admin)):
    """Full analytics for admin dashboard."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Totals
            cur.execute("SELECT COUNT(*) as cnt FROM items")
            total = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE report_type = 'found'")
            total_found = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE report_type = 'lost'")
            total_lost = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE status = 'Recovered'")
            total_recovered = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE escalation_level = 'department'")
            total_dept = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE escalation_level = 'admin'")
            total_admin = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE is_valuable = TRUE")
            total_valuable = cur.fetchone()["cnt"]

            recovery_rate = round((total_recovered / total * 100) if total > 0 else 0, 1)

            # By department
            by_dept = []
            for dept in KEC_DEPARTMENTS:
                code = dept["code"]
                cur.execute("SELECT COUNT(*) as cnt FROM items WHERE assigned_department = %s", (code,))
                dept_total = cur.fetchone()["cnt"]
                if dept_total == 0:
                    continue
                cur.execute("SELECT COUNT(*) as cnt FROM items WHERE assigned_department = %s AND status NOT IN ('Recovered')", (code,))
                dept_pending = cur.fetchone()["cnt"]
                cur.execute("SELECT COUNT(*) as cnt FROM items WHERE assigned_department = %s AND status = 'Recovered'", (code,))
                dept_rec = cur.fetchone()["cnt"]
                cur.execute("SELECT COUNT(*) as cnt FROM items WHERE assigned_department = %s AND escalation_level = 'admin'", (code,))
                dept_admin = cur.fetchone()["cnt"]
                by_dept.append(DeptStats(
                    department_code=code,
                    department_name=dept["name"],
                    total=dept_total,
                    pending=dept_pending,
                    recovered=dept_rec,
                    at_admin=dept_admin
                ))

            # By category
            cur.execute("""
                SELECT category, COUNT(*) as cnt
                FROM items GROUP BY category ORDER BY cnt DESC LIMIT 10;
            """)
            by_category = [{"category": r["category"], "count": r["cnt"]} for r in cur.fetchall()]

            # By status
            cur.execute("""
                SELECT status, COUNT(*) as cnt FROM items GROUP BY status ORDER BY cnt DESC;
            """)
            by_status = [{"status": r["status"], "count": r["cnt"]} for r in cur.fetchall()]

            # Recent escalations
            cur.execute("""
                SELECT eh.*, i.title as item_title FROM escalation_history eh
                JOIN items i ON eh.item_id = i.id
                ORDER BY eh.created_at DESC LIMIT 10;
            """)
            recent_escalations = [dict(r) for r in cur.fetchall()]

            return AdminAnalyticsOut(
                total_items=total,
                total_found=total_found,
                total_lost=total_lost,
                total_recovered=total_recovered,
                total_at_departments=total_dept,
                total_at_admin=total_admin,
                total_valuable=total_valuable,
                recovery_rate=recovery_rate,
                by_department=by_dept,
                by_category=by_category,
                by_status=by_status,
                recent_escalations=[
                    {**r, "created_at": r["created_at"].isoformat() if hasattr(r.get("created_at"), "isoformat") else str(r.get("created_at"))}
                    for r in recent_escalations
                ]
            )
    finally:
        conn.close()


# ==========================================
# Chat & Messaging
# ==========================================
@app.get("/items/{item_id}/messages", response_model=List[MessageOut])
def get_item_messages(item_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM messages WHERE item_id = %s ORDER BY created_at ASC", (item_id,))
            messages = cur.fetchall()

            if not messages:
                cur.execute("SELECT title FROM items WHERE id = %s", (item_id,))
                item = cur.fetchone()
                item_title = item["title"] if item else "Item"
                welcome_text = f"You've been connected on '{item_title}'! Please confirm identifying details before arranging pickup."
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Campus Match Desk', 'system', %s, TRUE)
                    RETURNING *;
                """, (item_id, welcome_text))
                first_msg = cur.fetchone()
                conn.commit()
                messages = [first_msg]

            return [MessageOut(**dict(m)) for m in messages]
    finally:
        conn.close()


@app.post("/items/{item_id}/messages", response_model=MessageOut)
def send_item_message(
    item_id: int,
    req: MessageCreate,
    current_user: dict = Depends(get_current_user_from_token)
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO messages (item_id, sender_id, sender_name, sender_role, message, is_system)
                VALUES (%s, %s, %s, %s, %s, FALSE)
                RETURNING *;
            """, (item_id, current_user["id"], current_user["name"], current_user["role"], req.message.strip()))
            msg = cur.fetchone()
            conn.commit()
            return MessageOut(**dict(msg))
    finally:
        conn.close()


# ==========================================
# Ownership Verification (Claims)
# ==========================================
@app.post("/items/{item_id}/claim", response_model=ClaimOut)
def submit_claim(
    item_id: int,
    req: ClaimCreate,
    current_user: dict = Depends(get_current_user_from_token)
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title, user_id, is_valuable FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            cur.execute("""
                INSERT INTO claims (item_id, claimant_id, claimant_name, claimant_role, hidden_details, status)
                VALUES (%s, %s, %s, %s, %s, 'pending')
                RETURNING *;
            """, (item_id, current_user["id"], current_user["name"], current_user["role"], req.hidden_details.strip()))
            claim = cur.fetchone()

            cur.execute("UPDATE items SET status = 'Under Verification' WHERE id = %s;", (item_id,))

            sys_msg = f"Verification claim submitted by {current_user['name'].split()[0]} ({current_user['role']}). Awaiting confirmation of hidden details."
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Verification Desk', 'system', %s, TRUE);
            """, (item_id, sys_msg))

            cur.execute("""
                INSERT INTO notifications (user_id, title, message, type, item_id)
                VALUES (%s, 'Claim Submitted', 'Your ownership verification claim is under review.', 'claim', %s);
            """, (current_user["id"], item_id))

            conn.commit()
            return ClaimOut(**dict(claim))
    finally:
        conn.close()


@app.post("/claims/{claim_id}/verify")
def verify_claim(
    claim_id: int,
    req: ClaimVerifyRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT c.*, i.title, i.id as item_id FROM claims c JOIN items i ON c.item_id = i.id WHERE c.id = %s",
                (claim_id,)
            )
            claim = cur.fetchone()
            if not claim:
                raise HTTPException(status_code=404, detail="Claim not found")

            new_status = "approved" if req.approved else "rejected"
            cur.execute("UPDATE claims SET status = %s WHERE id = %s", (new_status, claim_id))

            if req.approved:
                cur.execute("UPDATE items SET status = 'Recovered', handover_at = NOW() WHERE id = %s", (claim["item_id"],))
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Verification Desk', 'system', '🎉 Ownership Confirmed! This item has been verified and marked as RECOVERED.', TRUE);
                """, (claim["item_id"],))

                if claim["claimant_id"]:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id)
                        VALUES (%s, 'Item Recovered!', %s, 'claim', %s);
                    """, (
                        claim["claimant_id"],
                        f"Your claim for '{claim['title']}' was approved. Item officially recovered!",
                        claim["item_id"]
                    ))

            conn.commit()
            return {
                "message": f"Claim {new_status} successfully.",
                "item_status": "Recovered" if req.approved else "Under Verification"
            }
    finally:
        conn.close()


@app.get("/items/{item_id}/claims", response_model=List[ClaimOut])
def get_item_claims(
    item_id: int,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Retrieve claims for an item (item reporter, department admin, or admin)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            is_reporter = (item["user_id"] == current_user["id"])
            is_staff = current_user["role"] in ("admin", "department_admin")
            if not (is_reporter or is_staff):
                raise HTTPException(status_code=403, detail="Not authorized to view claims for this item")

            cur.execute("SELECT * FROM claims WHERE item_id = %s ORDER BY created_at DESC", (item_id,))
            claims = cur.fetchall()
            return [ClaimOut(**dict(c)) for c in claims]
    finally:
        conn.close()


@app.get("/claims", response_model=List[ClaimOut])
def list_claims(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user_from_token)
):
    """List claims (Admin or Department Admin)."""
    if current_user["role"] not in ("admin", "department_admin"):
        raise HTTPException(status_code=403, detail="Staff access required")

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT c.* FROM claims c JOIN items i ON c.item_id = i.id WHERE 1=1"
            params = []
            if current_user["role"] == "department_admin" and current_user.get("department_code"):
                query += " AND (i.assigned_department = %s OR UPPER(i.assigned_department) = UPPER(%s))"
                params.extend([current_user["department_code"], current_user["department_code"]])

            if status_filter:
                query += " AND LOWER(c.status) = LOWER(%s)"
                params.append(status_filter)

            query += " ORDER BY c.created_at DESC"
            cur.execute(query, tuple(params))
            claims = cur.fetchall()
            return [ClaimOut(**dict(c)) for c in claims]
    finally:
        conn.close()


# ==========================================
# Gemini Vision AI
# ==========================================
@app.post("/gemini/analyze-image", response_model=GeminiAnalysisOut)
async def analyze_image(req: GeminiAnalysisRequest):
    """Analyze an uploaded item image with Gemini Vision to auto-fill report fields."""
    result = await analyze_item_image(
        image_url=req.image_url,
        image_base64=req.image_base64
    )
    return GeminiAnalysisOut(
        title=result.get("title", "Unknown Item"),
        category=result.get("category", "others"),
        description=result.get("description", ""),
        is_valuable=result.get("is_valuable", False),
        confidence=result.get("confidence", 0.0),
        tags=result.get("tags", [])
    )


# ==========================================
# Notifications
# ==========================================
@app.get("/notifications", response_model=List[NotificationOut])
def get_notifications(current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM notifications
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 20;
            """, (current_user["id"],))
            notifs = cur.fetchall()

            if not notifs:
                init_notifs = [
                    (current_user["id"], "Welcome to Campus Lost & Found", "Browse the feed or report items you've lost or found around campus.", "info", None),
                    (current_user["id"], "Valuable Items Protection", "High value items (Electronics, Jewelry, Wallets) are secured by the Department office.", "info", None),
                ]
                for n in init_notifs:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING *;
                    """, n)
                conn.commit()
                cur.execute("SELECT * FROM notifications WHERE user_id = %s ORDER BY created_at DESC", (current_user["id"],))
                notifs = cur.fetchall()

            return [NotificationOut(**dict(n)) for n in notifs]
    finally:
        conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
