"""
Database setup for SevaSetu (v1.1.0).
Supports SQLite and PostgreSQL with automated runtime schema migrations,
dynamic model-driven column reconciliation, and integrity verification.
"""
import os
import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.types import String, Text, Integer, Float, Boolean, DateTime

logger = logging.getLogger("sevasetu.database")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/sevasetu.db")

# Ensure parent directory exists for SQLite database files
if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    if db_path and db_path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
else:
    # PostgreSQL production configuration with connection healthchecks and recycling
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=int(os.getenv("DB_POOL_SIZE", 10)),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", 20)),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", 3600)),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", 30)),
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _get_column_ddl(col, is_sqlite: bool) -> str:
    """Generate safe, dialect-aware DDL type string for ALTER TABLE ADD COLUMN."""
    col_type = col.type
    type_str = "VARCHAR"

    if isinstance(col_type, Boolean):
        type_str = "BOOLEAN"
    elif isinstance(col_type, Integer):
        type_str = "INTEGER"
    elif isinstance(col_type, Float):
        type_str = "FLOAT"
    elif isinstance(col_type, Text):
        type_str = "TEXT" if not is_sqlite else "VARCHAR"
    elif isinstance(col_type, DateTime):
        type_str = "DATETIME" if is_sqlite else "TIMESTAMP WITH TIME ZONE"
    elif isinstance(col_type, String):
        if col_type.length:
            type_str = f"VARCHAR({col_type.length})"
        else:
            type_str = "VARCHAR"

    # Handle defaults safely without breaking existing rows
    default_clause = ""
    if col.default is not None and getattr(col.default, "is_scalar", False):
        val = col.default.arg
        if isinstance(val, bool):
            default_clause = f" DEFAULT {1 if val else 0}" if is_sqlite else f" DEFAULT {'TRUE' if val else 'FALSE'}"
        elif isinstance(val, (int, float)):
            default_clause = f" DEFAULT {val}"
        elif isinstance(val, str):
            default_clause = f" DEFAULT '{val}'"

    return f"{type_str}{default_clause}".strip()


def ensure_schema_upgrades(db_engine):
    """
    Safely creates missing tables and dynamically adds missing columns to existing tables
    across SQLite and PostgreSQL using SQLAlchemy ORM model introspection.
    Fails fast with structured logging if a required migration fails.
    """
    # 1. Ensure all tables registered on Base metadata exist
    Base.metadata.create_all(bind=db_engine)

    is_sqlite = str(db_engine.url).startswith("sqlite")
    added_columns_count = 0
    already_present_count = 0

    with db_engine.connect() as conn:
        inspector = inspect(db_engine)
        existing_tables = set(inspector.get_table_names())

        for table_name, table_obj in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue

            existing_cols = {c["name"]: c for c in inspector.get_columns(table_name)}

            for col in table_obj.columns:
                if col.name not in existing_cols:
                    ddl_type = _get_column_ddl(col, is_sqlite)
                    sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {ddl_type}"
                    try:
                        conn.exec_driver_sql(sql)
                        added_columns_count += 1
                        logger.info(f"Schema migration: {table_name}.{col.name} -> ADDED ({ddl_type})")
                        print(f"  {table_name}.{col.name} -> ADDED")
                    except Exception as e:
                        conn.rollback()
                        err_msg = f"DATABASE SCHEMA MIGRATION FAILED: Failed to add column '{col.name}' to table '{table_name}': {e}"
                        logger.critical(err_msg)
                        print(err_msg)
                        raise RuntimeError(err_msg) from e
                else:
                    already_present_count += 1

        conn.commit()

    logger.info(f"Schema upgrade completed successfully. (Added: {added_columns_count}, Verified: {already_present_count})")
    print(f"Schema upgrade completed successfully. (Added: {added_columns_count}, Verified: {already_present_count})")


def verify_schema_integrity(db_engine) -> bool:
    """
    Verifies that every table and column declared in SQLAlchemy ORM models
    actually exists in the database. Raises RuntimeError if any mismatch is found.
    """
    inspector = inspect(db_engine)
    existing_tables = set(inspector.get_table_names())

    for table_name, table_obj in Base.metadata.tables.items():
        if table_name not in existing_tables:
            err_msg = f"DATABASE SCHEMA VERIFICATION FAILED: Required table '{table_name}' does not exist in database."
            logger.critical(err_msg)
            raise RuntimeError(err_msg)

        existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
        for col in table_obj.columns:
            if col.name not in existing_cols:
                err_msg = f"DATABASE SCHEMA VERIFICATION FAILED: Table '{table_name}' is missing required column '{col.name}'."
                logger.critical(err_msg)
                raise RuntimeError(err_msg)

    logger.info("Schema integrity verified: all tables and columns match ORM definitions.")
    print("Schema integrity verified: all tables and columns match ORM definitions.")
    return True


def init_db():
    """Initializes and verifies the database schema."""
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades(engine)
    verify_schema_integrity(engine)
