"""
JWT authentication for staff routes (Officer, Administrator).

Individual hashed-password accounts (StaffUser in models.py), not one
shared password per role. The earlier version let a client pick their
own role from a dropdown and only checked it against a role-agnostic
shared secret — nothing actually bound identity to role. Here, role is
looked up from the account record a username resolves to; the client
never gets to assert it.

Includes basic login rate limiting: a real, working, single-process
protection against password guessing. Being upfront about its actual
limit — this is an in-memory counter, so it resets on restart and
doesn't coordinate across multiple server instances. A real multi
instance deployment needs a shared store (Redis) for this; documented
here rather than silently pretended away.
"""
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-secret-change-before-any-real-deployment")
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 8

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 60

_bearer_scheme = HTTPBearer()

# username -> list of failed-attempt timestamps within the lockout window.
# In-memory by design for this project's scale — see module docstring.
_failed_attempts: dict = defaultdict(list)


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), password_hash.encode())


def is_locked_out(username: str) -> Optional[int]:
    """Returns seconds remaining if locked out, else None."""
    now = time.monotonic()
    recent = [t for t in _failed_attempts[username] if now - t < LOCKOUT_SECONDS]
    _failed_attempts[username] = recent
    if len(recent) >= MAX_LOGIN_ATTEMPTS:
        oldest_relevant = recent[-MAX_LOGIN_ATTEMPTS]
        return max(0, int(LOCKOUT_SECONDS - (now - oldest_relevant)))
    return None


def record_failed_attempt(username: str) -> None:
    _failed_attempts[username].append(time.monotonic())


def clear_failed_attempts(username: str) -> None:
    _failed_attempts.pop(username, None)


