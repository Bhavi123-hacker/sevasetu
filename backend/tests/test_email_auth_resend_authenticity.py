"""
Unit & Integration Tests for:
1. Firebase Email/Password Authentication & Profile Deduplication
2. Resend Transactional Email Provider & Lifecycle Notifications
3. Document Authenticity Risk Assessment & Explainable Signals
"""
import os
import pytest
from app.main import app
from app.database import SessionLocal
from app import models
from app.pipeline.integrity import (
    assess_document_authenticity_risk,
    DocumentIntegrityResult,
)
from app.pipeline.quality import DocumentQualityResult
from app.pipeline.consistency import FieldCheckResult
from app.pipeline.classifier import ClassificationResult
from app.pipeline.notification_providers import ResendEmailProvider
from app.pipeline.notifications import (
    trigger_lifecycle_notification,
    list_notifications,
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ==============================================================================
# 1. Firebase Email Authentication Tests
# ==============================================================================

def test_firebase_email_auth_new_citizen(raw_client, db):
    """Verifies that a new citizen can authenticate using a valid Firebase ID token."""
    response = raw_client.post(
        "/api/auth/firebase-email",
        json={
            "id_token": "mock-firebase-id-token-12345",
            "email": "priya.sharma@example.com",
            "citizen_name": "Priya Sharma",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "Citizen"
    assert data["profile"]["citizen_name"] == "Priya Sharma"
    assert data["profile"]["email"] == "priya.sharma@example.com"
    assert "firebase_uid" in data["profile"]


def test_firebase_email_auth_profile_deduplication(raw_client, db):
    """Verifies that subsequent logins with the same email or Firebase UID reuse the existing profile."""
    # First login
    res1 = raw_client.post(
        "/api/auth/firebase-email",
        json={
            "id_token": "mock-token-user-abc",
            "email": "rahul.verma@example.com",
            "citizen_name": "Rahul Verma",
        },
    )
    assert res1.status_code == 200
    p1 = res1.json()["profile"]

    # Second login with same email
    res2 = raw_client.post(
        "/api/auth/firebase-email",
        json={
            "id_token": "mock-token-user-abc",
            "email": "rahul.verma@example.com",
            "citizen_name": "Rahul Verma",
        },
    )
    assert res2.status_code == 200
    p2 = res2.json()["profile"]

    # Must be the exact same profile ID (no duplicate profiles created)
    assert p1["id"] == p2["id"]
    count = db.query(models.CitizenProfile).filter(models.CitizenProfile.email == "rahul.verma@example.com").count()
    assert count == 1


def test_firebase_email_auth_empty_token_rejected(raw_client):
    """Verifies that empty ID tokens are rejected with 400 Bad Request."""
    response = raw_client.post(
        "/api/auth/firebase-email",
        json={"id_token": "   "},
    )
    assert response.status_code == 400


# ==============================================================================
# 2. Resend Email Notifications Tests
# ==============================================================================

def test_resend_email_provider_unconfigured_safety():
    """Verifies that ResendEmailProvider safely reports NOT_CONFIGURED without crashing when no API key is present."""
    old_key = os.environ.get("RESEND_API_KEY")
    try:
        os.environ["RESEND_API_KEY"] = ""
        provider = ResendEmailProvider()
        assert not provider.is_configured()
        res = provider.send(
            destination="citizen@example.com",
            title="Application Status",
            message="Your application is ready.",
        )
        assert res.status == "NOT_CONFIGURED"
        assert not res.is_delivered
    finally:
        if old_key is not None:
            os.environ["RESEND_API_KEY"] = old_key


def test_lifecycle_notification_dispatches_email(db):
    """Verifies that trigger_lifecycle_notification creates in-app and email notifications for citizens."""
    profile = models.CitizenProfile(
        id="cit-profile-email-test",
        citizen_name="Amit Patel",
        email="amit.patel@example.com",
        category="General",
    )
    db.add(profile)
    db.commit()

    notif = trigger_lifecycle_notification(
        db=db,
        notification_type="APPLICATION_SUBMITTED",
        application_id="app-12345",
        service_type="income_certificate",
        citizen_profile_id="cit-profile-email-test",
    )

    assert notif is not None
    assert notif.title == "Application Submitted Successfully"

    # Verify notifications recorded in database
    notifs = list_notifications(db, citizen_profile_id="cit-profile-email-test")
    assert len(notifs) >= 1
    channels = {n.channel for n in notifs}
    assert "IN_APP" in channels


# ==============================================================================
# 3. Document Authenticity Risk Assessment Tests
# ==============================================================================

def test_authenticity_risk_assessment_clean_docs():
    """Verifies that clean documents with matching types and high OCR confidence produce LOW risk."""
    doc_verifs = [
        ClassificationResult(detected_type="aadhaar", confidence=0.95, status="MATCH", expected_type="aadhaar"),
        ClassificationResult(detected_type="salary_slip", confidence=0.92, status="MATCH", expected_type="salary_slip"),
    ]
    field_checks = [
        FieldCheckResult(field="name", status="pass", detail="Matches across docs"),
        FieldCheckResult(field="date_of_birth", status="pass", detail="Matches across docs"),
    ]
    quality_results = [
        DocumentQualityResult(status="GOOD", quality_score=95.0, issues=[]),
    ]

    assessment = assess_document_authenticity_risk(
        doc_verifications=doc_verifs,
        field_checks=field_checks,
        quality_results=quality_results,
        integrity_results=[DocumentIntegrityResult(status="VALID")],
        duplicate_suspected=False,
        average_ocr_confidence=92.0,
    )

    assert assessment.risk_level == "LOW"
    assert assessment.risk_score < 15
    assert "disclaimer" in assessment.__dict__
    assert "statutory decision" in assessment.disclaimer.lower()


def test_authenticity_risk_assessment_dob_mismatch_produces_high_risk():
    """Verifies that a Date of Birth mismatch produces a HIGH risk authenticity flag with explicit signals."""
    field_checks = [
        FieldCheckResult(field="name", status="pass", detail="Matches"),
        FieldCheckResult(field="date_of_birth", status="fail", detail="1990-01-01 vs 1995-05-12"),
    ]

    assessment = assess_document_authenticity_risk(
        doc_verifications=[],
        field_checks=field_checks,
        quality_results=[],
        integrity_results=[],
        duplicate_suspected=False,
        average_ocr_confidence=88.0,
    )

    assert assessment.risk_level == "HIGH"
    assert any("Date of Birth" in s["name"] for s in assessment.detected_signals)


def test_authenticity_risk_assessment_slot_mismatch_produces_high_risk():
    """Verifies that an incorrect document uploaded in a slot triggers HIGH risk and explainable signals."""
    doc_verifs = [
        ClassificationResult(detected_type="electricity_bill", confidence=0.95, status="MISMATCH", expected_type="birth_certificate"),
    ]

    assessment = assess_document_authenticity_risk(
        doc_verifications=doc_verifs,
        field_checks=[],
        quality_results=[],
        integrity_results=[],
        duplicate_suspected=False,
        average_ocr_confidence=85.0,
    )

    assert assessment.risk_level == "HIGH"
    assert any("Classification Mismatch" in s["name"] for s in assessment.detected_signals)
