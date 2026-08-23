"""
Database setup for SevaSetu.

Uses SQLite by default (zero external dependency — fits the "no paid
services required" constraint for the MVP). Swap DATABASE_URL for a
Postgres URL later without touching any other file, if the project
outgrows SQLite.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/sevasetu.db")

# Ensure parent directory exists for SQLite database files
if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    if db_path and db_path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

# check_same_thread is a SQLite-only connect arg — passing it to
# psycopg2 (Postgres) raises a TypeError. This was untested before: the
# original comment claimed swapping DATABASE_URL would work without
# touching any other file, which was true for the URL but not for this
# line. Verified against a real local Postgres instance, not assumed.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema_upgrades(db_engine):
    """Safely adds missing columns to existing SQLite tables if schema has evolved."""
    if not str(db_engine.url).startswith("sqlite"):
        return
    with db_engine.connect() as conn:
        try:
            cursor = conn.exec_driver_sql("PRAGMA table_info(applications)")
            columns = [row[1] for row in cursor.fetchall()]
            if columns:
                if "date_of_birth" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN date_of_birth VARCHAR")
                if "duplicate_confidence" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN duplicate_confidence INTEGER")
                if "resolved_at" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN resolved_at DATETIME")
                if "correction_reason" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN correction_reason VARCHAR")
                if "correction_details" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN correction_details VARCHAR")
                if "correction_requested_by" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN correction_requested_by VARCHAR")
                if "correction_requested_at" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN correction_requested_at DATETIME")
                if "resubmitted_at" not in columns:
                    conn.exec_driver_sql("ALTER TABLE applications ADD COLUMN resubmitted_at DATETIME")
                conn.commit()

            cursor_docs = conn.exec_driver_sql("PRAGMA table_info(documents)")
            doc_columns = [row[1] for row in cursor_docs.fetchall()]
            if doc_columns:
                if "detected_type" not in doc_columns:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN detected_type VARCHAR")
                if "type_confidence" not in doc_columns:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN type_confidence FLOAT")
                if "type_status" not in doc_columns:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN type_status VARCHAR")
                if "type_evidence" not in doc_columns:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN type_evidence VARCHAR")
                conn.commit()
        except Exception:
            pass


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
