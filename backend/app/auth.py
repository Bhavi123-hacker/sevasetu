"""
JWT authentication for staff routes (Officer, Administrator).

Real signed, expiring, verifiable tokens — this is what the architecture
diagram's "JWT Auth" box actually refers to, and it's genuinely different
from the previous demo gate, which was just a boolean in Streamlit's
session state that reset if you refreshed the page.

What this still is NOT: a full user-account system. There's still one
shared password per role (via STAFF_DEMO_PASSWORD), not individually
hashed passwords in a database. A citizen never authenticates — the
citizen-facing endpoints (submit application, ask a question, leave
feedback, check status by ID) stay open on purpose, the same as before.

SECRET_KEY has a default so this runs out of the box, but that default
is public (it's sitting in this file) — set a real JWT_SECRET_KEY
environment variable before this ever handles real citizen data.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-secret-change-before-any-real-deployment")
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 8

STAFF_DEMO_PASSWORD = os.getenv("OFFICER_DEMO_PASSWORD", "seva123")

_bearer_scheme = HTTPBearer()


def create_access_token(name: str, role: str) -> str:
    payload = {
        "sub": name,
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


def get_current_staff_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)) -> dict:
    """FastAPI dependency — any valid staff token (Officer or Administrator)."""
    payload = _decode_token(credentials.credentials)
    return {"name": payload["sub"], "role": payload["role"]}


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
