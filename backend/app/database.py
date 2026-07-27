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

# check_same_thread=False is only needed for SQLite + multiple FastAPI workers
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
