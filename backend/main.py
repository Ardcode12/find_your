import os
import json
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()


from fastapi import Depends, FastAPI, HTTPException, Header, Query, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from database import (
    get_db_connection, init_db,
    COMMON_PLACE_LOCATIONS, VALUABLE_CATEGORIES, KEC_DEPARTMENTS
)
from auth import create_access_token, decode_access_token, hash_password, verify_password
from schemas import (
    ActivityStatsOut,
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
    ItemCreateResponse,
    ItemEscalateRequest,
    ItemHandoverRequest,
    ItemOut,
    ItemUpdate,
    LoginRequest,
    MatchOut,
    MessageCreate,
    MessageOut,
    NotificationOut,
    PasswordChangeRequest,
    PhotoAnalysisRequest,
    PhotoAnalysisResponse,
    SignupRequest,
    UserOut,
    UserStatsOut,
    UserUpdate,
    VoiceTranscribeRequest,
    VoiceTranscribeOut,
)
from gemini_vision import analyze_item_image
from whisper_service import transcribe_audio_bytes


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
    description="Backend for Kongu Campus Lost and Found system — Department & Admin Portals, Mobile Hub, OpenCLIP ViT-H/14 Visual AI",
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
            cur.execute("""
                SELECT id, name, email, role, department, department_code, phone, phone_number,
                       contact_preference, notify_matches, notify_claims, notify_messages, notify_email,
                       avatar_url, is_suspended, created_at
                FROM users WHERE email = %s
            """, (email,))
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
            cur.execute("""
                SELECT id, name, email, role, department, department_code, phone, phone_number,
                       contact_preference, notify_matches, notify_claims, notify_messages, notify_email,
                       avatar_url, is_suspended, created_at
                FROM users WHERE email = %s
            """, (email,))
            return cur.fetchone()
    except Exception:
        return None
    finally:
        conn.close()


def _is_common_place(location: str) -> bool:
    loc_lower = location.lower()
    return any(cp in loc_lower for cp in COMMON_PLACE_LOCATIONS)


def _detect_department_from_location(location: str) -> Optional[dict]:
    loc_upper = location.upper()
    for dept in KEC_DEPARTMENTS:
        if dept["code"] in loc_upper or dept["name"].upper() in loc_upper:
            return dept
    return None


def _is_valuable_category(category: str) -> bool:
    return category.lower() in VALUABLE_CATEGORIES


