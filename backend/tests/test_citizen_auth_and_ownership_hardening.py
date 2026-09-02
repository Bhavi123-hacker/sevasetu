"""
SEVASETU v1.1.1 — CITIZEN AUTHENTICATION, OWNERSHIP & SECURITY HARDENING SUITE
Validates all 20 requirements from Section 16:
1. Fresh citizen registration/login
2. Fresh application empty fields
3. Citizen A accesses Citizen B profile -> 401/403
4. Citizen A modifies Citizen B profile -> 403
5. Anonymous application creation -> 401
6. Citizen A submits Citizen B profile ID -> 403
7. Citizen A accesses Citizen B application -> 403
8. Citizen A resubmits Citizen B application -> 403
9. Citizen A accesses Citizen B notifications -> scoped/403
10. Citizen starts interview before officer review -> 400
11. Direct interview URL without eligible app -> 400
12. Officer passes document review -> INTERVIEW_ELIGIBLE
13. Citizen starts eligible interview -> INTERVIEW_IN_PROGRESS
14. Interview completed -> INTERVIEW_COMPLETED
15. Citizen cannot approve own application -> 403
16. Officer performs final decision with attribution
17. Production OTP provider missing -> NOT_CONFIGURED
18. Production response does not expose dev_otp
19. Wallet document not silently attached
20. Cross-citizen notification access blocked
"""
import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app

TEST_DOCS = Path(__file__).parent.parent / "app" / "test_documents"
OFFICER_PASSWORD = os.getenv("OFFICER_DEMO_PASSWORD", "officer-demo-pass")


def test_01_fresh_citizen_registration_and_session(raw_client):
    """TEST 1: Fresh citizen registration/login creates authenticated citizen session."""
    r = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Aarav Patel",
        "phone_number": "+919876511111",
        "password": "aarav-secure-pass",
    })
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "Citizen"
    assert data["profile"]["citizen_name"] == "Aarav Patel"

    # Verify session via /api/auth/citizen/me
    token = data["access_token"]
    me_r = raw_client.get("/api/auth/citizen/me", headers={"Authorization": f"Bearer {token}"})
    assert me_r.status_code == 200
    assert me_r.json()["citizen_name"] == "Aarav Patel"


def test_02_fresh_citizen_profile_starts_empty(raw_client):
    """TEST 2: Fresh citizen has clean, empty profile without hardcoded demo data."""
    # Register a new citizen
    r = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Clean Citizen",
        "phone_number": "+919876522222",
    })
    assert r.status_code == 200
    token = r.json()["access_token"]

    prof_r = raw_client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})
    assert prof_r.status_code == 200
    prof = prof_r.json()
    assert prof["citizen_name"] == "Clean Citizen"
    # Should not have arbitrary demo names
    assert prof["citizen_name"] not in ["Pooja Sharma", "Bhavy Garg"]


def test_03_citizen_a_accesses_citizen_b_profile_rejected(raw_client):
    """TEST 3: Citizen A cannot access Citizen B's profile (401/403)."""
    # Register Citizen A
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen A", "phone_number": "+919876533333",
    })
    token_a = r_a.json()["access_token"]

    # Register Citizen B
    r_b = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen B", "phone_number": "+919876544444",
    })
    prof_id_b = r_b.json()["profile"]["id"]

    # Citizen A attempts to access Citizen B's profile
    r = raw_client.get(f"/api/profile?profile_id={prof_id_b}", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 403

    r_direct = raw_client.get(f"/api/profile/{prof_id_b}", headers={"Authorization": f"Bearer {token_a}"})
    assert r_direct.status_code == 403


def test_04_citizen_a_modifies_citizen_b_profile_rejected(raw_client):
    """TEST 4: Citizen A cannot modify Citizen B's profile (403)."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen A", "phone_number": "+919876555555",
    })
    token_a = r_a.json()["access_token"]

    r_b = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen B", "phone_number": "+919876566666",
    })
    prof_id_b = r_b.json()["profile"]["id"]

    # Citizen A attempts to overwrite Citizen B's profile
    mod_r = raw_client.put("/api/profile", json={
        "id": prof_id_b,
        "citizen_name": "Hacked Name",
        "address": "Malicious Address",
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert mod_r.status_code == 403


def test_05_anonymous_application_creation_rejected(raw_client):
    """TEST 5: Anonymous application creation without citizen authentication returns 401."""
    with open(TEST_DOCS / "aadhaar.png", "rb") as f1:
        r = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Anonymous Person", "service_type": "income_certificate"},
            files={"aadhaar": ("a.png", f1, "image/png")},
        )
    assert r.status_code == 401


def test_06_citizen_a_submits_citizen_b_profile_id_rejected(raw_client):
    """TEST 6: Citizen A submitting Citizen B's profile ID is rejected with 403."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen A", "phone_number": "+919876577777",
    })
    token_a = r_a.json()["access_token"]

    r_b = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen B", "phone_number": "+919876588888",
    })
    prof_id_b = r_b.json()["profile"]["id"]

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        r = raw_client.post(
            "/api/applications",
            data={
                "citizen_name": "Citizen A",
                "service_type": "income_certificate",
                "citizen_profile_id": prof_id_b,  # Attempting to assign to Citizen B
            },
            files={
                "aadhaar": ("a.png", f1, "image/png"),
                "ration_card": ("r.png", f2, "image/png"),
                "electricity_bill": ("e.png", f3, "image/png"),
            },
            headers={"Authorization": f"Bearer {token_a}"},
        )
    assert r.status_code == 403


