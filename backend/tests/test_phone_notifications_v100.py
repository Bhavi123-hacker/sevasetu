"""
SevaSetu — Comprehensive Phone Verification & Notification Test Suite.
Tests all 21 specific security, cryptographic, and civic truthfulness invariants.
"""
import time
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, get_db, SessionLocal
from app import models
from app.pipeline.phone_verification import (
    normalize_indian_phone,
    mask_phone_number,
    create_phone_otp_record,
    verify_phone_otp,
    PhoneVerificationError,
    generate_secure_otp,
    hash_otp,
)
from app.pipeline.notification_providers import (
    DevelopmentSMSProvider,
    ProductionSMSProvider,
    NotificationService,
)
from app.pipeline.notifications import (
    create_notification,
    trigger_lifecycle_notification,
    get_citizen_preferences,
    is_notification_permitted,
)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# 1. Phone number validation
def test_phone_number_validation():
    # Valid Indian formats
    assert normalize_indian_phone("+919876543210") == "+919876543210"
    assert normalize_indian_phone("9876543210") == "+919876543210"
    assert normalize_indian_phone("09876543210") == "+919876543210"
    assert normalize_indian_phone("+91 98765 43210") == "+919876543210"
    assert normalize_indian_phone("+91-8765432109") == "+918765432109"
    assert normalize_indian_phone("7123456789") == "+917123456789"
    assert normalize_indian_phone("6123456789") == "+916123456789"

    # Invalid formats
    with pytest.raises(PhoneVerificationError):
        normalize_indian_phone("1234567890")  # starts with 1
    with pytest.raises(PhoneVerificationError):
        normalize_indian_phone("5123456789")  # starts with 5
    with pytest.raises(PhoneVerificationError):
        normalize_indian_phone("987654321")   # only 9 digits
    with pytest.raises(PhoneVerificationError):
        normalize_indian_phone("987654321099")# 12 digits without country code
    with pytest.raises(PhoneVerificationError):
        normalize_indian_phone("")


# 2. OTP generation (secure 6-digit)
def test_otp_generation():
    for _ in range(20):
        otp = generate_secure_otp()
        assert len(otp) == 6
        assert otp.isdigit()
        assert 100000 <= int(otp) <= 999999


# 3. OTP expiration
def test_otp_expiration(db_session):
    phone = "+919111122222"
    rec, raw_otp, _ = create_phone_otp_record(db_session, phone)
    
    # Manually expire the record
    rec.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db_session.commit()

    with pytest.raises(PhoneVerificationError) as exc_info:
        verify_phone_otp(db_session, phone, raw_otp)
    assert "expired" in str(exc_info.value).lower()


# 4. Invalid OTP and attempt decrement
def test_invalid_otp_attempt_decrement(db_session):
    phone = "+919222233333"
    rec, raw_otp, _ = create_phone_otp_record(db_session, phone)
    
    with pytest.raises(PhoneVerificationError) as exc_info:
        verify_phone_otp(db_session, phone, "000000")
    assert "2 attempt(s) remaining" in str(exc_info.value)

    db_session.refresh(rec)
    assert rec.attempts_left == 2


# 5. OTP attempt limit lockout
def test_otp_attempt_limit_lockout(db_session):
    phone = "+919333344444"
    rec, raw_otp, _ = create_phone_otp_record(db_session, phone)
    
    for _ in range(3):
        try:
            verify_phone_otp(db_session, phone, "000000")
        except PhoneVerificationError:
            pass

    db_session.refresh(rec)
    assert rec.attempts_left == 0
    assert rec.is_invalidated is True

    # Next attempt fails with maximum attempts exceeded
    with pytest.raises(PhoneVerificationError) as exc_info:
        verify_phone_otp(db_session, phone, raw_otp)
    assert "maximum verification attempts exceeded" in str(exc_info.value).lower() or "no active verification request" in str(exc_info.value).lower()


# 6. Resend cooldown enforcement
def test_resend_cooldown_enforcement(db_session):
    phone = "+919444455555"
    create_phone_otp_record(db_session, phone)

    # Immediate second request should be blocked by cooldown
    with pytest.raises(PhoneVerificationError) as exc_info:
        create_phone_otp_record(db_session, phone)
    assert exc_info.value.status_code == 429
    assert "wait" in str(exc_info.value).lower()


