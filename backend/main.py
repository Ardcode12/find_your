import os
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware

from database import get_db_connection, init_db
from auth import create_access_token, decode_access_token, hash_password, verify_password
from schemas import (
    ActivitySummary,
    AuthResponse,
    CategoryItem,
    ClaimCreate,
    ClaimOut,
    ClaimVerifyRequest,
    ItemCreate,
    ItemOut,
    LoginRequest,
    MessageCreate,
    MessageOut,
    NotificationOut,
    SignupRequest,
    UserOut,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database and all tables are initialized
    try:
        init_db()
        print("[FASTAPI] Startup: PostgreSQL database and all tables ready.")
    except Exception as e:
        print(f"[FASTAPI] Startup DB init warning: {e}")
    yield

app = FastAPI(
    title="Campus Lost & Found API",
    description="Backend for Kongu Campus Lost and Found system (Full Dashboard, Reports, Chat & Claims)",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for local and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            cur.execute("SELECT id, name, email, role, created_at FROM users WHERE email = %s", (email,))
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            return user
    finally:
        conn.close()

def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Optional user token resolution for public/mixed endpoints."""
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
            cur.execute("SELECT id, name, email, role, created_at FROM users WHERE email = %s", (email,))
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
        "version": "2.0.0"
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
                RETURNING id, name, email, role, created_at;
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
                "SELECT id, name, email, password, role, created_at FROM users WHERE email = %s",
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
        {"id": "all", "title": "All", "count": 12, "icon": "sparkles", "priority": True},
        {"id": "id_cards", "title": "ID Cards", "count": 28, "icon": "id-card", "priority": True},
        {"id": "wallets", "title": "Wallets", "count": 19, "icon": "wallet", "priority": False},
        {"id": "keys", "title": "Keys", "count": 14, "icon": "key", "priority": False},
        {"id": "electronics", "title": "Electronics", "count": 23, "icon": "plug", "priority": True},
        {"id": "bags", "title": "Bags", "count": 16, "icon": "bag", "priority": False},
        {"id": "shoese", "title": "Shoese", "count": 8, "icon": "shoe", "priority": False},
        {"id": "books", "title": "Books", "count": 31, "icon": "book", "priority": False},
        {"id": "others", "title": "Others", "count": 42, "icon": "box", "priority": False},
    ]

    role_privileges = {
        "role": user_role,
        "user_name": user_name,
        "can_report_lost": True,
        "can_report_found": True,
        "valuable_custody_access": user_role in ["non_teaching_staff", "staff", "admin"],
        "moderation_view": user_role == "admin",
        "badge": "Staff Console" if user_role in ["staff", "non_teaching_staff"] else (
            "Admin Console" if user_role == "admin" else "Student"
        )
    }

    return {
        "categories": categories,
        "role_privileges": role_privileges
    }

# ==========================================
# SECTION 3 & 4: Items Feed & Listings
# ==========================================
@app.get("/items", response_model=List[ItemOut])
def get_items(
    search: Optional[str] = Query(None, description="Search keyword"),
    category: Optional[str] = Query(None, description="Filter category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter status"),
    location: Optional[str] = Query(None, description="Filter location"),
    sort: Optional[str] = Query("recent", description="'recent' or 'oldest'"),
    report_type: Optional[str] = Query("found", description="'found', 'lost', or 'all'")
):
    """
    Returns public listings matching filters.
    Lost reports are private to owners unless specifically queried.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM items WHERE 1=1"
            params = []

            # Filter by report_type
            if report_type and report_type != "all":
                query += " AND report_type = %s"
                params.append(report_type)

            # Filter by Category
            if category and category.lower() not in ["all", ""]:
                # Match case-insensitively or normalized
                query += " AND LOWER(category) = LOWER(%s)"
                params.append(category)

            # Filter by Status
            if status_filter and status_filter.lower() not in ["all", ""]:
                query += " AND LOWER(status) = LOWER(%s)"
                params.append(status_filter)

            # Filter by Location
            if location and location.lower() not in ["all", ""]:
                query += " AND LOWER(location) = LOWER(%s)"
                params.append(location)

            # Global Search Filter
            if search and search.strip():
                query += " AND (title ILIKE %s OR description ILIKE %s OR location ILIKE %s)"
                term = f"%{search.strip()}%"
                params.extend([term, term, term])

            # Sorting
            if sort == "oldest":
                query += " ORDER BY created_at ASC"
            else:
                query += " ORDER BY created_at DESC"

            cur.execute(query, tuple(params))
            items = cur.fetchall()

            # Format and sanitize reporter name (First Name + Role only)
            result = []
            for it in items:
                first_name = it["reporter_name"].split()[0] if it["reporter_name"] else "Campus"
                it_dict = dict(it)
                it_dict["reporter_name"] = first_name
                result.append(ItemOut(**it_dict))
            return result
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
            it_dict = dict(item)
            it_dict["reporter_name"] = item["reporter_name"].split()[0] if item["reporter_name"] else "Campus"
            return ItemOut(**it_dict)
    finally:
        conn.close()

# ==========================================
# SECTION 7: Report Item Form (Lost & Found)
# ==========================================
@app.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item_report(
    req: ItemCreate,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Submits a new Lost or Found item report:
    - Automatically flags valuable items based on category/override
    - Runs automatic smart-match against existing reports
    """
    # Auto-flag valuable if electronics, wallets, jewelry or id cards
    is_val = req.is_valuable
    if req.category.lower() in ["electronics", "wallets", "id cards", "jewelry"]:
        is_val = True

    default_images = {
        "shoese": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
        "wallets": "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80",
        "id cards": "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80",
        "electronics": "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80",
        "bags": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
        "keys": "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
        "books": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
        "others": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
    }

    img_url = req.image_url
    if not img_url:
        img_url = default_images.get(req.category.lower(), default_images["others"])

    date_str = req.incident_date or datetime.now().strftime("%Y-%m-%d")
    time_str = req.incident_time or datetime.now().strftime("%I:%M %p")
    initial_status = "Reported" if req.report_type == "lost" else "Found"

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1. Insert report
            cur.execute("""
                INSERT INTO items (
                    user_id, report_type, title, category, description,
                    image_url, location, incident_date, incident_time,
                    is_valuable, status, reporter_name, reporter_role
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
            """, (
                current_user["id"], req.report_type.lower(), req.title.strip(),
                req.category, req.description.strip(), img_url,
                req.location, date_str, time_str,
                is_val, initial_status, current_user["name"], current_user["role"]
            ))
            new_item = cur.fetchone()

            # 2. Smart auto-match algorithm:
            # If opposite report exists in same category with similar title
            opp_type = "found" if req.report_type == "lost" else "lost"
            cur.execute("""
                SELECT id, title, user_id FROM items 
                WHERE report_type = %s AND LOWER(category) = LOWER(%s) AND status != 'Recovered'
                LIMIT 1;
            """, (opp_type, req.category))
            potential_match = cur.fetchone()

            if potential_match:
                # Update both items to 'Matched'
                cur.execute("UPDATE items SET status = 'Matched' WHERE id IN (%s, %s);", (new_item["id"], potential_match["id"]))
                new_item["status"] = "Matched"

                # Send auto-match notification
                notif_msg = f"Potential match found between your report '{new_item['title']}' and '{potential_match['title']}'!"
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, item_id)
                    VALUES (%s, %s, %s, %s, %s);
                """, (current_user["id"], "System Auto-Match Alert", notif_msg, "match", new_item["id"]))

                if potential_match["user_id"]:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id)
                        VALUES (%s, %s, %s, %s, %s);
                    """, (potential_match["user_id"], "System Auto-Match Alert", notif_msg, "match", potential_match["id"]))

                # Add initial system message to chat thread
                sys_chat = f"System Match: '{new_item['title']}' has been matched with '{potential_match['title']}'. Please verify identifying details before arranging pickup."
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Campus Match Bot', 'system', %s, TRUE);
                """, (new_item["id"], sys_chat))

            conn.commit()
            it_dict = dict(new_item)
            it_dict["reporter_name"] = current_user["name"].split()[0]
            return ItemOut(**it_dict)
    finally:
        conn.close()

# ==========================================
# SECTION 6: My Activity Panel
# ==========================================
@app.get("/items/my-activity", response_model=ActivitySummary)
def get_my_activity(current_user: dict = Depends(get_current_user_from_token)):
    """
    Returns 4 categories of activity:
    1. My Lost Reports (private to this user)
    2. My Found Reports (public items posted by this user)
    3. My Matches (items matched for this user)
    4. Recovered / History (completed cases)
    """
    uid = current_user["id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1. Lost
            cur.execute("SELECT * FROM items WHERE user_id = %s AND report_type = 'lost' ORDER BY created_at DESC", (uid,))
            lost_rows = cur.fetchall()

            # 2. Found
            cur.execute("SELECT * FROM items WHERE user_id = %s AND report_type = 'found' ORDER BY created_at DESC", (uid,))
            found_rows = cur.fetchall()

            # 3. Matches
            cur.execute("SELECT * FROM items WHERE (user_id = %s OR id IN (SELECT item_id FROM claims WHERE claimant_id = %s)) AND status = 'Matched' ORDER BY created_at DESC", (uid, uid))
            match_rows = cur.fetchall()

            # 4. Recovered
            cur.execute("SELECT * FROM items WHERE (user_id = %s OR id IN (SELECT item_id FROM claims WHERE claimant_id = %s)) AND status = 'Recovered' ORDER BY created_at DESC", (uid, uid))
            rec_rows = cur.fetchall()

            def sanitize(rows):
                res = []
                for r in rows:
                    d = dict(r)
                    d["reporter_name"] = r["reporter_name"].split()[0] if r["reporter_name"] else "Campus"
                    res.append(ItemOut(**d))
                return res

            return ActivitySummary(
                my_lost_reports=sanitize(lost_rows),
                my_found_reports=sanitize(found_rows),
                my_matches=sanitize(match_rows),
                recovered_history=sanitize(rec_rows)
            )
    finally:
        conn.close()

# ==========================================
# SECTION 8: Chat & Messaging
# ==========================================
@app.get("/items/{item_id}/messages", response_model=List[MessageOut])
def get_item_messages(item_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM messages WHERE item_id = %s ORDER BY created_at ASC", (item_id,))
            messages = cur.fetchall()

            # If no messages yet, seed default welcome system message
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
# SECTION 9: Ownership Verification Step
# ==========================================
@app.post("/items/{item_id}/claim", response_model=ClaimOut)
def submit_claim(
    item_id: int,
    req: ClaimCreate,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    User provides 2-3 hidden details not visible in the photo.
    Item status updates to 'Under Verification'.
    """
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

            # Update item status to 'Under Verification'
            cur.execute("UPDATE items SET status = 'Under Verification' WHERE id = %s;", (item_id,))

            # Add system notice in chat
            sys_msg = f"Verification claim submitted by {current_user['name'].split()[0]} ({current_user['role']}). Awaiting confirmation of hidden details."
            cur.execute("""
                INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                VALUES (%s, 'Verification Desk', 'system', %s, TRUE);
            """, (item_id, sys_msg))

            # Add notification
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
    """
    Finder or Staff verifies and approves the claim.
    On approval:
    - claim status = 'approved'
    - item status = 'Recovered'
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT c.*, i.title, i.id as item_id FROM claims c JOIN items i ON c.item_id = i.id WHERE c.id = %s", (claim_id,))
            claim = cur.fetchone()
            if not claim:
                raise HTTPException(status_code=404, detail="Claim not found")

            new_status = "approved" if req.approved else "rejected"
            cur.execute("UPDATE claims SET status = %s WHERE id = %s", (new_status, claim_id))

            if req.approved:
                cur.execute("UPDATE items SET status = 'Recovered' WHERE id = %s", (claim["item_id"],))

                # Post system chat message
                cur.execute("""
                    INSERT INTO messages (item_id, sender_name, sender_role, message, is_system)
                    VALUES (%s, 'Verification Desk', 'system', '🎉 Ownership Confirmed! This item has been verified and marked as RECOVERED.', TRUE);
                """, (claim["item_id"],))

                # Send notification to claimant
                if claim["claimant_id"]:
                    cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type, item_id)
                        VALUES (%s, 'Item Recovered!', %s, 'claim', %s);
                    """, (claim["claimant_id"], f"Your claim for '{claim['title']}' was approved. Item is officially recovered!", claim["item_id"]))

            conn.commit()
            return {
                "message": f"Claim {new_status} successfully.",
                "item_status": "Recovered" if req.approved else "Under Verification"
            }
    finally:
        conn.close()

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

            # If empty, add helpful initial notifications
            if not notifs:
                init_notifs = [
                    (current_user["id"], "Welcome to Campus Lost & Found", "Browse the feed or report items you've lost or found around campus.", "info", None),
                    (current_user["id"], "Valuable Items Protection", "High value items (Wallets, Electronics, Jewelry) are secured through Staff Desk.", "info", None)
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
