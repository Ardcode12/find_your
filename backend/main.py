import os
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware

from database import get_db_connection, init_db
from auth import create_access_token, decode_access_token, hash_password, verify_password
from schemas import (
    ActivityStatsOut,
    ActivitySummary,
    AuthResponse,
    CategoryItem,
    ClaimCreate,
    ClaimOut,
    ClaimVerifyRequest,
    ItemCreate,
    ItemCreateResponse,
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
)

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
    description="Backend for Kongu Campus Lost and Found system (Full Dashboard, Reports, Chat, Claims, Profile, Notifications)",
    version="2.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
                SELECT id, name, email, role, phone_number, contact_preference,
                       notify_matches, notify_claims, notify_messages, notify_email,
                       avatar_url, created_at 
                FROM users WHERE email = %s
            """, (email,))
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            return user
    finally:
        conn.close()

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
                SELECT id, name, email, role, phone_number, contact_preference,
                       notify_matches, notify_claims, notify_messages, notify_email,
                       avatar_url, created_at 
                FROM users WHERE email = %s
            """, (email,))
            return cur.fetchone()
    except Exception:
        return None
    finally:
        conn.close()

# ==========================================
# Root & Auth Endpoints
# ==========================================
@app.get("/")
def root():
    return {
        "app": "Campus Lost & Found Backend",
        "status": "online",
        "institution": "Kongu Engineering College (@kongu.edu)",
        "version": "2.1.0"
    }

