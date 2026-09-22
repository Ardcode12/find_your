import asyncio
import httpx
from main import app
from database import get_db_connection

async def run_async_tests():
    print("--- Starting Backend Auth & PostgreSQL Tests ---")
    
    # 0. Clean up test user if exists
    test_email = "gowtham.21it@kongu.edu"
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM users WHERE email = %s", (test_email,))
        conn.commit()
    conn.close()
    print("Cleaned test user.")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8000") as client:
        # 1. Root endpoint test
        root_resp = await client.get("/")
        assert root_resp.status_code == 200
        print("[PASS] Root endpoint:", root_resp.json())

        # 2. Invalid email domain test
        invalid_resp = await client.post("/auth/signup", json={
            "name": "Gowtham",
            "email": "gowtham@gmail.com",
            "password": "SecretPassword123",
            "confirm_password": "SecretPassword123",
            "role": "student"
        })
        assert invalid_resp.status_code == 422 or invalid_resp.status_code == 400
        print("[PASS] Rejection of non-@kongu.edu email passed:", invalid_resp.status_code)

        # 3. Password mismatch test
        mismatch_resp = await client.post("/auth/signup", json={
            "name": "Gowtham",
            "email": test_email,
            "password": "Password123",
            "confirm_password": "PasswordMismatch",
            "role": "student"
        })
        assert mismatch_resp.status_code == 422 or mismatch_resp.status_code == 400
        print("[PASS] Password mismatch check passed")

        # 4. Valid signup test
        signup_resp = await client.post("/auth/signup", json={
            "name": "Gowtham K",
            "email": test_email,
            "password": "Gowtham@Password2026",
            "confirm_password": "Gowtham@Password2026",
            "role": "student"
        })
        assert signup_resp.status_code == 201, f"Expected 201, got {signup_resp.status_code}: {signup_resp.text}"
        signup_data = signup_resp.json()
        assert "access_token" in signup_data
        assert signup_data["user"]["email"] == test_email
        assert signup_data["user"]["role"] == "student"
        print("[PASS] Valid signup test passed! Token received:", signup_data["access_token"][:30] + "...")

        # 5. Duplicate signup test
        dup_resp = await client.post("/auth/signup", json={
            "name": "Gowtham K",
            "email": test_email,
            "password": "Gowtham@Password2026",
            "confirm_password": "Gowtham@Password2026",
            "role": "student"
        })
        assert dup_resp.status_code == 400
        assert "already registered" in dup_resp.json()["detail"]
        print("[PASS] Duplicate email rejection passed:", dup_resp.json()["detail"])

        # 6. Login test with wrong password (Generic error test)
        wrong_pwd_resp = await client.post("/auth/login", json={
            "email": test_email,
            "password": "WrongPassword999"
        })
        assert wrong_pwd_resp.status_code == 401
        assert wrong_pwd_resp.json()["detail"] == "Invalid email or password"
        print("[PASS] Wrong password generic error check passed")

        # 7. Login test with non-existent email (Generic error test)
        wrong_email_resp = await client.post("/auth/login", json={
            "email": "unknown.user@kongu.edu",
            "password": "SomePassword123"
        })
        assert wrong_email_resp.status_code == 401
        assert wrong_email_resp.json()["detail"] == "Invalid email or password"
        print("[PASS] Unknown email generic error check passed")

        # 8. Login test with correct credentials
        login_resp = await client.post("/auth/login", json={
            "email": test_email,
            "password": "Gowtham@Password2026"
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        print("[PASS] Correct login passed! Token generated.")

        # 9. Categories endpoint test with token
        cat_resp = await client.get("/categories", headers={"Authorization": f"Bearer {token}"})
        assert cat_resp.status_code == 200
        cat_data = cat_resp.json()
        assert len(cat_data["categories"]) >= 6
        print("[PASS] Categories fetched successfully:", len(cat_data["categories"]), "categories found")

        # 10. Verify record in PostgreSQL directly
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, email, role, created_at FROM users WHERE email = %s", (test_email,))
            row = cur.fetchone()
            assert row is not None
            print("[PASS] Verified user record directly in PostgreSQL:", dict(row))
        conn.close()

    print("\n--- ALL BACKEND TESTS PASSED WITH 100% SUCCESS ---")

def test_auth_and_postgres():
    asyncio.run(run_async_tests())

if __name__ == "__main__":
    asyncio.run(run_async_tests())

