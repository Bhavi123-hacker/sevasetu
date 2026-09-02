"""
Regression suite — codifies what was manually verified, ad hoc, while
building this project. Run with: pytest tests/ -v
Needs the synthetic test documents to exist first:
    python -m app.generate_test_documents
"""
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth import clear_failed_attempts

TEST_DOCS = Path(__file__).parent.parent / "app" / "test_documents"
OFFICER_PASSWORD = os.getenv("OFFICER_DEMO_PASSWORD", "officer-demo-pass")
ADMIN_PASSWORD = os.getenv("ADMIN_DEMO_PASSWORD", "admin-demo-pass")


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
    r1 = client.post("/api/auth/login", json={"username": "admin1", "password": OFFICER_PASSWORD})
    assert r1.status_code == 401

    r2 = client.post("/api/auth/login", json={"username": "officer1", "password": ADMIN_PASSWORD})
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
    detail = client.get(f"/api/applications/{app_id}", headers={"Authorization": f"Bearer {officer_token}"}).json()
    assert detail["resolved_by"] == "Suresh"


def test_audit_trail_records_every_stage(client, officer_token):
    app_r = _submit_full_bundle(client, citizen_name="Audit Test Person")
    app_id = app_r.json()["application_id"]
    r = client.get(f"/api/applications/{app_id}/audit", headers={"Authorization": f"Bearer {officer_token}"})
    event_types = [e["event_type"] for e in r.json()]
    assert event_types == [
        "Uploaded", "OCR Completed", "Document Type Verification",
        "Consistency Check Completed", "Duplicate Check Completed", "Readiness Scored",
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
    token = app_r.json().get("tracking_token")
    url = f"/api/applications/{app_id}/report.pdf" + (f"?token={token}" if token else "")
    r = client.get(url)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"


def test_unknown_application_returns_404(client):
    r = client.get("/api/applications/doesnotexist")
    assert r.status_code == 404


def test_single_page_pdf_upload(client):
    with open(TEST_DOCS / "aadhaar.pdf", "rb") as f_pdf:
        r = client.post(
            "/api/applications",
            data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
            files={"aadhaar": ("aadhaar.pdf", f_pdf, "application/pdf")},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["citizen_name"] == "Rahul Kumar"
    assert data["average_ocr_confidence"] > 70
    name_check = next(c for c in data["field_checks"] if c["field"] == "name")
    assert name_check["status"] == "pass"


def test_multipage_pdf_upload_extracts_fields_across_pages(client):
    """
    Page 1 has Name and DOB, Page 2 has Address.
    Verifies that multi-page OCR aggregates text and extracts fields from all pages.
    """
    with open(TEST_DOCS / "multipage_aadhaar.pdf", "rb") as f_pdf:
        r = client.post(
            "/api/applications",
            data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
            files={"aadhaar": ("multipage_aadhaar.pdf", f_pdf, "application/pdf")},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["citizen_name"] == "Rahul Kumar"
    name_check = next(c for c in data["field_checks"] if c["field"] == "name")
    assert name_check["status"] == "pass"
    address_check = next(c for c in data["field_checks"] if c["field"] == "address")
    assert address_check["status"] == "pass"


def test_mixed_pdf_and_image_bundle(client):
    """Bundle containing single-page PDF, multi-page PDF, and PNG images together."""
    with open(TEST_DOCS / "aadhaar.pdf", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        r = client.post(
            "/api/applications",
            data={"citizen_name": "Mixed Citizen", "service_type": "income_certificate"},
            files={
                "aadhaar": ("aadhaar.pdf", f1, "application/pdf"),
                "ration_card": ("ration_card.png", f2, "image/png"),
                "electricity_bill": ("electricity_bill.png", f3, "image/png"),
            },
        )
    assert r.status_code == 200
    data = r.json()
    assert data["readiness_score"] == 75
    address_check = next(c for c in data["field_checks"] if c["field"] == "address")
    assert address_check["status"] == "fail"


def test_unsupported_file_rejected_cleanly(client):
    fake_txt = b"Hello world this is a text file."
    r = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
        files={"aadhaar": ("document.txt", fake_txt, "text/plain")},
    )
    assert r.status_code == 400
    assert "Invalid 'aadhaar' document" in r.json()["detail"]


def test_empty_document_rejected(client):
    r = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
        files={"aadhaar": ("empty.pdf", b"", "application/pdf")},
    )
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_corrupted_pdf_rejected(client):
    r = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
        files={"aadhaar": ("corrupted.pdf", b"%PDF-1.5 this is not valid pdf data", "application/pdf")},
    )
    assert r.status_code == 400
    assert "Invalid or corrupted PDF" in r.json()["detail"] or "Invalid" in r.json()["detail"]


def test_pdf_page_limit_enforced(client, monkeypatch):
    import io
    from reportlab.pdfgen import canvas
    monkeypatch.setenv("MAX_PDF_PAGES", "2")
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    for i in range(3):
        c.drawString(100, 100, f"Page {i+1}")
        c.showPage()
    c.save()
    r = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
        files={"aadhaar": ("toolong.pdf", buf.getvalue(), "application/pdf")},
    )
    assert r.status_code == 400
    assert "exceeds the maximum allowed limit" in r.json()["detail"]


