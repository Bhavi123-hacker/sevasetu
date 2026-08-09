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
    finally:
        db.close()


def get_current_staff_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db=Depends(_get_db_session),
) -> dict:
    """
    FastAPI dependency — any valid staff token (Officer or Administrator).
    Checks is_active against the DB on every call, not just token
    validity — a deactivated account's existing token stops working
    immediately instead of staying valid until it naturally expires,
    which is the actual point of having a deactivate button at all.
    """
    payload = _decode_token(credentials.credentials)
    from . import models
    user_row = db.query(models.StaffUser).filter(models.StaffUser.username == payload["sub"]).first()
    if user_row is None or not user_row.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer active")
    return {"username": payload["sub"], "name": payload["name"], "role": payload["role"]}


def require_role(required_role: str):
    """FastAPI dependency factory — a valid token AND a specific role."""
    def _check(user: dict = Depends(get_current_staff_user)) -> dict:
        if user["role"] != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the {required_role} role, not {user['role']}",
            )
        return user
    return _check


def seed_demo_accounts_if_empty(db, models) -> None:
    """
    Runs once at startup. Two demo accounts, each with its OWN password
    (env-overridable) — deliberately not the same shared password for
    both roles anymore, since that was exactly the gap being fixed.
    No-ops if accounts already exist, so it's safe to call every boot.
    """
    import uuid
    if db.query(models.StaffUser).first() is not None:
        return

    officer_password = os.getenv("OFFICER_DEMO_PASSWORD", "officer-demo-pass")
    admin_password = os.getenv("ADMIN_DEMO_PASSWORD", "admin-demo-pass")

    db.add(models.StaffUser(
        id=str(uuid.uuid4())[:8], username="officer1", display_name="Suresh",
        role="Officer", password_hash=hash_password(officer_password),
    ))
    db.add(models.StaffUser(
        id=str(uuid.uuid4())[:8], username="admin1", display_name="Priya",
        role="Administrator", password_hash=hash_password(admin_password),
    ))
    db.commit()
