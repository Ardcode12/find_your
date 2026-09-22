"""
Clean Database & Institutional Seed Data Script
Campus Lost & Found System - Kongu Engineering College (KEC)
"""
import sys
import psycopg
from datetime import datetime, timedelta, timezone
from auth import hash_password

DB_CONN = "dbname=lost_and_found user=postgres password=arnald2826 host=localhost port=5432"

def clean_and_seed():
    conn = psycopg.connect(DB_CONN)
    try:
        with conn.cursor() as cur:
            print("1. Purging all raw test data...")
            # Truncate tables in dependency order
            cur.execute("TRUNCATE TABLE claims RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE messages RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE escalation_history RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE items RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE users RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE departments RESTART IDENTITY CASCADE;")
            conn.commit()
            print("   -> Raw tables truncated successfully.")

            # 2. Seed official KEC Departments
            print("2. Seeding official KEC Departments...")
            departments_data = [
                ("CSE", "Computer Science & Engineering", "Block A, Room 101", "hod.cse@kongu.edu"),
                ("IT", "Information Technology", "Block A, Room 201", "hod.it@kongu.edu"),
                ("ECE", "Electronics & Communication Engineering", "Block B, Room 101", "hod.ece@kongu.edu"),
                ("EEE", "Electrical & Electronics Engineering", "Block B, Room 201", "hod.eee@kongu.edu"),
                ("MECH", "Mechanical Engineering", "Block C, Room 101", "hod.mech@kongu.edu"),
                ("CIVIL", "Civil Engineering", "Block C, Room 201", "hod.civil@kongu.edu"),
                ("MBA", "Master of Business Administration", "Block D, Room 101", "hod.mba@kongu.edu"),
                ("MCA", "Master of Computer Applications", "Block D, Room 201", "hod.mca@kongu.edu"),
                ("AUTO", "Automobile Engineering", "Block E, Room 101", "hod.auto@kongu.edu"),
                ("CHEM", "Chemical Engineering", "Block E, Room 201", "hod.chem@kongu.edu"),
                ("FOOD", "Food Technology", "Block F, Room 101", "hod.food@kongu.edu"),
                ("BIO", "Biomedical Engineering", "Block F, Room 201", "hod.bio@kongu.edu"),
            ]
            for code, name, loc, email in departments_data:
                cur.execute("""
                    INSERT INTO departments (code, name, office_location, hod_email, created_at)
                    VALUES (%s, %s, %s, %s, NOW());
                """, (code, name, loc, email))
            print(f"   -> Inserted {len(departments_data)} official KEC departments.")

            # 3. Seed Institutional Users
            print("3. Seeding institutional users...")
            pwd_hash = hash_password("Password123")
            users_data = [
                # Admin
                (1, "Dr. S. K. Ramesh", "superadmin@kongu.edu", pwd_hash, "admin", None, None, "+91 94430 12345"),
                # Dept Admins
                (2, "Prof. M. Anand", "dept.cse@kongu.edu", pwd_hash, "department_admin", "Computer Science & Engineering", "CSE", "+91 94431 23456"),
                (3, "Prof. K. Priya", "dept.it@kongu.edu", pwd_hash, "department_admin", "Information Technology", "IT", "+91 94432 34567"),
                (4, "Prof. R. Suresh", "dept.ece@kongu.edu", pwd_hash, "department_admin", "Electronics & Communication Engineering", "ECE", "+91 94433 45678"),
                # Students
                (5, "Gowtham K", "gowtham.21it@kongu.edu", pwd_hash, "student", "Information Technology", "IT", "+91 98765 43210"),
                (6, "Ananya S", "ananya.22cse@kongu.edu", pwd_hash, "student", "Computer Science & Engineering", "CSE", "+91 98765 43211"),
                (7, "Dinesh V", "dinesh.21mech@kongu.edu", pwd_hash, "student", "Mechanical Engineering", "MECH", "+91 98765 43212"),
            ]
            for uid, name, email, pw, role, dept, dcode, phone in users_data:
                cur.execute("""
                    INSERT INTO users (id, name, email, password, role, department, department_code, phone, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW());
                """, (uid, name, email, pw, role, dept, dcode, phone))
            cur.execute("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));")
            print(f"   -> Inserted {len(users_data)} clean institutional users.")

            # 4. Seed Realistic Campus Items
            print("4. Seeding realistic campus items...")
            now = datetime.now(timezone.utc)
            items_data = [
                # Item 1: Found Student Smart ID Card (With Department - CSE)
                (
                    1, 6, "found", "KEC Student Smart ID Card (Roll: 22CS142)", "ID Cards",
                    "Official student identity card belonging to S. Kavitha (22CS142). Handed over to CSE office.",
                    None, "Block A - CSE Laboratory 3", "2026-09-21", "14:30", True,
                    "With Department", "Ananya S", "student", "Handed in at CSE Dept Office",
                    "CSE", "Computer Science & Engineering", "department", None,
                    now - timedelta(days=1), now - timedelta(hours=20), None, None, None, now - timedelta(days=1)
                ),
                # Item 2: Found Casio Scientific Calculator (Escalated to Department - CSE)
                (
                    2, 5, "found", "Casio fx-991EX ClassWiz Calculator", "Electronics",
                    "Standard black scientific calculator with battery and slide cover. Found under seat row 4.",
                    None, "Block A - Seminar Hall", "2026-09-22", "11:00", False,
                    "Escalated to Department", "Gowtham K", "student", "Kept safely, pending claimant",
                    "CSE", "Computer Science & Engineering", "department", None,
                    now - timedelta(hours=10), None, None, None, None, now - timedelta(hours=10)
                ),
                # Item 3: Found HP 65W Laptop Charger (At Admin Office)
                (
                    3, 7, "found", "HP 65W USB-C Original Laptop Adapter", "Electronics",
                    "Original black HP type-C charging adapter left plugged in study table #14.",
                    None, "Central Library - 2nd Floor Reading Hall", "2026-09-20", "16:45", False,
                    "At Admin Office", "Dinesh V", "student", "Deposited at Central Office Desk",
                    None, None, "admin", "Central Lost & Found Office",
                    now - timedelta(days=2), None, now - timedelta(days=1), None, None, now - timedelta(days=2)
                ),
                # Item 4: Found Fastrack Smartwatch (At Admin Office - Valuable)
                (
                    4, 6, "found", "Fastrack Reflex Beat+ Smartwatch", "Jewelry",
                    "Black silicone strap smartwatch with magnetic charging terminals intact. Turned in from cafeteria.",
                    None, "Campus Food Court (Table 18)", "2026-09-21", "13:15", True,
                    "At Admin Office", "Ananya S", "student", "Secured in Central Office Locker",
                    None, None, "admin", "Central Lost & Found Office",
                    now - timedelta(days=1), None, now - timedelta(hours=18), None, None, now - timedelta(days=1)
                ),
                # Item 5: Lost Titan Blue Dial Watch (Reported - User level)
                (
                    5, 7, "lost", "Titan Neo Quartz Watch with Navy Blue Dial", "Jewelry",
                    "Silver stainless steel chain strap with a dark royal blue face. Lost between Mech block and canteen.",
                    None, "Mechanical Block Corridor", "2026-09-22", "09:30", True,
                    "Reported", "Dinesh V", "student", "Contact: 9876543212",
                    None, None, "user", None,
                    None, None, None, None, None, now - timedelta(hours=8)
                ),
                # Item 6: Lost Dell Wireless Mouse (Reported - User level)
                (
                    6, 5, "lost", "Dell Premier Multi-Device Wireless Mouse", "Electronics",
                    "Grey/silver compact mouse with Bluetooth and 2.4GHz receiver toggle on underside.",
                    None, "IT Department - Internet Lab", "2026-09-22", "15:00", False,
                    "Reported", "Gowtham K", "student", "Contact: gowtham.21it@kongu.edu",
                    None, None, "user", None,
                    None, None, None, None, None, now - timedelta(hours=4)
                ),
                # Item 7: Recovered Key Bunch with Royal Enfield Keychain (Recovered - CSE Dept)
                (
                    7, 6, "found", "Bike Keys Bunch with Royal Enfield Keychain", "Keys",
                    "Set of two keys with metal Royal Enfield emblem. Verified with vehicle RC copy and returned.",
                    None, "Two-Wheeler Parking Bay 2", "2026-09-19", "08:45", False,
                    "Recovered", "Ananya S", "student", "Owner collected in person",
                    "CSE", "Computer Science & Engineering", "department", None,
                    now - timedelta(days=3), now - timedelta(days=3), None, now - timedelta(days=1), "Prof. M. Anand", now - timedelta(days=3)
                ),
                # Item 8: Recovered Milton Insulated Thermosteel Flask (Recovered - Admin Office)
                (
                    8, 7, "found", "Milton 750ml Matte Black Insulated Flask", "Others",
                    "Stainless steel hot & cold water bottle with college sports meet commemorative sticker.",
                    None, "Maharaja Auditorium Entrance", "2026-09-18", "17:30", False,
                    "Recovered", "Dinesh V", "student", "Returned to owner after identity verification",
                    None, None, "admin", "Central Lost & Found Office",
                    now - timedelta(days=4), None, now - timedelta(days=3), now - timedelta(hours=12), "Dr. S. K. Ramesh", now - timedelta(days=4)
                ),
                # Item 9: Found Wildcraft Black Backpack (With Department - IT)
                (
                    9, 5, "found", "Wildcraft Trail 35L Black Backpack", "Bags",
                    "Water-resistant dark backpack containing semester textbooks, engineering notebook, and blue umbrella.",
                    None, "Block A - IT Department Ground Floor", "2026-09-22", "10:15", True,
                    "With Department", "Gowtham K", "student", "In custody of IT Department office desk",
                    "IT", "Information Technology", "department", None,
                    now - timedelta(hours=12), now - timedelta(hours=10), None, None, None, now - timedelta(hours=12)
                ),
                # Item 10: Found Spectacles in Hard Case (Under Verification - ECE)
                (
                    10, 6, "found", "Gold-Rimmed Reading Spectacles with Case", "Others",
                    "Prescription eyeglasses in hard black magnetic case with microfiber cloth.",
                    None, "Block B - ECE Conference Hall", "2026-09-22", "12:00", False,
                    "Under Verification", "Ananya S", "student", "Claim submitted by student, under desk review",
                    "ECE", "Electronics & Communication Engineering", "department", None,
                    now - timedelta(hours=9), now - timedelta(hours=7), None, None, None, now - timedelta(hours=9)
                )
            ]

            insert_item_query = """
                INSERT INTO items (
                    id, user_id, report_type, title, category, description,
                    image_url, location, incident_date, incident_time, is_valuable,
                    status, reporter_name, reporter_role, contact_note,
                    assigned_department, assigned_department_name, escalation_level,
                    assigned_office, escalation_at, dept_received_at, admin_received_at,
                    handover_at, handover_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s
                );
            """
            for it in items_data:
                cur.execute(insert_item_query, it)
            cur.execute("SELECT setval('items_id_seq', (SELECT MAX(id) FROM items));")
            print(f"   -> Inserted {len(items_data)} realistic campus items.")

            # 5. Seed Claims
            print("5. Seeding claims...")
            claims_data = [
                # Claim for Item 10 (Spectacles)
                (1, 10, 5, "Gowtham K", "student", "Case has a small silver KEC sticker on the bottom left corner and lens power is -1.50.", "pending", now - timedelta(hours=5)),
                # Claim for Item 7 (Recovered Keys)
                (2, 7, 7, "Dinesh V", "student", "Key ring has a small brass miniature cylinder and RE classic 350 key.", "approved", now - timedelta(days=2)),
            ]
            for cid, iid, clid, clname, clrole, details, st, cat in claims_data:
                cur.execute("""
                    INSERT INTO claims (id, item_id, claimant_id, claimant_name, claimant_role, hidden_details, status, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (cid, iid, clid, clname, clrole, details, st, cat))
            cur.execute("SELECT setval('claims_id_seq', (SELECT MAX(id) FROM claims));")
            print(f"   -> Inserted {len(claims_data)} claims.")

            # 6. Seed Messages
            print("6. Seeding messages...")
            messages_data = [
                (1, 1, None, "CSE Department Desk", "department_admin", "Item received into department custody. Stored in Block A Room 101 cabinet.", True, now - timedelta(hours=20)),
                (2, 7, None, "CSE Department Desk", "department_admin", "Handover completed to Dinesh V after verification of vehicle registration.", True, now - timedelta(days=1)),
                (3, 8, None, "Central Admin Office", "admin", "Owner verified with sports club badge and collected from Admin office.", True, now - timedelta(hours=12)),
                (4, 10, 5, "Gowtham K", "student", "I left them on the front row desk during the ECE guest seminar.", False, now - timedelta(hours=5)),
                (5, 10, None, "ECE Department Desk", "department_admin", "Please bring your ID card to Block B Room 101 for identity verification.", True, now - timedelta(hours=4)),
            ]
            for mid, iid, sid, sname, srole, msg, is_sys, cat in messages_data:
                cur.execute("""
                    INSERT INTO messages (id, item_id, sender_id, sender_name, sender_role, message, is_system, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (mid, iid, sid, sname, srole, msg, is_sys, cat))
            cur.execute("SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages));")
            print(f"   -> Inserted {len(messages_data)} official messages.")

            # 7. Seed Escalation History
            print("7. Seeding escalation history...")
            escalations_data = [
                (1, 1, "user", "department", "Valuable student credential — immediate escalation to CSE Dept Desk", "System Auto-Rule", now - timedelta(days=1)),
                (2, 2, "user", "department", "Reported in academic building Block A — routed to CSE Dept Desk", "System Auto-Rule", now - timedelta(hours=10)),
                (3, 3, "user", "admin", "Common campus location (Central Library) with no claim — escalated to Central Admin Office", "Auto-Escalation Engine", now - timedelta(days=1)),
                (4, 4, "user", "admin", "Valuable electronic device found in common area (Food Court) — immediate Central Admin custody", "System Auto-Rule", now - timedelta(days=1)),
                (5, 9, "user", "department", "Found inside IT department premises — routed to IT Dept Desk", "System Auto-Rule", now - timedelta(hours=12)),
                (6, 10, "user", "department", "Found inside ECE conference hall — routed to ECE Dept Desk", "System Auto-Rule", now - timedelta(hours=9)),
            ]
            for eid, iid, f_lvl, t_lvl, reas, esc_by, cat in escalations_data:
                cur.execute("""
                    INSERT INTO escalation_history (id, item_id, from_level, to_level, reason, escalated_by, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (eid, iid, f_lvl, t_lvl, reas, esc_by, cat))
            cur.execute("SELECT setval('escalation_history_id_seq', (SELECT MAX(id) FROM escalation_history));")
            print(f"   -> Inserted {len(escalations_data)} escalation history records.")

            # 8. Seed Notifications
            print("8. Seeding notifications...")
            notifications_data = [
                (1, 2, "New Found Item Assigned", "KEC Student Smart ID Card was turned in and is awaiting department review.", "item", 1, False, now - timedelta(days=1)),
                (2, 1, "Valuable Item Escalation", "Fastrack Reflex Beat+ Smartwatch from Food Court escalated to Central Admin Office.", "escalation", 4, False, now - timedelta(days=1)),
                (3, 5, "Claim Verification In Progress", "Your claim for Gold-Rimmed Reading Spectacles is being reviewed by ECE Department Desk.", "claim", 10, False, now - timedelta(hours=4)),
                (4, 7, "Item Recovered", "Your bike keys bunch was successfully verified and recorded as recovered.", "recovery", 7, True, now - timedelta(days=1)),
            ]
            for nid, uid, title, msg, ntype, iid, is_rd, cat in notifications_data:
                cur.execute("""
                    INSERT INTO notifications (id, user_id, title, message, type, item_id, is_read, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (nid, uid, title, msg, ntype, iid, is_rd, cat))
            cur.execute("SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications));")
            print(f"   -> Inserted {len(notifications_data)} notifications.")

            conn.commit()
            print("\nSUCCESS: All raw test data removed. Clean, realistic institutional data successfully seeded!")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    clean_and_seed()
