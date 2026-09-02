"""
Unit and API integration tests for SevaSetu v1.0.0 Civic Services Platform evolution.
"""
import io
import json
import pytest
from PIL import Image, ImageDraw

from app.database import SessionLocal
from app.pipeline.eligibility import evaluate_eligibility
from app.pipeline.interview import (
    generate_interview_questions,
    evaluate_answer_consistency,
)
from app.pipeline.verification_providers import get_active_verification_provider
from app.pipeline.mfa import send_otp, verify_otp
from app.pipeline.notifications import create_notification, list_notifications, mark_notification_read


def _make_dummy_image(text: str = "OFFICIAL DOCUMENT") -> bytes:
    img = Image.new("RGB", (600, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((30, 30), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# 1. Eligibility Evaluation Tests
def test_eligibility_evaluation_met():
    res = evaluate_eligibility("income_certificate", {"annual_income": 150000.0, "state": "Gujarat"})
    assert res.service_type == "income_certificate"
    assert res.guidance_status == "POTENTIALLY_RELEVANT"
    assert res.is_indicatively_matched is True
    assert len(res.matching_criteria) >= 1


def test_eligibility_evaluation_unmet():
    res = evaluate_eligibility("income_certificate", {"annual_income": 950000.0, "state": "Gujarat"})
    assert res.is_indicatively_matched is False
    assert len(res.unmatched_criteria) >= 1


def test_eligibility_unknown_service():
    res = evaluate_eligibility("non_existent_service", {})
    assert res.guidance_status == "NOT_ENOUGH_INFORMATION"
    assert "No predefined eligibility rules" in res.guidance_notes[0] or "preliminary guidance" in res.disclaimer


# 2. Verification Provider Abstraction Tests
def test_verification_provider_honest_disclaimer():
    provider = get_active_verification_provider()
    res = provider.verify_document("aadhaar", "GOVERNMENT OF INDIA Aadhaar No: 1234 5678 9012")
    assert res.status == "OFFICIAL_VERIFICATION_UNAVAILABLE"
    assert res.is_officially_verified is False
    assert "Official authenticity has not been independently verified" in res.disclaimer


# 3. AI Verification Interview Question Generator & Consistency Checks
def test_interview_question_generation():
    questions = generate_interview_questions(
        citizen_name="Ramesh Kumar",
        dob="15-05-1990",
        address="12 Shanti Nagar, Ahmedabad",
        service_type="income_certificate",
        document_types=["aadhaar", "income_proof"],
    )
    assert len(questions) >= 3
    fields = [q["expected_field"] for q in questions]
    assert "name" in fields
    assert "date_of_birth" in fields


def test_interview_answer_consistency_matching():
    res = evaluate_answer_consistency(
        category="NAME",
        question_text="Please state your full name as it appears on your Aadhaar card.",
        transcript_text="My name is Ramesh Kumar",
        expected_value="Ramesh Kumar",
    )
    assert res.comparison_status == "CONSISTENT"
    assert res.confidence > 0.8


def test_interview_answer_consistency_mismatch():
    res = evaluate_answer_consistency(
        category="NAME",
        question_text="Please state your full name as it appears on your Aadhaar card.",
        transcript_text="My name is Vijay Singh",
        expected_value="Ramesh Kumar",
    )
    assert res.comparison_status in ["INCONSISTENT", "UNCERTAIN"]


# 4. MFA OTP & Confirmation Tests
def test_mfa_otp_generation_and_verification():
    res = send_otp("+919876543210", channel="SMS")
    assert res["delivery_status"] in ["DEV_SIMULATED", "NOT_CONFIGURED"]
    otp_code = res.get("dev_otp", "123456")
    assert verify_otp("+919876543210", otp_code) is True
    # Second verify fails (consumed)
    assert verify_otp("+919876543210", otp_code) is False


# 5. In-App Notifications DB Tests
def test_in_app_notifications():
    db = SessionLocal()
    try:
        notif = create_notification(
            db=db,
            recipient="citizen",
            notification_type="STATUS_UPDATE",
            title="Application Received",
            message="Your application has been received.",
            application_id="app-1234",
        )
        assert notif.id is not None
        notifs = list_notifications(db=db, recipient="citizen")
        assert len(notifs) >= 1
        assert any(n.id == notif.id for n in notifs)

        success = mark_notification_read(db=db, notification_id=notif.id)
        assert success is True
    finally:
        db.close()


# 6. Citizen Profile API Endpoints Tests
def test_citizen_profile_api(client):
    r_get = client.get("/api/profile")
    assert r_get.status_code == 200
    data = r_get.json()
    assert "citizen_name" in data

    update_payload = {
        "citizen_name": "Sunita Verma",
        "date_of_birth": "1988-03-22",
        "gender": "Female",
        "address": "45 Green Park, Jaipur",
        "district": "Jaipur",
        "state": "Rajasthan",
        "pincode": "302016",
        "phone": "+91 9822334455",
        "email": "sunita.verma@example.com",
        "category": "OBC",
        "annual_income": 220000.0,
        "is_student": False,
        "has_disability": False,
        "preferences": {"language": "hi", "notifications": True},
    }
    r_put = client.put("/api/profile", json=update_payload)
    assert r_put.status_code == 200
    assert r_put.json()["status"] in ["updated", "created"]

    r_verify = client.get(f"/api/profile?profile_id={r_put.json()['id']}")
    assert r_verify.status_code == 200
    assert r_verify.json()["citizen_name"] == "Sunita Verma"


# 7. Document Wallet API Endpoints Tests
def test_document_wallet_api(client):
    doc_bytes = _make_dummy_image("GOVERNMENT OF INDIA AADHAAR CARD Name: Sunita Verma DOB: 22-03-1988 Aadhaar: 1122 3344 5566")
    r_upload = client.post(
        "/api/wallet/upload",
        data={"doc_type": "aadhaar"},
        files={"file": ("sunita_aadhaar.png", io.BytesIO(doc_bytes), "image/png")},
    )
    assert r_upload.status_code == 200
    w_data = r_upload.json()
    assert w_data["status"] == "stored"
    doc_id = w_data["id"]

    r_list = client.get("/api/wallet")
    assert r_list.status_code == 200
    items = r_list.json()
    assert any(item["id"] == doc_id for item in items)


# 8. Interactive AI Interview API Flow
def test_interview_api_flow(client):
    # 1. Start session
    r_start = client.post(
        "/api/interviews/start",
        json={
            "citizen_name": "Sunita Verma",
            "dob": "22-03-1988",
            "address": "45 Green Park, Jaipur",
            "service_type": "income_certificate",
            "document_types": ["aadhaar", "income_proof"],
        },
    )
    assert r_start.status_code == 200
    session_data = r_start.json()
    session_id = session_data["session_id"]
    questions = session_data["questions"]
    assert len(questions) >= 3

    # 2. Submit answer to question 1
    q1 = questions[0]
    r_ans = client.post(
        f"/api/interviews/{session_id}/answer",
        json={
            "question_id": q1["id"],
            "transcript_text": "My name is Sunita Verma",
        },
    )
    assert r_ans.status_code == 200
    ans_res = r_ans.json()
    assert ans_res["comparison_status"] in ["CONSISTENT", "UNCERTAIN"]

    # 3. Complete interview
    r_complete = client.post(f"/api/interviews/{session_id}/complete")
    assert r_complete.status_code == 200
    assert r_complete.json()["status"] == "COMPLETED"
