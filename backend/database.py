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
        # Fallback to postgres default db if lost_and_found doesn't exist yet
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
        # Users Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Items Table
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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Messages / Chat Threads Table
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

        # Claims & Verifications Table
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

        # Notifications Table
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

        conn.commit()
        print("[DB] All tables verified/created successfully.")

        # Seed realistic items if table is empty
        seed_initial_data(cur, conn)

    conn.close()

def seed_initial_data(cur, conn):
    """Seed initial campus items matching the reference design if table is empty."""
    cur.execute("SELECT COUNT(*) as count FROM items;")
    row = cur.fetchone()
    if row and row["count"] == 0:
        sample_items = [
            (
                "Clean 90 Blue Triple Sneakers",
                "shoese",
                "Blue knit sneakers with white sole, size 41. Left under chair 14 in Library reading hall.",
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
                "Library",
                "2026-09-22",
                "10:30 AM",
                True,
                "Found",
                "Karthik",
                "student",
                "found"
            ),
            (
                "Traveler Black Leather Tote",
                "Bags",
                "Marc Jacobs style black leather zipper bag with silver puller and water bottle inside.",
                "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
                "Main Block",
                "2026-09-22",
                "11:15 AM",
                True,
                "Found",
                "Priya",
                "student",
                "found"
            ),
            (
                "Kongu Student Smart ID Card",
                "ID Cards",
                "Blue lanyard with Kongu Engineering College badge for Department of Information Technology.",
                "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80",
                "Canteen",
                "2026-09-22",
                "01:45 PM",
                True,
                "Found",
                "Suresh",
                "staff",
                "found"
            ),
            (
                "AirPods Pro 2nd Gen in Matte Case",
                "Electronics",
                "White wireless earbuds in a black silicone protective case with carabiner clip.",
                "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80",
                "Hostel Block A",
                "2026-09-21",
                "08:20 PM",
                True,
                "Matched",
                "Dinesh",
                "student",
                "found"
            ),
            (
                "Brass Key Ring with Bike Keychain",
                "Keys",
                "Bunch of 3 silver Godrej keys with a black pulsar bike key rubber ring.",
                "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
                "Parking Area",
                "2026-09-22",
                "09:00 AM",
                False,
                "Found",
                "Ramesh",
                "staff",
                "found"
            ),
            (
                "Stainless Steel Insulated Bottle",
                "Others",
                "Milton silver insulated 1-litre water bottle with small dent on bottom base.",
                "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
                "Sports Complex",
                "2026-09-20",
                "05:30 PM",
                False,
                "Recovered",
                "Meena",
                "student",
                "found"
            ),
            (
                "Black Fossil Leather Wallet",
                "Wallets",
                "Bifold brown/black leather wallet with college bus pass and driver's license inside.",
                "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80",
                "Library",
                "2026-09-22",
                "02:00 PM",
                True,
                "Reported",
                "Gowtham K",
                "student",
                "lost"
            )
        ]

        for item in sample_items:
            cur.execute("""
                INSERT INTO items (
                    title, category, description, image_url, location, 
                    incident_date, incident_time, is_valuable, status, 
                    reporter_name, reporter_role, report_type
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, item)

        conn.commit()
        print("[DB] Initial sample campus items seeded successfully.")
