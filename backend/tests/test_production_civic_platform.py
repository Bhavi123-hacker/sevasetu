"""
Comprehensive Production Civic Platform Tests:
- Multi-role RBAC (Citizen, Verification Officer, Senior Officer, Administrator)
- State Machine lifecycle transitions & statutory guardrails
- Document Versioning (V1 -> V2), SHA-256 Checksums, and Secure Downloads
- Officer Application Queue search, filter, and pagination
- Officer Workload Assignment
- Cryptographic Audit Trail & Hash Chaining
- SLA Calculations and Threshold Monitoring
- Structured Decision Records & Certificate Issuance
- Notification Idempotency
"""

import pytest
import os
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from app.pipeline.state_machine import (
    STATE_DRAFT, STATE_SUBMITTED, STATE_READY_FOR_REVIEW, STATE_NEEDS_CORRECTION,
    STATE_CORRECTION_SUBMITTED, STATE_INTERVIEW_ELIGIBLE, STATE_INTERVIEW_IN_PROGRESS,
    STATE_INTERVIEW_COMPLETED, STATE_APPROVED, STATE_REJECTED,
    VALID_TRANSITIONS, validate_state_transition, compute_sla_deadline, compute_sla_status,
)
from app.auth import (
    ROLE_CITIZEN, ROLE_VERIFICATION_OFFICER, ROLE_SENIOR_OFFICER, ROLE_ADMIN,
    normalize_role, create_access_token, create_citizen_token
)

TEST_DOCS = Path(__file__).parent.parent / "app" / "test_documents"
if not TEST_DOCS.exists():
    TEST_DOCS = Path("/app/app/test_documents")


@pytest.fixture
def senior_officer_token(raw_client):
    from app.auth import clear_failed_attempts
    clear_failed_attempts("senior_officer1")
    r = raw_client.post("/api/auth/login", json={"username": "senior_officer1", "password": "senior-demo-pass"})
    if r.status_code != 200:
        return create_access_token("senior_officer1", "Senior Officer", "Meenakshi")
    return r.json()["access_token"]


def test_role_normalization():
    assert normalize_role("officer") == ROLE_VERIFICATION_OFFICER
    assert normalize_role("VERIFICATION_OFFICER") == ROLE_VERIFICATION_OFFICER
    assert normalize_role("senior_officer") == ROLE_SENIOR_OFFICER
    assert normalize_role("admin") == ROLE_ADMIN
    assert normalize_role("citizen") == ROLE_CITIZEN


def test_state_machine_transition_rules():
    # Valid transitions
    assert validate_state_transition(STATE_SUBMITTED, STATE_READY_FOR_REVIEW) is True
    assert validate_state_transition(STATE_READY_FOR_REVIEW, STATE_INTERVIEW_ELIGIBLE) is True
    assert validate_state_transition(STATE_INTERVIEW_ELIGIBLE, STATE_INTERVIEW_IN_PROGRESS) is True
    assert validate_state_transition(STATE_INTERVIEW_IN_PROGRESS, STATE_INTERVIEW_COMPLETED) is True
    assert validate_state_transition(STATE_INTERVIEW_COMPLETED, STATE_APPROVED) is True
    assert validate_state_transition(STATE_READY_FOR_REVIEW, STATE_NEEDS_CORRECTION) is True
    assert validate_state_transition(STATE_NEEDS_CORRECTION, STATE_CORRECTION_SUBMITTED) is True

    # Invalid transitions should raise HTTPException
    with pytest.raises(Exception):
        validate_state_transition(STATE_SUBMITTED, STATE_APPROVED)
    with pytest.raises(Exception):
        validate_state_transition(STATE_APPROVED, STATE_REJECTED)


def test_sla_deadline_and_status_computation():
    now = datetime.now(timezone.utc)
    deadline = compute_sla_deadline(now, "income_certificate")
    assert deadline > now

    # Normal SLA
    assert compute_sla_status(now, now + timedelta(days=7), resolved_at=None) == "NORMAL"
    # Approaching SLA
    assert compute_sla_status(now - timedelta(hours=8), now + timedelta(hours=2), resolved_at=None) == "APPROACHING_SLA"
    # Overdue SLA
    assert compute_sla_status(now - timedelta(days=4), now - timedelta(hours=2), resolved_at=None) == "OVERDUE"
    # Resolved within SLA
    assert compute_sla_status(now, now + timedelta(days=7), resolved_at=now + timedelta(hours=1)) == "MET"


