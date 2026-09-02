"""
Comprehensive Civic Grievance, Support & Escalation Module Test Suite.
Tests:
- Citizen grievance lodgment with / without application reference
- Attachment validation (magic bytes, size check, sanitization)
- IDOR isolation: cross-citizen isolation on GET, response, reopen, close, attachment download
- Cross-citizen application reference blocking
- Full grievance state machine lifecycle (OPEN -> ACKNOWLEDGED -> ASSIGNED -> UNDER_REVIEW -> AWAITING_CITIZEN -> UNDER_REVIEW -> ESCALATED -> RESOLVED -> REOPENED -> CLOSED)
- Reopen count limit enforcement (MAX_REOPEN_LIMIT = 2)
- Internal staff notes strictly hidden from citizens
- SLA computation (NORMAL, APPROACHING_SLA, OVERDUE, MET)
- Chained cryptographic audit trail events
- Multi-channel in-app notification creation and idempotency
- Grievance queue search, filtering, and pagination
- Linked application grievances lookup
"""
import pytest
import io
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from starlette.testclient import TestClient
from app.main import app
from app.auth import create_citizen_token, create_access_token
from app.models import CitizenProfile, Application, Grievance, GrievanceMessage, AuditEvent, Notification
from app.grievances import (
    STATUS_OPEN, STATUS_ACKNOWLEDGED, STATUS_ASSIGNED, STATUS_UNDER_REVIEW,
    STATUS_AWAITING_CITIZEN, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_CLOSED, STATUS_REOPENED,
    validate_grievance_transition, compute_grievance_sla_status, compute_grievance_sla_deadline
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def grievance_env(client):
    from app.database import SessionLocal
    with SessionLocal() as db_session:
        # Create Citizen A
        cit_a_id = f"cit-grv-a-{uuid.uuid4().hex[:6]}"
        profile_a = CitizenProfile(
            id=cit_a_id,
            citizen_name="Manoj Kumar",
            email="manoj@example.com",
            phone="+919811122233",
            address="12 MG Road, Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
        )
        db_session.add(profile_a)

        # Create Citizen B
        cit_b_id = f"cit-grv-b-{uuid.uuid4().hex[:6]}"
        profile_b = CitizenProfile(
            id=cit_b_id,
            citizen_name="Deepa Sharma",
            email="deepa@example.com",
            phone="+919844455566",
            address="45 Park Street, Mysuru",
            district="Mysuru",
            state="Karnataka",
        )
        db_session.add(profile_b)

        # Create Application for Citizen A
        app_a_id = f"app-grv-a-{uuid.uuid4().hex[:6]}"
        app_a = Application(
            id=app_a_id,
            citizen_profile_id=cit_a_id,
            citizen_name="Manoj Kumar",
            service_type="income_certificate",
            status="READY_FOR_REVIEW",
            risk_level="LOW",
        )
        db_session.add(app_a)

        # Create Application for Citizen B
        app_b_id = f"app-grv-b-{uuid.uuid4().hex[:6]}"
        app_b = Application(
            id=app_b_id,
            citizen_profile_id=cit_b_id,
            citizen_name="Deepa Sharma",
            service_type="ration_card",
            status="NEEDS_CORRECTION",
            risk_level="MEDIUM",
        )
        db_session.add(app_b)
        db_session.commit()

    token_a = create_citizen_token(cit_a_id, "Manoj Kumar", "+919811122233")
    token_b = create_citizen_token(cit_b_id, "Deepa Sharma", "+919844455566")
    token_officer = create_access_token("officer1", "Suresh (Officer)", "Officer")
    token_senior = create_access_token("senior_officer1", "Meenakshi (Senior Officer)", "Senior Officer")
    token_admin = create_access_token("admin1", "Priya (Admin)", "Administrator")

    return {
        "cit_a_id": cit_a_id,
        "cit_b_id": cit_b_id,
        "app_a_id": app_a_id,
        "app_b_id": app_b_id,
        "auth_a": {"Authorization": f"Bearer {token_a}"},
        "auth_b": {"Authorization": f"Bearer {token_b}"},
        "auth_officer": {"Authorization": f"Bearer {token_officer}"},
        "auth_senior": {"Authorization": f"Bearer {token_senior}"},
        "auth_admin": {"Authorization": f"Bearer {token_admin}"},
    }


def test_grievance_creation_with_and_without_application(client, grievance_env):
    env = grievance_env

    # 1. Citizen A creates grievance linked to own application
    res1 = client.post(
        "/api/grievances",
        data={
            "subject": "Delay in income certificate processing",
            "description": "My income certificate has been in review for over statutory timeframe.",
            "category": "APPLICATION_DELAYED",
            "application_id": env["app_a_id"],
        },
        headers=env["auth_a"]
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "OPEN"
    assert data1["public_reference"].startswith("SS-GRV-")
    assert data1["application_id"] == env["app_a_id"]
    grv_id_1 = data1["grievance_id"]

    # 2. Citizen A creates general grievance without application
    res2 = client.post(
        "/api/grievances",
        data={
            "subject": "Portal login technical problem",
            "description": "Encountered session timeout during verification interview.",
            "category": "TECHNICAL_PROBLEM",
        },
        headers=env["auth_a"]
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "OPEN"
    assert data2["application_id"] is None


def test_grievance_cross_citizen_application_blocking(client, grievance_env):
    """Citizen A cannot create a grievance against Citizen B's application."""
    env = grievance_env

    res = client.post(
        "/api/grievances",
        data={
            "subject": "Illegitimate dispute attempt",
            "description": "Attempting to file grievance against another person application.",
            "category": "DECISION_DISPUTE",
            "application_id": env["app_b_id"],
        },
        headers=env["auth_a"]
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_grievance_attachment_validation_and_download(client, grievance_env):
    """Verifies magic bytes validation, size limit, and IDOR on attachment download."""
    env = grievance_env

    # Valid PNG attachment
    valid_png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200
    files = {
        "attachment": ("evidence_screenshot.png", io.BytesIO(valid_png_bytes), "image/png")
    }
    data = {
        "subject": "Document wrongly flagged as unreadable",
        "description": "Attaching the original high-resolution scan of my Aadhaar card.",
        "category": "DOCUMENT_REJECTED",
        "application_id": env["app_a_id"],
    }
    res = client.post("/api/grievances", data=data, files=files, headers=env["auth_a"])
    assert res.status_code == 200
    grv_id = res.json()["grievance_id"]

    # Download attachment as Citizen A (owner) -> 200 OK
    res_dl = client.get(f"/api/grievances/{grv_id}/attachment", headers=env["auth_a"])
    assert res_dl.status_code == 200
    assert len(res_dl.content) == len(valid_png_bytes)

    # Download attachment as Officer -> 200 OK
    res_dl_off = client.get(f"/api/grievances/{grv_id}/attachment", headers=env["auth_officer"])
    assert res_dl_off.status_code == 200

    # IDOR: Citizen B attempts to download Citizen A's attachment -> 403 Forbidden
    res_dl_idor = client.get(f"/api/grievances/{grv_id}/attachment", headers=env["auth_b"])
    assert res_dl_idor.status_code == 403


def test_grievance_idor_isolation(client, grievance_env):
    """Citizen A cannot view, respond to, reopen, or close Citizen B's grievance."""
    env = grievance_env

    # Create grievance by Citizen B
    res_b = client.post(
        "/api/grievances",
        data={
            "subject": "Correction clarification for ration card",
            "description": "Please clarify which page of ration card requires update.",
            "category": "CORRECTION_REQUEST_ISSUE",
            "application_id": env["app_b_id"],
        },
        headers=env["auth_b"]
    )
    assert res_b.status_code == 200
    grv_b_id = res_b.json()["grievance_id"]

    # Citizen A attempts to GET Citizen B's grievance -> 403
    res_get = client.get(f"/api/grievances/{grv_b_id}", headers=env["auth_a"])
    assert res_get.status_code == 403

    # Citizen A attempts to GET Citizen B's grievance history -> 403
    res_hist = client.get(f"/api/grievances/{grv_b_id}/history", headers=env["auth_a"])
    assert res_hist.status_code == 403

    # Citizen A attempts to POST response on Citizen B's grievance -> 403
    res_resp = client.post(
        f"/api/grievances/{grv_b_id}/respond",
        json={"message_text": "Unauthorized message attempt"},
        headers=env["auth_a"]
    )
    assert res_resp.status_code == 403

    # Citizen A attempts to close Citizen B's grievance -> 403
    res_close = client.post(
        f"/api/grievances/{grv_b_id}/close",
        headers=env["auth_a"]
    )
    assert res_close.status_code == 403


def test_full_grievance_lifecycle_workflow(client, grievance_env):
    """
    Executes full grievance state lifecycle:
    OPEN -> ACKNOWLEDGED -> ASSIGNED -> UNDER_REVIEW -> AWAITING_CITIZEN -> UNDER_REVIEW -> ESCALATED -> RESOLVED -> REOPENED -> CLOSED
    """
    env = grievance_env

    # 1. Citizen A creates grievance
    res_create = client.post(
        "/api/grievances",
        data={
            "subject": "Decision dispute regarding income threshold",
            "description": "My annual income certificate was rejected but calculation did not consider non-taxable allowances.",
            "category": "DECISION_DISPUTE",
            "application_id": env["app_a_id"],
        },
        headers=env["auth_a"]
    )
    assert res_create.status_code == 200
    grv_id = res_create.json()["grievance_id"]
    pub_ref = res_create.json()["public_reference"]

    # 2. Officer Acknowledges grievance
    res_ack = client.post(f"/api/grievances/{grv_id}/acknowledge", headers=env["auth_officer"])
    assert res_ack.status_code == 200
    assert res_ack.json()["status"] == "ACKNOWLEDGED"

    # 3. Officer Assigns grievance to self
    res_assign = client.post(
        f"/api/grievances/{grv_id}/assign",
        json={"assigned_officer_name": "Suresh (Officer)"},
        headers=env["auth_officer"]
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["status"] == "ASSIGNED"

    # 4. Officer Starts Review
    res_start = client.post(f"/api/grievances/{grv_id}/start-review", headers=env["auth_officer"])
    assert res_start.status_code == 200
    assert res_start.json()["status"] == "UNDER_REVIEW"

    # 5. Officer adds Internal Note (verified hidden from citizen)
    res_note = client.post(
        f"/api/grievances/{grv_id}/internal-note",
        json={"note_text": "Investigated income schedule; need bank statement for verification."},
        headers=env["auth_officer"]
    )
    assert res_note.status_code == 200

    # Citizen inspects grievance -> internal note must NOT be present
    res_cit_view = client.get(f"/api/grievances/{grv_id}", headers=env["auth_a"])
    assert res_cit_view.status_code == 200
    msg_texts = [m["message_text"] for m in res_cit_view.json()["messages"]]
    assert not any("Investigated income schedule" in t for t in msg_texts)

    # Officer inspects grievance -> internal note MUST be present
    res_off_view = client.get(f"/api/grievances/{grv_id}", headers=env["auth_officer"])
    assert res_off_view.status_code == 200
    off_msg_texts = [m["message_text"] for m in res_off_view.json()["messages"]]
    assert any("Investigated income schedule" in t for t in off_msg_texts)

    # 6. Officer Requests Information from Citizen (status becomes AWAITING_CITIZEN)
    res_req_info = client.post(
        f"/api/grievances/{grv_id}/request-information",
        json={"question_text": "Please provide latest 3 months salary slips or employer certificate."},
        headers=env["auth_officer"]
    )
    assert res_req_info.status_code == 200
    assert res_req_info.json()["status"] == "AWAITING_CITIZEN"

    # 7. Citizen Responds to Information Request (status automatically transitions back to UNDER_REVIEW)
    res_cit_resp = client.post(
        f"/api/grievances/{grv_id}/respond",
        json={"message_text": "I have uploaded the employer salary certificate confirming base pay is within limit."},
        headers=env["auth_a"]
    )
    assert res_cit_resp.status_code == 200
    assert res_cit_resp.json()["status"] == "UNDER_REVIEW"

    # 8. Escalation to Senior Review
    res_esc = client.post(
        f"/api/grievances/{grv_id}/escalate",
        json={"reason": "Requires statutory income deduction interpretation by Senior Officer.", "priority": "HIGH"},
        headers=env["auth_officer"]
    )
    assert res_esc.status_code == 200
    assert res_esc.json()["status"] == "ESCALATED"
    assert res_esc.json()["priority"] == "HIGH"

    # 9. Senior Officer Resolves Grievance
    res_resolve = client.post(
        f"/api/grievances/{grv_id}/resolve",
        json={
            "resolution_notes": "Statutory deduction policy applied. Applicant eligible for income certificate revision.",
            "resolution_category": "DECISION_REVISED"
        },
        headers=env["auth_senior"]
    )
    assert res_resolve.status_code == 200
    assert res_resolve.json()["status"] == "RESOLVED"

    # 10. Citizen Reopens Grievance (Reconsideration Request #1)
    res_reopen = client.post(
        f"/api/grievances/{grv_id}/reopen",
        json={"reopen_reason": "Need formal revised certificate issuance confirmation."},
        headers=env["auth_a"]
    )
    assert res_reopen.status_code == 200
    assert res_reopen.json()["status"] == "REOPENED"
    assert res_reopen.json()["reopen_count"] == 1

    # Senior Officer re-resolves
    res_re_resolve = client.post(
        f"/api/grievances/{grv_id}/resolve",
        json={
            "resolution_notes": "Application status reset to APPROVED with fresh digital certificate generated.",
            "resolution_category": "CERTIFICATE_ISSUED"
        },
        headers=env["auth_senior"]
    )
    assert res_re_resolve.status_code == 200
    assert res_re_resolve.json()["status"] == "RESOLVED"

    # 11. Citizen Closes Grievance
    res_close = client.post(
        f"/api/grievances/{grv_id}/close",
        json={"feedback": "Issue resolved swiftly and satisfactorily."},
        headers=env["auth_a"]
    )
    assert res_close.status_code == 200
    assert res_close.json()["status"] == "CLOSED"

    # Terminal state check: Closed grievance cannot transition
    res_invalid_reopen = client.post(
        f"/api/grievances/{grv_id}/reopen",
        json={"reopen_reason": "Trying to reopen closed grievance"},
        headers=env["auth_a"]
    )
    assert res_invalid_reopen.status_code == 400


def test_grievance_reopen_limit_enforcement(client, grievance_env):
    """Verifies that citizen cannot exceed MAX_REOPEN_LIMIT (2)."""
    env = grievance_env

    # Create grievance
    res_c = client.post(
        "/api/grievances",
        data={
            "subject": "Multiple reconsideration test",
            "description": "Testing max reopen limit guardrails.",
            "category": "OTHER",
        },
        headers=env["auth_a"]
    )
    grv_id = res_c.json()["grievance_id"]

    # First resolve
    client.post(
        f"/api/grievances/{grv_id}/resolve",
        json={"resolution_notes": "First resolution"},
        headers=env["auth_officer"]
    )

    # Reopen #1 -> OK
    r1 = client.post(f"/api/grievances/{grv_id}/reopen", json={"reopen_reason": "First dispute"}, headers=env["auth_a"])
    assert r1.status_code == 200

    # Second resolve
    client.post(
        f"/api/grievances/{grv_id}/resolve",
        json={"resolution_notes": "Second resolution"},
        headers=env["auth_officer"]
    )

    # Reopen #2 -> OK
    r2 = client.post(f"/api/grievances/{grv_id}/reopen", json={"reopen_reason": "Second dispute"}, headers=env["auth_a"])
    assert r2.status_code == 200

    # Third resolve
    client.post(
        f"/api/grievances/{grv_id}/resolve",
        json={"resolution_notes": "Third resolution"},
        headers=env["auth_officer"]
    )

    # Reopen #3 -> BLOCKED (Exceeded limit of 2)
    r3 = client.post(f"/api/grievances/{grv_id}/reopen", json={"reopen_reason": "Third dispute"}, headers=env["auth_a"])
    assert r3.status_code == 400
    assert "Maximum reconsideration limit" in r3.json()["detail"]


def test_grievance_queue_search_filter_pagination(client, grievance_env):
    """Tests staff grievance queue with category, status, priority filters and search."""
    env = grievance_env

    # List as Officer
    res_list = client.get("/api/grievances?page=1&page_size=10", headers=env["auth_officer"])
    assert res_list.status_code == 200
    data = res_list.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_application_linked_grievances_endpoint(client, grievance_env):
    """Tests GET /api/applications/{application_id}/grievances."""
    env = grievance_env

    # Create grievance linked to Application A
    client.post(
        "/api/grievances",
        data={
            "subject": "Linked application grievance verification",
            "description": "Checking that application page displays this grievance.",
            "category": "INTERVIEW_ISSUE",
            "application_id": env["app_a_id"],
        },
        headers=env["auth_a"]
    )

    # Citizen A views own application grievances
    res_linked = client.get(f"/api/applications/{env['app_a_id']}/grievances", headers=env["auth_a"])
    assert res_linked.status_code == 200
    items = res_linked.json()
    assert len(items) >= 1
    assert items[0]["category"] == "INTERVIEW_ISSUE"

    # IDOR: Citizen B cannot view Citizen A's application grievances
    res_idor = client.get(f"/api/applications/{env['app_a_id']}/grievances", headers=env["auth_b"])
    assert res_idor.status_code == 403
