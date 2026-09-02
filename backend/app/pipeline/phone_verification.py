"""
SevaSetu Citizen Phone Verification Module.
Implements cryptographically secure, rate-limited, salted-hash OTP phone verification.
Never permanently stores plaintext OTPs or exposes them in production.
"""
import re
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models

# Verification Configuration
OTP_EXPIRY_SECONDS = 300       # 5 minutes
RESEND_COOLDOWN_SECONDS = 60    # 60 seconds
MAX_VERIFICATION_ATTEMPTS = 3   # 3 attempts before locking OTP
MAX_REQUESTS_PER_HOUR = 5       # Max 5 OTP requests per hour per number


class PhoneVerificationError(Exception):
    """Custom exception for phone verification validation and rate limits."""
    def __init__(self, message: str, status_code: int = 400, details: Optional[dict] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def normalize_indian_phone(phone_input: str) -> str:
    """
    Validates and normalizes Indian mobile numbers to canonical +91XXXXXXXXXX format.
    Accepts: +919876543210, 9876543210, 09876543210, +91 98765 43210, +91-9876543210.
    Rejects numbers not conforming to 10 digits starting with [6, 7, 8, 9].
    """
    if not phone_input or not isinstance(phone_input, str):
        raise PhoneVerificationError("Mobile number is required.")

    # Remove all formatting whitespace, dots, hyphens, parentheses
    cleaned = re.sub(r"[\s\-\(\)\.]+", "", phone_input.strip())

    # Strip international country code if present
    if cleaned.startswith("+91"):
        digits = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        digits = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        digits = cleaned[1:]
    else:
        digits = cleaned

    # Must be exactly 10 digits
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise PhoneVerificationError(
            "Invalid Indian mobile number. Must be a valid 10-digit number starting with 6, 7, 8, or 9."
        )

    return f"+91{digits}"


def mask_phone_number(canonical_phone: str) -> str:
    """
    Masks phone numbers for safe UI presentation: +91 ******1234.
    """
    if not canonical_phone or len(canonical_phone) < 13:
        return canonical_phone or ""
    return f"{canonical_phone[:3]} ******{canonical_phone[-4:]}"


def generate_secure_otp() -> str:
    """Generates a cryptographically secure 6-digit OTP."""
    # Range: 100000 to 999999 inclusive
    val = secrets.randbelow(900000) + 100000
    return str(val)


def hash_otp(raw_otp: str, salt: str) -> str:
    """Returns SHA-256 salted hash of the OTP string."""
    return hashlib.sha256(f"{raw_otp}:{salt}".encode("utf-8")).hexdigest()


def create_phone_otp_record(
    db: Session,
    phone_input: str,
    citizen_profile_id: Optional[str] = None,
) -> Tuple[models.PhoneVerificationOtp, str, str]:
    """
    Creates a new salted OTP record in DB after enforcing rate limits and cooldowns.
    Invalidates any previous active OTPs for the same phone number.
    Returns: (otp_record, raw_otp, canonical_phone)
    """
    canonical_phone = normalize_indian_phone(phone_input)
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)

    # 1. Hourly Rate Limit Check
    recent_count = db.query(func.count(models.PhoneVerificationOtp.id)).filter(
        models.PhoneVerificationOtp.phone_number == canonical_phone,
        models.PhoneVerificationOtp.created_at >= one_hour_ago,
    ).scalar() or 0

    if recent_count >= MAX_REQUESTS_PER_HOUR:
        raise PhoneVerificationError(
            f"Maximum OTP requests exceeded. Please wait before requesting another OTP for {mask_phone_number(canonical_phone)}.",
            status_code=429,
            details={"cooldown_seconds": 3600},
        )

    # 2. Resend Cooldown Check
    latest_active = db.query(models.PhoneVerificationOtp).filter(
        models.PhoneVerificationOtp.phone_number == canonical_phone,
        models.PhoneVerificationOtp.is_used == False,
        models.PhoneVerificationOtp.is_invalidated == False,
    ).order_by(models.PhoneVerificationOtp.created_at.desc()).first()

    if latest_active and latest_active.resend_available_at:
        # SQLite or Postgres timestamp awareness handling
        resend_time = latest_active.resend_available_at
        if resend_time.tzinfo is None:
            resend_time = resend_time.replace(tzinfo=timezone.utc)

        if now < resend_time:
            wait_sec = int((resend_time - now).total_seconds())
            raise PhoneVerificationError(
                f"Please wait {wait_sec} seconds before requesting a new OTP.",
                status_code=429,
                details={"cooldown_seconds": wait_sec},
            )

    # 3. Invalidate all previous active OTPs for this number
    db.query(models.PhoneVerificationOtp).filter(
        models.PhoneVerificationOtp.phone_number == canonical_phone,
        models.PhoneVerificationOtp.is_used == False,
        models.PhoneVerificationOtp.is_invalidated == False,
    ).update({"is_invalidated": True})

    # 4. Generate new OTP and salt
    raw_otp = generate_secure_otp()
    salt = secrets.token_hex(16)
    hashed = hash_otp(raw_otp, salt)

    otp_record = models.PhoneVerificationOtp(
        id=f"otp-{secrets.token_hex(8)}",
        phone_number=canonical_phone,
        citizen_profile_id=citizen_profile_id,
        hashed_otp=hashed,
        salt=salt,
        attempts_left=MAX_VERIFICATION_ATTEMPTS,
        expires_at=now + timedelta(seconds=OTP_EXPIRY_SECONDS),
        resend_available_at=now + timedelta(seconds=RESEND_COOLDOWN_SECONDS),
        is_used=False,
        is_invalidated=False,
        created_at=now,
    )
    db.add(otp_record)
    db.commit()
    db.refresh(otp_record)

    return otp_record, raw_otp, canonical_phone


