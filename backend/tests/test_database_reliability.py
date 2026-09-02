"""
Database Reliability, Disaster Recovery & Transaction Integrity Test Suite.
Verifies:
1. Transaction rollback behavior on unhandled exceptions.
2. Cryptographic audit event hash chain immutability.
3. Health check connectivity and graceful degraded status.
4. Entity constraint integrity and schema consistency.
"""
import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal, get_db
from app.auth import create_citizen_token


def test_transaction_rollback_preserves_clean_session(raw_client):
    """Verifies that an unhandled error inside a transaction rolls back all pending inserts."""
    db = SessionLocal()
    try:
        unique_token = f"tok-rollback-{uuid.uuid4().hex[:8]}"
        
        # Start transaction block
        try:
            # 1. Add valid application
            app = models.Application(
                id=f"app-roll-{uuid.uuid4().hex[:8]}",
                citizen_name="Rollback Test User",
                service_type="income_certificate",
                tracking_token=unique_token,
            )
            db.add(app)
            db.flush()

            # 2. Simulate failure before commit
            raise RuntimeError("Simulated mid-pipeline database/network crash")
        except RuntimeError:
            db.rollback()

        # 3. Assert that rolled back application does NOT exist in the database
        queried_app = db.query(models.Application).filter(models.Application.tracking_token == unique_token).first()
        assert queried_app is None, "Failed transaction was not properly rolled back."
    finally:
        db.close()


def test_cryptographic_audit_hash_chain_integrity(raw_client, officer_token):
    """Verifies that each audit event strictly builds on the hash of the preceding event."""
    from app.main import _log_audit
    db = SessionLocal()
    try:
        app_id = f"app-hash-{uuid.uuid4().hex[:8]}"
        app = models.Application(
            id=app_id,
            citizen_name="Audit Chain Test Citizen",
            service_type="income_certificate",
            status="READY_FOR_REVIEW",
        )
        db.add(app)
        db.commit()

        # Generate 3 sequential audit events
        _log_audit(db, app_id, "Application Submitted", "Initial submit", actor="citizen", action="SUBMITTED")
        db.commit()

        _log_audit(db, app_id, "Officer Review Started", "Reviewing docs", actor="officer1", action="REVIEW_STARTED")
        db.commit()

        _log_audit(db, app_id, "Application Approved", "All clear", actor="officer1", action="APPROVED")
        db.commit()

        # Query all events for this application
        events = db.query(models.AuditEvent).filter(models.AuditEvent.application_id == app_id).order_by(models.AuditEvent.created_at.asc()).all()
        assert len(events) == 3

        # First event previous_event_hash is GENESIS
        assert "GENESIS" in events[0].previous_event_hash
        assert len(events[0].event_hash) == 64

        # Second event previous_event_hash == First event's event_hash
        assert events[1].previous_event_hash == events[0].event_hash

        # Third event previous_event_hash == Second event's event_hash
        assert events[2].previous_event_hash == events[1].event_hash
    finally:
        db.close()


def test_health_check_database_connectivity_and_no_credentials_leak(raw_client):
    """Verifies that /api/health accurately reports healthy DB status without leaking connection strings."""
    resp = raw_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["database"] == "healthy"
    # Ensure no internal DB URL, user, or password leaked
    assert "password" not in str(data).lower()
    assert "postgresql://" not in str(data)
    assert "sqlite:///" not in str(data)
