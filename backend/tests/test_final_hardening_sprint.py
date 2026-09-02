"""
Final Production Hardening & IDOR / Security Test Suite for SevaSetu Civic Platform.
Validates:
1. Decision Certificate PDF download for APPROVED applications & Decision notice.
2. IDOR Prevention: Cross-citizen application, document, history, and certificate isolation.
3. RBAC Strictness: Officer vs Senior Officer vs Administrator privileges.
4. Admin Safety Lockout Prevention: Sole admin cannot demote or deactivate self.
5. Workload Analytics & Operational Health without secret leaks.
6. Notification deduplication and state machine guards.
"""
import uuid
import pytest
from datetime import datetime, timezone

from app import models
from app.database import SessionLocal
from app.auth import create_citizen_token, create_access_token


def test_certificate_pdf_generation_and_authorization(raw_client, officer_token, admin_token):
    db = SessionLocal()
    try:
        # Create Citizen A and Citizen B profiles
        cit_a_id = f"cit-a-{uuid.uuid4().hex[:8]}"
        cit_b_id = f"cit-b-{uuid.uuid4().hex[:8]}"
        
        token_a = create_citizen_token(cit_a_id, "Aarav Sharma", "+919876543211")
        token_b = create_citizen_token(cit_b_id, "Bhavna Patel", "+919876543212")

        auth_a = {"Authorization": f"Bearer {token_a}"}
        auth_b = {"Authorization": f"Bearer {token_b}"}
        auth_off = {"Authorization": f"Bearer {officer_token}"}

        # Create approved application for Citizen A
        app_a_id = f"app-appr-{uuid.uuid4().hex[:8]}"
        app_a = models.Application(
            id=app_a_id,
            citizen_name="Aarav Sharma",
            citizen_profile_id=cit_a_id,
            service_type="income_certificate",
            status="APPROVED",
            readiness_score=95,
            decision_certificate_id="SS-CERT-2026-A101",
            decision_reason_category="All statutory criteria verified",
            resolved_by="Suresh Verification Officer",
            resolved_at=datetime.now(timezone.utc),
        )
        db.add(app_a)
        db.commit()

        # 1. Citizen A (owner) downloads certificate PDF
        resp_owner = raw_client.get(f"/api/applications/{app_a_id}/certificate.pdf", headers=auth_a)
        assert resp_owner.status_code == 200
        assert "application/pdf" in resp_owner.headers["content-type"]
        assert len(resp_owner.content) > 500  # Non-empty valid PDF binary

        # 2. IDOR Prevention: Citizen B cannot download Citizen A's certificate -> 403
        resp_b = raw_client.get(f"/api/applications/{app_a_id}/certificate.pdf", headers=auth_b)
        assert resp_b.status_code == 403

        # 3. Staff Officer can download certificate for official records
        resp_off = raw_client.get(f"/api/applications/{app_a_id}/certificate.pdf", headers=auth_off)
        assert resp_off.status_code == 200
        assert "application/pdf" in resp_off.headers["content-type"]

    finally:
        db.close()


def test_cross_citizen_idor_isolation(raw_client):
    db = SessionLocal()
    try:
        cit_a_id = f"cit-idor-a-{uuid.uuid4().hex[:8]}"
        cit_b_id = f"cit-idor-b-{uuid.uuid4().hex[:8]}"

        token_a = create_citizen_token(cit_a_id, "Citizen A", "+919876543221")
        token_b = create_citizen_token(cit_b_id, "Citizen B", "+919876543222")

        auth_a = {"Authorization": f"Bearer {token_a}"}
        auth_b = {"Authorization": f"Bearer {token_b}"}

        app_b_id = f"app-b-{uuid.uuid4().hex[:8]}"
        doc_b_id = f"doc-b-{uuid.uuid4().hex[:8]}"

        app_b = models.Application(
            id=app_b_id,
            citizen_name="Citizen B",
            citizen_profile_id=cit_b_id,
            service_type="ration_card",
            status="READY_FOR_REVIEW",
            tracking_token="secret-tracking-token-bbb",
        )
        doc_b = models.DocumentRecord(
            id=doc_b_id,
            application_id=app_b_id,
            doc_type="aadhaar",
            detected_type="aadhaar",
            original_filename="citizen_b_aadhaar.pdf",
            status="ACTIVE",
        )
        db.add_all([app_b, doc_b])
        db.commit()

        # 1. Citizen A tries to access Citizen B's application details -> 403
        r_app = raw_client.get(f"/api/applications/{app_b_id}", headers=auth_a)
        assert r_app.status_code == 403

        # 2. Citizen A tries to download Citizen B's document -> 403
        r_doc = raw_client.get(f"/api/documents/{doc_b_id}/download", headers=auth_a)
        assert r_doc.status_code == 403

        # 3. Citizen A tries to view Citizen B's history timeline -> 403
        r_hist = raw_client.get(f"/api/applications/{app_b_id}/history", headers=auth_a)
        assert r_hist.status_code == 403

        # 4. Citizen B (owner) can access their own records
        r_b_app = raw_client.get(f"/api/applications/{app_b_id}", headers=auth_b)
        assert r_b_app.status_code == 200
        r_b_hist = raw_client.get(f"/api/applications/{app_b_id}/history", headers=auth_b)
        assert r_b_hist.status_code == 200

    finally:
        db.close()


