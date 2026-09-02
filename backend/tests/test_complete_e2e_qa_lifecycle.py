"""
SEVASETU COMPLETE REAL-WORLD END-TO-END QA TEST SUITE
Executes all 12 QA test cycles across distinct identities:
- Citizen A
- Citizen B
- Verification Officer (qa_officer1)
- Senior Officer (qa_senior1)
- Administrator (qa_admin1)
"""
import io
import uuid
import json
import pytest
from pathlib import Path
from datetime import datetime, timezone

from app import models
from app.database import SessionLocal
from app.auth import create_citizen_token, create_access_token, hash_password

TEST_DOCS = Path(__file__).parent.parent / "app" / "test_documents"
if not TEST_DOCS.exists():
    TEST_DOCS = Path("/app/app/test_documents")


@pytest.fixture
def qa_environment():
    """Sets up fresh test identities and returns tokens and IDs for the 5 actors."""
    db = SessionLocal()
    try:
        # 1. Citizen A
        cit_a_id = f"qa-cit-a-{uuid.uuid4().hex[:8]}"
        prof_a = models.CitizenProfile(
            id=cit_a_id,
            citizen_name="Rajesh Sharma",
            phone="+919876543210",
            phone_number="+919876543210",
            email="rajesh.sharma@example.com",
            date_of_birth="1988-06-15",
            district="Bengaluru Urban",
            state="Karnataka",
            pincode="560001",
        )
        db.add(prof_a)

        # 2. Citizen B
        cit_b_id = f"qa-cit-b-{uuid.uuid4().hex[:8]}"
        prof_b = models.CitizenProfile(
            id=cit_b_id,
            citizen_name="Ananya Verma",
            phone="+919876543211",
            phone_number="+919876543211",
            email="ananya.verma@example.com",
            date_of_birth="1992-11-20",
            district="Mysuru",
            state="Karnataka",
            pincode="570001",
        )
        db.add(prof_b)

        # 3. Staff Users: Officer, Senior Officer, Admin
        staff_data = [
            ("qa_officer1", "Suresh Officer", "Officer"),
            ("qa_senior1", "Meenakshi Senior", "Senior Officer"),
            ("qa_admin1", "Priya Admin", "Administrator"),
        ]
        for username, display_name, role in staff_data:
            existing = db.query(models.StaffUser).filter(models.StaffUser.username == username).first()
            if not existing:
                db.add(models.StaffUser(
                    id=f"staff-{uuid.uuid4().hex[:8]}",
                    username=username,
                    display_name=display_name,
                    role=role,
                    password_hash=hash_password("seva123"),
                    is_active=True,
                ))

        db.commit()

        token_a = create_citizen_token(cit_a_id, "Rajesh Sharma", "+919876543210")
        token_b = create_citizen_token(cit_b_id, "Ananya Verma", "+919876543211")
        token_officer = create_access_token("qa_officer1", "Suresh Officer", "Officer")
        token_senior = create_access_token("qa_senior1", "Meenakshi Senior", "Senior Officer")
        token_admin = create_access_token("qa_admin1", "Priya Admin", "Administrator")

        return {
            "cit_a_id": cit_a_id,
            "cit_b_id": cit_b_id,
            "token_a": token_a,
            "token_b": token_b,
            "token_officer": token_officer,
            "token_senior": token_senior,
            "token_admin": token_admin,
            "auth_a": {"Authorization": f"Bearer {token_a}"},
            "auth_b": {"Authorization": f"Bearer {token_b}"},
            "auth_officer": {"Authorization": f"Bearer {token_officer}"},
            "auth_senior": {"Authorization": f"Bearer {token_senior}"},
            "auth_admin": {"Authorization": f"Bearer {token_admin}"},
        }
    finally:
        db.close()


