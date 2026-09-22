import os
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Gowtham@2007")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "lost_and_found")

# Departments at Kongu Engineering College
KEC_DEPARTMENTS = [
    {"code": "CSE",   "name": "Computer Science & Engineering",        "office": "Block A, Room 101"},
    {"code": "IT",    "name": "Information Technology",                 "office": "Block A, Room 201"},
    {"code": "ECE",   "name": "Electronics & Communication Engineering","office": "Block B, Room 101"},
    {"code": "EEE",   "name": "Electrical & Electronics Engineering",   "office": "Block B, Room 201"},
    {"code": "MECH",  "name": "Mechanical Engineering",                 "office": "Block C, Room 101"},
    {"code": "CIVIL", "name": "Civil Engineering",                      "office": "Block C, Room 201"},
    {"code": "MBA",   "name": "Master of Business Administration",      "office": "Block D, Room 101"},
    {"code": "MCA",   "name": "Master of Computer Applications",        "office": "Block D, Room 201"},
    {"code": "AUTO",  "name": "Automobile Engineering",                 "office": "Block E, Room 101"},
    {"code": "CHEM",  "name": "Chemical Engineering",                   "office": "Block E, Room 201"},
    {"code": "FOOD",  "name": "Food Technology",                        "office": "Block F, Room 101"},
    {"code": "BIO",   "name": "Biomedical Engineering",                 "office": "Block F, Room 201"},
]

# Common-place locations that escalate directly to Admin office (e.g. general campus areas)
COMMON_PLACE_LOCATIONS = [
    "library", "canteen", "fc", "food court", "bus stand", "bus stop",
    "main gate", "parking", "parking area", "sports complex", "auditorium",
    "college ground", "playground", "sports ground", "hostel", "hostel block a", "hostel block b",
    "hostel block c", "administrative block", "main entrance"
]

# Valuable item categories — immediate dept escalation (no 24h wait)
VALUABLE_CATEGORIES = [
    "electronics", "wallets", "jewelry", "id cards", "gold", "mobile", "cash"
]


def get_db_connection():
    """Connect to the lost_and_found database (or postgres default if not created yet)."""
    try:
        conn = psycopg.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            row_factory=dict_row
        )
        return conn
    except Exception as e:
        conn = psycopg.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            dbname="postgres",
            row_factory=dict_row
        )
        return conn


def init_db():
    """Ensure database and tables are created with proper schema."""
    # 1. Make sure lost_and_found database exists
    try:
        root_conn = psycopg.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            dbname="postgres",
            autocommit=True
        )
        with root_conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
            if not cur.fetchone():
                cur.execute(f'CREATE DATABASE "{DB_NAME}"')
                print(f"[DB] Database '{DB_NAME}' created successfully.")
            else:
                print(f"[DB] Database '{DB_NAME}' exists.")
        root_conn.close()
    except Exception as e:
        print(f"[DB] Database creation check notice: {e}")

    # 2. Connect to the target database and create tables
    conn = get_db_connection()
    with conn.cursor() as cur:

        # ── Users Table ────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                department VARCHAR(100),
                department_code VARCHAR(20),
                phone VARCHAR(20),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Safely add new columns if upgrading existing DB
        for col, defn in [
            ("department",      "VARCHAR(100)"),
            ("department_code", "VARCHAR(20)"),
            ("phone",           "VARCHAR(20)"),
        ]:
            cur.execute(f"""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {defn};
            """)

        # ── Departments Master Table ──────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS departments (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                hod_email VARCHAR(255),
                office_location VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Items Table ────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                report_type VARCHAR(20) NOT NULL DEFAULT 'found',
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                image_url TEXT,
                location VARCHAR(255) NOT NULL,
                incident_date VARCHAR(50),
                incident_time VARCHAR(50),
                is_valuable BOOLEAN DEFAULT FALSE,
                status VARCHAR(50) DEFAULT 'Found',
                reporter_name VARCHAR(255) NOT NULL,
                reporter_role VARCHAR(50) NOT NULL,
                contact_note TEXT,
                match_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
                -- Department & escalation tracking
                assigned_department VARCHAR(20),
                assigned_department_name VARCHAR(255),
                escalation_level VARCHAR(20) DEFAULT 'user',
                assigned_office VARCHAR(255),
                escalation_at TIMESTAMP WITH TIME ZONE,
                dept_received_at TIMESTAMP WITH TIME ZONE,
                admin_received_at TIMESTAMP WITH TIME ZONE,
                handover_at TIMESTAMP WITH TIME ZONE,
                handover_by VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Safely add new columns to items if upgrading
        for col, defn in [
            ("assigned_department",      "VARCHAR(20)"),
            ("assigned_department_name", "VARCHAR(255)"),
            ("escalation_level",         "VARCHAR(20) DEFAULT 'user'"),
            ("assigned_office",          "VARCHAR(255)"),
            ("escalation_at",            "TIMESTAMP WITH TIME ZONE"),
            ("dept_received_at",         "TIMESTAMP WITH TIME ZONE"),
            ("admin_received_at",        "TIMESTAMP WITH TIME ZONE"),
            ("handover_at",              "TIMESTAMP WITH TIME ZONE"),
            ("handover_by",              "VARCHAR(255)"),
            ("owner_name",               "VARCHAR(100)"),
            ("owner_roll_no",            "VARCHAR(50)"),
            ("owner_phone",              "VARCHAR(50)"),
            ("owner_id_card_image",      "TEXT"),
            ("handover_notes",           "TEXT"),
            ("embedding",                "JSONB"),
        ]:
            cur.execute(f"""
                ALTER TABLE items ADD COLUMN IF NOT EXISTS {col} {defn};
            """)

        # ── Messages / Chat Threads Table ─────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                sender_name VARCHAR(255) NOT NULL,
                sender_role VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                is_system BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Claims & Verifications Table ──────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS claims (
                id SERIAL PRIMARY KEY,
                item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
                claimant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                claimant_name VARCHAR(255) NOT NULL,
                claimant_role VARCHAR(50) NOT NULL,
                hidden_details TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Notifications Table ───────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                item_id INTEGER,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── Escalation History Table ──────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS escalation_history (
                id SERIAL PRIMARY KEY,
                item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
                from_level VARCHAR(20) NOT NULL,
                to_level VARCHAR(20) NOT NULL,
                reason TEXT,
                escalated_by VARCHAR(255) DEFAULT 'system',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        conn.commit()
        print("[DB] All tables verified/created successfully.")

        # Seed departments
        seed_departments(cur, conn)

    conn.close()


def seed_departments(cur, conn):
    """Seed KEC department master data."""
    cur.execute("SELECT COUNT(*) as count FROM departments;")
    row = cur.fetchone()
    if row and row["count"] == 0:
        for dept in KEC_DEPARTMENTS:
            cur.execute("""
                INSERT INTO departments (code, name, office_location)
                VALUES (%s, %s, %s)
                ON CONFLICT (code) DO NOTHING;
            """, (dept["code"], dept["name"], dept["office"]))
        conn.commit()
        print("[DB] KEC departments seeded.")



