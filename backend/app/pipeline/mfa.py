"""
MFA & Citizen Declaration Confirmation Engine for SevaSetu.
Provides structured confirmation and OTP authentication for application submissions.

CRITICAL PRINCIPLE:
MFA proves control of the citizen's authentication factor / declaration submission.
It does NOT prove legal document authenticity.
"""
import os
import secrets
import time
from typing import Dict, Any, Optional
from pydantic import BaseModel

# In-memory ephemeral OTP store for dev/testing: {phone_or_email: {"otp": "123456", "expires_at": float}}
_OTP_CACHE: Dict[str, Dict[str, Any]] = {}
OTP_EXPIRY_SECONDS = 300  # 5 minutes


class ConfirmationResult(BaseModel):
    is_confirmed: bool
    confirmation_method: str  # CITIZEN_DECLARATION | OTP_SMS | OTP_EMAIL | SECURE_TOKEN
    confirmation_timestamp: str
    mfa_verified: bool
    details: str
    disclaimer: str = (
        "Confirmation verifies citizen declaration and submission intent. "
        "It does not constitute independent document authenticity verification."
    )


def send_otp(destination: str, channel: str = "SMS") -> Dict[str, Any]:
    """
    Issues an ephemeral 6-digit OTP.
    Generates a cryptographically secure 6-digit code.
    Never prints or logs the OTP value in production logs.
    """
    is_dev = os.getenv("ENV", "development").lower() in ["development", "dev", "test"]
    # Generate 6-digit cryptographic OTP
    otp_val = f"{secrets.randbelow(900000) + 100000}"
    
    _OTP_CACHE[destination] = {
        "otp": otp_val,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS,
        "channel": channel,
        "attempts_left": 3,
    }
    
    res = {
        "destination": destination,
        "channel": channel,
        "delivery_status": "DEV_SIMULATED" if is_dev else "NOT_CONFIGURED",
        "expires_in_seconds": OTP_EXPIRY_SECONDS,
        "message": "OTP issued for application confirmation.",
    }
    if is_dev:
        res["dev_otp"] = otp_val
    return res


def verify_otp(destination: str, submitted_otp: str) -> bool:
    """Verifies submitted OTP against cached ephemeral record with strict replay prevention."""
    if not destination or not submitted_otp:
        return False

    record = _OTP_CACHE.get(destination)
    if not record:
        return False

    if time.time() > record["expires_at"]:
        _OTP_CACHE.pop(destination, None)
        return False

    if record.get("attempts_left", 3) <= 0:
        _OTP_CACHE.pop(destination, None)
        return False

    # Constant-time comparison
    expected_otp = str(record["otp"])
    candidate_otp = str(submitted_otp).strip()

    import hmac
    if hmac.compare_digest(expected_otp, candidate_otp):
        # Single-use: pop immediately to prevent replay
        _OTP_CACHE.pop(destination, None)
        return True
    else:
        record["attempts_left"] = record.get("attempts_left", 3) - 1
        if record["attempts_left"] <= 0:
            _OTP_CACHE.pop(destination, None)
        return False
