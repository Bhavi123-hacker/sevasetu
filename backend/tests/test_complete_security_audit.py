"""
SevaSetu Comprehensive Security & Vulnerability Test Suite.
Verifies all 10 Security Audit dimensions:
1. Authentication & Token Lifecycle
2. Role-Based Access Control (RBAC)
3. Insecure Direct Object Reference (IDOR) Protection
4. Document Upload & File Path Traversal Defense
5. Privacy Scrubbing & Log Security
6. API Input Validation & Oversized Payload Defense
7. State Machine Guarding & Idempotency Protection
"""
import io
import uuid
import pytest
from datetime import datetime, timezone

from app import models
from app.database import SessionLocal
from app.auth import create_citizen_token, create_access_token, hash_password
from app.pipeline.ocr import process_document_bytes, DocumentValidationError
from app.pipeline.integrity import sanitize_filename
from app.logging_config import sanitize_log_val


def test_unauthenticated_profile_access_blocked(raw_client):
    """Verifies that unauthenticated callers cannot harvest profile data using profile_id."""
    db = SessionLocal()
    try:
        pid = f"prof-secret-{uuid.uuid4().hex[:8]}"
        p = models.CitizenProfile(
            id=pid,
            citizen_name="Confidential Citizen",
            phone="+919876500999",
            email="confidential@example.com",
            address="123 Classified St",
        )
        db.add(p)
        db.commit()

        # Unauthenticated request with profile_id must be rejected with 401
        res = raw_client.get(f"/api/profile?profile_id={pid}")
        assert res.status_code == 401
        assert "Authentication required" in res.json()["detail"]

        res_path = raw_client.get(f"/api/profile/{pid}")
        assert res_path.status_code == 401
    finally:
        db.close()


def test_unauthenticated_profile_creation_cannot_hijack_existing_id(raw_client):
    """Verifies unauthenticated callers cannot overwrite an existing citizen profile ID."""
    db = SessionLocal()
    try:
        victim_id = f"prof-victim-{uuid.uuid4().hex[:8]}"
        victim = models.CitizenProfile(
            id=victim_id,
            citizen_name="Original Victim",
            phone="+919876500888",
            email="victim@example.com",
        )
        db.add(victim)
        db.commit()

        # Attacker tries to post with victim's id without authentication
        res = raw_client.post("/api/profile", json={
            "id": victim_id,
            "citizen_name": "Malicious Overwrite Attempt",
            "phone": "+919876500000",
        })
        assert res.status_code == 200
        data = res.json()
        # Ensure a new profile ID was minted and victim wasn't overwritten
        assert data["id"] != victim_id
        
        # Verify victim record untouched
        db.refresh(victim)
        assert victim.citizen_name == "Original Victim"
    finally:
        db.close()


def test_cross_citizen_wallet_isolation(raw_client):
    """Verifies strict citizen document wallet isolation against IDOR."""
    db = SessionLocal()
    try:
        cit_a_id = f"prof-w-a-{uuid.uuid4().hex[:8]}"
        cit_b_id = f"prof-w-b-{uuid.uuid4().hex[:8]}"

        prof_a = models.CitizenProfile(id=cit_a_id, citizen_name="Citizen A", phone="+919876500111")
        prof_b = models.CitizenProfile(id=cit_b_id, citizen_name="Citizen B", phone="+919876500112")
        db.add_all([prof_a, prof_b])
        db.commit()

        token_a = create_citizen_token(cit_a_id, "Citizen A")
        token_b = create_citizen_token(cit_b_id, "Citizen B")

        auth_a = {"Authorization": f"Bearer {token_a}"}
        auth_b = {"Authorization": f"Bearer {token_b}"}

        # Create wallet item for Citizen A
        w_item_a = models.DocumentWalletItem(
            id=f"wdoc-a-{uuid.uuid4().hex[:8]}",
            citizen_profile_id=cit_a_id,
            doc_type="income_certificate",
            original_filename="citizen_a_income.pdf",
        )
        db.add(w_item_a)
        db.commit()

        # Citizen B tries to query Citizen A's wallet items by passing profile_id -> 403
        r_list = raw_client.get(f"/api/wallet?profile_id={cit_a_id}", headers=auth_b)
        assert r_list.status_code == 403

        # Citizen B tries to delete Citizen A's wallet item -> 403
        r_del = raw_client.delete(f"/api/wallet/{w_item_a.id}", headers=auth_b)
        assert r_del.status_code == 403

        # Citizen A can list their own wallet item
        r_own = raw_client.get("/api/wallet", headers=auth_a)
        assert r_own.status_code == 200
        assert any(it["id"] == w_item_a.id for it in r_own.json())
    finally:
        db.close()


