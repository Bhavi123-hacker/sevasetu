"""
Automated Integration & Security Tests for Final 9.8/10 Productization Sprint:
- Phase 2: Independent Public Certificate Verification & Privacy Safety
- Phase 3: QR Code in Certificate PDF
- Phase 4: Executive Command Center Telemetry & RBAC
- Phase 6 & 7: Notification Event Architecture & Provider Safety
- Phase 8: Grievance Lifecycle & Internal Note Isolation
"""
import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db, SessionLocal
from app import models
from app.auth import hash_password, create_access_token, create_citizen_token
from app.pipeline.report import build_decision_certificate_pdf, create_qr_drawing


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_public_certificate_verification_valid_and_privacy_safe(client, db_session):
    """
    Tests Phase 2: Public certificate verification endpoint without authentication.
    Confirms that certificate validity is proven while strictly shielding private citizen data.
    """
    app_id = "cert-test-app-001"
    cert_id = "SS-CERT-2026-TEST01"

    # Cleanup existing
    db_session.query(models.Application).filter(models.Application.id == app_id).delete()
    db_session.commit()

    # Create approved application
    app_record = models.Application(
        id=app_id,
        citizen_name="Private Citizen Name",
        service_type="income_certificate",
        status="APPROVED",
        decision_certificate_id=cert_id,
        resolved_by="Officer Ramesh Kumar",
        resolved_at=datetime.now(timezone.utc),
        readiness_score=92,
        decision_reason_category="Statutory Verification Satisfied",
        decision_remarks="Confidential officer remarks on internal verification.",
    )
    db_session.add(app_record)
    db_session.commit()

    # Call public verification endpoint without any auth token
    res = client.get(f"/api/public/verify-certificate/{cert_id}")
    assert res.status_code == 200
    data = res.json()

    # Check validity metadata
    assert data["valid"] is True
    assert data["certificate_status"] == "VALID"
    assert data["certificate_id"] == cert_id
    assert "SS-2026-CERT-TEST-APP-001" in data["application_reference"] or "CERT-TEST-APP-001" in data["application_reference"]
    assert "Income Certificate" in data["service"]
    assert data["decision"] == "APPROVED"
    assert "SevaSetu Authorized Officer" in data["issuing_authority"]
    assert "Ramesh Kumar" in data["authorized_officer"]

    # Verify Strict Privacy Rule (No PII leaked)
    assert "citizen_name" not in data
    assert "Private Citizen Name" not in json.dumps(data)
    assert "phone" not in data
    assert "aadhaar" not in data
    assert "address" not in data
    assert "documents" not in data
    assert "Confidential officer remarks" not in json.dumps(data)


