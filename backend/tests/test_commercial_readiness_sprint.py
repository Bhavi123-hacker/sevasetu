"""
Commercial Readiness & Productization Sprint Tests.
Verifies real-database operational telemetry, feedback rating & deduplication,
service configuration engine versioning, and integration gateway status.
"""
import pytest
from app.main import app
from app.database import SessionLocal
from app import models


def test_impact_metrics_endpoint_real_database(raw_client):
    """Verifies that /api/impact/metrics returns real database aggregations with complete schema."""
    resp = raw_client.get("/api/impact/metrics")
    assert resp.status_code == 200
    data = resp.json()

    assert "metadata" in data
    assert "data_freshness" in data["metadata"]
    assert "applications" in data
    assert "total_received" in data["applications"]
    assert "performance" in data
    assert "sla_compliance_pct" in data["performance"]
    assert "documents" in data
    assert "officers" in data
    assert "grievances" in data
    assert "citizen_experience" in data
    assert "average_rating" in data["citizen_experience"]


def test_feedback_rating_and_deduplication(raw_client):
    """Verifies citizen feedback submission with ratings, categories, and duplicate prevention."""
    db = SessionLocal()
    try:
        app_id = "test_app_comm_fb"
        existing_app = db.query(models.Application).filter(models.Application.id == app_id).first()
        if not existing_app:
            new_app = models.Application(
                id=app_id,
                citizen_name="Aarav Sharma",
                service_type="income_certificate",
                status="APPROVED",
            )
            db.add(new_app)
            db.commit()

        # First submission
        fb_payload = {
            "citizen_name": "Aarav Sharma",
            "application_id": app_id,
            "rating": 5,
            "category": "EASE_OF_APPLICATION",
            "text": "The document pre-verification was super smooth and fast!",
        }
        resp1 = raw_client.post("/api/feedback", json=fb_payload)
        assert resp1.status_code == 200
        res1_data = resp1.json()
        assert res1_data["rating"] == 5
        assert res1_data["is_update"] is False

        # Second submission (should update instead of duplicate)
        fb_payload["rating"] = 4
        fb_payload["text"] = "Updated: Very good experience, minor scan retry needed."
        resp2 = raw_client.post("/api/feedback", json=fb_payload)
        assert resp2.status_code == 200
        res2_data = resp2.json()
        assert res2_data["rating"] == 4
        assert res2_data["is_update"] is True
        assert res2_data["id"] == res1_data["id"]

        # Verify count in database
        fb_count = db.query(models.Feedback).filter(
            models.Feedback.application_id == app_id,
            models.Feedback.citizen_name == "Aarav Sharma",
        ).count()
        assert fb_count == 1
    finally:
        db.close()


def test_integration_gateway_status_endpoint(raw_client, officer_token):
    """Verifies integration gateway status returns sandbox capabilities and truthfulness disclaimers."""
    resp = raw_client.get("/api/integration/status", headers={"Authorization": f"Bearer {officer_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert len(data["providers"]) >= 3
    assert "disclaimer" in data

    provider_ids = [p["id"] for p in data["providers"]]
    assert "identity_verification" in provider_ids
    assert "document_verification" in provider_ids
    assert "eligibility_rules" in provider_ids


def test_admin_service_config_update_with_audit_trail(raw_client, admin_token):
    """Verifies administrator can configure statutory SLA and requirement versions with audit logging."""
    db = SessionLocal()
    try:
        srv_id = "income_certificate"
        srv = db.query(models.ServiceDefinition).filter(models.ServiceDefinition.id == srv_id).first()
        if not srv:
            srv = models.ServiceDefinition(
                id=srv_id,
                name="Income Certificate",
                description="State revenue department income certificate.",
                category="Certificates",
                sla_days=7,
                requirement_version="2026-v1.0",
            )
            db.add(srv)
            db.commit()

        update_payload = {
            "name": "Income Certificate (Urban & Rural)",
            "sla_days": 5,
            "interview_required": True,
            "requirement_version": "2026-v1.2-gazette",
            "eligibility_summary": "Annual family income threshold under INR 8,00,000.",
        }

        resp = raw_client.put(
            f"/api/admin/services/{srv_id}",
            json=update_payload,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sla_days"] == 5
        assert data["interview_required"] is True
        assert data["requirement_version"] == "2026-v1.2-gazette"

        # Verify audit event recorded
        audit = db.query(models.AuditEvent).filter(
            models.AuditEvent.action == "SERVICE_CONFIG_UPDATED",
            models.AuditEvent.entity_id == srv_id,
        ).first()
        assert audit is not None
        assert audit.actor == "admin1"
    finally:
        db.close()
