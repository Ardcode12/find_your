import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware

from database import get_db_connection, init_db
from auth import create_access_token, decode_access_token, hash_password, verify_password
from schemas import AuthResponse, CategoryItem, LoginRequest, SignupRequest, UserOut

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database and users table are initialized
    try:
        init_db()
        print("[FASTAPI] Startup: PostgreSQL database and users table ready.")
    except Exception as e:
        print(f"[FASTAPI] Startup DB init warning: {e}")
    yield

app = FastAPI(
    title="Campus Lost & Found API",
    description="Backend for Kongu Campus Lost and Found system (Authentication & Roles)",
    version="1.0.0",
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

@app.get("/")
def root():
    return {
        "app": "Campus Lost & Found Backend",
        "status": "online",
        "institution": "Kongu Engineering College (@kongu.edu)"
    }

@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest):
    """
    Register a new user:
    - Verifies @kongu.edu domain (enforced by Pydantic schema)
    - Checks email uniqueness in PostgreSQL
    - Hashes password with bcrypt
    - Stores record in 'users' table
    - Returns JWT token and user profile
    """
    clean_email = req.email.strip().lower()
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if email is already registered
            cur.execute("SELECT id FROM users WHERE email = %s", (clean_email,))
            existing_user = cur.fetchone()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email is already registered. Please log in instead."
                )

            # Hash the password
            hashed_pwd = hash_password(req.password)

            # Insert new user record
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

            # Generate JWT token
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
    """
    Log in an existing user:
    - Look up user by email
    - Compare entered password against stored hashed password
    - Show generic 'Invalid email or password' error if either fails (security best practice)
    - On success: return JWT token + user profile
    """
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
            
            # If user not found, reject with generic error
            if not user_row:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=generic_error
                )

            # Verify password hash
            if not verify_password(req.password, user_row["password"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=generic_error
                )

            # Generate JWT token
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
    """Fetch profile of currently authenticated user."""
    return UserOut(**current_user)

@app.get("/categories")
def get_categories(authorization: Optional[str] = Header(None)):
    """
    Returns item categories matching UI Screen 2.
    Dynamically customizes response based on role if logged in.
    """
    user_role = "guest"
    user_name = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            user_role = payload.get("role", "student")
            user_name = payload.get("name", "Student")

    # Categories matching Screen 2 mockup
    categories = [
        {"id": "new_arrivals", "title": "New Arrivals", "count": 208, "icon": "cart", "priority": True},
        {"id": "clothes", "title": "Clothes", "count": 358, "icon": "shirt", "priority": False},
        {"id": "bags", "title": "Bags", "count": 160, "icon": "bag", "priority": False},
        {"id": "shoese", "title": "Shoese", "count": 230, "icon": "shoe", "priority": False},
        {"id": "electronics", "title": "Electronics", "count": 130, "icon": "plug", "priority": False},
        {"id": "jewelry", "title": "Jewelry", "count": 87, "icon": "diamond", "priority": True},
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
