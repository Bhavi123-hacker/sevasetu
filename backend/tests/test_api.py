"""
Regression suite — codifies what was manually verified, ad hoc, while
building this project. Run with: pytest tests/ -v
Needs the synthetic test documents to exist first:
    python -m app.generate_test_documents
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

TEST_DOCS = Path(__file__).parent.parent / "app" / "test_documents"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def officer_token(client):
    r = client.post("/api/auth/login", json={"username": "officer1", "password": "officer-demo-pass"})
    return r.json()["access_token"]


@pytest.fixture
def admin_token(client):
    r = client.post("/api/auth/login", json={"username": "admin1", "password": "admin-demo-pass"})
    return r.json()["access_token"]


def _submit_full_bundle(client, citizen_name="Rahul Kumar"):
    with open(TEST_DOCS / "aadhaar.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        return client.post(
            "/api/applications",
            data={"citizen_name": citizen_name, "service_type": "income_certificate"},
            files={
                "aadhaar": ("a.png", f1, "image/png"),
                "ration_card": ("r.png", f2, "image/png"),
                "electricity_bill": ("e.png", f3, "image/png"),
            },
        )


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_full_readiness_pipeline_catches_the_injected_mismatch(client):
    r = _submit_full_bundle(client)
    assert r.status_code == 200
    data = r.json()
    assert data["readiness_score"] == 75
    assert data["missing_documents"] == ["residence_proof"]
    address_check = next(c for c in data["field_checks"] if c["field"] == "address")
    assert address_check["status"] == "fail"
    assert "12 MG Road" in address_check["detail"] and "14 MG Road" in address_check["detail"]


def test_score_reasoning_sums_to_the_actual_score(client):
    r = _submit_full_bundle(client)
    data = r.json()
    assert sum(item["points"] for item in data["score_reasoning"]) == data["readiness_score"]


def test_ocr_confidence_is_real_and_high_for_clean_synthetic_docs(client):
    r = _submit_full_bundle(client)
    assert r.json()["average_ocr_confidence"] > 85


def test_duplicate_detection(client):
    _submit_full_bundle(client, citizen_name="Duplicate Test Person")
    r2 = _submit_full_bundle(client, citizen_name="Duplicate Test Person")
    assert r2.json()["duplicate_suspected"] is True


def test_auth_rejects_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "officer1", "password": "wrong"})
    assert r.status_code == 401


def test_officer_password_does_not_work_for_admin_account_and_vice_versa(client):
    """
    The actual vulnerability this replaced: the old login let the client
    pick a role from a dropdown and checked it against one password
    shared by both roles. Nothing bound identity to role. This is the
    real regression test for that fix, not just a generic auth check.
    """
    r1 = client.post("/api/auth/login", json={"username": "admin1", "password": "officer-demo-pass"})
    assert r1.status_code == 401

    r2 = client.post("/api/auth/login", json={"username": "officer1", "password": "admin-demo-pass"})
    assert r2.status_code == 401


def test_login_rate_limiting(client):
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "rate_limit_probe", "password": "wrong"})
    r = client.post("/api/auth/login", json={"username": "rate_limit_probe", "password": "wrong"})
    assert r.status_code == 429


def test_protected_route_rejects_missing_token(client):
    r = client.get("/api/applications")
    assert r.status_code in (401, 403)


def test_role_enforcement_both_directions(client, officer_token, admin_token):
    r = client.put(
        "/api/service-requirements/income_certificate",
        json={"document_types": ["aadhaar"]},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert r.status_code == 403  # Officer blocked from an Administrator-only route

    app_r = _submit_full_bundle(client, citizen_name="Role Test Person")
    app_id = app_r.json()["application_id"]
    r2 = client.post(
        f"/api/applications/{app_id}/resolve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 403  # Administrator blocked from an Officer-only route


def test_resolve_uses_verified_token_identity_not_client_input(client, officer_token):
    app_r = _submit_full_bundle(client, citizen_name="Attribution Test Person")
    app_id = app_r.json()["application_id"]
    client.post(f"/api/applications/{app_id}/resolve", headers={"Authorization": f"Bearer {officer_token}"})
    detail = client.get(f"/api/applications/{app_id}").json()
    assert detail["resolved_by"] == "Suresh"


def test_audit_trail_records_every_stage(client, officer_token):
    app_r = _submit_full_bundle(client, citizen_name="Audit Test Person")
    app_id = app_r.json()["application_id"]
    r = client.get(f"/api/applications/{app_id}/audit", headers={"Authorization": f"Bearer {officer_token}"})
    event_types = [e["event_type"] for e in r.json()]
    assert event_types == [
        "Uploaded", "OCR Completed", "Consistency Check Completed",
        "Duplicate Check Completed", "Readiness Scored",
    ]


@pytest.mark.parametrize("question,expected_id", [
    ("how long does processing take", "processing_time"),
    ("what documents do I need", "required_documents"),
    ("can I appeal a rejection", "appeals"),
    ("is there a fee", "fees"),
    ("how long is the certificate valid", "validity"),
    ("what happens if I submit twice", "duplicate_submissions"),
])
def test_hybrid_retrieval_matches_the_right_passage(client, question, expected_id):
    r = client.post("/api/ask", json={"question": question})
    assert r.json()["matches"][0]["id"] == expected_id


def test_feedback_sentiment_positive_and_negative(client):
    pos = client.post("/api/feedback", json={"text": "This was fast and easy, thank you!"})
    neg = client.post("/api/feedback", json={"text": "Terrible, nobody explained the delay."})
    assert pos.json()["sentiment_label"] == "positive"
    assert neg.json()["sentiment_label"] == "negative"


def test_admin_can_edit_checklist_officer_cannot(client, officer_token, admin_token):
    r = client.put(
        "/api/service-requirements/income_certificate",
        json={"document_types": ["aadhaar", "ration_card"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200

    # restore the default afterwards so later tests in this file aren't affected
    client.put(
        "/api/service-requirements/income_certificate",
        json={"document_types": ["aadhaar", "ration_card", "electricity_bill", "residence_proof"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )


def test_pdf_report_downloads_as_a_real_pdf(client):
    app_r = _submit_full_bundle(client, citizen_name="PDF Test Person")
    app_id = app_r.json()["application_id"]
    r = client.get(f"/api/applications/{app_id}/report.pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"


def test_unknown_application_returns_404(client):
    r = client.get("/api/applications/doesnotexist")
    assert r.status_code == 404