def _item_to_out(item: dict) -> ItemOut:
    d = dict(item)
    if d.get("reporter_name"):
        d["reporter_name"] = d["reporter_name"].split()[0]
    filtered = {k: v for k, v in d.items() if k in ItemOut.model_fields}
    return ItemOut(**filtered)


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
                INSERT INTO users (name, email, password, role, department, department_code, phone, phone_number)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, email, role, department, department_code, phone, phone_number,
                          contact_preference, notify_matches, notify_claims, notify_messages, notify_email,
                          avatar_url, is_suspended, created_at;
                """,
                (
                    req.name.strip(), clean_email, hashed_pwd, req.role.value,
                    req.department, req.department_code, req.phone, req.phone
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
            filtered_user = {k: v for k, v in new_user.items() if k in UserOut.model_fields}
            return AuthResponse(
                message="User registered successfully",
                access_token=token,
                token_type="bearer",
                user=UserOut(**filtered_user)
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
                """
                SELECT id, name, email, password, role, department, department_code, phone, phone_number,
                       contact_preference, notify_matches, notify_claims, notify_messages, notify_email,
                       avatar_url, is_suspended, created_at
                FROM users WHERE email = %s
                """,
                (clean_email,)
            )
            user_row = cur.fetchone()
            if not user_row or not verify_password(req.password, user_row["password"]):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

            if user_row.get("is_suspended"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended. Contact administration.")

            token = create_access_token({
                "sub": user_row["email"],
                "id": user_row["id"],
                "role": user_row["role"],
                "name": user_row["name"]
            })
            filtered_user = {k: v for k, v in user_row.items() if k in UserOut.model_fields}
            user_out = UserOut(**filtered_user)
            return AuthResponse(
                message="Login successful",
                access_token=token,
                token_type="bearer",
                user=user_out
            )
    finally:
        conn.close()


@app.get("/auth/me", response_model=UserOut)
def get_auth_me(current_user: dict = Depends(get_current_user_from_token)):
    filtered_user = {k: v for k, v in current_user.items() if k in UserOut.model_fields}
    return UserOut(**filtered_user)


# ==========================================
# Department Management Endpoints
# ==========================================
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


@app.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(req: DepartmentCreate, current_user: dict = Depends(require_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM departments WHERE code = %s", (req.code.upper(),))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Department code '{req.code.upper()}' already exists")

            cur.execute("""
                INSERT INTO departments (code, name, office_location, hod_email)
                VALUES (%s, %s, %s, %s)
                RETURNING *;
            """, (req.code.upper().strip(), req.name.strip(), req.office_location, req.hod_email))
            dept = cur.fetchone()
            conn.commit()
            return DepartmentOut(**dict(dept))
    finally:
        conn.close()


@app.put("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: int, req: DepartmentUpdate, current_user: dict = Depends(require_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM departments WHERE id = %s", (dept_id,))
            dept = cur.fetchone()
            if not dept:
                raise HTTPException(status_code=404, detail="Department not found")

            name = req.name if req.name is not None else dept["name"]
            loc = req.office_location if req.office_location is not None else dept["office_location"]
            email = req.hod_email if req.hod_email is not None else dept["hod_email"]

            cur.execute("""
                UPDATE departments SET name = %s, office_location = %s, hod_email = %s
                WHERE id = %s
                RETURNING *;
            """, (name, loc, email, dept_id))
            updated = cur.fetchone()
            conn.commit()
            return DepartmentOut(**dict(updated))
    finally:
        conn.close()


@app.delete("/departments/{dept_id}")
def delete_department(dept_id: int, current_user: dict = Depends(require_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT code FROM departments WHERE id = %s", (dept_id,))
            dept = cur.fetchone()
            if not dept:
                raise HTTPException(status_code=404, detail="Department not found")

            cur.execute("SELECT COUNT(*) as count FROM items WHERE assigned_department = %s", (dept["code"],))
            row = cur.fetchone()
            if row and row["count"] > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete department {dept['code']}: {row['count']} items are currently assigned to it."
                )

            cur.execute("DELETE FROM departments WHERE id = %s", (dept_id,))
            conn.commit()
            return {"message": f"Department {dept['code']} deleted successfully."}
    finally:
        conn.close()


# ==========================================
# Categories & Home Stats
# ==========================================
@app.get("/categories")
def get_categories(authorization: Optional[str] = Header(None)):
    user_role = "guest"
    user_name = "Guest User"
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            user_role = payload.get("role", "student")
            user_name = payload.get("name", "Student")

    cat_counts = {}
    total_count = 0
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT category, COUNT(*) as cnt
                FROM items
                WHERE withdrawn = FALSE AND status != 'Recovered'
                GROUP BY category;
            """)
            for row in cur.fetchall():
                cat_counts[row["category"].lower()] = row["cnt"]
                total_count += row["cnt"]
    except Exception:
        pass
    finally:
        conn.close()

    categories = [
        {"id": "all",         "title": "All",         "count": total_count, "icon": "tag",             "priority": True},
        {"id": "id_cards",    "title": "ID Cards",    "count": cat_counts.get("id cards", 0), "icon": "id-card",         "priority": True},
        {"id": "wallets",     "title": "Wallets",     "count": cat_counts.get("wallets", 0),  "icon": "wallet",          "priority": True},
        {"id": "keys",        "title": "Keys",        "count": cat_counts.get("keys", 0),     "icon": "key",             "priority": False},
        {"id": "electronics", "title": "Electronics", "count": cat_counts.get("electronics", 0), "icon": "laptop",       "priority": True},
        {"id": "bags",        "title": "Bags",        "count": cat_counts.get("bags", 0),     "icon": "briefcase",       "priority": False},
        {"id": "shoes",       "title": "Shoes",       "count": cat_counts.get("shoes", cat_counts.get("shoese", 0)), "icon": "shoe", "priority": False},
        {"id": "books",       "title": "Books",       "count": cat_counts.get("books", 0),    "icon": "book",            "priority": False},
        {"id": "jewelry",     "title": "Jewelry",     "count": cat_counts.get("jewelry", 0),  "icon": "gem",             "priority": True},
        {"id": "others",      "title": "Others",      "count": cat_counts.get("others", 0),   "icon": "more-horizontal", "priority": False},
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


@app.get("/home-stats")
def get_home_stats():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE report_type = 'found' AND withdrawn = FALSE AND status != 'Recovered';")
            found_count = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE report_type = 'lost' AND withdrawn = FALSE AND status != 'Recovered';")
            lost_count = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE status = 'Recovered' AND withdrawn = FALSE;")
            recovered_count = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM matches WHERE stage != 'recovered';")
            matched_count = cur.fetchone()["cnt"]

            return {
                "found_items": found_count,
                "lost_reports": lost_count,
                "recovered": recovered_count,
                "matched": matched_count
            }
    finally:
        conn.close()


# ==========================================
# Specific Items Endpoints
# ==========================================
@app.post("/items/analyze-photo", response_model=PhotoAnalysisResponse)
def analyze_photo(req: PhotoAnalysisRequest):
    url_lower = req.image_url.lower()

    if any(k in url_lower for k in ["sneaker", "shoe", "boot", "sandals", "nike", "adidas", "puma", "footwear"]):
        return PhotoAnalysisResponse(
            suggested_name="Clean Campus Sneakers",
            suggested_category="Shoes",
            suggested_description="Sports sneakers with rubber sole. Spotted near campus grounds.",
            is_valuable=False
        )
    elif any(k in url_lower for k in ["wallet", "purse", "leather", "bifold", "cardholder", "fossil"]):
        return PhotoAnalysisResponse(
            suggested_name="Leather Bi-Fold Wallet",
            suggested_category="Wallets",
            suggested_description="Black/brown leather wallet with cards and cash compartment.",
            is_valuable=True
        )
    elif any(k in url_lower for k in ["id", "badge", "lanyard", "smartcard", "smart-card", "card"]):
        return PhotoAnalysisResponse(
            suggested_name="Kongu Student Smart ID Card",
            suggested_category="ID Cards",
            suggested_description="Official Kongu Engineering College ID badge with department lanyard.",
            is_valuable=True
        )
    elif any(k in url_lower for k in ["airpod", "earbud", "laptop", "macbook", "phone", "iphone", "watch", "charger", "headphone"]):
        return PhotoAnalysisResponse(
            suggested_name="Wireless Electronic Device",
            suggested_category="Electronics",
            suggested_description="Personal electronics device in protective casing.",
            is_valuable=True
        )
    elif any(k in url_lower for k in ["key", "bike", "ring", "keychain", "keys"]):
        return PhotoAnalysisResponse(
            suggested_name="Key Ring with Vehicle Key",
            suggested_category="Keys",
            suggested_description="Set of silver keys attached to campus bike ring.",
            is_valuable=False
        )
    elif any(k in url_lower for k in ["bag", "tote", "backpack", "pouch", "luggage", "rucksack"]):
        return PhotoAnalysisResponse(
            suggested_name="Canvas / Leather Campus Bag",
            suggested_category="Bags",
            suggested_description="Zippered carry bag with shoulder strap and side compartment.",
            is_valuable=True
        )
    elif any(k in url_lower for k in ["book", "notebook", "notes", "binder"]):
        return PhotoAnalysisResponse(
            suggested_name="Course Textbook / Study Notes",
            suggested_category="Books",
            suggested_description="Academic engineering syllabus textbook with handwritten notes.",
            is_valuable=False
        )
    else:
        return PhotoAnalysisResponse(
            suggested_name="Campus Personal Item",
            suggested_category="Others",
            suggested_description="Found belongings on campus. Has distinct marks for verification.",
            is_valuable=False
        )


@app.get("/items/my-activity", response_model=ActivitySummary)
def get_my_activity(current_user: dict = Depends(get_current_user_from_token)):
    uid = current_user["id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT i.*, 
                       (SELECT COUNT(*) FROM matches m WHERE m.lost_item_id = i.id) as matches_count
                FROM items i
                WHERE i.user_id = %s AND i.report_type = 'lost' AND i.withdrawn = FALSE
                ORDER BY i.created_at DESC;
            """, (uid,))
            lost_rows = cur.fetchall()

            cur.execute("""
                SELECT i.*,
                       (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id) as claims_count
                FROM items i
                WHERE i.user_id = %s AND i.report_type = 'found' AND i.withdrawn = FALSE
                ORDER BY i.created_at DESC;
            """, (uid,))
            found_rows = cur.fetchall()

            cur.execute("""
                SELECT m.id, m.similarity_score, m.stage, m.created_at,
                       l.id as l_id, l.title as l_title, l.category as l_category, l.description as l_description,
                       l.image_url as l_image_url, l.location as l_location, l.incident_date as l_incident_date,
                       l.incident_time as l_incident_time, l.is_valuable as l_is_valuable, l.status as l_status,
                       l.reporter_name as l_reporter_name, l.reporter_role as l_reporter_role, l.created_at as l_created_at,
                       f.id as f_id, f.title as f_title, f.category as f_category, f.description as f_description,
                       f.image_url as f_image_url, f.location as f_location, f.incident_date as f_incident_date,
                       f.incident_time as f_incident_time, f.is_valuable as f_is_valuable, f.status as f_status,
                       f.reporter_name as f_reporter_name, f.reporter_role as f_reporter_role, f.created_at as f_created_at
                FROM matches m
                JOIN items l ON m.lost_item_id = l.id
                JOIN items f ON m.found_item_id = f.id
                WHERE (l.user_id = %s OR f.user_id = %s) AND m.stage != 'recovered'
                ORDER BY m.created_at DESC;
            """, (uid, uid))
            match_rows = cur.fetchall()
            matches_list = []
            for m in match_rows:
                lost_it = _item_to_out({
                    "id": m["l_id"], "title": m["l_title"], "category": m["l_category"],
                    "description": m["l_description"], "image_url": m["l_image_url"], "location": m["l_location"],
                    "incident_date": m["l_incident_date"], "incident_time": m["l_incident_time"],
                    "is_valuable": m["l_is_valuable"], "status": m["l_status"], "reporter_name": m["l_reporter_name"],
                    "reporter_role": m["l_reporter_role"], "report_type": "lost", "created_at": m["l_created_at"]
                })
                found_it = _item_to_out({
                    "id": m["f_id"], "title": m["f_title"], "category": m["f_category"],
                    "description": m["f_description"], "image_url": m["f_image_url"], "location": m["f_location"],
                    "incident_date": m["f_incident_date"], "incident_time": m["f_incident_time"],
                    "is_valuable": m["f_is_valuable"], "status": m["f_status"], "reporter_name": m["f_reporter_name"],
                    "reporter_role": m["f_reporter_role"], "report_type": "found", "created_at": m["f_created_at"]
                })
                matches_list.append(MatchOut(
                    id=m["id"],
                    lost_item=lost_it,
                    found_item=found_it,
                    similarity_score=m["similarity_score"],
                    stage=m["stage"],
                    created_at=m["created_at"]
                ))

            cur.execute("""
                SELECT i.* FROM items i
                WHERE (i.user_id = %s OR i.id IN (
                    SELECT m.found_item_id FROM matches m WHERE m.lost_item_id IN (SELECT id FROM items WHERE user_id = %s)
                )) AND i.status = 'Recovered'
                ORDER BY i.created_at DESC;
            """, (uid, uid))
            rec_rows = cur.fetchall()

            stats = ActivityStatsOut(
                lost=len([r for r in lost_rows if r['status'] != 'Recovered']),
                found=len([r for r in found_rows if r['status'] != 'Recovered']),
                active_matches=len(matches_list),
                recovered=len(rec_rows)
            )

            return ActivitySummary(
                summary_stats=stats,
                my_lost_reports=[_item_to_out(dict(r)) for r in lost_rows],
                my_found_reports=[_item_to_out(dict(r)) for r in found_rows],
                my_matches=matches_list,
                recovered_history=[_item_to_out(dict(r)) for r in rec_rows]
            )
    finally:
        conn.close()


@app.get("/items/my-matches", response_model=List[MatchOut])
def get_my_matches(current_user: dict = Depends(get_current_user_from_token)):
    act = get_my_activity(current_user)
    return act.my_matches


@app.get("/items/history", response_model=List[ItemOut])
def get_item_history(current_user: dict = Depends(get_current_user_from_token)):
    act = get_my_activity(current_user)
    return act.recovered_history


@app.get("/items/activity-stats", response_model=ActivityStatsOut)
def get_activity_stats(current_user: dict = Depends(get_current_user_from_token)):
    act = get_my_activity(current_user)
    return act.summary_stats


@app.get("/items", response_model=List[ItemOut])
def get_items(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    location: Optional[str] = Query(None),
    sort: Optional[str] = Query("recent"),
    sort_by: Optional[str] = Query(None),
    report_type: Optional[str] = Query("found"),
    escalation_level: Optional[str] = Query(None),
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM items WHERE withdrawn = FALSE"
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

            effective_sort = sort_by or sort
            if effective_sort == "oldest":
                query += " ORDER BY created_at ASC"
            elif effective_sort == "valuable":
                query += " ORDER BY is_valuable DESC, created_at DESC"
            else:
                query += " ORDER BY created_at DESC"

            cur.execute(query, tuple(params))
            items = cur.fetchall()
            return [_item_to_out(dict(it)) for it in items]
    finally:
        conn.close()


# ==========================================
# Report Item Form (Lost & Found)
# ==========================================
@app.post("/items", response_model=ItemCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_item_report(
    req: ItemCreate,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Submit a new Lost or Found item report.
    - Uses OpenCLIP ViT-H/14 for dense visual & semantic embeddings
    - High-accuracy cosine similarity auto-matching (threshold >= 0.70)
    - Valuable items → immediately escalate to department
    - Common-place found items → route to admin after 24h
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

    # Generate OpenCLIP ViT-H/14 embedding
    item_emb = None
    try:
        from clip_client import embed_item, cosine_similarity
        item_emb = await embed_item(image_url=img_url, text=f"{req.title}. {req.description}")
    except Exception as e:
        print(f"[OpenCLIP] Embedding failed (continuing gracefully): {e}")

    # Routing rules
    is_lost = (req.report_type.strip().lower() == "lost")
    initial_status = "Reported" if is_lost else "Found"
    escalation_level = "user"
    assigned_dept_code = None
    assigned_dept_name = None
    assigned_office = None

    if is_val and not is_lost:
        initial_status = "Escalated to Department"
        escalation_level = "department"
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
            cur.execute("""
                INSERT INTO items (
                    user_id, report_type, title, category, description,
                    image_url, location, incident_date, incident_time,
                    is_valuable, status, reporter_name, reporter_role,
                    assigned_department, assigned_department_name, escalation_level,
                    assigned_office, escalation_at, embedding,
                    private_verification_detail, contact_preference, is_public, withdrawn
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                RETURNING *;
            """, (
                current_user["id"], req.report_type.lower(), req.title.strip(),
                req.category, req.description.strip(), img_url,
                req.location, date_str, time_str,
                is_val, initial_status, current_user["name"], current_user["role"],
                assigned_dept_code, assigned_dept_name, escalation_level,
                assigned_office,
                datetime.now(timezone.utc) if is_val and not is_lost else None,
                json.dumps(item_emb) if item_emb else None,
                req.private_verification_detail.strip() if req.private_verification_detail else None,
                req.contact_preference or "chat_only",
                not is_lost
            ))
            new_item = cur.fetchone()

            # If escalated immediately, record escalation history
            if escalation_level == "department":
                cur.execute("""
                    INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                    VALUES (%s, 'user', 'department', 'Valuable item policy — auto-escalated on submission', 'System');
                """, (new_item["id"],))

                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Valuable Item Escalated', %s, 'info', %s);
                """, (
                    current_user["id"],
                    f"Your found item '{new_item['title']}' has been escalated to the {assigned_dept_name} department for secure handling.",
                    new_item["id"]
                ))

            candidate_matches: List[ItemOut] = []

            # Auto-matching using OpenCLIP ViT-H/14
            opp_type = "found" if is_lost else "lost"
            cur.execute("""
                SELECT id, title, user_id, category, location, image_url, description,
                       incident_date, incident_time, is_valuable, status, reporter_name,
                       reporter_role, report_type, created_at, embedding
                FROM items
                WHERE report_type = %s AND withdrawn = FALSE
                  AND status NOT IN ('Recovered', 'At Admin Office')
                ORDER BY created_at DESC LIMIT 50;
            """, (opp_type,))
            candidates = cur.fetchall()

            potential_match = None
            match_score = 75
            match_note = None

            # 1. Try high-precision CLIP visual match
            if item_emb and candidates:
                try:
                    from clip_client import cosine_similarity
                    best_score = -1.0
                    best_cand = None
                    for cand in candidates:
                        cand_emb_data = cand.get("embedding")
                        if cand_emb_data:
                            cand_emb = json.loads(cand_emb_data) if isinstance(cand_emb_data, str) else cand_emb_data
                            score = cosine_similarity(item_emb, cand_emb)
                            if score > best_score:
                                best_score = score
                                best_cand = cand
                    if best_cand and best_score >= 0.70:
                        potential_match = best_cand
                        match_score = int(best_score * 100)
                        match_note = f"OpenCLIP ViT-H/14 visual match ({match_score}% similarity)"
                except Exception as e:
                    print(f"[OpenCLIP] Candidate comparison exception: {e}")

            # 2. Fallback to category/location match if CLIP didn't find candidate >= 0.70
            if not potential_match and candidates:
                for cand in candidates:
                    if cand.get("category", "").lower() == req.category.lower():
                        potential_match = cand
                        match_score = 80
                        match_note = "Category match"
                        break

            if potential_match:
                # Add to candidate matches list
                candidate_matches.append(_item_to_out(dict(potential_match)))

                cur.execute("UPDATE items SET status = 'Matched' WHERE id IN (%s, %s);",
                            (new_item["id"], potential_match["id"]))
                new_item = dict(new_item)
                new_item["status"] = "Matched"

                lost_id = new_item["id"] if is_lost else potential_match["id"]
                found_id = potential_match["id"] if is_lost else new_item["id"]

                cur.execute("""
                    INSERT INTO matches (lost_item_id, found_item_id, similarity_score, stage)
                    VALUES (%s, %s, %s, 'verification_pending')
                    ON CONFLICT DO NOTHING;
                """, (lost_id, found_id, match_score))

                notif_msg = f"Potential match found between '{new_item['title']}' and '{potential_match['title']}' ({match_note})!"
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Auto-Match Alert', %s, 'match', %s, FALSE);
                """, (current_user["id"], notif_msg, new_item["id"]))

                if potential_match.get("user_id"):
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                        VALUES (%s, 'Auto-Match Alert', %s, 'match', %s, FALSE);
                    """, (potential_match["user_id"], notif_msg, potential_match["id"]))

                sys_chat = f"System Match: '{new_item['title']}' matched with '{potential_match['title']}' ({match_note}). Please verify identifying details before pickup."
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Campus Match Bot', 'system', %s, TRUE);
                """, (new_item["id"], sys_chat))

            conn.commit()

            item_out = _item_to_out(dict(new_item))
            msg = "Report submitted successfully."
            if is_lost:
                msg = f"Report submitted. Found {len(candidate_matches)} potential match(es)!" if candidate_matches else "Report submitted. System is actively scanning for matches."
            else:
                msg = "Thanks! Your found item is now securely registered."

            return ItemCreateResponse(
                item=item_out,
                message=msg,
                matches=candidate_matches
            )
    finally:
        conn.close()


@app.get("/items/{item_id}", response_model=ItemOut)
def get_item_by_id(item_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Item not found")
            return _item_to_out(dict(row))
    finally:
        conn.close()


@app.patch("/items/{item_id}", response_model=ItemOut)
def update_item_report(item_id: int, req: ItemUpdate, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")
            if item["user_id"] != current_user["id"] and current_user["role"] not in ("admin", "department_admin"):
                raise HTTPException(status_code=403, detail="Not authorized to edit this report")

            updates = []
            params = []
            if req.title is not None:
                updates.append("title = %s")
                params.append(req.title.strip())
            if req.category is not None:
                updates.append("category = %s")
                params.append(req.category.strip())
            if req.description is not None:
                updates.append("description = %s")
                params.append(req.description.strip())
            if req.location is not None:
                updates.append("location = %s")
                params.append(req.location.strip())
            if req.incident_date is not None:
                updates.append("incident_date = %s")
                params.append(req.incident_date)
            if req.incident_time is not None:
                updates.append("incident_time = %s")
                params.append(req.incident_time)
            if req.is_valuable is not None:
                updates.append("is_valuable = %s")
                params.append(req.is_valuable)

            if updates:
                params.append(item_id)
                cur.execute(f"UPDATE items SET {', '.join(updates)} WHERE id = %s RETURNING *;", tuple(params))
                updated_row = cur.fetchone()
                conn.commit()
                return _item_to_out(dict(updated_row))
            return _item_to_out(dict(item))
    finally:
        conn.close()


@app.delete("/items/{item_id}")
def withdraw_item_report(item_id: int, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")
            if item["user_id"] != current_user["id"] and current_user["role"] not in ("admin", "department_admin"):
                raise HTTPException(status_code=403, detail="Not authorized to withdraw this report")

            cur.execute("UPDATE items SET withdrawn = TRUE, status = 'Withdrawn' WHERE id = %s", (item_id,))
            conn.commit()
            return {"message": "Report successfully withdrawn."}
    finally:
        conn.close()


@app.get("/items/{item_id}/matches", response_model=List[ItemOut])
def get_item_matches(item_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT f.*
                FROM matches m
                JOIN items f ON m.found_item_id = f.id
                WHERE m.lost_item_id = %s AND f.withdrawn = FALSE;
            """, (item_id,))
            rows = cur.fetchall()
            return [_item_to_out(dict(r)) for r in rows]
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
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            dept_code = req.target_department_code
            dept_name = None
            if dept_code:
                cur.execute("SELECT name FROM departments WHERE code = %s", (dept_code,))
                dept_row = cur.fetchone()
                if dept_row:
                    dept_name = dept_row["name"]

            if not dept_name:
                detected = _detect_department_from_location(item["location"])
                if detected:
                    dept_code = detected["code"]
                    dept_name = detected["name"]
                else:
                    dept_code = current_user.get("department_code") or "CSE"
                    dept_name = current_user.get("department") or "Computer Science & Engineering"

            cur.execute("""
                UPDATE items SET
                    escalation_level = 'department',
                    assigned_department = %s,
                    assigned_department_name = %s,
                    status = 'Escalated to Department',
                    escalation_at = NOW()
                WHERE id = %s;
            """, (dept_code, dept_name, item_id))

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, %s, 'department', %s, %s);
            """, (
                item_id,
                item["escalation_level"] or "user",
                req.reason or "No owner match within 24 hours",
                current_user["name"]
            ))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, 'Item Escalated to Department', %s, 'info', %s);
                """, (
                    item["user_id"],
                    f"Your item '{item['title']}' has been escalated to {dept_name} department.",
                    item_id
                ))

            conn.commit()
            return {"message": "Item escalated to department successfully", "department": dept_name, "department_code": dept_code}
    finally:
        conn.close()