def verify_phone_otp(
    db: Session,
    phone_input: str,
    submitted_otp: str,
    citizen_profile_id: Optional[str] = None,
) -> dict:
    """
    Verifies submitted OTP against active DB record.
    Decrements attempts on failure. Sets phone_verified_at and VERIFIED status on success.
    """
    canonical_phone = normalize_indian_phone(phone_input)
    cleaned_otp = (submitted_otp or "").strip()
    now = datetime.now(timezone.utc)

    if not cleaned_otp or len(cleaned_otp) != 6 or not cleaned_otp.isdigit():
        raise PhoneVerificationError("OTP must be a 6-digit numeric code.")

    # Fetch latest active OTP for this number
    record = db.query(models.PhoneVerificationOtp).filter(
        models.PhoneVerificationOtp.phone_number == canonical_phone,
        models.PhoneVerificationOtp.is_used == False,
        models.PhoneVerificationOtp.is_invalidated == False,
    ).order_by(models.PhoneVerificationOtp.created_at.desc()).first()

    if not record:
        raise PhoneVerificationError(
            "No active verification request found for this phone number. Please request a new OTP.",
            status_code=400,
        )

    # Check Expiration
    exp_time = record.expires_at
    if exp_time.tzinfo is None:
        exp_time = exp_time.replace(tzinfo=timezone.utc)

    if now > exp_time:
        record.is_invalidated = True
        db.commit()
        raise PhoneVerificationError("OTP has expired. Please request a new verification code.", status_code=400)

    # Check Attempts
    if record.attempts_left <= 0:
        record.is_invalidated = True
        db.commit()
        raise PhoneVerificationError(
            "Maximum verification attempts exceeded for this OTP. Please request a new code.",
            status_code=400,
        )

    # Constant-time comparison
    expected_hash = record.hashed_otp
    candidate_hash = hash_otp(cleaned_otp, record.salt)

    if not hmac.compare_digest(expected_hash, candidate_hash):
        record.attempts_left -= 1
        if record.attempts_left <= 0:
            record.is_invalidated = True
        db.commit()
        remaining = max(0, record.attempts_left)
        raise PhoneVerificationError(
            f"Invalid OTP code. {remaining} attempt(s) remaining.",
            status_code=400,
            details={"attempts_left": remaining},
        )

    # Success: Mark OTP as used
    record.is_used = True
    db.commit()

    # Update CitizenProfile if present
    profile = None
    if citizen_profile_id:
        profile = db.query(models.CitizenProfile).filter(models.CitizenProfile.id == citizen_profile_id).first()
    if not profile:
        # Check by matching phone or get default
        profile = db.query(models.CitizenProfile).filter(
            (models.CitizenProfile.phone_number == canonical_phone) | (models.CitizenProfile.phone == canonical_phone)
        ).first()

    verified_at = datetime.now(timezone.utc)
    if profile:
        # If changing an existing verified number, audit is handled by caller
        profile.phone_number = canonical_phone
        profile.phone = canonical_phone
        profile.phone_verified_at = verified_at
        profile.phone_verification_status = "VERIFIED"
        db.commit()

    return {
        "verified": True,
        "phone_number": canonical_phone,
        "phone_masked": mask_phone_number(canonical_phone),
        "phone_verified_at": verified_at.isoformat(),
        "phone_verification_status": "VERIFIED",
        "message": "Mobile number successfully verified.",
    }