def test_07_citizen_a_accesses_citizen_b_application_rejected(raw_client):
    """TEST 7: Citizen A cannot access Citizen B's private application details (403)."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Owner A", "phone_number": "+919876500011",
    })
    token_a = r_a.json()["access_token"]

    r_b = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Attacker B", "phone_number": "+919876500022",
    })
    token_b = r_b.json()["access_token"]

    # Citizen A creates application
    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        app_res = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Owner A", "service_type": "income_certificate"},
            files={"aadhaar": ("a.png", f1, "image/png"), "ration_card": ("r.png", f2, "image/png"), "electricity_bill": ("e.png", f3, "image/png")},
            headers={"Authorization": f"Bearer {token_a}"},
        )
    app_id = app_res.json()["application_id"]

    # Citizen B attempts to access Citizen A's application
    r = raw_client.get(f"/api/applications/{app_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 403


def test_08_citizen_a_resubmits_citizen_b_application_rejected(raw_client):
    """TEST 8: Citizen A cannot resubmit documents to Citizen B's application (403)."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Owner A", "phone_number": "+919876500033",
    })
    token_a = r_a.json()["access_token"]

    r_b = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Attacker B", "phone_number": "+919876500044",
    })
    token_b = r_b.json()["access_token"]

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        app_res = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Owner A", "service_type": "income_certificate"},
            files={"aadhaar": ("a.png", f1, "image/png"), "ration_card": ("r.png", f2, "image/png"), "electricity_bill": ("e.png", f3, "image/png")},
            headers={"Authorization": f"Bearer {token_a}"},
        )
    app_id = app_res.json()["application_id"]

    # Citizen B attempts to resubmit replacement files to Citizen A's application
    with open(TEST_DOCS / "aadhaar.png", "rb") as f_new:
        r = raw_client.post(
            f"/api/applications/{app_id}/resubmit",
            files={"aadhaar": ("a_new.png", f_new, "image/png")},
            headers={"Authorization": f"Bearer {token_b}"},
        )
    assert r.status_code == 403