@app.post("/items/{item_id}/escalate-to-admin")
def escalate_to_admin(
    item_id: int,
    req: ItemEscalateRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
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
                    cur.execute("""
                        UPDATE items SET escalation_level='admin', status='At Admin Office',
                        assigned_office='Central Lost & Found Office', admin_received_at=NOW(), escalation_at=NOW()
                        WHERE id=%s;
                    """, (item["id"],))
                    cur.execute("""
                        INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                        VALUES (%s, 'user', 'admin', 'Common-place location, no owner after 24h', 'system');
                    """, (item["id"],))
                    escalated.append({"id": item["id"], "title": item["title"], "to": "Admin Office"})
                else:
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
                        VALUES (%s, 'user', 'department', '24h limit reached — custody transferred to department office', 'system');
                    """, (item["id"],))

                    # Send notification & message to founder instructing them to give the product to department desk
                    cur.execute("""
                        INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                        VALUES (%s, 'Campus Control Desk', 'system',
                                %s, TRUE);
                    """, (
                        item["id"],
                        f"24-Hour Policy Notice: Custody has been transferred to the {dept_name} Department Office. Please hand over the physical product at the department desk for secure collection."
                    ))

                    if item.get("user_id"):
                        cur.execute("""
                            INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                            VALUES (%s, 'Submit Item to Department Office', %s, 'info', %s, FALSE);
                        """, (
                            item["user_id"],
                            f"The 24-hour limit has reached for '{item['title']}'. Please submit the physical item to the {dept_name} department office desk.",
                            item["id"]
                        ))

                    escalated.append({"id": item["id"], "title": item["title"], "to": dept_name})

            # 2. Department items after 7 days
            cur.execute("""
                SELECT * FROM items
                WHERE escalation_level = 'department'
                  AND status IN ('Escalated to Department', 'With Department')
                  AND escalation_at < %s;
            """, (threshold_7d,))
            items_7d = cur.fetchall()

            for item in items_7d:
                cur.execute("""
                    UPDATE items SET escalation_level='admin', status='At Admin Office',
                    assigned_office='Central Lost & Found Office', admin_received_at=NOW(), escalation_at=NOW()
                    WHERE id=%s;
                """, (item["id"],))
                cur.execute("""
                    INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                    VALUES (%s, 'department', 'admin', '7-day department period expired', 'system');
                """, (item["id"],))
                escalated.append({"id": item["id"], "title": item["title"], "to": "Admin Office (7-day rule)"})

            conn.commit()
            return {"escalated_count": len(escalated), "items": escalated}
    finally:
        conn.close()


# ==========================================
# Department Desk Endpoints
# ==========================================
@app.get("/department/items")
def get_department_items(
    status: Optional[str] = Query(None),
    report_type: Optional[str] = Query("all"),
    current_user: dict = Depends(require_department_admin)
):
    dept_code = current_user.get("department_code")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM items WHERE (assigned_department = %s OR escalation_level = 'department')"
            params = [dept_code]

            if report_type and report_type != "all":
                query += " AND report_type = %s"
                params.append(report_type)

            if status and status != "all":
                query += " AND status = %s"
                params.append(status)

            query += " ORDER BY created_at DESC"
            cur.execute(query, tuple(params))
            items = cur.fetchall()
            return [_item_to_out(dict(it)) for it in items]
    finally:
        conn.close()


@app.get("/department/stats")
def get_department_stats(current_user: dict = Depends(require_department_admin)):
    dept_code = current_user.get("department_code")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'With Department') as in_custody,
                    COUNT(*) FILTER (WHERE status = 'Escalated to Department') as pending_custody,
                    COUNT(*) FILTER (WHERE status = 'Under Verification') as verifying,
                    COUNT(*) FILTER (WHERE status = 'Verified by Department') as verified,
                    COUNT(*) FILTER (WHERE status = 'Recovered') as recovered,
                    COUNT(*) FILTER (WHERE status = 'At Admin Office') as forwarded_to_admin,
                    COUNT(*) FILTER (WHERE is_valuable = TRUE AND status NOT IN ('Recovered') AND withdrawn = FALSE) as valuable,
                    COUNT(*) FILTER (WHERE status IN ('With Department', 'Escalated to Department', 'Under Verification', 'Verified by Department')) as pending
                FROM items
                WHERE assigned_department = %s AND withdrawn = FALSE;
            """, (dept_code,))
            stats = cur.fetchone()
            d = dict(stats)
            if 'pending' not in d or d['pending'] is None:
                d['pending'] = (d.get('pending_custody') or 0) + (d.get('in_custody') or 0)
            if 'valuable' not in d or d['valuable'] is None:
                d['valuable'] = 0
            if 'verified' not in d or d['verified'] is None:
                d['verified'] = 0
            return d
    finally:
        conn.close()


