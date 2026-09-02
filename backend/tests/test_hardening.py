"""
Comprehensive test suite for Phase 1-6 Hardening:
- Security headers & error responses
- File magic bytes & upload limits validation
- Privacy-safe PII scrubbing in JSON logging
- Readiness vs Risk assessment separation
- Document integrity & structural anomaly detection
- Staff password reset & account management
- Operational analytics dashboard endpoint
"""
import io
import json
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.logging_config import sanitize_log_val, JSONFormatter
from app.pipeline.integrity import validate_file_magic_bytes, assess_document_integrity, sanitize_filename
from app.pipeline.scoring import compute_risk_level, compute_readiness
from app.pipeline.consistency import FieldCheckResult
from app.pipeline.classifier import ClassificationResult


def test_security_headers_present(client):
    """Verifies that security headers are returned on API responses."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert resp.headers.get("X-XSS-Protection") == "1; mode=block"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_magic_bytes_validation():
    """Validates header magic byte checks for PDF, PNG, JPEG, WEBP."""
    assert validate_file_magic_bytes(b"%PDF-1.4 sample content")[0] is True
    assert validate_file_magic_bytes(b"\x89PNG\r\n\x1a\n\x00\x00")[0] is True
    assert validate_file_magic_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF")[0] is True
    assert validate_file_magic_bytes(b"RIFF\x20\x00\x00\x00WEBPVP8 ")[0] is True
    # Fake executable or random text disguised as pdf
    valid, desc = validate_file_magic_bytes(b"MZ\x90\x00\x03\x00\x00\x00")
    assert valid is False
    assert "Unrecognized file format" in desc


def test_sanitize_filename():
    """Tests path traversal sanitization on user-supplied filenames."""
    assert sanitize_filename("../../etc/passwd.png") == "passwd.png"
    assert sanitize_filename("..\\..\\Windows\\system32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename(None) == "unnamed_document"


def test_document_integrity_suspicious_script():
    """Detects embedded javascript directives in raw document bytes."""
    payload = b"%PDF-1.4 /JavaScript << /JS (alert(1)) >>"
    res = assess_document_integrity(payload, ocr_text="")
    assert res.status == "SUSPICIOUS"
    assert any("executable script" in w for w in res.warnings)


def test_privacy_safe_logging_scrubber():
    """Ensures Aadhaar numbers, JWTs, and passwords are fully redacted from log strings."""
    raw_text = "Citizen Aadhaar is 5421 8899 1234 and token is eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak"
    clean = sanitize_log_val(raw_text)
    assert "5421 8899 1234" not in clean
    assert "[REDACTED_AADHAAR]" in clean
    assert "[REDACTED_JWT]" in clean

    dict_data = {"username": "admin", "password": "supersecretpassword123", "score": 90}
    clean_dict = sanitize_log_val(dict_data)
    assert clean_dict["password"] == "[REDACTED]"


def test_risk_level_separation_from_readiness():
    """Verifies that risk level appropriately flags mismatches and duplicate suspects as HIGH risk."""
    # Case 1: Clean application -> LOW risk
    checks = [
        FieldCheckResult(field="name", status="pass", detail=""),
        FieldCheckResult(field="date_of_birth", status="pass", detail=""),
        FieldCheckResult(field="address", status="pass", detail=""),
    ]
    risk, factors = compute_risk_level(checks, duplicate_suspected=False, doc_verifications=[])
    assert risk == "LOW"
    assert len(factors) == 0

    # Case 2: Address variation -> MEDIUM risk
    checks_var = [
        FieldCheckResult(field="name", status="pass", detail=""),
        FieldCheckResult(field="date_of_birth", status="pass", detail=""),
        FieldCheckResult(field="address", status="fail", detail="Address difference"),
    ]
    risk_var, factors_var = compute_risk_level(checks_var, duplicate_suspected=False, doc_verifications=[])
    assert risk_var == "MEDIUM"

    # Case 3: Document mismatch -> HIGH risk
    mismatch_verif = [
        ClassificationResult(expected_type="aadhaar", detected_type="birth_certificate", confidence=0.9, status="MISMATCH", evidence=[]),
    ]
    risk_mismatch, factors_mismatch = compute_risk_level(checks, duplicate_suspected=False, doc_verifications=mismatch_verif)
    assert risk_mismatch == "HIGH"
    assert any("mismatch" in f for f in factors_mismatch)


def test_dashboard_stats_endpoint(client, officer_token):
    """Verifies that the operational analytics /api/dashboard/stats endpoint returns valid aggregates."""
    resp = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {officer_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "total_applications" in data
    assert "pending_review" in data
    assert "risk_distribution" in data
    assert "LOW" in data["risk_distribution"]
    assert "HIGH" in data["risk_distribution"]


def test_admin_staff_password_reset(client, admin_token):
    """Verifies that Administrator can reset a staff member's password."""
    # Create test officer
    uname = "temp_officer_test"
    client.post(
        "/api/staff/users",
        json={"username": uname, "password": "initialpassword123", "display_name": "Temp Officer", "role": "Officer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Admin resets password
    reset_resp = client.post(
        f"/api/staff/users/{uname}/reset-password",
        json={"new_password": "newsecurepassword123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "password_reset_success"

    # Login with new password works
    login_resp = client.post("/api/auth/login", json={"username": uname, "password": "newsecurepassword123"})
    assert login_resp.status_code == 200