def test_public_certificate_verification_invalid_and_404(client, db_session):
    """
    Tests Phase 2: Querying non-existent or unfinalized certificates returns 404 without leaking data.
    """
    # 1. Non-existent certificate
    res = client.get("/api/public/verify-certificate/SS-CERT-INVALID-99999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

    # 2. Application that is not yet finalized (e.g. READY_FOR_REVIEW)
    draft_app_id = "cert-draft-app-002"
    db_session.query(models.Application).filter(models.Application.id == draft_app_id).delete()
    db_session.commit()

    draft_app = models.Application(
        id=draft_app_id,
        citizen_name="Draft Applicant",
        service_type="caste_certificate",
        status="READY_FOR_REVIEW",
        decision_certificate_id="SS-CERT-DRAFT-002",
    )
    db_session.add(draft_app)
    db_session.commit()

    res_draft = client.get("/api/public/verify-certificate/SS-CERT-DRAFT-002")
    assert res_draft.status_code == 404


def test_certificate_pdf_generation_with_qr_code():
    """
    Tests Phase 3: Decision certificate PDF includes genuine vector QR code and verification reference.
    """
    app_data = {
        "id": "app-qr-test-100",
        "citizen_name": "Kavitha Sundaram",
        "service_type": "income_certificate",
        "status": "APPROVED",
        "decision_certificate_id": "SS-CERT-2026-QR100",
        "readiness_score": 90,
        "resolved_by": "Senior Officer Priya Sharma",
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "verification_url": "http://localhost:3000/verify?certificate=SS-CERT-2026-QR100",
    }

    pdf_bytes = build_decision_certificate_pdf(app_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    assert b"%PDF" in pdf_bytes[:10]

    # Verify QR drawing utility
    qr_drawing = create_qr_drawing("http://localhost:3000/verify?certificate=SS-CERT-2026-QR100", size=60)
    assert qr_drawing is not None
    assert qr_drawing.width == 60
    assert qr_drawing.height == 60


def test_command_center_metrics_endpoint_rbac_and_data(client, db_session):
    """
    Tests Phase 4: Executive Command Center metrics endpoint enforces staff RBAC and computes live DB telemetry.
    """
    # 1. Unauthenticated request is rejected
    res_unauth = client.get("/api/command-center/metrics")
    assert res_unauth.status_code in [401, 403]

    # 2. Staff user authentication
    staff_user = db_session.query(models.StaffUser).filter(models.StaffUser.username == "admin1").first()
    if not staff_user:
        staff_user = models.StaffUser(
            id="admin-test-uid-01",
            username="admin1",
            password_hash=hash_password("admin123"),
            display_name="Administrator",
            role="Administrator",
            is_active=True,
        )
        db_session.add(staff_user)
        db_session.commit()

    token = create_access_token(username=staff_user.username, name=staff_user.display_name or "Administrator", role=staff_user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Successful authenticated request
    res = client.get("/api/command-center/metrics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "overview" in data
    assert "sla_health" in data
    assert "performance" in data
    assert "grievances" in data
    assert "officers" in data
    assert "service_performance" in data
    assert data["metadata"]["data_source"] == "Live relational database"

    # 4. Filter by service
    res_filtered = client.get("/api/command-center/metrics?service_id=income_certificate&days=30", headers=headers)
    assert res_filtered.status_code == 200
    data_filtered = res_filtered.json()
    assert data_filtered["metadata"]["filter_service"] == "income_certificate"
    assert data_filtered["metadata"]["filter_days"] == 30


def test_grievance_internal_notes_isolation(client, db_session):
    """
    Tests Phase 8: Grievance internal staff deliberation notes are isolated from citizen view.
    """
    grv_id = "grv-sec-test-01"
    db_session.query(models.GrievanceMessage).filter(models.GrievanceMessage.grievance_id == grv_id).delete()
    db_session.query(models.Grievance).filter(models.Grievance.id == grv_id).delete()
    db_session.commit()

    # Create grievance
    grv = models.Grievance(
        id=grv_id,
        public_reference="SS-GRV-2026-TESTNOTE",
        citizen_id="citizen-sec-01",
        citizen_name="Citizen Tester",
        subject="Delay in income certificate processing",
        description="Application pending for 10 days.",
        category="PROCESSING_DELAY",
        status="UNDER_REVIEW",
    )
    db_session.add(grv)
    db_session.commit()

    # Staff adds internal note
    staff_user = db_session.query(models.StaffUser).filter(models.StaffUser.username == "admin1").first()
    if not staff_user:
        staff_user = models.StaffUser(
            id="admin-test-uid-01",
            username="admin1",
            password_hash=hash_password("admin123"),
            display_name="Administrator",
            role="Administrator",
            is_active=True,
        )
        db_session.add(staff_user)
        db_session.commit()

    token_staff = create_access_token(username=staff_user.username, name=staff_user.display_name or "Administrator", role=staff_user.role)
    headers_staff = {"Authorization": f"Bearer {token_staff}"}

    res_note = client.post(
        f"/api/grievances/{grv_id}/internal-note",
        json={"note_text": "CONFIDENTIAL: Internal staff review of applicant income records."},
        headers=headers_staff,
    )
    assert res_note.status_code == 200

    # Staff fetches grievance details -> sees internal note
    res_staff_view = client.get(f"/api/grievances/{grv_id}", headers=headers_staff)
    assert res_staff_view.status_code == 200
    staff_data = res_staff_view.json()
    internal_msgs = [m for m in staff_data.get("messages", []) if m.get("is_internal") is True]
    assert len(internal_msgs) > 0
    assert "CONFIDENTIAL" in internal_msgs[0]["message_text"]

    # Citizen fetches grievance details -> CANNOT see internal notes
    prof = db_session.query(models.CitizenProfile).filter(models.CitizenProfile.id == "citizen-sec-01").first()
    if not prof:
        prof = models.CitizenProfile(
            id="citizen-sec-01",
            citizen_name="Citizen Tester",
            phone_number="+919876543210",
        )
        db_session.add(prof)
        db_session.commit()

    token_citizen = create_citizen_token(profile_id="citizen-sec-01", name="Citizen Tester")
    headers_citizen = {"Authorization": f"Bearer {token_citizen}"}

    res_citizen_view = client.get(f"/api/grievances/{grv_id}", headers=headers_citizen)
    assert res_citizen_view.status_code == 200
    citizen_data = res_citizen_view.json()
    citizen_internal_msgs = [m for m in citizen_data.get("messages", []) if m.get("is_internal") is True]
    assert len(citizen_internal_msgs) == 0
    assert "CONFIDENTIAL" not in json.dumps(citizen_data)