@app.post("/department/items/{item_id}/verify")
def department_verify_item(
    item_id: int,
    req: ItemHandoverRequest,
    current_user: dict = Depends(require_department_admin)
):
    """
    Department Office Desk Handover to Item Owner.
    Collects Name, Roll No, Phone, Submitting Date, Handover Officer, and Notes.
    Owner ID card image is NOT required for department desk in-person handover.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            if current_user["role"] != "admin" and item["assigned_department"] != current_user.get("department_code"):
                raise HTTPException(status_code=403, detail="This item is assigned to another department")

            handover_by = req.handover_by or current_user["name"]

            cur.execute("""
                UPDATE items SET
                    status = 'Recovered',
                    handover_at = NOW(),
                    handover_by = %s,
                    owner_name = %s,
                    owner_roll_no = %s,
                    owner_phone = %s,
                    handover_notes = %s
                WHERE id = %s;
            """, (
                handover_by,
                req.owner_name.strip(),
                req.owner_roll_no.strip(),
                req.owner_phone.strip(),
                req.notes or f"Handover date: {req.handover_date or 'today'}",
                item_id
            ))

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, 'department', 'recovered', %s, %s);
            """, (
                item_id,
                f"Department handed over to owner {req.owner_name} ({req.owner_roll_no}, Ph: {req.owner_phone})",
                handover_by
            ))

            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Department Desk', 'staff',
                        %s, TRUE);
            """, (
                item_id,
                f"OFFICIAL HANDOVER COMPLETE: Item successfully received by owner {req.owner_name} (Roll: {req.owner_roll_no}, Ph: {req.owner_phone}). Handed over by {handover_by}."
            ))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Item Recovered by Owner', %s, 'claim', %s, FALSE);
                """, (
                    item["user_id"],
                    f"'{item['title']}' has been officially collected from the Department Desk by owner {req.owner_name}.",
                    item_id
                ))

            conn.commit()
            return {
                "message": f"Item officially handed over to owner {req.owner_name}.",
                "status": "Recovered",
                "handover_proof": {
                    "name": req.owner_name,
                    "roll_no": req.owner_roll_no,
                    "phone": req.owner_phone,
                    "date": req.handover_date or datetime.now().strftime("%Y-%m-%d"),
                    "handover_by": handover_by
                }
            }
    finally:
        conn.close()


