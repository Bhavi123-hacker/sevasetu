"""
Tests for SevaSetu Statutory Workflow & AI Verification Interview Gates:
- Enforces that final statutory approval is strictly prohibited from READY_FOR_REVIEW or INTERVIEW_ELIGIBLE.
- Requires Officer Document Review Pass -> INTERVIEW_ELIGIBLE.
- Requires AI Verification Interview Completion -> FINAL_OFFICER_REVIEW / INTERVIEW_COMPLETED.
- Enforces human officer statutory decision at the final review stage.
- Verifies RBAC and Citizen IDOR protection on interview and approval endpoints.
"""

import pytest
from pathlib import Path

TEST_DOCS = Path(__file__).parent.parent / "app" / "test_documents"
if not TEST_DOCS.exists():
    TEST_DOCS = Path("/app/app/test_documents")


def test_statutory_workflow_interview_gate_lifecycle(raw_client, officer_token):
    # 1. Register & login citizen
    raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Arjun Mehta",
        "phone_number": "+919876540001",
        "password": "Password@123",
        "address": "123 Civic Lane, New Delhi",
        "date_of_birth": "1995-05-15",
    })
    r_login = raw_client.post("/api/auth/citizen/login", json={
        "phone_number": "+919876540001",
        "password": "Password@123",
    })
    assert r_login.status_code == 200
    citizen_token = r_login.json()["access_token"]
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    # 2. Submit application
    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        r_sub = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Arjun Mehta", "service_type": "income_certificate"},
            files={
                "aadhaar": ("aadhaar.png", f1, "image/png"),
                "ration_card": ("ration_card.png", f2, "image/png"),
                "electricity_bill": ("electricity_bill.png", f3, "image/png"),
            },
            headers=citizen_headers,
        )
    assert r_sub.status_code == 200
    app_id = r_sub.json()["application_id"]
    assert r_sub.json()["status"] == "READY_FOR_REVIEW"

    # 3. GATING TEST 1: Citizen CANNOT start interview before Officer Document Review Pass
    r_early_intv = raw_client.post(
        "/api/interviews/start",
        json={"application_id": app_id},
        headers=citizen_headers,
    )
    assert r_early_intv.status_code == 400
    assert "not available yet" in r_early_intv.json()["detail"]

    # 4. GATING TEST 2: Officer CANNOT directly approve application from READY_FOR_REVIEW
    r_bypass_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Illegal direct approval attempt without interview"},
        headers=officer_headers,
    )
    assert r_bypass_appr.status_code == 400
    assert "Final approval requires" in r_bypass_appr.json()["detail"]

    # 5. GATING TEST 3: Citizen CANNOT approve application (RBAC)
    r_cit_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Citizen unauthorized approval"},
        headers=citizen_headers,
    )
    assert r_cit_appr.status_code == 403

    # 6. Officer Document Review Pass -> transitions to INTERVIEW_ELIGIBLE
    r_doc_pass = raw_client.post(
        f"/api/applications/{app_id}/document-review-pass",
        json={"notes": "All uploaded documents verified readable and coherent."},
        headers=officer_headers,
    )
    assert r_doc_pass.status_code == 200
    assert r_doc_pass.json()["status"] == "INTERVIEW_ELIGIBLE"

    # 7. GATING TEST 4: Officer CANNOT approve from INTERVIEW_ELIGIBLE without interview
    r_eligible_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Premature approval attempt"},
        headers=officer_headers,
    )
    assert r_eligible_appr.status_code == 400

    # 8. Citizen starts AI Verification Interview
    r_start_intv = raw_client.post(
        "/api/interviews/start",
        json={"application_id": app_id},
        headers=citizen_headers,
    )
    assert r_start_intv.status_code == 200
    session_data = r_start_intv.json()
    session_id = session_data["session_id"]
    assert session_data["status"] == "IN_PROGRESS"

    # Verify application transitioned to INTERVIEW_IN_PROGRESS
    r_app_check = raw_client.get(f"/api/applications/{app_id}", headers=officer_headers)
    assert r_app_check.json()["status"] == "INTERVIEW_IN_PROGRESS"

    # 9. GATING TEST 5: Officer CANNOT approve while interview is IN_PROGRESS
    r_inprog_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Approval while interview in progress"},
        headers=officer_headers,
    )
    assert r_inprog_appr.status_code == 400

    # 10. Citizen answers questions & completes interview
    for q in session_data["questions"]:
        raw_client.post(
            f"/api/interviews/{session_id}/answer",
            json={"question_id": q["id"], "transcript_text": "Arjun Mehta"},
            headers=citizen_headers,
        )
    r_comp = raw_client.post(f"/api/interviews/{session_id}/complete", headers=citizen_headers)
    assert r_comp.status_code == 200

    # Application is now in FINAL_OFFICER_REVIEW / INTERVIEW_COMPLETED
    r_app_final = raw_client.get(f"/api/applications/{app_id}", headers=officer_headers)
    assert r_app_final.json()["status"] in ["FINAL_OFFICER_REVIEW", "INTERVIEW_COMPLETED"]
    assert r_app_final.json()["interview_summary"] is not None

    # 11. Final Officer Statutory Approval succeeds
    r_final_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Statutory decision: Approved following document check and interview consistency."},
        headers=officer_headers,
    )
    assert r_final_appr.status_code == 200
    assert r_final_appr.json()["status"] == "APPROVED"
    assert r_final_appr.json()["resolved_by"] == "Suresh"

    # 12. Terminal status lock: Cannot approve or reject again
    r_term_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Duplicate approval"},
        headers=officer_headers,
    )
    assert r_term_appr.status_code == 400
    assert "terminal status" in r_term_appr.json()["detail"]


def test_cross_citizen_interview_idor_protection(raw_client):
    # Citizen A
    raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen A", "phone_number": "+919876540011", "password": "Password@123",
    })
    tok_a = raw_client.post("/api/auth/citizen/login", json={
        "phone_number": "+919876540011", "password": "Password@123",
    }).json()["access_token"]

    # Citizen B
    raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen B", "phone_number": "+919876540022", "password": "Password@123",
    })
    tok_b = raw_client.post("/api/auth/citizen/login", json={
        "phone_number": "+919876540022", "password": "Password@123",
    }).json()["access_token"]

    # Citizen A submits application
    with open(TEST_DOCS / "aadhaar.png", "rb") as f1:
        r_app = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Citizen A", "service_type": "income_certificate"},
            files={"aadhaar": ("aadhaar.png", f1, "image/png")},
            headers={"Authorization": f"Bearer {tok_a}"},
        )
    app_id = r_app.json()["application_id"]

    # Citizen B attempts to start interview for Citizen A's application -> 403 Forbidden
    r_idor = raw_client.post(
        "/api/interviews/start",
        json={"application_id": app_id},
        headers={"Authorization": f"Bearer {tok_b}"},
    )
    assert r_idor.status_code == 403
    assert "belongs to another citizen" in r_idor.json()["detail"]