def test_oversized_file_rejected(client, monkeypatch):
    monkeypatch.setenv("MAX_UPLOAD_SIZE_MB", "1")
    large_payload = b"0" * (2 * 1024 * 1024)  # 2MB file exceeds 1MB limit
    r = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
        files={"aadhaar": ("large.png", large_payload, "image/png")},
    )
    assert r.status_code == 400
    assert "exceeds maximum allowed limit" in r.json()["detail"]


def test_webp_image_upload(client):
    import io
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (600, 300), color="white")
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), "Name: Rahul Kumar", fill="black")
    draw.text((20, 60), "DOB: 12-05-1998", fill="black")
    draw.text((20, 100), "Address: 12 MG Road, Vellore", fill="black")
    buf = io.BytesIO()
    img.save(buf, format="WEBP")
    r = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "income_certificate"},
        files={"aadhaar": ("aadhaar.webp", buf.getvalue(), "image/webp")},
    )
    assert r.status_code == 200
    assert r.json()["application_id"] is not None


def test_inactive_staff_account_cannot_authenticate(client, admin_token):
    # Create test staff user
    username = "temp_deactivated_user"
    client.post(
        "/api/staff/users",
        json={"username": username, "password": "password123", "display_name": "Temp User", "role": "Officer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Deactivate account
    client.patch(
        f"/api/staff/users/{username}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Attempt login
    r = client.post("/api/auth/login", json={"username": username, "password": "password123"})
    assert r.status_code == 401


def test_service_catalog_endpoint(client):
    r = client.get("/api/services")
    assert r.status_code == 200
    services = r.json()
    assert len(services) >= 5
    service_ids = [s["id"] for s in services]
    assert "income_certificate" in service_ids
    assert "domicile_certificate" in service_ids
    assert "caste_certificate" in service_ids
    assert "birth_certificate" in service_ids
    assert "ews_certificate" in service_ids
    for s in services:
        assert len(s["required_documents"]) > 0


def test_unknown_service_rejected(client):
    r = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "invalid_unknown_service"},
        files={"aadhaar": ("a.png", b"dummy", "image/png")},
    )
    assert r.status_code == 400
    assert "Unknown or inactive service" in r.json()["detail"]


def test_admin_toggle_service_status(client, admin_token):
    # Toggle service off
    r_toggle = client.patch(
        "/api/admin/services/caste_certificate/toggle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_toggle.status_code == 200
    assert r_toggle.json()["is_active"] is False

    # Attempt submission for deactivated service
    r_sub = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "caste_certificate"},
        files={"aadhaar": ("a.png", b"dummy", "image/png")},
    )
    assert r_sub.status_code == 400
    assert "Unknown or inactive service" in r_sub.json()["detail"]

    # Toggle service back on
    r_toggle_back = client.patch(
        "/api/admin/services/caste_certificate/toggle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_toggle_back.status_code == 200
    assert r_toggle_back.json()["is_active"] is True


def test_cors_headers_on_responses(client):
    # On 200 OK
    r_ok = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert r_ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert r_ok.headers.get("access-control-allow-credentials") == "true"

    # On 400 Bad Request
    r_err = client.post(
        "/api/applications",
        data={"citizen_name": "Rahul Kumar", "service_type": "nonexistent"},
        files={"aadhaar": ("a.png", b"dummy", "image/png")},
        headers={"Origin": "http://localhost:3000"},
    )
    assert r_err.status_code == 400
    assert r_err.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_officer_request_correction_and_citizen_resubmit_workflow(client, officer_token):
    # 1. Submit initial bundle with missing / mismatched docs
    app_r = _submit_full_bundle(client, citizen_name="Vikas Sharma")
    app_id = app_r.json()["application_id"]
    assert app_r.json()["readiness_score"] > 0

    # 2. Officer requests correction
    r_corr = client.post(
        f"/api/applications/{app_id}/request-correction",
        json={"reason": "Address Mismatch", "details": "Please upload an updated Aadhaar or proof of residence."},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert r_corr.status_code == 200
    assert r_corr.json()["status"] == "NEEDS_CORRECTION"
    assert r_corr.json()["correction_reason"] == "Address Mismatch"

    # 3. Citizen checks status and sees correction details
    r_status = client.get(f"/api/applications/{app_id}")
    assert r_status.status_code == 200
    detail = r_status.json()
    assert detail["status"] == "NEEDS_CORRECTION"
    assert detail["correction_reason"] == "Address Mismatch"
    assert "updated Aadhaar" in detail["correction_details"]

    # 4. Citizen resubmits replacement documents with tracking token
    tracking_token = app_r.json().get("tracking_token")
    url_resub = f"/api/applications/{app_id}/resubmit" + (f"?token={tracking_token}" if tracking_token else "")
    with open(TEST_DOCS / "aadhaar.png", "rb") as f_resub:
        r_resubmit = client.post(
            url_resub,
            files={"aadhaar": ("aadhaar_clean.png", f_resub, "image/png")},
        )
    assert r_resubmit.status_code == 200
    resub_data = r_resubmit.json()
    assert resub_data["application_id"] == app_id
    assert resub_data["readiness_score"] > 0

    # 5. Status transitioned back to review
    r_status_after = client.get(f"/api/applications/{app_id}", headers={"Authorization": f"Bearer {officer_token}"})
    assert r_status_after.json()["status"] == "READY_FOR_REVIEW"

    # 5a. Attempting approval directly from READY_FOR_REVIEW must be rejected
    r_direct_appr = client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "Direct approval attempt"},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert r_direct_appr.status_code == 400

    # 5b. Officer passes document review -> advances to INTERVIEW_ELIGIBLE
    r_pass_doc = client.post(
        f"/api/applications/{app_id}/document-review-pass",
        json={"notes": "Documents verified coherent."},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert r_pass_doc.status_code == 200
    assert r_pass_doc.json()["status"] == "INTERVIEW_ELIGIBLE"

    # 5c. Citizen conducts and completes interview
    r_intv = client.post("/api/interviews/start", json={"application_id": app_id})
    assert r_intv.status_code == 200
    session_id = r_intv.json()["session_id"]
    r_intv_comp = client.post(f"/api/interviews/{session_id}/complete")
    assert r_intv_comp.status_code == 200

    # 6. Officer approves application from FINAL_OFFICER_REVIEW / INTERVIEW_COMPLETED
    r_approve = client.post(
        f"/api/applications/{app_id}/approve",
        json={"notes": "All documents and interview verified coherent."},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert r_approve.status_code == 200
    assert r_approve.json()["status"] == "APPROVED"
    assert r_approve.json()["resolved_by"] == "Suresh"

    # 7. Verify complete audit trail
    r_audit = client.get(f"/api/applications/{app_id}/audit", headers={"Authorization": f"Bearer {officer_token}"})
    audit_event_types = [e["event_type"] for e in r_audit.json()]
    assert "Uploaded" in audit_event_types
    assert "Correction Requested" in audit_event_types
    assert "Correction Resubmitted" in audit_event_types
    assert "Application Approved" in audit_event_types


def test_officer_reject_application_workflow(client, officer_token):
    app_r = _submit_full_bundle(client, citizen_name="Rejection Test Applicant")
    app_id = app_r.json()["application_id"]

    r_reject = client.post(
        f"/api/applications/{app_id}/reject",
        json={"notes": "Failed statutory income eligibility."},
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert r_reject.status_code == 200
    r_status = client.get(f"/api/applications/{app_id}", headers={"Authorization": f"Bearer {officer_token}"})
    assert r_status.json()["status"] == "REJECTED"


def test_wrong_document_upload_mismatch_and_needs_correction(client, officer_token):
    """
    Submitting an application with an incorrect document type in a required slot
    (e.g., uploading electricity bill in the Aadhaar slot) must:
    - Detect the mismatch
    - Penalize readiness score
    - Transition state directly to NEEDS_CORRECTION
    - Populate correction details with the mismatch info
    - Not allow fast track
    """
    with open(TEST_DOCS / "electricity_bill.png", "rb") as f1, \
         open(TEST_DOCS / "ration_card.png", "rb") as f2, \
         open(TEST_DOCS / "electricity_bill.png", "rb") as f3:
        r = client.post(
            "/api/applications",
            data={"citizen_name": "Mismatch Test Citizen", "service_type": "income_certificate"},
            files={
                "aadhaar": ("wrong_doc.png", f1, "image/png"),  # Electricity bill in Aadhaar slot!
                "ration_card": ("r.png", f2, "image/png"),
                "electricity_bill": ("e.png", f3, "image/png"),
            },
        )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "NEEDS_CORRECTION"
    assert "Document Type Mismatch" in data["correction_reason"]
    assert "Aadhaar" in data["correction_reason"]
    
    # Check document verifications list
    verifs = data["document_verifications"]
    aadhaar_v = next(v for v in verifs if v["expected_type"] == "aadhaar")
    assert aadhaar_v["status"] == "MISMATCH"
    assert aadhaar_v["detected_type"] == "electricity_bill"
    assert aadhaar_v["is_valid_for_slot"] is False

    # Check that score reasoning reflects the mismatch penalty
    assert any("Document mismatch" in item["label"] for item in data["score_reasoning"])

    # Verify that get_application returns the document_verifications
    app_id = data["application_id"]
    r_get = client.get(f"/api/applications/{app_id}", headers={"Authorization": f"Bearer {officer_token}"})
    assert r_get.status_code == 200
    assert len(r_get.json()["document_verifications"]) > 0


def test_correct_documents_yield_match_status(client):
    r = _submit_full_bundle(client, citizen_name="Clean Bundle Citizen")
    assert r.status_code == 200
    data = r.json()
    verifs = data["document_verifications"]
    assert len(verifs) == 3
    for v in verifs:
        assert v["status"] in ["MATCH", "LIKELY_MATCH"]
        assert v["is_valid_for_slot"] is True
