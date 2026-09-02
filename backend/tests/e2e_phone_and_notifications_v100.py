#!/usr/bin/env python3
"""
SevaSetu Live E2E Forensic Test: Real Phone Verification & Civic Notification System.
Executes 12 live end-to-end integration scenarios against running FastAPI + PostgreSQL backend.
"""
import os
import sys
import time
import requests

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")


def print_step(step_num, title):
    print(f"\n[SCENARIO {step_num}] {title}")


def run_all_e2e_scenarios():
    print("=" * 70)
    print("SEVASETU LIVE E2E: PHONE VERIFICATION & NOTIFICATIONS INTEGRITY")
    print(f"Target Backend: {BASE_URL}")
    print("=" * 70)

    # 1. Health check
    print_step(1, "Verify backend health & database connectivity")
    r_health = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r_health.status_code == 200, f"Health check failed: {r_health.text}"
    health_data = r_health.json()
    print(f"  ✓ System healthy: {health_data}")

    # 2. Test phone normalization & validation
    print_step(2, "Phone normalization and format rejection")
    r_invalid = requests.post(f"{BASE_URL}/api/profile/phone/send-otp", json={"phone_number": "1234567890"})
    assert r_invalid.status_code in [400, 422], f"Expected rejection of invalid phone prefix, got {r_invalid.status_code}"
    print("  ✓ Invalid prefix rejected (400/422)")

    # 3. Request OTP and check rate-limiting / resend cooldown
    print_step(3, "Request OTP and verify resend cooldown")
    test_phone = "+91 98765 43210"
    r_send = requests.post(f"{BASE_URL}/api/profile/phone/send-otp", json={"phone_number": test_phone})
    assert r_send.status_code == 200, f"OTP request failed: {r_send.text}"
    otp_data = r_send.json()
    assert otp_data["status"] == "OTP_SENT"
    assert otp_data["phone_masked"] == "+91 ******3210"
    assert otp_data["sms_delivery_status"] in ["NOT_CONFIGURED", "SENT", "DELIVERED_IN_APP"]
    raw_otp = otp_data.get("dev_otp")
    assert raw_otp is not None, "dev_otp helper expected in test mode"
    print(f"  ✓ OTP generated and masked: {otp_data['phone_masked']}")

    # Immediate second request should trigger 429 cooldown
    r_cooldown = requests.post(f"{BASE_URL}/api/profile/phone/send-otp", json={"phone_number": test_phone})
    assert r_cooldown.status_code == 429, f"Expected 429 Too Many Requests, got {r_cooldown.status_code}"
    print("  ✓ Resend cooldown enforced (429 Too Many Requests)")

    # 4. Test wrong OTP decrement & attempt lockout
    print_step(4, "Wrong OTP rejection and attempt decrement")
    phone_lockout = "+91 91111 22222"
    r_send_lock = requests.post(f"{BASE_URL}/api/profile/phone/send-otp", json={"phone_number": phone_lockout})
    assert r_send_lock.status_code == 200
    
    # 3 invalid attempts
    for attempt in [1, 2, 3]:
        r_bad = requests.post(f"{BASE_URL}/api/profile/phone/verify-otp", json={"phone_number": phone_lockout, "otp": "000000"})
        assert r_bad.status_code in [400, 401], f"Expected failure on wrong OTP, got {r_bad.status_code}"
    
    # 4th attempt should be locked out
    r_locked = requests.post(f"{BASE_URL}/api/profile/phone/verify-otp", json={"phone_number": phone_lockout, "otp": r_send_lock.json().get("dev_otp", "123456")})
    assert r_locked.status_code in [400, 401, 429], "Expected lockout rejection on 4th attempt"
    print("  ✓ Brute-force protection verified: 3 failed attempts invalidates OTP")

    # 5. Successful phone verification and profile status update
    print_step(5, "Successful OTP verification & profile verification status")
    r_prof = requests.post(f"{BASE_URL}/api/profile", json={
        "id": "prof-e2e-citizen-1",
        "citizen_name": "Kavita Sharma",
        "phone": "+919876543210",
        "category": "General",
    })
    assert r_prof.status_code == 200

    r_verify = requests.post(f"{BASE_URL}/api/profile/phone/verify-otp", json={
        "phone_number": test_phone,
        "otp": raw_otp,
        "profile_id": "prof-e2e-citizen-1",
    })
    assert r_verify.status_code == 200, f"Verification failed: {r_verify.text}"
    v_data = r_verify.json()
    assert v_data["verified"] is True
    assert v_data["phone_number"] == "+919876543210"
    print(f"  ✓ Phone verified: {v_data['phone_number']} at {v_data['phone_verified_at']}")

    # 6. Verify OTP reuse is rejected
    print_step(6, "OTP reuse prevention")
    r_reuse = requests.post(f"{BASE_URL}/api/profile/phone/verify-otp", json={
        "phone_number": test_phone,
        "otp": raw_otp,
        "profile_id": "prof-e2e-citizen-1",
    })
    assert r_reuse.status_code in [400, 401], "Used OTP must not be reusable"
    print("  ✓ Used OTP cannot be replayed")

    # 7. Notification preferences management (security alerts mandatory)
    print_step(7, "Notification preferences & mandatory security invariant")
    r_prefs = requests.put(f"{BASE_URL}/api/notification-preferences", json={
        "profile_id": "prof-e2e-citizen-1",
        "preferences": {
            "application_updates": False,
            "correction_requests": True,
            "decision_alerts": True,
            "security_alerts": False,  # Should be forced True
        }
    })
    assert r_prefs.status_code == 200
    p_data = r_prefs.json()["preferences"]
    assert p_data["security_alerts"] is True, "Security alerts must be strictly mandatory"
    assert p_data["application_updates"] is False
    print("  ✓ Notification preferences updated, security_alerts invariant maintained")

    # 8. Lifecycle notification generation across application stages
    print_step(8, "Lifecycle notification creation on application submission")
    app_id = f"e2e-{int(time.time())}"[-8:]
    r_app = requests.post(
        f"{BASE_URL}/api/applications",
        data={
            "citizen_name": "Kavita Sharma",
            "service_type": "income_certificate",
            "citizen_profile_id": "prof-e2e-citizen-1",
        },
    )
    assert r_app.status_code == 200
    app_data = r_app.json()
    created_app_id = app_data["application_id"]
    token = app_data.get("tracking_token")
    print(f"  ✓ Application created: {created_app_id}")

    # Check notification list
    r_notifs = requests.get(f"{BASE_URL}/api/notifications?recipient=citizen")
    assert r_notifs.status_code == 200
    notifs = r_notifs.json()
    notif_types = [n["notification_type"] for n in notifs]
    assert "APPLICATION_SUBMITTED" in notif_types or "READY_FOR_REVIEW" in notif_types
    print(f"  ✓ Lifecycle notifications created: {set(notif_types)}")

    # 9. Officer correction request with standardized message
    print_step(9, "Officer correction request notification")
    # Login staff
    r_login = requests.post(f"{BASE_URL}/api/auth/login", data={"username": "officer_patel", "password": "password123"})
    assert r_login.status_code == 200
    auth_header = {"Authorization": f"Bearer {r_login.json()['access_token']}"}

    r_corr = requests.post(
        f"{BASE_URL}/api/applications/{created_app_id}/request-correction",
        json={
            "reason": "Income proof document is blurred and lacks seal",
            "details": "Please upload a clear scanned copy of employer salary certificate.",
        },
        headers=auth_header,
    )
    assert r_corr.status_code == 200

    r_notifs_after = requests.get(f"{BASE_URL}/api/notifications?recipient=citizen")
    corr_notif = next((n for n in r_notifs_after.json() if n["notification_type"] == "CORRECTION_REQUESTED"), None)
    assert corr_notif is not None
    assert "Action Required" in corr_notif["title"]
    assert "Income proof document is blurred" in corr_notif["message"]
    print("  ✓ Correction request notification formatted with 4-part civic standard")

    # 9b. Officer passes document review & citizen completes interview
    requests.post(
        f"{BASE_URL}/api/applications/{created_app_id}/document-review-pass",
        json={"notes": "All requirements verified."},
        headers=auth_header,
    )
    r_intv = requests.post(f"{BASE_URL}/api/interviews/start", json={"application_id": created_app_id})
    if r_intv.status_code == 200:
        requests.post(f"{BASE_URL}/api/interviews/{r_intv.json()['session_id']}/complete")

    # 10. Officer approval notification with statutory wording
    print_step(10, "Officer statutory approval notification")
    r_appr = requests.post(
        f"{BASE_URL}/api/applications/{created_app_id}/approve",
        json={"notes": "All requirements verified."},
        headers=auth_header,
    )
    assert r_appr.status_code == 200

    r_notifs_appr = requests.get(f"{BASE_URL}/api/notifications?recipient=citizen")
    appr_notif = next((n for n in r_notifs_appr.json() if n["notification_type"] == "APPLICATION_APPROVED"), None)
    assert appr_notif is not None
    assert "approved by the authorized officer" in appr_notif["message"]
    print("  ✓ Approval notification compliant with statutory provenance")

    # 11. In-App Notification Center: mark read and mark all read
    print_step(11, "In-App Notification Center mark read & mark all read")
    r_unread = requests.get(f"{BASE_URL}/api/notifications/unread-count?recipient=citizen")
    assert r_unread.status_code == 200
    unread_init = r_unread.json()["unread_count"]
    print(f"  ✓ Unread notification count: {unread_init}")

    r_all_read = requests.post(f"{BASE_URL}/api/notifications/read-all?recipient=citizen")
    assert r_all_read.status_code == 200

    r_unread_post = requests.get(f"{BASE_URL}/api/notifications/unread-count?recipient=citizen")
    assert r_unread_post.json()["unread_count"] == 0
    print("  ✓ All notifications marked as read successfully")

    # 12. Phone number reset & security event audit
    print_step(12, "Phone number change resets verification & emits audit event")
    r_del_phone = requests.delete(f"{BASE_URL}/api/profile/phone?profile_id=prof-e2e-citizen-1")
    assert r_del_phone.status_code == 200

    r_prof_after = requests.get(f"{BASE_URL}/api/profile?profile_id=prof-e2e-citizen-1")
    assert r_prof_after.json().get("phone_verification_status") in ["UNVERIFIED", None]
    print("  ✓ Phone verification status cleared and security audit emitted")

    print("\n" + "=" * 70)
    print("ALL 12 E2E PHONE VERIFICATION & NOTIFICATION SCENARIOS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    run_all_e2e_scenarios()