def test_cross_citizen_notification_manipulation_blocked(raw_client):
    """Verifies that Citizen B cannot mark Citizen A's notifications as read."""
    db = SessionLocal()
    try:
        cit_a_id = f"prof-notif-a-{uuid.uuid4().hex[:8]}"
        cit_b_id = f"prof-notif-b-{uuid.uuid4().hex[:8]}"

        prof_a = models.CitizenProfile(id=cit_a_id, citizen_name="Citizen A", phone="+919876500121")
        prof_b = models.CitizenProfile(id=cit_b_id, citizen_name="Citizen B", phone="+919876500122")
        db.add_all([prof_a, prof_b])
        db.commit()

        token_a = create_citizen_token(cit_a_id, "Citizen A")
        token_b = create_citizen_token(cit_b_id, "Citizen B")

        auth_a = {"Authorization": f"Bearer {token_a}"}
        auth_b = {"Authorization": f"Bearer {token_b}"}

        notif_a = models.Notification(
            id=f"notif-a-{uuid.uuid4().hex[:8]}",
            recipient="citizen",
            citizen_profile_id=cit_a_id,
            notification_type="SECURITY_EVENT",
            title="Private Alert A",
            message="Sensitive application update for citizen A",
            is_read=False,
        )
        db.add(notif_a)
        db.commit()

        # Citizen B attempts to mark Citizen A's notification as read -> 403
        r_read = raw_client.post(f"/api/notifications/{notif_a.id}/read", headers=auth_b)
        assert r_read.status_code == 403

        # Citizen A marks their own notification as read -> 200
        r_own = raw_client.post(f"/api/notifications/{notif_a.id}/read", headers=auth_a)
        assert r_own.status_code == 200
        assert r_own.json()["is_read"] is True
    finally:
        db.close()


def test_rbac_officer_vs_admin_privilege_separation(raw_client, officer_token, admin_token):
    """Verifies that Officers cannot execute Administrator-only actions."""
    auth_off = {"Authorization": f"Bearer {officer_token}"}
    auth_adm = {"Authorization": f"Bearer {admin_token}"}

    # 1. Staff user list (Admin only)
    assert raw_client.get("/api/staff/users", headers=auth_off).status_code == 403
    assert raw_client.get("/api/staff/users", headers=auth_adm).status_code == 200

    # 2. Staff user creation (Admin only)
    res_create = raw_client.post("/api/staff/users", json={
        "username": f"temp_user_{uuid.uuid4().hex[:6]}",
        "password": "Password123!",
        "display_name": "Temporary Officer",
        "role": "Officer",
    }, headers=auth_off)
    assert res_create.status_code == 403

    # 3. Retention policy inspection (Admin only)
    assert raw_client.get("/api/retention/status", headers=auth_off).status_code == 403
    assert raw_client.get("/api/retention/status", headers=auth_adm).status_code == 200


def test_path_traversal_and_filename_sanitization():
    """Verifies that filename path traversal attacks are neutralized."""
    malicious_filenames = [
        "../../etc/passwd",
        "..\\..\\windows\\system32\\cmd.exe",
        "../../../var/data/secret.key",
        "normal_document.pdf",
    ]
    for fn in malicious_filenames:
        clean = sanitize_filename(fn)
        assert ".." not in clean
        assert "/" not in clean
        assert "\\" not in clean


