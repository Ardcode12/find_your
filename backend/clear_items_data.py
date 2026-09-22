"""
Clear all item, claim, message, notification, and escalation data.
Preserve departments and user accounts (superadmin, department admins, students).
"""
import psycopg

DB_CONN = "dbname=lost_and_found user=postgres password=arnald2826 host=localhost port=5432"

def clear_data_keep_logins():
    conn = psycopg.connect(DB_CONN)
    try:
        with conn.cursor() as cur:
            print("Purging all items, claims, messages, notifications, and escalation history...")
            cur.execute("TRUNCATE TABLE claims RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE messages RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE escalation_history RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE items RESTART IDENTITY CASCADE;")
            conn.commit()

            cur.execute("SELECT COUNT(*) FROM users;")
            user_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM departments;")
            dept_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM items;")
            item_count = cur.fetchone()[0]

            print(f"Done! Remaining in database:")
            print(f"  - Users (login credentials intact): {user_count}")
            print(f"  - Departments intact: {dept_count}")
            print(f"  - Items (products): {item_count}")
    finally:
        conn.close()

if __name__ == "__main__":
    clear_data_keep_logins()