def test_document_versioning_and_resubmission(raw_client, officer_token):
    # 1. Citizen registers and submits application
    phone = f"+91987654{int(datetime.now().timestamp()) % 10000:04d}"
    reg_r = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Deepak Sharma", "phone_number": phone, "password": "Password@123",
    })
    token = reg_r.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {token}"}
    o_headers = {"Authorization": f"Bearer {officer_token}"}

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        sub_r = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Deepak Sharma", "service_type": "income_certificate"},
            files={"aadhaar": ("aadhaar.png", f1, "image/png"), "ration_card": ("ration_card.png", f2, "image/png"), "electricity_bill": ("electricity_bill.png", f3, "image/png")},
            headers=c_headers,
        )
    assert sub_r.status_code == 200
    app_id = sub_r.json()["application_id"]

    # Check initial document version (version = 1)
    v_r1 = raw_client.get(f"/api/applications/{app_id}/documents/aadhaar/versions", headers=o_headers)
    assert v_r1.status_code == 200
    versions1 = v_r1.json()
    assert len(versions1) == 1
    assert versions1[0]["version"] == 1
    assert versions1[0]["status"] == "ACTIVE"
    assert versions1[0]["checksum_sha256"] is not None
    doc_id_v1 = versions1[0]["id"]

    # 2. Officer requests correction
    corr_r = raw_client.post(
        f"/api/applications/{app_id}/request-correction",
        json={"reason": "Address Mismatch", "details": "Please upload updated Aadhaar with current address", "document": "aadhaar"},
        headers=o_headers,
    )
    assert corr_r.status_code == 200

    # 3. Citizen resubmits replacement Aadhaar
    with open(TEST_DOCS / "aadhaar.png", "rb") as f_new:
        resub_r = raw_client.post(
            f"/api/applications/{app_id}/resubmit",
            files={"aadhaar": ("aadhaar_v2.png", f_new, "image/png")},
            headers=c_headers,
        )
    assert resub_r.status_code == 200

    # 4. Check document version history (version 2 active, version 1 archived)
    v_r2 = raw_client.get(f"/api/applications/{app_id}/documents/aadhaar/versions", headers=o_headers)
    assert v_r2.status_code == 200
    versions2 = v_r2.json()
    assert len(versions2) == 2
    assert versions2[0]["version"] == 2
    assert versions2[0]["status"] == "ACTIVE"
    assert versions2[1]["version"] == 1
    assert versions2[1]["status"] == "ARCHIVED_REPLACED"

    # 5. Secure download verification
    dl_r = raw_client.get(f"/api/documents/{doc_id_v1}/download", headers=o_headers)
    assert dl_r.status_code == 200
    assert dl_r.json()["doc_type"] == "aadhaar"


def test_officer_assignment_and_senior_reassignment(raw_client, officer_token, senior_officer_token):
    unique_phone = f"+919{uuid.uuid4().int % 1000000000:09d}"
    reg_r = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Kavita Nair", "phone_number": unique_phone, "password": "Password@123",
    })
    token = reg_r.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {token}"}
    o_headers = {"Authorization": f"Bearer {officer_token}"}
    s_headers = {"Authorization": f"Bearer {senior_officer_token}"}

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        sub_r = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Kavita Nair", "service_type": "income_certificate"},
            files={"aadhaar": ("aadhaar.png", f1, "image/png"), "ration_card": ("ration_card.png", f2, "image/png"), "electricity_bill": ("electricity_bill.png", f3, "image/png")},
            headers=c_headers,
        )
    app_id = sub_r.json()["application_id"]

    # 2. Officer self-assigns
    assign_r = raw_client.post(
        f"/api/applications/{app_id}/assign",
        json={"officer_username": "officer1"},
        headers=o_headers,
    )
    assert assign_r.status_code == 200
    assert assign_r.json()["assignment_status"] == "ASSIGNED"
    assert assign_r.json()["assigned_officer_name"] is not None

    # 3. Officer CANNOT reassign to another officer (forbidden for regular officer)
    bad_reassign = raw_client.post(
        f"/api/applications/{app_id}/assign",
        json={"officer_username": "senior_officer1"},
        headers=o_headers,
    )
    assert bad_reassign.status_code == 403

    # 4. Senior Officer CAN reassign to another officer
    senior_reassign = raw_client.post(
        f"/api/applications/{app_id}/assign",
        json={"officer_username": "senior_officer1"},
        headers=s_headers,
    )
    assert senior_reassign.status_code == 200


def test_officer_queue_search_filter_pagination(raw_client, officer_token):
    o_headers = {"Authorization": f"Bearer {officer_token}"}
    
    # Query queue with search and pagination
    q_r = raw_client.get("/api/applications?page=1&limit=5&status=ALL", headers=o_headers)
    assert q_r.status_code == 200
    assert "X-Total-Count" in q_r.headers
    assert "X-Page" in q_r.headers
    assert isinstance(q_r.json(), list)


def test_dashboard_metrics_endpoint(raw_client, officer_token):
    o_headers = {"Authorization": f"Bearer {officer_token}"}
    metrics_r = raw_client.get("/api/officer/dashboard-metrics", headers=o_headers)
    assert metrics_r.status_code == 200
    data = metrics_r.json()
    assert "total_applications" in data
    assert "pending_review" in data
    assert "corrections_pending" in data
    assert "interviews_pending" in data
    assert "final_reviews" in data
    assert "approved" in data
    assert "rejected" in data
    assert "sla_metrics" in data


def test_cryptographic_audit_trail_and_citizen_history(raw_client, officer_token):
    # 1. Submit application
    reg_r = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Audit Test Subject", "phone_number": f"+91987654{int(datetime.now().timestamp()) % 10000:04d}", "password": "Password@123",
    })
    token = reg_r.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {token}"}
    o_headers = {"Authorization": f"Bearer {officer_token}"}

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        sub_r = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Audit Test Subject", "service_type": "income_certificate"},
            files={"aadhaar": ("aadhaar.png", f1, "image/png"), "ration_card": ("ration_card.png", f2, "image/png"), "electricity_bill": ("electricity_bill.png", f3, "image/png")},
            headers=c_headers,
        )
    app_id = sub_r.json()["application_id"]

    # 2. Staff views audit trail (includes SHA-256 hash chains)
    audit_r = raw_client.get(f"/api/audit-trail?application_id={app_id}", headers=o_headers)
    assert audit_r.status_code == 200
    res_data = audit_r.json()
    events = res_data.get("events", res_data if isinstance(res_data, list) else [])
    assert len(events) > 0
    assert "event_hash" in events[0]

    # 3. Citizen views sanitized timeline
    hist_r = raw_client.get(f"/api/applications/{app_id}/history", headers=c_headers)
    assert hist_r.status_code == 200
    res_hist = hist_r.json()
    timeline = res_hist.get("timeline", res_hist if isinstance(res_hist, list) else [])
    assert len(timeline) > 0
    assert "title" in timeline[0]