@app.post("/department/items/{item_id}/receive")
def department_receive_item(item_id: int, current_user: dict = Depends(require_department_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            dept_code = current_user.get("department_code") or "CSE"
            dept_name = current_user.get("department") or "Department Office"

            cur.execute("""
                UPDATE items SET
                    status = 'With Department',
                    escalation_level = 'department',
                    assigned_department = %s,
                    assigned_department_name = %s,
                    assigned_office = %s,
                    dept_received_at = NOW()
                WHERE id = %s;
            """, (dept_code, dept_name, f"{dept_name} Office Desk", item_id))

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, %s, 'department', 'Item physically submitted to department desk by finder', %s);
            """, (item_id, item["escalation_level"] or "user", current_user["name"]))

            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Department Desk', 'staff',
                        %s, TRUE);
            """, (
                item_id,
                f"Custody Update: Item has been physically submitted to the {dept_name} Office Desk. If this is your item, visit the department desk with identification to claim it."
            ))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Item at Department Desk', %s, 'info', %s, FALSE);
                """, (
                    item["user_id"],
                    f"'{item['title']}' physical custody has been confirmed at the {dept_name} Office Desk.",
                    item_id
                ))

            conn.commit()
            return {"message": "Custody accepted by department office", "status": "With Department"}
    finally:
        conn.close()


@app.post("/department/items/{item_id}/escalate-to-admin")
def department_escalate_to_super_admin(
    item_id: int,
    req: ItemEscalateRequest,
    current_user: dict = Depends(require_department_admin)
):
    """
    Department Office option to send the item process and physical product
    to Super Admin (Central Admin Office) for further handling.
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
                    assigned_office = 'Central Lost & Found Administration Office',
                    admin_received_at = NOW(),
                    escalation_at = NOW()
                WHERE id = %s;
            """, (item_id,))

            dept_name = current_user.get("department") or "Department Office"
            reason = req.reason or f"Forwarded from {dept_name} to Super Admin Office"

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, 'department', 'admin', %s, %s);
            """, (item_id, reason, current_user["name"]))

            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Central Admin Office', 'system',
                        %s, TRUE);
            """, (
                item_id,
                f"Process Transferred: This item has been handed over from {dept_name} to the Central Super Admin Office. Super Admin will now handle verification and delivery."
            ))

            cur.execute("SELECT id FROM users WHERE role = 'admin'")
            admin_users = cur.fetchall()
            for adm in admin_users:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Item Transferred to Super Admin', %s, 'info', %s, FALSE);
                """, (
                    adm["id"],
                    f"'{item['title']}' was forwarded from {dept_name} to Central Super Admin Office for handling.",
                    item_id
                ))

            conn.commit()
            return {
                "message": "Item process and physical custody successfully transferred to Super Admin Office.",
                "status": "At Admin Office",
                "assigned_office": "Central Lost & Found Administration Office"
            }
    finally:
        conn.close()


# ==========================================
# Admin Endpoints
# ==========================================
@app.get("/admin/items")
def get_admin_items(
    scope: Optional[str] = Query("admin"),
    status: Optional[str] = Query("all"),
    department: Optional[str] = Query("all"),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin)
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM items WHERE 1=1"
            params = []

            if scope == "admin":
                query += " AND escalation_level = 'admin'"

            if status and status != "all":
                query += " AND status = %s"
                params.append(status)

            if department and department != "all":
                query += " AND assigned_department = %s"
                params.append(department)

            if search and search.strip():
                query += " AND (title ILIKE %s OR description ILIKE %s OR location ILIKE %s)"
                s_param = f"%{search.strip()}%"
                params.extend([s_param, s_param, s_param])

            query += " ORDER BY created_at DESC"
            cur.execute(query, tuple(params))
            items = cur.fetchall()
            return [_item_to_out(dict(it)) for it in items]
    finally:
        conn.close()