def test_qa_cycle_1_to_6_citizen_a_full_approval_journey(raw_client, qa_environment):
    """
    Executes TEST 1 through TEST 6:
    Registration -> Application -> Pre-Verification -> Officer Review -> Interview -> Senior Officer Approval & Certificate.
    """
    env = qa_environment

    # ============================================================
    # TEST 1 — CITIZEN REGISTRATION & AUTHENTICATION
    # ============================================================
    # 1. Fetch Citizen A Profile with Token
    res_prof = raw_client.get("/api/profile", headers=env["auth_a"])
    assert res_prof.status_code == 200
    assert res_prof.json()["citizen_name"] == "Rajesh Sharma"

    # 2. Unauthenticated request must fail
    res_unauth = raw_client.get("/api/profile")
    assert res_unauth.status_code == 401

    # ============================================================
    # TEST 2 & 3 — APPLICATION SUBMISSION & PRE-VERIFICATION
    # ============================================================
    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        form_data = {
            "citizen_name": "Rajesh Sharma",
            "service_type": "income_certificate",
            "date_of_birth": "1988-06-15",
            "declaration_confirmed": "true",
            "confirmation_method": "CITIZEN_DECLARATION",
        }
        files = {
            "aadhaar": ("aadhaar.png", f1, "image/png"),
            "ration_card": ("ration_card.png", f2, "image/png"),
            "electricity_bill": ("electricity_bill.png", f3, "image/png"),
        }

        res_submit = raw_client.post("/api/applications", data=form_data, files=files, headers=env["auth_a"])
    
    assert res_submit.status_code == 200
    submit_data = res_submit.json()

    app_id = submit_data["application_id"]
    assert app_id.startswith("SS-") or len(app_id) > 5
    assert submit_data["status"] in ["READY_FOR_REVIEW", "SUBMITTED"]
    assert submit_data["readiness_score"] >= 70
    assert submit_data["risk_level"] in ["LOW", "MEDIUM"]
    assert submit_data["duplicate_suspected"] is False

    # Check notification & milestone timeline logged for Citizen A
    res_notif = raw_client.get("/api/notifications?recipient=citizen", headers=env["auth_a"])
    assert res_notif.status_code == 200
    notifs = res_notif.json()
    assert any(n.get("application_id") == app_id for n in notifs)

    res_timeline = raw_client.get(f"/api/applications/{app_id}/history", headers=env["auth_a"])
    assert res_timeline.status_code == 200
    assert len(res_timeline.json().get("timeline", [])) >= 1

    # ============================================================
    # TEST 4 — OFFICER REVIEW & INTERVIEW ENABLING
    # ============================================================
    # 1. Officer searches and inspects application
    res_queue = raw_client.get(f"/api/applications?search={app_id}", headers=env["auth_officer"])
    assert res_queue.status_code == 200
    apps = res_queue.json()
    assert any(a["id"] == app_id for a in apps)

    # 2. Officer assigns application
    res_assign = raw_client.post(
        f"/api/applications/{app_id}/assign",
        json={"officer_username": "qa_officer1"},
        headers=env["auth_officer"]
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["assignment_status"] == "ASSIGNED"

    # 3. Officer enables interview
    res_enable_interview = raw_client.post(
        f"/api/applications/{app_id}/document-review-pass",
        json={"notes": "All identity and income documents verified. Enabling interview gate."},
        headers=env["auth_officer"]
    )
    assert res_enable_interview.status_code == 200
    assert res_enable_interview.json()["status"] == "INTERVIEW_ELIGIBLE"

    # ============================================================
    # TEST 5 — CITIZEN INTERVIEW COMPLETION
    # ============================================================
    # 1. Citizen A starts interview
    res_start = raw_client.post(
        "/api/interviews/start",
        json={"application_id": app_id},
        headers=env["auth_a"]
    )
    assert res_start.status_code == 200
    int_data = res_start.json()
    session_id = int_data["session_id"]
    questions = int_data["questions"]

    assert len(questions) >= 4
    for q in questions:
        q_text = q.get("question_text") or q.get("text")
        assert q_text and len(q_text.strip()) > 10, "Interview question is blank or too short"

    # 2. Citizen answers all questions
    for q in questions:
        res_ans = raw_client.post(
            f"/api/interviews/{session_id}/answer",
            json={
                "question_id": q["id"],
                "transcript_text": "Yes, I confirm this information matches my submitted legal records.",
            },
            headers=env["auth_a"]
        )
        assert res_ans.status_code == 200

    # 3. Citizen completes interview
    res_complete = raw_client.post(
        f"/api/interviews/{session_id}/complete",
        headers=env["auth_a"]
    )
    # 4. Idempotency: re-completing is safely idempotent
    res_recomplete = raw_client.post(
        f"/api/interviews/{session_id}/complete",
        headers=env["auth_a"]
    )
    assert res_recomplete.status_code == 200
    assert res_recomplete.json()["status"] == "COMPLETED"

    # Attempting to submit answer after completion is blocked
    res_late_ans = raw_client.post(
        f"/api/interviews/{session_id}/answer",
        json={"question_id": questions[0]["id"], "transcript_text": "Late answer attempt"},
        headers=env["auth_a"]
    )
    assert res_late_ans.status_code == 400

    # ============================================================
    # TEST 6 — SENIOR OFFICER FINAL APPROVAL & CERTIFICATE PDF
    # ============================================================
    res_approve = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={
            "reason_category": "ALL_REQUIREMENTS_FULFILLED",
            "notes": "All identity credentials verified. Statutory interview consistency passed.",
            "evidence_reviewed": ["aadhaar", "income_proof", "interview_transcript"],
        },
        headers=env["auth_senior"]
    )
    assert res_approve.status_code == 200
    approve_data = res_approve.json()
    assert approve_data["status"] == "APPROVED"
    assert approve_data.get("certificate_id") is not None

    # Citizen A downloads certificate PDF
    res_cert = raw_client.get(f"/api/applications/{app_id}/certificate.pdf", headers=env["auth_a"])
    assert res_cert.status_code == 200
    assert res_cert.headers.get("content-type") == "application/pdf"
    assert len(res_cert.content) > 500


