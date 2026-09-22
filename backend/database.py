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
    # First, make sure lost_and_found database exists
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

    # Connect to the target database and create tables
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
                phone_number VARCHAR(50),
                contact_preference VARCHAR(50) DEFAULT 'chat_only',
                notify_matches BOOLEAN DEFAULT TRUE,
                notify_claims BOOLEAN DEFAULT TRUE,
                notify_messages BOOLEAN DEFAULT TRUE,
                notify_email BOOLEAN DEFAULT FALSE,
                avatar_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Migration for existing users table
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;")

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
                private_verification_detail TEXT,
                contact_preference VARCHAR(50) DEFAULT 'chat_only',
                is_public BOOLEAN DEFAULT TRUE,
                withdrawn BOOLEAN DEFAULT FALSE,
                flag_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Migration for existing items table
        cur.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0;")

        # Messages Table
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

        # Claims Table
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

        # Matches Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                lost_item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
                found_item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
                similarity_score INTEGER NOT NULL,
                stage VARCHAR(50) DEFAULT 'verification_pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        conn.commit()
        print("[DB] All tables verified/created successfully.")
    conn.close()