@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest):
    clean_email = req.email.strip().lower()
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (clean_email,))
            existing_user = cur.fetchone()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email is already registered. Please log in instead."
                )

            hashed_pwd = hash_password(req.password)
            cur.execute(
                """
                INSERT INTO users (name, email, password, role)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, email, role, phone_number, contact_preference,
                          notify_matches, notify_claims, notify_messages, notify_email,
                          avatar_url, created_at;
                """,
                (req.name.strip(), clean_email, hashed_pwd, req.role.value)
            )
            new_user = cur.fetchone()
            conn.commit()

            token_payload = {
                "sub": new_user["email"],
                "id": new_user["id"],
                "role": new_user["role"],
                "name": new_user["name"]
            }
            token = create_access_token(token_payload)

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
    generic_error = "Invalid email or password"
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, email, password, role, phone_number, contact_preference,
                       notify_matches, notify_claims, notify_messages, notify_email,
                       avatar_url, created_at 
                FROM users WHERE email = %s
                """,
                (clean_email,)
            )
            user_row = cur.fetchone()
            if not user_row or not verify_password(req.password, user_row["password"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=generic_error
                )

            token_payload = {
                "sub": user_row["email"],
                "id": user_row["id"],
                "role": user_row["role"],
                "name": user_row["name"]
            }
            token = create_access_token(token_payload)

            user_out = UserOut(
                id=user_row["id"],
                name=user_row["name"],
                email=user_row["email"],
                role=user_row["role"],
                phone_number=user_row.get("phone_number"),
                contact_preference=user_row.get("contact_preference", "chat_only"),
                notify_matches=user_row.get("notify_matches", True),
                notify_claims=user_row.get("notify_claims", True),
                notify_messages=user_row.get("notify_messages", True),
                notify_email=user_row.get("notify_email", False),
                avatar_url=user_row.get("avatar_url"),
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
def get_auth_me(current_user: dict = Depends(get_current_user_from_token)):
    return UserOut(**current_user)

# ==========================================
# Categories & Home Stats
# ==========================================
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

    # Calculate real-time item counts per category from database
    cat_counts = {}
    total_count = 0
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT category, COUNT(*) as cnt
                FROM items
                WHERE withdrawn = FALSE
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
        {"id": "all", "title": "All", "count": total_count, "icon": "tag", "priority": True},
        {"id": "id_cards", "title": "ID Cards", "count": cat_counts.get("id cards", 0), "icon": "id-card", "priority": True},
        {"id": "wallets", "title": "Wallets", "count": cat_counts.get("wallets", 0), "icon": "wallet", "priority": True},
        {"id": "keys", "title": "Keys", "count": cat_counts.get("keys", 0), "icon": "key", "priority": False},
        {"id": "books", "title": "Books", "count": cat_counts.get("books", 0), "icon": "book", "priority": False},
        {"id": "electronics", "title": "Electronics", "count": cat_counts.get("electronics", 0), "icon": "laptop", "priority": True},
        {"id": "bags", "title": "Bags", "count": cat_counts.get("bags", 0), "icon": "briefcase", "priority": False},
        {"id": "shoes", "title": "Shoes", "count": cat_counts.get("shoes", cat_counts.get("shoese", 0)), "icon": "shoe", "priority": False},
        {"id": "others", "title": "Others", "count": cat_counts.get("others", 0), "icon": "more-horizontal", "priority": False},
    ]

    role_privileges = {
        "role": user_role,
        "user_name": user_name,
        "can_report_lost": True,
        "can_report_found": True,
        "valuable_custody_access": user_role in ["non_teaching_staff", "admin"],
        "moderation_view": user_role == "admin",
        "badge": "Admin Console" if user_role == "admin" else (
            "Valuable Custodian" if user_role == "non_teaching_staff" else "Campus Member"
        )
    }

    return {
        "categories": categories,
        "role_privileges": role_privileges
    }

@app.get("/home-stats")
def get_home_stats():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE report_type = 'found' AND withdrawn = FALSE;")
            found_count = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE report_type = 'lost' AND withdrawn = FALSE;")
            lost_count = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE status = 'Recovered';")
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
# Specific Items Endpoints (MUST PRECEDE /items/{item_id})
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
                lost_it = ItemOut(
                    id=m["l_id"], title=m["l_title"], category=m["l_category"],
                    description=m["l_description"], image_url=m["l_image_url"], location=m["l_location"],
                    incident_date=m["l_incident_date"], incident_time=m["l_incident_time"],
                    is_valuable=m["l_is_valuable"], status=m["l_status"], reporter_name=m["l_reporter_name"],
                    reporter_role=m["l_reporter_role"], report_type="lost", created_at=m["l_created_at"]
                )
                found_it = ItemOut(
                    id=m["f_id"], title=m["f_title"], category=m["f_category"],
                    description=m["f_description"], image_url=m["f_image_url"], location=m["f_location"],
                    incident_date=m["f_incident_date"], incident_time=m["f_incident_time"],
                    is_valuable=m["f_is_valuable"], status=m["f_status"], reporter_name=m["f_reporter_name"],
                    reporter_role=m["f_reporter_role"], report_type="found", created_at=m["f_created_at"]
                )
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
                lost=len(lost_rows),
                found=len(found_rows),
                active_matches=len(matches_list),
                recovered=len(rec_rows)
            )

            return ActivitySummary(
                summary_stats=stats,
                my_lost_reports=[ItemOut(**r) for r in lost_rows],
                my_found_reports=[ItemOut(**r) for r in found_rows],
                my_matches=matches_list,
                recovered_history=[ItemOut(**r) for r in rec_rows]
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
    category: Optional[str] = None,
    location: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "recent",
    user: Optional[dict] = Depends(get_optional_user)
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT id, user_id, report_type, title, category, description, image_url,
                       location, incident_date, incident_time, is_valuable, status,
                       reporter_name, reporter_role, contact_note, private_verification_detail,
                       contact_preference, is_public, withdrawn, created_at
                FROM items
                WHERE withdrawn = FALSE AND report_type = 'found' AND is_public = TRUE
            """
            params: List[Any] = []

            if category and category.lower() != "all":
                query += " AND LOWER(category) = LOWER(%s)"
                params.append(category)

            if location and location.lower() != "all":
                query += " AND LOWER(location) = LOWER(%s)"
                params.append(location)

            if status_filter and status_filter.lower() != "all":
                query += " AND LOWER(status) = LOWER(%s)"
                params.append(status_filter)

            if search:
                query += " AND (title ILIKE %s OR description ILIKE %s OR location ILIKE %s)"
                wildcard = f"%{search}%"
                params.extend([wildcard, wildcard, wildcard])

            if sort_by == "oldest":
                query += " ORDER BY created_at ASC"
            elif sort_by == "valuable":
                query += " ORDER BY is_valuable DESC, created_at DESC"
            else:
                query += " ORDER BY created_at DESC"

            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            return [ItemOut(**row) for row in rows]
    finally:
        conn.close()

