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

# check_same_thread is a SQLite-only connect arg — passing it to
# psycopg2 (Postgres) raises a TypeError. This was untested before: the
# original comment claimed swapping DATABASE_URL would work without
# touching any other file, which was true for the URL but not for this
# line. Verified against a real local Postgres instance, not assumed.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