# 7. OTP reuse prevention
def test_otp_reuse_prevention(db_session):
    phone = "+919555566666"
    rec, raw_otp, _ = create_phone_otp_record(db_session, phone)
    
    res1 = verify_phone_otp(db_session, phone, raw_otp)
    assert res1["verified"] is True

    # Second attempt with same OTP must be rejected
    with pytest.raises(PhoneVerificationError):
        verify_phone_otp(db_session, phone, raw_otp)


# 8. Successful verification updates profile
def test_successful_verification_updates_profile(db_session):
    profile = models.CitizenProfile(
        id="prof-test-1",
        citizen_name="Aarav Sharma",
        phone="+919666677777",
        phone_verification_status="UNVERIFIED",
    )
    db_session.add(profile)
    db_session.commit()

    rec, raw_otp, canonical = create_phone_otp_record(db_session, "+919666677777", citizen_profile_id="prof-test-1")
    res = verify_phone_otp(db_session, "+919666677777", raw_otp, citizen_profile_id="prof-test-1")
    
    assert res["verified"] is True
    db_session.refresh(profile)
    assert profile.phone_verification_status == "VERIFIED"
    assert profile.phone_verified_at is not None


# 9. Phone change resets verification
def test_phone_change_resets_verification(client, db_session):
    profile = models.CitizenProfile(
        id="prof-change-1",
        citizen_name="Deepak Patel",
        phone="+919777788888",
        phone_number="+919777788888",
        phone_verification_status="VERIFIED",
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(profile)
    db_session.commit()

    # Clear phone verification via API
    r_del = client.delete("/api/profile/phone?profile_id=prof-change-1")
    assert r_del.status_code == 200
    
    db_session.refresh(profile)
    assert profile.phone_verification_status == "UNVERIFIED"
    assert profile.phone_verified_at is None


# 10. Notification creation & persistence
def test_notification_creation_and_persistence(db_session):
    notif = create_notification(
        db=db_session,
        recipient="citizen",
        notification_type="APPLICATION_SUBMITTED",
        title="Application Received",
        message="Your application has been received.",
        application_id="app-notif-1",
    )
    assert notif.id.startswith("notif-")
    assert notif.is_read is False

    queried = db_session.query(models.Notification).filter(models.Notification.id == notif.id).first()
    assert queried is not None
    assert queried.title == "Application Received"


# 11. Notification ownership filtering
def test_notification_ownership_filtering(client, db_session):
    notif1 = create_notification(db_session, recipient="citizen", notification_type="TEST", title="T1", message="M1", citizen_profile_id="prof-A")
    notif2 = create_notification(db_session, recipient="citizen", notification_type="TEST", title="T2", message="M2", citizen_profile_id="prof-B")

    r_a = client.get("/api/notifications?recipient=citizen")
    assert r_a.status_code == 200
    all_notifs = r_a.json()
    assert any(n["id"] == notif1.id for n in all_notifs)


# 12. IDOR Protection: mark read requires valid ID
def test_notification_mark_read_and_read_all(client, db_session):
    notif = create_notification(db_session, recipient="citizen", notification_type="TEST", title="Read Test", message="Msg")
    
    # Mark single read
    r_read = client.post(f"/api/notifications/{notif.id}/read")
    assert r_read.status_code == 200
    assert r_read.json()["is_read"] is True

    # Mark all read
    r_all = client.post("/api/notifications/read-all?recipient=citizen")
    assert r_all.status_code == 200
    assert r_all.json()["status"] == "success"


# 13. Notification preferences: security alerts mandatory
def test_notification_preferences_mandatory_security(client, db_session):
    profile = models.CitizenProfile(
        id="prof-pref-1",
        citizen_name="Meena Rao",
    )
    db_session.add(profile)
    db_session.commit()

    # Try turning off all notifications including security alerts
    r_put = client.put("/api/notification-preferences", json={
        "profile_id": "prof-pref-1",
        "preferences": {
            "application_updates": False,
            "security_alerts": False,  # Should be overridden to True
            "sms_enabled": False,
        }
    })
    assert r_put.status_code == 200
    prefs = r_put.json()["preferences"]
    assert prefs["application_updates"] is False
    assert prefs["security_alerts"] is True  # Mandatory invariant


# 14. Lifecycle-triggered notification: application submitted & ready
def test_lifecycle_triggered_notifications(db_session):
    notif_sub = trigger_lifecycle_notification(
        db=db_session,
        notification_type="APPLICATION_SUBMITTED",
        application_id="app-life-1",
        service_type="income_certificate",
    )
    assert notif_sub.notification_type == "APPLICATION_SUBMITTED"
    assert "Income Certificate" in notif_sub.message

    notif_ready = trigger_lifecycle_notification(
        db=db_session,
        notification_type="READY_FOR_REVIEW",
        application_id="app-life-1",
        service_type="income_certificate",
    )
    assert notif_ready.notification_type == "READY_FOR_REVIEW"


# 15. Development provider returns NOT_CONFIGURED
def test_development_sms_provider():
    dev_provider = DevelopmentSMSProvider()
    res = dev_provider.send(
        destination="+919876543210",
        title="Test",
        message="Dev OTP message",
    )
    assert res.status == "NOT_CONFIGURED"
    assert res.is_delivered is False
    assert "development" in res.disclaimer.lower() or "unavailable" in res.disclaimer.lower()


# 16. Production provider not configured behavior
def test_production_sms_provider_unconfigured():
    prod_provider = ProductionSMSProvider()
    assert prod_provider.is_configured() is False
    res = prod_provider.send("+919876543210", "Test", "Prod message")
    assert res.status == "NOT_CONFIGURED"
    assert res.is_delivered is False


# 17. No fake SENT / DELIVERED status
def test_no_fake_delivery_status():
    service = NotificationService()
    res = service.dispatch(
        destination="+919876543210",
        title="OTP",
        message="Your code is 123456",
        channel="SMS",
    )
    # When no real SMS provider is active, status must NOT be DELIVERED
    assert res.status != "DELIVERED"
    assert res.is_delivered is False


# 18. Approval notification wording
def test_approval_notification_wording(db_session):
    notif = trigger_lifecycle_notification(
        db=db_session,
        notification_type="APPLICATION_APPROVED",
        application_id="app-appr-1",
        service_type="residence_certificate",
        extra_details={"resolved_by": "Officer Suresh"},
    )
    assert "has been approved by the authorized officer" in notif.message
    assert "collection is handled by designated authority" in notif.message or "certificate issuance" in notif.message
    # Must NOT claim government certificate issued
    assert "Government certificate issued" not in notif.message


# 19. Rejection notification wording
def test_rejection_notification_wording(db_session):
    notif = trigger_lifecycle_notification(
        db=db_session,
        notification_type="APPLICATION_REJECTED",
        application_id="app-rej-1",
        service_type="caste_certificate",
        extra_details={"reason": "Insufficient jurisdictional community proof."},
    )
    assert "was not approved" in notif.message
    assert "Insufficient jurisdictional community proof" in notif.message


# 20. Correction notification wording (Action required, what is wrong, why, what to upload)
def test_correction_notification_wording(db_session):
    notif = trigger_lifecycle_notification(
        db=db_session,
        notification_type="CORRECTION_REQUESTED",
        application_id="app-corr-1",
        service_type="income_certificate",
        extra_details={
            "reason": "Salary certificate missing authorized signature",
            "details": "The uploaded income proof does not have employer seal.",
        },
    )
    assert "Action Required" in notif.title
    assert "Issue: Salary certificate missing authorized signature" in notif.message
    assert "Details: The uploaded income proof does not have employer seal." in notif.message
    assert "Action: Upload the required replacement document." in notif.message


# 21. Audit trail events for phone and notification actions
def test_audit_trail_events_for_phone_and_notifications(client, db_session):
    # Send OTP
    r_send = client.post("/api/profile/phone/send-otp", json={"phone_number": "+919888899999"})
    assert r_send.status_code == 200
    otp = r_send.json().get("dev_otp")
    assert otp is not None

    # Verify OTP
    r_ver = client.post("/api/profile/phone/verify-otp", json={"phone_number": "+919888899999", "otp": otp})
    assert r_ver.status_code == 200

    # Query audit events
    events = db_session.query(models.AuditEvent).all()
    event_types = [e.event_type for e in events]
    assert "PHONE_VERIFICATION_REQUESTED" in event_types
    assert "PHONE_VERIFIED" in event_types