@app.post("/admin/items/{item_id}/close")
def admin_close_item(
    item_id: int,
    req: ItemHandoverRequest,
    current_user: dict = Depends(require_admin)
):
    """
    Central Admin Office Handover to Item Owner.
    Collects Name, Roll No, Phone, Submitting Date, Handover Officer, and Notes.
    Owner ID card image is NOT required for admin desk in-person handover.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            handover_by = req.handover_by or current_user["name"]

            cur.execute("""
                UPDATE items SET
                    status = 'Recovered',
                    handover_at = NOW(),
                    handover_by = %s,
                    owner_name = %s,
                    owner_roll_no = %s,
                    owner_phone = %s,
                    handover_notes = %s
                WHERE id = %s;
            """, (
                handover_by,
                req.owner_name.strip(),
                req.owner_roll_no.strip(),
                req.owner_phone.strip(),
                req.notes or f"Handover date: {req.handover_date or 'today'}",
                item_id
            ))

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, 'admin', 'recovered', %s, %s);
            """, (
                item_id,
                f"Admin Office handed over to owner {req.owner_name} ({req.owner_roll_no}, Ph: {req.owner_phone})",
                handover_by
            ))

            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Central Admin Office', 'admin',
                        %s, TRUE);
            """, (
                item_id,
                f"OFFICIAL ADMIN HANDOVER COMPLETE: Item received by owner {req.owner_name} (Roll: {req.owner_roll_no}, Ph: {req.owner_phone}). Handed over by {handover_by}."
            ))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Item Recovered by Owner', %s, 'claim', %s, FALSE);
                """, (
                    item["user_id"],
                    f"'{item['title']}' has been officially collected from the Central Admin Office by owner {req.owner_name}.",
                    item_id
                ))

            conn.commit()
            return {
                "message": f"Item officially handed over to owner {req.owner_name} by Central Admin Office.",
                "status": "Recovered",
                "handover_proof": {
                    "name": req.owner_name,
                    "roll_no": req.owner_roll_no,
                    "phone": req.owner_phone,
                    "date": req.handover_date or datetime.now().strftime("%Y-%m-%d"),
                    "handover_by": handover_by
                }
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
    Direct Student-to-Student Handover.
    CRITICAL RULE:
    1. Name, Roll No, Phone No, Submitting Date are collected.
    2. Owner ID card image IS STRICTLY REQUIRED when a student hands over directly to another student.
    """
    if not req.owner_id_card_image or not req.owner_id_card_image.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item owner ID card image is required for student-to-student handover confirmation."
        )

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            handover_by = current_user["name"]

            cur.execute("""
                UPDATE items SET
                    status = 'Recovered',
                    handover_at = NOW(),
                    handover_by = %s,
                    owner_name = %s,
                    owner_roll_no = %s,
                    owner_phone = %s,
                    owner_department = %s,
                    owner_id_card_image = %s,
                    handover_notes = %s
                WHERE id = %s;
            """, (
                handover_by,
                req.owner_name.strip(),
                req.owner_roll_no.strip(),
                req.owner_phone.strip(),
                (req.owner_department or "").strip(),
                req.owner_id_card_image.strip(),
                req.notes or f"Peer-to-peer delivery on {req.handover_date or 'today'}",
                item_id
            ))

            cur.execute("""
                INSERT INTO escalation_history (item_id, from_level, to_level, reason, escalated_by)
                VALUES (%s, 'user', 'recovered', %s, %s);
            """, (
                item_id,
                f"Student finder {current_user['name']} delivered item to owner {req.owner_name} with verified student ID card photo.",
                handover_by
            ))

            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Delivery Confirmation', 'system',
                        %s, TRUE);
            """, (
                item_id,
                f"PEER DELIVERY VERIFIED: Finder {current_user['name']} handed over item to owner {req.owner_name} (Roll: {req.owner_roll_no}). Owner ID card photo submitted."
            ))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Item Delivered to Owner', %s, 'claim', %s, FALSE);
                """, (
                    item["user_id"],
                    f"'{item['title']}' has been officially delivered to owner {req.owner_name} with verified ID card proof.",
                    item_id
                ))

            conn.commit()
            return {
                "message": f"Item successfully delivered to owner {req.owner_name}.",
                "status": "Recovered",
                "handover_proof": {
                    "name": req.owner_name,
                    "roll_no": req.owner_roll_no,
                    "phone": req.owner_phone,
                    "date": req.handover_date or datetime.now().strftime("%Y-%m-%d"),
                    "id_card_verified": True
                }
            }
    finally:
        conn.close()


@app.delete("/admin/items/{item_id}")
def admin_delete_item(item_id: int, current_user: dict = Depends(require_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            cur.execute("DELETE FROM items WHERE id = %s", (item_id,))
            conn.commit()
            return {"message": f"Item '{item['title']}' deleted successfully"}
    finally:
        conn.close()


@app.get("/admin/analytics", response_model=AdminAnalyticsOut)
def get_admin_analytics(current_user: dict = Depends(require_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) as total_items,
                    COUNT(*) FILTER (WHERE report_type = 'found' AND status != 'Recovered' AND withdrawn = FALSE) as total_found,
                    COUNT(*) FILTER (WHERE report_type = 'lost' AND status != 'Recovered' AND withdrawn = FALSE) as total_lost,
                    COUNT(*) FILTER (WHERE status = 'Recovered' AND withdrawn = FALSE) as total_recovered,
                    COUNT(*) FILTER (WHERE status IN ('Escalated to Department', 'With Department', 'Under Verification', 'Verified by Department') AND withdrawn = FALSE) as total_at_departments,
                    COUNT(*) FILTER (WHERE status = 'At Admin Office' AND withdrawn = FALSE) as total_at_admin,
                    COUNT(*) FILTER (WHERE is_valuable = TRUE AND status != 'Recovered' AND withdrawn = FALSE) as total_valuable
                FROM items;
            """)
            overall = cur.fetchone()

            tot = overall["total_items"] or 0
            rec = overall["total_recovered"] or 0
            rate = round((rec / tot * 100), 1) if tot > 0 else 0.0

            cur.execute("""
                SELECT
                    d.code as department_code,
                    d.name as department_name,
                    COUNT(i.id) as total,
                    COUNT(i.id) FILTER (WHERE i.status IN ('Escalated to Department', 'With Department', 'Under Verification', 'Verified by Department')) as pending,
                    COUNT(i.id) FILTER (WHERE i.status = 'Recovered') as recovered,
                    COUNT(i.id) FILTER (WHERE i.status = 'At Admin Office') as at_admin
                FROM departments d
                LEFT JOIN items i ON i.assigned_department = d.code AND i.withdrawn = FALSE
                GROUP BY d.code, d.name
                ORDER BY d.code ASC;
            """)
            by_dept = [DeptStats(**dict(r)) for r in cur.fetchall()]

            cur.execute("""
                SELECT category, COUNT(*) as count
                FROM items
                WHERE withdrawn = FALSE AND status != 'Recovered'
                GROUP BY category
                ORDER BY count DESC;
            """)
            by_category = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT status, COUNT(*) as count
                FROM items
                WHERE withdrawn = FALSE
                GROUP BY status
                ORDER BY count DESC;
            """)
            by_status = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT eh.*, i.title as item_title
                FROM escalation_history eh
                JOIN items i ON eh.item_id = i.id
                ORDER BY eh.created_at DESC
                LIMIT 10;
            """)
            recent_escalations = cur.fetchall()

            return AdminAnalyticsOut(
                total_items=tot,
                total_found=overall["total_found"] or 0,
                total_lost=overall["total_lost"] or 0,
                total_recovered=rec,
                total_at_departments=overall["total_at_departments"] or 0,
                total_at_admin=overall["total_at_admin"] or 0,
                total_valuable=overall["total_valuable"] or 0,
                recovery_rate=rate,
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


@app.get("/admin/flagged-reports")
def get_flagged_reports(current_user: dict = Depends(require_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT i.*, u.email as reporter_email, u.is_suspended
                FROM items i
                JOIN users u ON i.user_id = u.id
                WHERE i.flag_count > 0
                ORDER BY i.flag_count DESC, i.created_at DESC;
            """)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.patch("/admin/users/{user_id}/suspend")
def suspend_user(user_id: int, current_user: dict = Depends(require_admin)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET is_suspended = TRUE WHERE id = %s RETURNING id, name, email", (user_id,))
            u = cur.fetchone()
            if not u:
                raise HTTPException(status_code=404, detail="User not found")
            cur.execute("UPDATE items SET withdrawn = TRUE, status = 'Withdrawn' WHERE user_id = %s", (user_id,))
            conn.commit()
            return {"message": f"User {u['name']} ({u['email']}) suspended and fraudulent reports withdrawn."}
    finally:
        conn.close()


# ==========================================
# Chat & Messaging Endpoints
# ==========================================
@app.get("/items/{item_id}/messages", response_model=List[MessageOut])
def get_messages(item_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, item_id, sender_id, sender_name, sender_role, message, is_system, created_at
                FROM messages
                WHERE item_id = %s
                ORDER BY created_at ASC;
            """, (item_id,))
            rows = cur.fetchall()

            if not rows:
                cur.execute("SELECT title FROM items WHERE id = %s", (item_id,))
                item = cur.fetchone()
                item_title = item["title"] if item else "Item"
                welcome_text = f"You've been connected on '{item_title}'! Please confirm identifying details before arranging pickup."
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Campus Match Desk', 'system', %s, TRUE)
                    RETURNING id, item_id, sender_id, sender_name, sender_role, message, is_system, created_at;
                """, (item_id, welcome_text))
                new_msg = cur.fetchone()
                conn.commit()
                rows = [new_msg]

            return [MessageOut(**dict(r)) for r in rows]
    finally:
        conn.close()


@app.post("/items/{item_id}/messages", response_model=MessageOut)
def send_message(item_id: int, req: MessageCreate, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO messages (item_id, sender_id, sender_name, sender_role, message, is_system)
                VALUES (%s, %s, %s, %s, %s, FALSE)
                RETURNING id, item_id, sender_id, sender_name, sender_role, message, is_system, created_at;
            """, (
                item_id,
                current_user["id"],
                current_user["name"],
                current_user["role"],
                req.message.strip()
            ))
            msg = cur.fetchone()

            cur.execute("SELECT user_id, title FROM items WHERE id = %s", (item_id,))
            it = cur.fetchone()
            if it and it["user_id"] and it["user_id"] != current_user["id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'New Chat Message', %s, 'message', %s, FALSE);
                """, (
                    it["user_id"],
                    f"New message from {current_user['name']} regarding '{it['title']}'.",
                    item_id
                ))

            conn.commit()
            return MessageOut(**dict(msg))
    finally:
        conn.close()


# ==========================================
# Claims & Verification Endpoints
# ==========================================
@app.post("/items/{item_id}/claim", response_model=ClaimOut)
def submit_claim(item_id: int, req: ClaimCreate, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            # Founder cannot claim their own found item
            if item.get("user_id") and item["user_id"] == current_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You reported finding this item. You cannot claim an item you found. Only the user who lost it can submit a claim."
                )

            cur.execute("""
                INSERT INTO claims (item_id, claimant_id, claimant_name, claimant_role, hidden_details, status)
                VALUES (%s, %s, %s, %s, %s, 'pending')
                RETURNING id, item_id, claimant_id, claimant_name, claimant_role, hidden_details, status, created_at;
            """, (
                item_id,
                current_user["id"],
                current_user["name"],
                current_user["role"],
                req.hidden_details.strip()
            ))
            claim = cur.fetchone()

            cur.execute("UPDATE items SET status = 'Under Verification' WHERE id = %s;", (item_id,))

            sys_msg = f"Verification claim submitted by {current_user['name'].split()[0]} ({current_user['role']}). Awaiting confirmation of hidden details."
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Campus Match Desk', 'system', %s, TRUE);
            """, (item_id, sys_msg))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'New Claim Submitted', %s, 'claim', %s, FALSE);
                """, (
                    item["user_id"],
                    f"Someone submitted ownership verification for your found '{item['title']}'.",
                    item_id
                ))

            conn.commit()
            return ClaimOut(**dict(claim))
    finally:
        conn.close()


@app.post("/claims/{claim_id}/verify")
def verify_claim(claim_id: int, req: ClaimVerifyRequest, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM claims WHERE id = %s", (claim_id,))
            claim = cur.fetchone()
            if not claim:
                raise HTTPException(status_code=404, detail="Claim not found")

            cur.execute("SELECT * FROM items WHERE id = %s", (claim["item_id"],))
            item = cur.fetchone()

            new_status = "approved" if req.approved else "rejected"
            cur.execute("UPDATE claims SET status = %s WHERE id = %s", (new_status, claim_id))

            if req.approved:
                cur.execute("UPDATE items SET status = 'Recovered', handover_at = NOW() WHERE id = %s", (claim["item_id"],))
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Campus Match Desk', 'system',
                            'Ownership verified! The item is now marked as Recovered.', TRUE);
                """, (claim["item_id"],))
                if claim["claimant_id"]:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                        VALUES (%s, 'Claim Approved!', %s, 'claim', %s, FALSE);
                    """, (
                        claim["claimant_id"],
                        f"Your claim for '{item['title'] if item else 'item'}' was approved. Item officially recovered!",
                        claim["item_id"]
                    ))
            else:
                cur.execute("UPDATE items SET status = 'Found' WHERE id = %s", (claim["item_id"],))
                if claim["claimant_id"]:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                        VALUES (%s, 'Verification Update', %s, 'claim', %s, FALSE);
                    """, (
                        claim["claimant_id"],
                        f"Your claim on '{item['title'] if item else 'item'}' could not be verified.",
                        claim["item_id"]
                    ))

            conn.commit()
            return {
                "message": f"Claim {new_status} successfully.",
                "item_status": "Recovered" if req.approved else "Found"
            }
    finally:
        conn.close()