@app.post("/items", response_model=ItemCreateResponse, status_code=status.HTTP_201_CREATED)
def create_item_report(req: ItemCreate, current_user: dict = Depends(get_current_user_from_token)):
    allowed_categories = ["ID Cards", "Wallets", "Keys", "Books", "Electronics", "Bags", "Shoes", "Others"]
    category_match = next((c for c in allowed_categories if c.lower() == req.category.strip().lower()), None)
    if not category_match:
        category_match = "Others"

    is_lost = (req.report_type.strip().lower() == "lost")
    
    if is_lost and (not req.private_verification_detail or len(req.private_verification_detail.strip()) < 3):
        raise HTTPException(
            status_code=400, 
            detail="Private verification detail is required for lost reports to prove ownership later."
        )

    initial_status = "Reported" if is_lost else "Found"
    is_public = not is_lost

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO items (
                    user_id, report_type, title, category, description, image_url,
                    location, incident_date, incident_time, is_valuable, status,
                    reporter_name, reporter_role, private_verification_detail,
                    contact_preference, is_public, withdrawn
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, FALSE
                ) RETURNING id, user_id, report_type, title, category, description, image_url,
                            location, incident_date, incident_time, is_valuable, status,
                            reporter_name, reporter_role, contact_note, private_verification_detail,
                            contact_preference, is_public, withdrawn, created_at;
            """, (
                current_user["id"],
                "lost" if is_lost else "found",
                req.title.strip(),
                category_match,
                req.description.strip(),
                req.image_url or "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
                req.location.strip(),
                req.incident_date or datetime.now().strftime("%Y-%m-%d"),
                req.incident_time or "Approximate time",
                req.is_valuable,
                initial_status,
                current_user["name"],
                current_user["role"],
                req.private_verification_detail.strip() if req.private_verification_detail else None,
                req.contact_preference or "chat_only",
                is_public
            ))
            new_item = cur.fetchone()
            item_out = ItemOut(**new_item)

            candidate_matches: List[ItemOut] = []

            if is_lost:
                cur.execute("""
                    SELECT id, user_id, report_type, title, category, description, image_url,
                           location, incident_date, incident_time, is_valuable, status,
                           reporter_name, reporter_role, contact_note, private_verification_detail,
                           contact_preference, is_public, withdrawn, created_at
                    FROM items
                    WHERE report_type = 'found' AND withdrawn = FALSE
                      AND (LOWER(category) = LOWER(%s) OR title ILIKE %s OR location ILIKE %s)
                    ORDER BY created_at DESC LIMIT 5;
                """, (category_match, f"%{req.title.strip().split()[0]}%", f"%{req.location.strip()}%"))
                found_matches = cur.fetchall()

                for f_row in found_matches:
                    f_item = ItemOut(**f_row)
                    candidate_matches.append(f_item)
                    
                    score = 75
                    if f_item.category.lower() == category_match.lower():
                        score += 15
                    if f_item.location.lower() == req.location.strip().lower():
                        score += 8
                    score = min(score, 98)

                    cur.execute("""
                        INSERT INTO matches (lost_item_id, found_item_id, similarity_score, stage)
                        VALUES (%s, %s, %s, 'verification_pending')
                        ON CONFLICT DO NOTHING;
                    """, (new_item["id"], f_item.id))

                if candidate_matches:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                        VALUES (%s, 'Possible Matches Found', %s, 'match', %s);
                    """, (
                        current_user["id"],
                        f"We found {len(candidate_matches)} possible matches for your lost {new_item['title']}.",
                        new_item["id"]
                    ))
            else:
                # When a found item is reported, find existing lost items that match
                cur.execute("""
                    SELECT id, user_id, title, category, location
                    FROM items
                    WHERE report_type = 'lost' AND withdrawn = FALSE
                      AND (LOWER(category) = LOWER(%s) OR title ILIKE %s)
                    ORDER BY created_at DESC LIMIT 5;
                """, (category_match, f"%{req.title.strip().split()[0]}%"))
                matching_lost_items = cur.fetchall()

                for l_item in matching_lost_items:
                    cur.execute("""
                        INSERT INTO matches (lost_item_id, found_item_id, similarity_score, stage)
                        VALUES (%s, %s, 85, 'verification_pending')
                        ON CONFLICT DO NOTHING;
                    """, (l_item["id"], new_item["id"]))

                    if l_item["user_id"] and l_item["user_id"] != current_user["id"]:
                        cur.execute("""
                            INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                            VALUES (%s, 'Match Found', %s, 'match', %s);
                        """, (
                            l_item["user_id"],
                            f"We found a possible match for your lost {l_item['title']}!",
                            new_item["id"]
                        ))

            conn.commit()

            msg = "Report submitted successfully."
            if is_lost:
                msg = f"Report submitted. Found {len(candidate_matches)} potential matches!" if candidate_matches else "Report submitted. System is actively scanning for matches."
            else:
                msg = "Thanks! Your found item is now visible to the campus."

            return ItemCreateResponse(
                item=item_out,
                message=msg,
                matches=candidate_matches
            )
    finally:
        conn.close()

