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

    # Connect to the target database and create users table
    conn = get_db_connection()
    with conn.cursor() as cur:
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
        conn.commit()
        print("[DB] Users table verified/created successfully.")
    conn.close()