@app.get("/items/{item_id}/claims", response_model=List[ClaimOut])
def get_item_claims(item_id: int, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM claims WHERE item_id = %s ORDER BY created_at DESC", (item_id,))
            claims = cur.fetchall()
            return [ClaimOut(**dict(c)) for c in claims]
    finally:
        conn.close()


@app.get("/claims", response_model=List[ClaimOut])
def list_claims(current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if current_user["role"] in ("admin", "department_admin"):
                cur.execute("SELECT * FROM claims ORDER BY created_at DESC")
            else:
                cur.execute("SELECT * FROM claims WHERE claimant_id = %s ORDER BY created_at DESC", (current_user["id"],))
            claims = cur.fetchall()
            return [ClaimOut(**dict(c)) for c in claims]
    finally:
        conn.close()


# ==========================================
# Notifications Endpoints
# ==========================================
@app.get("/notifications", response_model=List[NotificationOut])
def get_notifications(current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT n.id, n.user_id, n.title, n.message, n.type, n.item_id, n.is_read, n.created_at,
                       i.image_url as item_image, i.title as item_title
                FROM notifications n
                LEFT JOIN items i ON n.item_id = i.id
                WHERE n.user_id = %s
                ORDER BY n.created_at DESC;
            """, (current_user["id"],))
            rows = cur.fetchall()
            return [NotificationOut(**dict(r)) for r in rows]
    finally:
        conn.close()


@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE notifications SET is_read = TRUE 
                WHERE id = %s AND user_id = %s;
            """, (notification_id, current_user["id"]))
            conn.commit()
            return {"message": "Notification marked as read"}
    finally:
        conn.close()


@app.patch("/notifications/mark-all-read")
def mark_all_notifications_read(current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE notifications SET is_read = TRUE 
                WHERE user_id = %s;
            """, (current_user["id"],))
            conn.commit()
            return {"message": "All notifications marked as read"}
    finally:
        conn.close()


@app.get("/notifications/unread-count")
def get_unread_count(current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) as cnt FROM notifications 
                WHERE user_id = %s AND is_read = FALSE;
            """, (current_user["id"],))
            count = cur.fetchone()["cnt"]
            return {"unread_count": count}
    finally:
        conn.close()


# ==========================================
# User Profile Endpoints
# ==========================================
@app.get("/users/me", response_model=UserOut)
def get_user_profile(current_user: dict = Depends(get_current_user_from_token)):
    filtered_user = {k: v for k, v in current_user.items() if k in UserOut.model_fields}
    return UserOut(**filtered_user)


@app.patch("/users/me", response_model=UserOut)
def update_user_profile(req: UserUpdate, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            updates = []
            params = []
            if req.name is not None and req.name.strip():
                updates.append("name = %s")
                params.append(req.name.strip())
            if req.phone_number is not None:
                updates.append("phone_number = %s")
                params.append(req.phone_number.strip())
                updates.append("phone = %s")
                params.append(req.phone_number.strip())
            if req.contact_preference is not None:
                updates.append("contact_preference = %s")
                params.append(req.contact_preference)
            if req.notify_matches is not None:
                updates.append("notify_matches = %s")
                params.append(req.notify_matches)
            if req.notify_claims is not None:
                updates.append("notify_claims = %s")
                params.append(req.notify_claims)
            if req.notify_messages is not None:
                updates.append("notify_messages = %s")
                params.append(req.notify_messages)
            if req.notify_email is not None:
                updates.append("notify_email = %s")
                params.append(req.notify_email)
            if req.avatar_url is not None:
                updates.append("avatar_url = %s")
                params.append(req.avatar_url.strip())

            if updates:
                params.append(current_user["id"])
                cur.execute(f"""
                    UPDATE users
                    SET {', '.join(updates)}
                    WHERE id = %s
                    RETURNING id, name, email, role, department, department_code, phone, phone_number,
                              contact_preference, notify_matches, notify_claims, notify_messages, notify_email,
                              avatar_url, is_suspended, created_at;
                """, tuple(params))
                updated_user = cur.fetchone()
                conn.commit()
                filtered_user = {k: v for k, v in updated_user.items() if k in UserOut.model_fields}
                return UserOut(**filtered_user)
            filtered_user = {k: v for k, v in current_user.items() if k in UserOut.model_fields}
            return UserOut(**filtered_user)
    finally:
        conn.close()


@app.patch("/users/me/password")
def change_password(req: PasswordChangeRequest, current_user: dict = Depends(get_current_user_from_token)):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    if req.confirm_new_password and req.new_password != req.confirm_new_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match")

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password FROM users WHERE id = %s", (current_user["id"],))
            user_row = cur.fetchone()
            if not user_row or not verify_password(req.current_password, user_row["password"]):
                raise HTTPException(status_code=400, detail="Current password is incorrect")

            new_hash = hash_password(req.new_password)
            cur.execute("UPDATE users SET password = %s WHERE id = %s", (new_hash, current_user["id"]))
            conn.commit()
            return {"message": "Password changed successfully"}
    finally:
        conn.close()


@app.get("/users/me/stats", response_model=UserStatsOut)
def get_user_stats(current_user: dict = Depends(get_current_user_from_token)):
    uid = current_user["id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE user_id = %s AND withdrawn = FALSE AND status != 'Recovered'", (uid,))
            reported = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE user_id = %s AND status = 'Recovered' AND withdrawn = FALSE", (uid,))
            recovered = cur.fetchone()["cnt"]

            cur.execute("""
                SELECT COUNT(*) as cnt FROM matches m
                JOIN items l ON m.lost_item_id = l.id
                JOIN items f ON m.found_item_id = f.id
                WHERE (l.user_id = %s OR f.user_id = %s) AND m.stage != 'recovered'
            """, (uid, uid))
            matches = cur.fetchone()["cnt"]

            return UserStatsOut(
                items_reported=reported,
                items_recovered=recovered,
                active_matches=matches
            )
    finally:
        conn.close()


# ==========================================
# Moderation & Fraud Flagging Endpoints
# ==========================================
@app.patch("/items/{item_id}/flag")
def flag_item_report(item_id: int, current_user: dict = Depends(get_current_user_from_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, user_id, title, flag_count FROM items WHERE id = %s", (item_id,))
            item = cur.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Item report not found")

            new_flags = (item.get("flag_count") or 0) + 1
            cur.execute("UPDATE items SET flag_count = %s WHERE id = %s RETURNING flag_count", (new_flags, item_id))

            if new_flags >= 3:
                cur.execute("SELECT id FROM users WHERE role = 'admin'")
                admins = cur.fetchall()
                for adm in admins:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                        VALUES (%s, 'Moderation Alert', %s, 'status', %s, FALSE)
                    """, (
                        adm["id"],
                        f"Item '{item['title']}' (ID #{item_id}) has received {new_flags} suspicious report flags.",
                        item_id
                    ))
            conn.commit()
            return {"message": "Report flagged for moderation review", "flag_count": new_flags}
    finally:
        conn.close()


# ==========================================
# Gemini Vision AI Endpoints
# ==========================================
@app.post("/gemini/analyze-image", response_model=GeminiAnalysisOut)
async def analyze_image(req: GeminiAnalysisRequest):
    """Analyze an uploaded item image with Gemini Vision to auto-fill report fields."""
    if not req.image_url and not req.image_base64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either image_url or image_base64 must be provided"
        )
    result = await analyze_item_image(
        image_url=req.image_url,
        image_base64=req.image_base64
    )
    return GeminiAnalysisOut(**result)


# ==========================================
# Whisper Large V3 Voice Transcription
# ==========================================
@app.post("/voice/transcribe", response_model=VoiceTranscribeOut)
async def transcribe_audio_file(
    file: UploadFile = File(...),
    language: str = Query("en", description="Target language, defaults to en")
):
    """
    Transcribe audio recorded from mobile microphone using Whisper Large V3.
    Returns normalized English transcription for item descriptions.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty")
        
        print(f"[FASTAPI /voice/transcribe] Received file: {file.filename}, size: {len(content)} bytes")
        result = transcribe_audio_bytes(
            audio_bytes=content,
            filename=file.filename or "recording.m4a",
            content_type=file.content_type or "audio/m4a",
            target_language=language
        )
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Transcription failed"))
        
        return VoiceTranscribeOut(**result)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FASTAPI /voice/transcribe] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voice/transcribe-base64", response_model=VoiceTranscribeOut)
async def transcribe_audio_base64(req: VoiceTranscribeRequest):
    """
    Transcribe base64 encoded audio using Whisper Large V3.
    """
    import base64
    if not req.audio_base64 or not req.audio_base64.strip():
        raise HTTPException(status_code=400, detail="audio_base64 field is required")
    
    try:
        raw_b64 = req.audio_base64.strip()
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1].strip()
        
        # Remove any whitespace / newlines
        raw_b64 = "".join(raw_b64.split())
        
        # Ensure correct base64 padding
        missing_padding = len(raw_b64) % 4
        if missing_padding:
            raw_b64 += "=" * (4 - missing_padding)

        audio_bytes = base64.b64decode(raw_b64)
        print(f"[FASTAPI /voice/transcribe-base64] Decoded audio size: {len(audio_bytes)} bytes")
        
        if not audio_bytes or len(audio_bytes) < 32:
            raise HTTPException(status_code=400, detail="Decoded audio file is empty or too small")

        result = transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            filename="recording.m4a",
            content_type="audio/m4a",
            target_language=req.language or "en"
        )
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Transcription failed"))
        
        return VoiceTranscribeOut(**result)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FASTAPI /voice/transcribe-base64] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