# ==========================================
# Parameterized Item Endpoints
# ==========================================
@app.get("/items/{item_id}", response_model=ItemOut)
def get_item_by_id(item_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, user_id, report_type, title, category, description, image_url,
                       location, incident_date, incident_time, is_valuable, status,
                       reporter_name, reporter_role, contact_note, private_verification_detail,
                       contact_preference, is_public, withdrawn, created_at
                FROM items WHERE id = %s
            """, (item_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Item not found")
            return ItemOut(**row)
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
            if item["user_id"] != current_user["id"] and current_user["role"] != "admin":
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
                query = f"UPDATE items SET {', '.join(updates)} WHERE id = %s RETURNING *;"
                cur.execute(query, tuple(params))
                updated_row = cur.fetchone()
                conn.commit()
                return ItemOut(**updated_row)
            return ItemOut(**item)
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
            if item["user_id"] != current_user["id"] and current_user["role"] != "admin":
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
                SELECT f.id, f.user_id, f.report_type, f.title, f.category, f.description,
                       f.image_url, f.location, f.incident_date, f.incident_time, f.is_valuable,
                       f.status, f.reporter_name, f.reporter_role, f.contact_note,
                       f.private_verification_detail, f.contact_preference, f.is_public,
                       f.withdrawn, f.created_at
                FROM matches m
                JOIN items f ON m.found_item_id = f.id
                WHERE m.lost_item_id = %s AND f.withdrawn = FALSE;
            """, (item_id,))
            rows = cur.fetchall()
            return [ItemOut(**r) for r in rows]
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
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Campus System', 'system', 'Verification details confirmed. Peer chat is unlocked to arrange item handover.', TRUE)
                    RETURNING id, item_id, sender_id, sender_name, sender_role, message, is_system, created_at;
                """, (item_id,))
                new_msg = cur.fetchone()
                conn.commit()
                rows = [new_msg]

            return [MessageOut(**r) for r in rows]
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
                    VALUES (%s, 'New Chat Message', %s, 'message', %s);
                """, (
                    it["user_id"],
                    f"New message from {current_user['name']} regarding {it['title']}.",
                    item_id
                ))

            conn.commit()
            return MessageOut(**msg)
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

            cur.execute("UPDATE items SET status = 'Under Verification' WHERE id = %s", (item_id,))

            if item["user_id"]:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Claim Submitted', %s, 'claim', %s);
                """, (
                    item["user_id"],
                    f"Someone submitted ownership verification for your found {item['title']}.",
                    item_id
                ))

            conn.commit()
            return ClaimOut(**claim)
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

            new_claim_status = "approved" if req.approved else "rejected"
            new_item_status = "Matched" if req.approved else "Found"

            cur.execute("UPDATE claims SET status = %s WHERE id = %s", (new_claim_status, claim_id))
            cur.execute("UPDATE items SET status = %s WHERE id = %s", (new_item_status, claim["item_id"]))

            if claim["claimant_id"]:
                notif_msg = f"Your claim on {item['title']} has been confirmed! Chat is now unlocked." if req.approved else f"Your claim on {item['title']} could not be verified."
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                    VALUES (%s, 'Verification Update', %s, 'status_update', %s);
                """, (claim["claimant_id"], notif_msg, claim["item_id"]))

            conn.commit()
            return {"status": new_claim_status, "item_status": new_item_status}
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
            return [NotificationOut(**r) for r in rows]
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
    return UserOut(**current_user)

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
                    RETURNING id, name, email, role, phone_number, contact_preference,
                              notify_matches, notify_claims, notify_messages, notify_email,
                              avatar_url, created_at;
                """, params)
                updated_user = cur.fetchone()
                conn.commit()
                return UserOut(**updated_user)
            return UserOut(**current_user)
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
            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE user_id = %s AND withdrawn = FALSE", (uid,))
            reported = cur.fetchone()["cnt"]

            cur.execute("SELECT COUNT(*) as cnt FROM items WHERE user_id = %s AND status = 'Recovered'", (uid,))
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
            
            # If flagged repeatedly (e.g. 3+ flags), notify admins
            if new_flags >= 3:
                cur.execute("SELECT id FROM users WHERE role = 'admin'")
                admins = cur.fetchall()
                for adm in admins:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id, is_read)
                        VALUES (%s, 'Moderation Alert', %s, 'status', %s)
                    """, (
                        adm["id"],
                        f"Item '{item['title']}' (ID #{item_id}) has received {new_flags} suspicious report flags.",
                        item_id
                    ))
            conn.commit()
            return {"message": "Report flagged for moderation review", "flag_count": new_flags}
    finally:
        conn.close()

@app.get("/admin/flagged-reports")
def get_flagged_reports(current_user: dict = Depends(get_current_user_from_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
            rows = cur.fetchall()
            return rows
    finally:
        conn.close()

@app.patch("/admin/users/{user_id}/suspend")
def suspend_user(user_id: int, current_user: dict = Depends(get_current_user_from_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET is_suspended = TRUE WHERE id = %s RETURNING id, name, email", (user_id,))
            u = cur.fetchone()
            if not u:
                raise HTTPException(status_code=404, detail="User not found")
            # Automatically withdraw all reports from this suspended user
            cur.execute("UPDATE items SET withdrawn = TRUE, status = 'Withdrawn' WHERE user_id = %s", (user_id,))
            conn.commit()
            return {"message": f"User {u['name']} ({u['email']}) suspended and fraudulent reports withdrawn."}
    finally:
        conn.close()

if __name__ == "__main__":
    # Campus Lost & Found Backend Server
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