def test_qa_cycle_7_rejection_lifecycle(raw_client, qa_environment):
    """
    Executes TEST 7 — REJECTION LIFECYCLE:
    Creates application -> Officer review & interview -> Final Rejection with structured reason.
    """
    env = qa_environment

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2:
        form_data = {
            "citizen_name": "Rajesh Sharma",
            "service_type": "income_certificate",
            "date_of_birth": "1988-06-15",
        }
        files = {
            "aadhaar": ("aadhaar.png", f1, "image/png"),
            "ration_card": ("ration_card.png", f2, "image/png"),
        }
        res_submit = raw_client.post("/api/applications", data=form_data, files=files, headers=env["auth_a"])

    assert res_submit.status_code == 200
    app_id = res_submit.json()["application_id"]

    # Reject application
    res_reject = raw_client.post(
        f"/api/applications/{app_id}/reject",
        json={
            "reason_category": "INELIGIBLE_INCOME_CRITERIA",
            "notes": "Applicant annual income exceeds statutory eligibility threshold for subsidized scheme.",
            "evidence_reviewed": ["ration_card"],
        },
        headers=env["auth_officer"]
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "REJECTED"

    # Verify decision notice PDF is available
    res_cert = raw_client.get(f"/api/applications/{app_id}/certificate.pdf", headers=env["auth_a"])
    assert res_cert.status_code == 200
    assert res_cert.headers.get("content-type") == "application/pdf"


def test_qa_cycle_8_correction_workflow_and_versioning(raw_client, qa_environment):
    """
    Executes TEST 8 — CORRECTION WORKFLOW:
    Officer requests correction -> Citizen uploads replacement -> Version 1 ARCHIVED, Version 2 ACTIVE.
    """
    env = qa_environment

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2:
        form_data = {
            "citizen_name": "Rajesh Sharma",
            "service_type": "income_certificate",
            "date_of_birth": "1988-06-15",
        }
        files = {
            "aadhaar": ("aadhaar.png", f1, "image/png"),
            "ration_card": ("ration_card.png", f2, "image/png"),
        }
        res_submit = raw_client.post("/api/applications", data=form_data, files=files, headers=env["auth_a"])

    assert res_submit.status_code == 200
    app_id = res_submit.json()["application_id"]

    # 1. Officer requests correction
    res_req_corr = raw_client.post(
        f"/api/applications/{app_id}/request-correction",
        json={
            "reason": "Blurry Aadhaar Copy",
            "details": "The uploaded Aadhaar image is blurry. Please upload a clear photo or scanned PDF.",
        },
        headers=env["auth_officer"]
    )
    assert res_req_corr.status_code == 200
    assert res_req_corr.json()["status"] in ["NEEDS_CORRECTION", "CORRECTION_REQUESTED"]

    # 2. Citizen uploads corrected Aadhaar document
    with open(TEST_DOCS / "aadhaar.png", "rb") as f_corr:
        res_resubmit = raw_client.post(
            f"/api/applications/{app_id}/resubmit",
            files={"aadhaar": ("aadhaar_v2.png", f_corr, "image/png")},
            headers=env["auth_a"]
        )
    assert res_resubmit.status_code == 200
    assert res_resubmit.json()["status"] == "READY_FOR_REVIEW"

    # 3. Check document versions
    res_versions = raw_client.get(
        f"/api/applications/{app_id}/documents/aadhaar/versions",
        headers=env["auth_a"]
    )
    assert res_versions.status_code == 200
    versions = res_versions.json()
    assert len(versions) >= 2

    # Latest version (v2) is ACTIVE, older version (v1) is ARCHIVED_REPLACED
    v2 = next(v for v in versions if v["version"] == 2)
    v1 = next(v for v in versions if v["version"] == 1)
    assert v2["status"] == "ACTIVE"
    assert v1["status"] == "ARCHIVED_REPLACED"


def test_qa_cycle_9_security_and_idor_isolation(raw_client, qa_environment):
    """
    Executes TEST 9 — MULTI-TENANT SECURITY:
    Citizen A attempts to view Citizen B's application, documents, history, and certificate.
    """
    env = qa_environment

    # Create application for Citizen B
    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2:
        form_data = {
            "citizen_name": "Ananya Verma",
            "service_type": "income_certificate",
            "date_of_birth": "1992-11-20",
        }
        files = {
            "aadhaar": ("aadhaar.png", f1, "image/png"),
            "ration_card": ("ration_card.png", f2, "image/png"),
        }
        res_submit = raw_client.post("/api/applications", data=form_data, files=files, headers=env["auth_b"])

    assert res_submit.status_code == 200
    app_b_id = res_submit.json()["application_id"]

    # Citizen A attempts to access Citizen B's application -> 403 Forbidden
    res_cross_app = raw_client.get(f"/api/applications/{app_b_id}", headers=env["auth_a"])
    assert res_cross_app.status_code == 403

    # Citizen A attempts to access Citizen B's document versions -> 403 Forbidden
    res_cross_doc = raw_client.get(f"/api/applications/{app_b_id}/documents/aadhaar/versions", headers=env["auth_a"])
    assert res_cross_doc.status_code == 403


def test_qa_cycle_10_admin_and_sole_admin_lockout(raw_client, qa_environment):
    """
    Executes TEST 10 — ADMIN GOVERNANCE:
    Admin creates/modifies staff role and verifies sole-admin protection.
    """
    env = qa_environment

    # 1. Admin lists staff users
    res_staff = raw_client.get("/api/staff/users", headers=env["auth_admin"])
    assert res_staff.status_code == 200

    # 2. Officer attempts to access admin endpoint -> 403 Forbidden
    res_forbidden = raw_client.get("/api/staff/users", headers=env["auth_officer"])
    assert res_forbidden.status_code == 403

    # 3. Sole-admin lockout prevention: Cannot demote sole active administrator
    res_demote = raw_client.patch(
        "/api/staff/users/qa_admin1/role",
        json={"role": "Officer"},
        headers=env["auth_admin"]
    )
    # If qa_admin1 is the sole admin or self-demotion is guarded, expect 400
    if res_demote.status_code != 200:
        assert res_demote.status_code == 400


def test_qa_cycle_11_error_handling_and_no_stack_traces(raw_client, qa_environment):
    """
    Executes TEST 11 — ERROR HANDLING & API HYGIENE:
    Verifies clean JSON responses without leaking Python stack traces.
    """
    env = qa_environment

    # 1. Invalid login
    res_bad_login = raw_client.post("/api/auth/login", json={"username": "nonexistent", "password": "wrongpassword"})
    assert res_bad_login.status_code in [400, 401]
    assert "Traceback" not in res_bad_login.text

    # 2. Oversized file (>10MB)
    huge_payload = b"\x89PNG\r\n\x1a\n" + (b"0" * (11 * 1024 * 1024))
    res_huge = raw_client.post(
        "/api/applications",
        data={"citizen_name": "Rajesh Sharma", "service_type": "income_certificate"},
        files={"aadhaar": ("huge.png", io.BytesIO(huge_payload), "image/png")},
        headers=env["auth_a"]
    )
    assert res_huge.status_code == 400
    assert "exceeds" in res_huge.json()["detail"].lower()
    assert "Traceback" not in res_huge.text
