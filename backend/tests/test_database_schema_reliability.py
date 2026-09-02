import pytest
import sqlite3
from sqlalchemy import create_engine, inspect, Column, String, Integer
from sqlalchemy.orm import declarative_base, sessionmaker

from app.database import Base, ensure_schema_upgrades, verify_schema_integrity, _get_column_ddl
from app import models


def test_schema_upgrade_adds_missing_assigned_officer_username_and_other_cols():
    """
    Test A: An existing old SQLite database missing assigned_officer_username and other columns
    is safely upgraded and receives all missing columns.
    """
    test_engine = create_engine("sqlite:///:memory:")
    
    # Create an old minimal 'applications' table missing assigned_officer_username and other fields
    with test_engine.connect() as conn:
        conn.exec_driver_sql("""
            CREATE TABLE applications (
                id VARCHAR PRIMARY KEY,
                citizen_name VARCHAR NOT NULL,
                service_type VARCHAR NOT NULL
            );
        """)
        # Insert a sample row to verify data retention
        conn.exec_driver_sql("""
            INSERT INTO applications (id, citizen_name, service_type)
            VALUES ('app-test-1', 'Rajesh Kumar', 'income_certificate');
        """)
        conn.commit()
        
    inspector_before = inspect(test_engine)
    cols_before = [c["name"] for c in inspector_before.get_columns("applications")]
    assert "assigned_officer_username" not in cols_before
    assert len(cols_before) == 3

    # Run ensure_schema_upgrades
    ensure_schema_upgrades(test_engine)

    inspector_after = inspect(test_engine)
    cols_after = [c["name"] for c in inspector_after.get_columns("applications")]
    
    # Verify assigned_officer_username was added
    assert "assigned_officer_username" in cols_after
    
    # Verify all Application model columns exist
    model_cols = [c.name for c in models.Application.__table__.columns]
    for m_col in model_cols:
        assert m_col in cols_after, f"Missing column {m_col} in applications table after migration"

    # Verify existing data was preserved (Test C)
    with test_engine.connect() as conn:
        res = conn.exec_driver_sql("SELECT id, citizen_name, service_type, assigned_officer_username FROM applications WHERE id = 'app-test-1'").fetchone()
        assert res[0] == "app-test-1"
        assert res[1] == "Rajesh Kumar"
        assert res[2] == "income_certificate"
        assert res[3] is None  # newly added nullable column default


def test_schema_upgrade_is_idempotent():
    """
    Test B: Running ensure_schema_upgrades multiple times does not error or duplicate columns.
    """
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)

    # First upgrade pass
    ensure_schema_upgrades(test_engine)
    inspector_1 = inspect(test_engine)
    cols_pass_1 = {c["name"] for c in inspector_1.get_columns("applications")}

    # Second upgrade pass
    ensure_schema_upgrades(test_engine)
    inspector_2 = inspect(test_engine)
    cols_pass_2 = {c["name"] for c in inspector_2.get_columns("applications")}

    assert cols_pass_1 == cols_pass_2


def test_all_model_tables_and_columns_verified():
    """
    Test D & E: Every model table in Base.metadata has all required columns,
    and verify_schema_integrity succeeds.
    """
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    ensure_schema_upgrades(test_engine)
    
    # Verification function succeeds
    assert verify_schema_integrity(test_engine) is True


def test_schema_verification_fails_if_column_missing():
    """
    Test F: verify_schema_integrity raises RuntimeError if any model column is missing.
    """
    test_engine = create_engine("sqlite:///:memory:")
    # Create partial applications table
    with test_engine.connect() as conn:
        conn.exec_driver_sql("CREATE TABLE applications (id VARCHAR PRIMARY KEY);")
        conn.commit()

    with pytest.raises(RuntimeError) as exc_info:
        verify_schema_integrity(test_engine)
    assert "DATABASE SCHEMA VERIFICATION FAILED" in str(exc_info.value)


def test_fresh_empty_sqlite_database_initialization():
    """
    Test G: A brand new empty SQLite database initializes completely without errors.
    """
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    ensure_schema_upgrades(test_engine)
    verify_schema_integrity(test_engine)

    inspector = inspect(test_engine)
    tables = inspector.get_table_names()
    assert "applications" in tables
    assert "citizen_profiles" in tables
    assert "documents" in tables
    assert "grievances" in tables
    assert "citizen_consents" in tables
    assert "staff_users" in tables
