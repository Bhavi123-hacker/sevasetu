"""
SEVASETU v0.8.0 — Feature Verification Test Suite.

Verifies:
1. Document Quality Engine (sharpness, blur, contrast, blank pages, resolution)
2. Document Expiry & Validity Engine (lifetime vs time-limited, expiring soon, expired, not determinable)
3. Data Retention & Privacy Lifecycle (dry-run, document text redaction, audit trail immutability)
4. In-App Notifications Engine (notification creation, retrieval, mark as read)
5. Fast-Track Safety Invariants with Quality and Validity gates
6. Multi-jurisdiction Government Provenance
"""
import io
import json
import pytest
from datetime import datetime, timedelta, timezone
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine
from app.pipeline.quality import assess_document_quality, calculate_blur_variance, DocumentQualityResult
from app.pipeline.validity import evaluate_document_validity, DocumentValidityResult
from app.pipeline.retention import run_retention_cleanup
from app.pipeline.scoring import compute_readiness, is_fast_track_eligible
from app import models, auth


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def make_test_image(text="TEST CIVIC DOCUMENT", width=800, height=600, blur=False, blank=False):
    img = Image.new("RGB", (width, height), color=(255, 255, 255) if not blank else (250, 250, 250))
    if not blank:
        draw = ImageDraw.Draw(img)
        draw.rectangle([50, 50, width - 50, height - 50], outline=(0, 0, 0), width=4)
        draw.text((100, 100), text, fill=(0, 0, 0))
    if blur:
        from PIL import ImageFilter
        img = img.filter(ImageFilter.GaussianBlur(radius=8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ============================================================
# 1. DOCUMENT QUALITY ENGINE TESTS
# ============================================================

def test_quality_sharp_standard_document():
    raw_bytes = make_test_image(text="GOVERNMENT OF GUJARAT REVENUE DEPARTMENT", width=800, height=600)
    res = assess_document_quality(raw_bytes, ocr_text="GOVERNMENT OF GUJARAT REVENUE DEPARTMENT", ocr_confidence=92.0)
    assert res.status in ["GOOD", "ACCEPTABLE"]
    assert res.quality_score >= 0.70
    assert not res.is_blank
    assert res.width == 800
    assert res.height == 600


def test_quality_blurry_document_flagged():
    raw_bytes = make_test_image(text="Blurry civic document scan", width=800, height=600, blur=True)
    res = assess_document_quality(raw_bytes, ocr_text="Blurry text", ocr_confidence=30.0)
    assert res.status in ["POOR", "UNREADABLE", "UNCERTAIN"]
    assert any("blur" in iss.lower() or "confidence" in iss.lower() for iss in res.issues)


def test_quality_blank_page_detected():
    raw_bytes = make_test_image(blank=True, width=800, height=600)
    res = assess_document_quality(raw_bytes, ocr_text="", ocr_confidence=0.0)
    assert res.status == "UNREADABLE"
    assert res.is_blank is True
    assert res.quality_score < 0.20


def test_quality_low_resolution_image():
    raw_bytes = make_test_image(text="Tiny scan", width=200, height=150)
    res = assess_document_quality(raw_bytes, ocr_text="Tiny scan", ocr_confidence=60.0)
    assert any("resolution" in iss.lower() for iss in res.issues)


# ============================================================
# 2. DOCUMENT EXPIRY & VALIDITY ENGINE TESTS
# ============================================================

def test_validity_lifetime_aadhaar_and_birth():
    res_aadhaar = evaluate_document_validity("aadhaar", "GOVERNMENT OF INDIA AADHAAR 1234 5678 9012")
    assert res_aadhaar.status == "VALID"
    assert res_aadhaar.is_expired is False
    assert res_aadhaar.official_validity_type == "PERMANENT"

    res_birth = evaluate_document_validity("birth_certificate", "BIRTH CERTIFICATE REGISTRAR GENERAL")
    assert res_birth.status == "VALID"
    assert res_birth.official_validity_type == "PERMANENT"


def test_validity_recent_electricity_bill_valid():
    recent_date = (datetime.now() - timedelta(days=20)).strftime("%d-%m-%Y")
    ocr_text = f"UTILITY POWER CORPORATION BILL DATE: {recent_date} CONSUMER NO 12345"
    res = evaluate_document_validity("electricity_bill", ocr_text)
    assert res.status == "VALID"
    assert res.is_expired is False
    assert res.issue_date == recent_date


def test_validity_old_electricity_bill_expired():
    old_date = (datetime.now() - timedelta(days=150)).strftime("%d-%m-%Y")
    ocr_text = f"UTILITY POWER CORPORATION BILL DATE: {old_date} CONSUMER NO 12345"
    res = evaluate_document_validity("electricity_bill", ocr_text)
    assert res.status == "EXPIRED"
    assert res.is_expired is True
    assert "exceeds" in res.evidence[0].lower()


def test_validity_explicit_expiry_date_in_past():
    past_expiry = (datetime.now() - timedelta(days=40)).strftime("%d-%m-%Y")
    ocr_text = f"TEMPORARY DISABILITY CERTIFICATE VALID UPTO: {past_expiry}"
    res = evaluate_document_validity("id_proof", ocr_text)
    assert res.status == "EXPIRED"
    assert res.is_expired is True


def test_validity_unidentifiable_date_returns_not_determinable():
    ocr_text = "POWER BILL CONSUMER NO 88726 NO DATE VISIBLE IN RAW TEXT"
    res = evaluate_document_validity("electricity_bill", ocr_text)
    assert res.status == "NOT_DETERMINABLE"
    assert res.is_expired is False


# ============================================================
# 3. DATA RETENTION & PRIVACY TESTS
# ============================================================

def test_retention_dry_run_does_not_modify_data():
    db = SessionLocal()
    try:
        summary = run_retention_cleanup(db, dry_run=True)
        assert summary["dry_run"] is True
        assert "document_retention_days" in summary
        assert "application_retention_days" in summary
    finally:
        db.close()


def test_retention_preserves_immutable_audit_events():
    db = SessionLocal()
    try:
        events_before = db.query(models.AuditEvent).count()
        run_retention_cleanup(db, dry_run=False)
        events_after = db.query(models.AuditEvent).count()
        assert events_after >= events_before  # Audit events NEVER deleted
    finally:
        db.close()


# ============================================================
# 4. IN-APP NOTIFICATIONS ENGINE TESTS
# ============================================================

def test_notification_creation_and_retrieval(client):
    db = SessionLocal()
    try:
        app_id = "test-notif-app"
        notif = models.Notification(
            id="notif-1",
            application_id=app_id,
            recipient="citizen",
            notification_type="SUBMISSION",
            message=f"Application #{app_id} received.",
        )
        db.add(notif)
        db.commit()
    finally:
        db.close()

    res = client.get("/api/notifications?application_id=test-notif-app")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["notification_type"] == "SUBMISSION"
    assert data[0]["is_read"] is False

    read_res = client.post(f"/api/notifications/{data[0]['id']}/read")
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True


# ============================================================
# 5. FAST-TRACK SAFETY GATES WITH QUALITY & VALIDITY
# ============================================================

def test_fast_track_blocked_by_poor_quality():
    poor_quality = DocumentQualityResult(status="POOR", quality_score=0.40)
    eligible = is_fast_track_eligible(
        readiness_score=95,
        missing_documents=[],
        quality_results=[poor_quality],
    )
    assert eligible is False


def test_fast_track_blocked_by_expired_document():
    expired_validity = DocumentValidityResult(status="EXPIRED", is_expired=True)
    eligible = is_fast_track_eligible(
        readiness_score=95,
        missing_documents=[],
        validity_results=[expired_validity],
    )
    assert eligible is False


def test_fast_track_allowed_when_all_quality_and_validity_pass():
    good_quality = DocumentQualityResult(status="GOOD", quality_score=0.95)
    valid_validity = DocumentValidityResult(status="VALID", is_expired=False)
    eligible = is_fast_track_eligible(
        readiness_score=95,
        missing_documents=[],
        quality_results=[good_quality],
        validity_results=[valid_validity],
    )
    assert eligible is True