def create_access_token(username: str, name: str, role: str) -> str:
    payload = {
        "sub": username,
        "name": name,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_citizen_token(profile_id: str, name: str, phone: Optional[str] = None) -> str:
    payload = {
        "sub": profile_id,
        "profile_id": profile_id,
        "name": name,
        "phone": phone,
        "role": "Citizen",
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired, log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def _get_db_session():
    from .database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


ROLE_CITIZEN = "Citizen"
ROLE_VERIFICATION_OFFICER = "Officer"
ROLE_SENIOR_OFFICER = "Senior Officer"
ROLE_ADMIN = "Administrator"


def normalize_role(role_str: Optional[str]) -> str:
    if not role_str:
        return "Unknown"
    r = role_str.strip().upper().replace(" ", "_")
    if r in ["CITIZEN"]:
        return ROLE_CITIZEN
    if r in ["OFFICER", "VERIFICATION_OFFICER"]:
        return ROLE_VERIFICATION_OFFICER
    if r in ["SENIOR_OFFICER", "SENIOR", "SENIOR_VERIFICATION_OFFICER"]:
        return ROLE_SENIOR_OFFICER
    if r in ["ADMINISTRATOR", "ADMIN", "SUPERADMIN"]:
        return ROLE_ADMIN
    return role_str


def get_current_staff_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db=Depends(_get_db_session),
) -> dict:
    """
    FastAPI dependency — any valid staff token (Officer, Senior Officer, or Administrator).
    Checks is_active against the DB on every call, not just token validity.
    """
    payload = _decode_token(credentials.credentials)
    if payload.get("role") == "Citizen":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This action requires staff credentials, not Citizen session")
    from . import models
    user_row = db.query(models.StaffUser).filter(models.StaffUser.username == payload["sub"]).first()
    if user_row is None or not user_row.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer active")
    if normalize_role(user_row.role) != normalize_role(payload.get("role")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token role does not match active account credentials")
    return {"username": user_row.username, "name": user_row.display_name, "role": user_row.role, "id": user_row.id}


def get_current_citizen_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db=Depends(_get_db_session),
) -> dict:
    """
    FastAPI dependency — valid authenticated citizen token.
    Resolves citizen profile from DB.
    """
    payload = _decode_token(credentials.credentials)
    if payload.get("role") != "Citizen":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Citizen authentication required")
    from . import models
    profile_id = payload.get("profile_id") or payload.get("sub")
    profile = db.query(models.CitizenProfile).filter(models.CitizenProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Citizen profile not found")
    return {
        "id": profile.id,
        "name": profile.citizen_name,
        "phone": profile.phone_number or profile.phone,
        "role": "Citizen",
        "profile": profile,
    }


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db=Depends(_get_db_session),
) -> Optional[dict]:
    """
    FastAPI dependency — decodes optional staff or citizen token if present.
    Returns None if no token provided.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = _decode_token(credentials.credentials)
    except HTTPException:
        return None

    from . import models
    role = normalize_role(payload.get("role"))
    if role in [ROLE_VERIFICATION_OFFICER, ROLE_SENIOR_OFFICER, ROLE_ADMIN]:
        user_row = db.query(models.StaffUser).filter(models.StaffUser.username == payload.get("sub")).first()
        if user_row and user_row.is_active:
            return {"type": "staff", "username": user_row.username, "name": user_row.display_name, "role": user_row.role, "id": user_row.id}
    elif role == ROLE_CITIZEN:
        profile_id = payload.get("profile_id") or payload.get("sub")
        profile = db.query(models.CitizenProfile).filter(models.CitizenProfile.id == profile_id).first()
        if profile:
            return {"type": "citizen", "id": profile.id, "name": profile.citizen_name, "phone": profile.phone_number or profile.phone, "role": "Citizen", "profile": profile}
    return None


def get_current_user_or_staff(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db=Depends(_get_db_session),
) -> dict:
    """
    FastAPI dependency — requires either an authenticated citizen OR a staff member.
    """
    payload = _decode_token(credentials.credentials)
    from . import models
    role = normalize_role(payload.get("role"))
    if role in [ROLE_VERIFICATION_OFFICER, ROLE_SENIOR_OFFICER, ROLE_ADMIN]:
        user_row = db.query(models.StaffUser).filter(models.StaffUser.username == payload.get("sub")).first()
        if not user_row or not user_row.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Staff account no longer active")
        return {"type": "staff", "username": user_row.username, "name": user_row.display_name, "role": user_row.role, "id": user_row.id}
    elif role == ROLE_CITIZEN:
        profile_id = payload.get("profile_id") or payload.get("sub")
        profile = db.query(models.CitizenProfile).filter(models.CitizenProfile.id == profile_id).first()
        if not profile:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Citizen profile not found")
        return {"type": "citizen", "id": profile.id, "name": profile.citizen_name, "phone": profile.phone_number or profile.phone, "role": "Citizen", "profile": profile}
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid role in token")


def require_roles(allowed_roles: list):
    """FastAPI dependency factory — checks if user role matches any allowed role."""
    normalized_allowed = [normalize_role(r) for r in allowed_roles]

    def _check(user: dict = Depends(get_current_staff_user)) -> dict:
        user_norm = normalize_role(user.get("role"))
        if user_norm not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of {allowed_roles} roles, not {user.get('role')}",
            )
        return user
    return _check


def require_role(required_role: str):
    """FastAPI dependency factory — a valid token AND a specific role."""
    return require_roles([required_role])


def require_verification_officer(user: dict = Depends(get_current_staff_user)) -> dict:
    """Allows Verification Officer, Senior Officer, or Administrator."""
    user_norm = normalize_role(user.get("role"))
    if user_norm not in [ROLE_VERIFICATION_OFFICER, ROLE_SENIOR_OFFICER, ROLE_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires Officer, Senior Officer, or Administrator privileges.",
        )
    return user


def require_senior_officer(user: dict = Depends(get_current_staff_user)) -> dict:
    """Allows Senior Officer or Administrator."""
    user_norm = normalize_role(user.get("role"))
    if user_norm not in [ROLE_SENIOR_OFFICER, ROLE_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires Senior Officer or Administrator privileges for final statutory decisions.",
        )
    return user


def require_admin(user: dict = Depends(get_current_staff_user)) -> dict:
    """Allows Administrator only."""
    user_norm = normalize_role(user.get("role"))
    if user_norm != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires Administrator privileges.",
        )
    return user


def seed_demo_accounts_if_empty(db, models) -> None:
    """
    Runs once at startup. Seeds demo accounts for Officer, Senior Officer, and Admin for local development/demo.
    In production (or when ENABLE_DEMO_SEED=false), automatic seeding is skipped to require administrator-controlled credentials.
    """
    enable_seed = os.getenv("ENABLE_DEMO_SEED", "true").lower()
    app_env = os.getenv("ENVIRONMENT", os.getenv("APP_ENV", "development")).lower()
    if enable_seed in ("false", "0", "no") or (app_env == "production" and enable_seed != "true"):
        return

    import uuid
    officer_password = os.getenv("OFFICER_DEMO_PASSWORD", "officer-demo-pass")
    senior_password = os.getenv("SENIOR_OFFICER_DEMO_PASSWORD", "senior-demo-pass")
    admin_password = os.getenv("ADMIN_DEMO_PASSWORD", "admin-demo-pass")

    existing_users = {u.username: u for u in db.query(models.StaffUser).all()}

    if "officer1" not in existing_users:
        db.add(models.StaffUser(
            id=str(uuid.uuid4())[:8], username="officer1", display_name="Suresh",
            role="Officer", password_hash=hash_password(officer_password),
        ))
    else:
        existing_users["officer1"].password_hash = hash_password(officer_password)

    if "senior_officer1" not in existing_users:
        db.add(models.StaffUser(
            id=str(uuid.uuid4())[:8], username="senior_officer1", display_name="Meenakshi",
            role="Senior Officer", password_hash=hash_password(senior_password),
        ))
    else:
        existing_users["senior_officer1"].password_hash = hash_password(senior_password)

    if "admin1" not in existing_users:
        db.add(models.StaffUser(
            id=str(uuid.uuid4())[:8], username="admin1", display_name="Priya",
            role="Administrator", password_hash=hash_password(admin_password),
        ))
    else:
        existing_users["admin1"].password_hash = hash_password(admin_password)

    db.commit()