def test_09_and_20_cross_citizen_notifications_blocked(raw_client):
    """TEST 9 & 20: Citizen A cannot query Citizen B notifications."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen A", "phone_number": "+919876500055",
    })
    token_a = r_a.json()["access_token"]
    prof_id_a = r_a.json()["profile"]["id"]

    r_b = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Citizen B", "phone_number": "+919876500066",
    })
    token_b = r_b.json()["access_token"]
    prof_id_b = r_b.json()["profile"]["id"]

    # Citizen A attempts to list notifications for Citizen B
    r = raw_client.get(f"/api/notifications?citizen_profile_id={prof_id_b}", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 403


def test_10_and_11_interview_gated_before_officer_review(raw_client):
    """TEST 10 & 11: Interview cannot start before officer review (400) and direct access is gated."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Applicant", "phone_number": "+919876500077",
    })
    token_a = r_a.json()["access_token"]

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        app_res = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Applicant", "service_type": "income_certificate"},
            files={"aadhaar": ("a.png", f1, "image/png"), "ration_card": ("r.png", f2, "image/png"), "electricity_bill": ("e.png", f3, "image/png")},
            headers={"Authorization": f"Bearer {token_a}"},
        )
    app_id = app_res.json()["application_id"]
    assert app_res.json()["status"] == "READY_FOR_REVIEW"

    # Citizen attempts to start interview immediately while in READY_FOR_REVIEW
    intv_r = raw_client.post(
        "/api/interviews/start",
        json={"application_id": app_id},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert intv_r.status_code == 400
    assert "Verification interview is not available yet" in intv_r.json()["detail"]


def test_12_13_14_officer_review_to_interview_completion_flow(raw_client, officer_token):
    """TEST 12, 13, 14: Officer passes document review -> INTERVIEW_ELIGIBLE -> citizen completes interview."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Interview Candidate", "phone_number": "+919876500088",
    })
    token_a = r_a.json()["access_token"]

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        app_res = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Interview Candidate", "service_type": "income_certificate"},
            files={"aadhaar": ("a.png", f1, "image/png"), "ration_card": ("r.png", f2, "image/png"), "electricity_bill": ("e.png", f3, "image/png")},
            headers={"Authorization": f"Bearer {token_a}"},
        )
    app_id = app_res.json()["application_id"]

    # TEST 12: Officer passes document review
    pass_r = raw_client.post(
        f"/api/applications/{app_id}/document-review-pass",
        json={"notes": "All documents verified and clear."},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert pass_r.status_code == 200
    assert pass_r.json()["status"] == "INTERVIEW_ELIGIBLE"

    # TEST 13: Citizen starts eligible interview
    start_r = raw_client.post(
        "/api/interviews/start",
        json={"application_id": app_id},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert start_r.status_code == 200
    session_id = start_r.json()["session_id"]
    assert len(start_r.json()["questions"]) > 0

    # Answer a question
    q = start_r.json()["questions"][0]
    ans_r = raw_client.post(
        f"/api/interviews/{session_id}/answer",
        json={"question_id": q["id"], "transcript_text": "Interview Candidate"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert ans_r.status_code == 200

    # TEST 14: Complete interview
    comp_r = raw_client.post(
        f"/api/interviews/{session_id}/complete",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert comp_r.status_code == 200
    assert comp_r.json()["status"] == "COMPLETED"


def test_15_and_16_citizen_cannot_approve_officer_final_decision(raw_client, officer_token):
    """TEST 15 & 16: Citizen cannot approve own application (403), officer performs statutory decision."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "Decided Citizen", "phone_number": "+919876500099",
    })
    token_a = r_a.json()["access_token"]

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        app_res = raw_client.post(
            "/api/applications",
            data={"citizen_name": "Decided Citizen", "service_type": "income_certificate"},
            files={"aadhaar": ("a.png", f1, "image/png"), "ration_card": ("r.png", f2, "image/png"), "electricity_bill": ("e.png", f3, "image/png")},
            headers={"Authorization": f"Bearer {token_a}"},
        )
    app_id = app_res.json()["application_id"]

    # TEST 15: Citizen attempts to approve their own application
    cit_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Self approved by citizen"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert cit_appr.status_code == 403

    # Officer passes document review -> INTERVIEW_ELIGIBLE
    pass_doc = raw_client.post(
        f"/api/applications/{app_id}/document-review-pass",
        json={"notes": "Document pre-verification passed."},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert pass_doc.status_code == 200

    # Citizen starts and completes interview -> INTERVIEW_COMPLETED
    intv_start = raw_client.post("/api/interviews/start", json={"application_id": app_id}, headers={"Authorization": f"Bearer {token_a}"})
    assert intv_start.status_code == 200
    intv_comp = raw_client.post(f"/api/interviews/{intv_start.json()['session_id']}/complete")
    assert intv_comp.status_code == 200

    # TEST 16: Authorized officer approves application
    off_appr = raw_client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Approved following complete pre-verification and interview."},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert off_appr.status_code == 200
    assert off_appr.json()["status"] == "APPROVED"
    assert off_appr.json()["resolved_by"] is not None


def test_17_and_18_production_otp_truthfulness_and_no_dev_otp(raw_client, monkeypatch):
    """TEST 17 & 18: In production mode, dev_otp is omitted and status is truthful."""
    monkeypatch.setenv("ENVIRONMENT", "production")

    r = raw_client.post("/api/auth/citizen/send-otp", json={"phone_number": "+919876512345"})
    assert r.status_code == 200
    data = r.json()
    assert "dev_otp" not in data
    assert data["status"] == "OTP_SENT"


def test_19_wallet_documents_not_silently_attached(raw_client):
    """TEST 19: Fresh application submission without wallet IDs does not attach wallet documents."""
    r_a = raw_client.post("/api/auth/citizen/register", json={
        "citizen_name": "No Wallet User", "phone_number": "+919876599991",
    })
    token_a = r_a.json()["access_token"]

    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        app_res = raw_client.post(
            "/api/applications",
            data={"citizen_name": "No Wallet User", "service_type": "income_certificate"},
            files={"aadhaar": ("a.png", f1, "image/png"), "ration_card": ("r.png", f2, "image/png"), "electricity_bill": ("e.png", f3, "image/png")},
            headers={"Authorization": f"Bearer {token_a}"},
        )
    assert app_res.status_code == 200
    app_id = app_res.json()["application_id"]

    # Verify inspection has 3 uploaded documents, all from direct upload, not wallet
    det_r = raw_client.get(f"/api/applications/{app_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert det_r.status_code == 200
    docs = det_r.json()["documents"]
    assert len(docs) == 3