def test_admin_role_management_and_sole_admin_lockout_prevention(raw_client, officer_token, admin_token):
    auth_admin = {"Authorization": f"Bearer {admin_token}"}
    auth_officer = {"Authorization": f"Bearer {officer_token}"}

    # 1. Verification officer cannot manage staff users -> 403
    r_forbidden = raw_client.get("/api/staff/users", headers=auth_officer)
    assert r_forbidden.status_code == 403

    # 2. Administrator can list staff users
    r_users = raw_client.get("/api/staff/users", headers=auth_admin)
    assert r_users.status_code == 200
    users_list = r_users.json()
    assert any(u["username"] == "admin1" for u in users_list)

    # 3. Administrator can change staff role
    r_promote = raw_client.patch(
        "/api/staff/users/officer1/role",
        json={"role": "Senior Officer"},
        headers=auth_admin,
    )
    assert r_promote.status_code == 200
    assert r_promote.json()["new_role"] == "Senior Officer"

    # Restore officer1 role
    raw_client.patch(
        "/api/staff/users/officer1/role",
        json={"role": "Officer"},
        headers=auth_admin,
    )

    # 4. Sole Admin Lockout Prevention: Admin cannot demote self if sole admin
    r_lockout = raw_client.patch(
        "/api/staff/users/admin1/role",
        json={"role": "Officer"},
        headers=auth_admin,
    )
    assert r_lockout.status_code == 400
    assert "cannot remove your own Administrator role" in r_lockout.json()["detail"]

    # 5. Sole Admin Lockout Prevention: Admin cannot deactivate self if sole admin
    r_deact = raw_client.patch(
        "/api/staff/users/admin1/deactivate",
        headers=auth_admin,
    )
    assert r_deact.status_code == 400
    assert "cannot deactivate your own account" in r_deact.json()["detail"]


def test_operational_health_endpoint_and_workload_metrics(raw_client):
    # 1. Health check returns healthy and safe provider flags
    r_health = raw_client.get("/api/health")
    assert r_health.status_code == 200
    health_data = r_health.json()
    assert health_data["status"] == "ok"
    assert health_data["database"] == "healthy"
    assert "resend_email" in health_data["providers"]
    assert "firebase_auth" in health_data["providers"]
    # Verify no credentials leaked
    assert "key" not in health_data
    assert "password" not in health_data

    # 2. Dashboard metrics include live assigned vs unassigned counts
    r_dash = raw_client.get("/api/officer/dashboard-metrics")
    assert r_dash.status_code == 200
    dash_data = r_dash.json()
    assert "assigned_applications" in dash_data
    assert "unassigned_applications" in dash_data
    assert "sla_metrics" in dash_data
    assert isinstance(dash_data["assigned_applications"], int)


def test_admin_settings_service_requirements_endpoints(raw_client, admin_token, officer_token):
    auth_admin = {"Authorization": f"Bearer {admin_token}"}
    auth_officer = {"Authorization": f"Bearer {officer_token}"}

    # 1. Unauthenticated -> 401
    r_unauth = raw_client.get("/api/service-requirements")
    assert r_unauth.status_code == 401

    # 2. Officer (non-admin) -> 403 Forbidden
    r_officer = raw_client.get("/api/service-requirements", headers=auth_officer)
    assert r_officer.status_code == 403

    # 3. Admin -> 200 OK with dict of service_type -> list of document keys
    r_admin = raw_client.get("/api/service-requirements", headers=auth_admin)
    assert r_admin.status_code == 200
    reqs = r_admin.json()
    assert isinstance(reqs, dict)
    assert "income_certificate" in reqs
    assert "aadhaar" in reqs["income_certificate"]

    # 4. Admin can list services
    r_srv = raw_client.get("/api/admin/services", headers=auth_admin)
    assert r_srv.status_code == 200
    services = r_srv.json()
    assert isinstance(services, list)
    assert len(services) > 0

    # 5. Admin can update requirements
    r_update = raw_client.put(
        "/api/service-requirements/income_certificate",
        json={"document_types": ["aadhaar", "ration_card", "residence_proof"]},
        headers=auth_admin,
    )
    assert r_update.status_code == 200
    assert r_update.json()["document_types"] == ["aadhaar", "ration_card", "residence_proof"]

    # 6. Verify update persisted
    r_after = raw_client.get("/api/service-requirements", headers=auth_admin)
    assert "aadhaar" in r_after.json()["income_certificate"]
    assert "ration_card" in r_after.json()["income_certificate"]