def test_file_upload_security_oversized_and_invalid_bytes(raw_client, citizen_token):
    """Verifies that oversized files (>10MB) and malicious script binaries are rejected."""
    auth = {"Authorization": f"Bearer {citizen_token}"}

    # 1. Oversized file (11MB dummy data)
    oversized_data = b"0" * (11 * 1024 * 1024)
    res = raw_client.post(
        "/api/applications",
        data={"citizen_name": "Security Test User", "service_type": "income_certificate"},
        files={"aadhaar": ("huge_aadhaar.pdf", oversized_data, "application/pdf")},
        headers=auth,
    )
    assert res.status_code == 400
    assert "exceeds 10mb" in res.json()["detail"].lower()

    # 2. Executable / suspicious HTML script injected as document bytes
    script_bytes = b"<html><script>alert('xss')</script></html>"
    with pytest.raises(DocumentValidationError):
        process_document_bytes(script_bytes, "malicious.png")


def test_privacy_scrubbing_redacts_keys_and_pii():
    """Verifies that logging scrubber redacts API keys, JWTs, and Aadhaar numbers."""
    sample_log = "API key re_live_983749283749823 and JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID65_LSY and Aadhaar 5489 1234 5678"
    sanitized = sanitize_log_val(sample_log)
    assert "re_live_983749283749823" not in sanitized
    assert "[REDACTED_KEY]" in sanitized
    assert "[REDACTED_JWT]" in sanitized
    assert "[REDACTED_AADHAAR]" in sanitized
    assert "5489 1234 5678" not in sanitized


def test_interview_session_idempotency_and_state_guarding(raw_client, officer_token):
    """Verifies that completed interviews cannot accept post-completion answers or duplicate completions."""
    db = SessionLocal()
    try:
        cit_id = f"prof-intv-{uuid.uuid4().hex[:8]}"
        prof = models.CitizenProfile(id=cit_id, citizen_name="Interview Citizen", phone="+919876500133")
        db.add(prof)
        db.commit()

        token = create_citizen_token(cit_id, "Interview Citizen")
        auth_cit = {"Authorization": f"Bearer {token}"}

        # Create application in INTERVIEW_ELIGIBLE
        app_id = f"app-intv-{uuid.uuid4().hex[:8]}"
        app_rec = models.Application(
            id=app_id,
            citizen_name="Interview Citizen",
            citizen_profile_id=cit_id,
            service_type="income_certificate",
            status="INTERVIEW_ELIGIBLE",
        )
        db.add(app_rec)
        db.commit()

        # Start interview session
        r_start = raw_client.post("/api/interviews/start", json={"application_id": app_id}, headers=auth_cit)
        assert r_start.status_code == 200
        sess_id = r_start.json()["session_id"]
        q_id = r_start.json()["questions"][0]["id"]

        # Submit an answer
        r_ans = raw_client.post(f"/api/interviews/{sess_id}/answer", json={
            "question_id": q_id,
            "transcript_text": "My family annual income is 150000 rupees as per my declared records.",
        }, headers=auth_cit)
        assert r_ans.status_code == 200

        # Complete interview
        r_comp1 = raw_client.post(f"/api/interviews/{sess_id}/complete", headers=auth_cit)
        assert r_comp1.status_code == 200

        # Idempotent re-complete returns completion status without error or state corruption
        r_comp2 = raw_client.post(f"/api/interviews/{sess_id}/complete", headers=auth_cit)
        assert r_comp2.status_code == 200

        # Post-completion answer attempt is rejected with 400
        r_post_ans = raw_client.post(f"/api/interviews/{sess_id}/answer", json={
            "question_id": q_id,
            "transcript_text": "Late answer attempt",
        }, headers=auth_cit)
        assert r_post_ans.status_code == 400
        assert "not in progress" in r_post_ans.json()["detail"].lower()
    finally:
        db.close()
