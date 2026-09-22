import asyncio
import pytest
import httpx
from datetime import datetime, timedelta, timezone
from main import app
from database import get_db_connection, KEC_DEPARTMENTS

@pytest.mark.anyio
async def test_full_department_and_admin_workflow():
    print("\n--- Starting Department & Admin Layer Verification ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8000") as client:
        # 1. Clean test users
        dept_admin_email = "dept.cse@kongu.edu"
        super_admin_email = "superadmin@kongu.edu"
        student_email = "test.student@kongu.edu"

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE email IN (%s, %s, %s)",
                        (dept_admin_email, super_admin_email, student_email))
            cur.execute("DELETE FROM items WHERE reporter_name IN ('DeptTester', 'AdminTester', 'StudentTester')")
            conn.commit()
        conn.close()

        # 2. Test GET /departments
        dept_resp = await client.get("/departments")
        assert dept_resp.status_code == 200
        dept_list = dept_resp.json()
        assert len(dept_list) >= 12
        assert any(d["code"] == "CSE" for d in dept_list)
        print(f"[PASS] GET /departments returned {len(dept_list)} KEC departments")

        # 3. Signup as department_admin
        dept_signup_resp = await client.post("/auth/signup", json={
            "name": "DeptTester",
            "email": dept_admin_email,
            "password": "Password123",
            "confirm_password": "Password123",
            "role": "department_admin",
            "department": "Computer Science & Engineering",
            "department_code": "CSE",
            "phone": "+91 9876543210"
        })
        assert dept_signup_resp.status_code == 201
        dept_admin_token = dept_signup_resp.json()["access_token"]
        assert dept_signup_resp.json()["user"]["role"] == "department_admin"
        assert dept_signup_resp.json()["user"]["department_code"] == "CSE"
        print("[PASS] Department Admin signup successful with CSE department")

        # 4. Signup as super admin
        admin_signup_resp = await client.post("/auth/signup", json={
            "name": "AdminTester",
            "email": super_admin_email,
            "password": "Password123",
            "confirm_password": "Password123",
            "role": "admin",
            "phone": "+91 9876543211"
        })
        assert admin_signup_resp.status_code == 201
        super_admin_token = admin_signup_resp.json()["access_token"]
        assert admin_signup_resp.json()["user"]["role"] == "admin"
        print("[PASS] Super Admin signup successful")

        # 5. Signup as regular student
        student_signup_resp = await client.post("/auth/signup", json={
            "name": "StudentTester",
            "email": student_email,
            "password": "Password123",
            "confirm_password": "Password123",
            "role": "student",
            "department": "Information Technology",
            "department_code": "IT"
        })
        assert student_signup_resp.status_code == 201
        student_token = student_signup_resp.json()["access_token"]
        print("[PASS] Student signup successful")

        # 6. Report a VALUABLE item (should IMMEDIATELY escalate to department, no 24h wait)
        valuable_item_resp = await client.post("/items", headers={"Authorization": f"Bearer {student_token}"}, json={
            "report_type": "found",
            "title": "Gold Bracelet with Diamond Clasp",
            "category": "jewelry",
            "description": "Found near CSE Block Room 102",
            "location": "CSE Department Block",
            "is_valuable": True
        })
        assert valuable_item_resp.status_code == 201
        valuable_item = valuable_item_resp.json()
        assert valuable_item["escalation_level"] == "department"
        assert valuable_item["status"] == "Escalated to Department"
        assert valuable_item["assigned_department"] == "CSE"
        val_item_id = valuable_item["id"]
        print(f"[PASS] Valuable item immediate escalation to department (CSE) passed (Item #{val_item_id})")

        # 7. Report a normal item at a common place (e.g. FC bus stand)
        common_item_resp = await client.post("/items", headers={"Authorization": f"Bearer {student_token}"}, json={
            "report_type": "found",
            "title": "Black Umbrella with Wooden Handle",
            "category": "others",
            "description": "Left on bench near FC bus stand",
            "location": "FC bus stand",
            "is_valuable": False
        })
        assert common_item_resp.status_code == 201
        common_item = common_item_resp.json()
        assert common_item["escalation_level"] == "user"
        common_item_id = common_item["id"]
        print(f"[PASS] Normal item reported with user level custody (Item #{common_item_id})")

        # 8. Simulate 24 hours passage on the common-place item and test auto-escalate
        conn = get_db_connection()
        with conn.cursor() as cur:
            old_time = datetime.now(timezone.utc) - timedelta(hours=25)
            cur.execute("UPDATE items SET created_at = %s WHERE id = %s", (old_time, common_item_id))
            conn.commit()
        conn.close()

        # Trigger auto-escalation
        escalate_resp = await client.post("/system/auto-escalate", headers={"Authorization": f"Bearer {super_admin_token}"})
        assert escalate_resp.status_code == 200
        escalate_data = escalate_resp.json()
        assert common_item_id in escalate_data["escalated_item_ids"]
        print(f"[PASS] Auto-escalation triggered: {escalate_data['total']} items escalated")

        # Verify common place item escalated to Admin Office
        common_check = await client.get(f"/items/{common_item_id}", headers={"Authorization": f"Bearer {student_token}"})
        assert common_check.status_code == 200
        assert common_check.json()["escalation_level"] == "admin"
        assert common_check.json()["status"] == "At Admin Office"
        print("[PASS] Common-place item properly escalated to Admin Office after 24h")

        # 9. Test Department Admin view: GET /department/items
        dept_items_resp = await client.get("/department/items", headers={"Authorization": f"Bearer {dept_admin_token}"})
        assert dept_items_resp.status_code == 200
        print(f"[PASS] GET /department/items succeeded: {len(dept_items_resp.json())} items found")

        # 10. Department verify & handover: POST /department/items/{id}/verify
        verify_resp = await client.post(
            f"/department/items/{val_item_id}/verify",
            headers={"Authorization": f"Bearer {dept_admin_token}"},
            json={"handover_by": "Prof. CSE Incharge", "notes": "Claimant verified with student ID and purchase invoice"}
        )
        assert verify_resp.status_code == 200
        print("[PASS] Department verified & handover completed successfully")

        # Verify item status changed to Recovered
        item_after_verify = await client.get(f"/items/{val_item_id}", headers={"Authorization": f"Bearer {dept_admin_token}"})
        assert item_after_verify.json()["status"] == "Recovered"
        assert item_after_verify.json()["handover_by"] == "Prof. CSE Incharge"
        print("[PASS] Item status updated to Recovered with handover record")

        # 11. Test Admin Analytics: GET /admin/analytics
        analytics_resp = await client.get("/admin/analytics", headers={"Authorization": f"Bearer {super_admin_token}"})
        assert analytics_resp.status_code == 200
        analytics = analytics_resp.json()
        assert "total_items" in analytics
        assert "recovery_rate" in analytics
        assert "by_department" in analytics
        assert len(analytics["by_department"]) > 0
        print(f"[PASS] Admin analytics verified: Total items={analytics['total_items']}, Recovery rate={analytics['recovery_rate']}%")

        # 12. Test Admin Items: GET /admin/items
        admin_items_resp = await client.get("/admin/items", headers={"Authorization": f"Bearer {super_admin_token}"})
        assert admin_items_resp.status_code == 200
        print(f"[PASS] GET /admin/items succeeded: {len(admin_items_resp.json())} items at admin office")

        # 13. Test Gemini Vision AI endpoint
        gemini_resp = await client.post(
            "/gemini/analyze-image",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80"}
        )
        assert gemini_resp.status_code == 200
        gemini_data = gemini_resp.json()
        assert "title" in gemini_data
        assert "category" in gemini_data
        assert "is_valuable" in gemini_data
        print(f"[PASS] Gemini Vision endpoint response received: title='{gemini_data['title']}', valuable={gemini_data['is_valuable']}")

    print("\n--- ALL DEPARTMENT & ADMIN LAYER VERIFICATIONS PASSED 100% ---")

def test_department_admin_layer():
    asyncio.run(test_full_department_and_admin_workflow())

if __name__ == "__main__":
    asyncio.run(test_full_department_and_admin_workflow())
