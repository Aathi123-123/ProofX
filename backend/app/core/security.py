"""
PSDE – Security Utilities
Password hashing, JWT tokens, permission checks.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.models.models import UserRole

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password Handling ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)


def validate_password_strength(password: str) -> list[str]:
    """Return a list of validation errors; empty list means password is strong."""
    errors: list[str] = []
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if not any(c.isupper() for c in password):
        errors.append("Password must contain at least one uppercase letter.")
    if not any(c.islower() for c in password):
        errors.append("Password must contain at least one lowercase letter.")
    if not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one digit.")
    if not any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?" for c in password):
        errors.append("Password must contain at least one special character.")
    return errors


# ── JWT Token Handling ────────────────────────────────────────────────────────

def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> str:
    """Create a signed JWT refresh token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token. Raises JWTError on failure."""
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


# ── Permissions ───────────────────────────────────────────────────────────────

class Permission:
    CASE_CREATE = "CASE_CREATE"
    CASE_VIEW = "CASE_VIEW"
    EVIDENCE_UPLOAD = "EVIDENCE_UPLOAD"
    EVIDENCE_VIEW = "EVIDENCE_VIEW"
    EVIDENCE_DISCLOSE = "EVIDENCE_DISCLOSE"
    EVIDENCE_VERIFY = "EVIDENCE_VERIFY"
    AUDIT_VIEW = "AUDIT_VIEW"
    BENCHMARK_RUN = "BENCHMARK_RUN"
    ADMIN = "ADMIN"
    CLASSIFICATION_OVERRIDE = "CLASSIFICATION_OVERRIDE"
    DATASET_GENERATE = "DATASET_GENERATE"
    BLOCKCHAIN_COMMIT = "BLOCKCHAIN_COMMIT"


# Role → Permission mapping
ROLE_PERMISSIONS: dict[str, set[str]] = {
    UserRole.ADMIN: {
        Permission.CASE_CREATE, Permission.CASE_VIEW,
        Permission.EVIDENCE_UPLOAD, Permission.EVIDENCE_VIEW,
        Permission.EVIDENCE_DISCLOSE, Permission.EVIDENCE_VERIFY,
        Permission.AUDIT_VIEW, Permission.BENCHMARK_RUN,
        Permission.ADMIN, Permission.CLASSIFICATION_OVERRIDE,
        Permission.DATASET_GENERATE, Permission.BLOCKCHAIN_COMMIT,
    },
    UserRole.FORENSIC_EXAMINER: {
        Permission.CASE_CREATE, Permission.CASE_VIEW,
        Permission.EVIDENCE_UPLOAD, Permission.EVIDENCE_VIEW,
        Permission.EVIDENCE_VERIFY,
        Permission.CLASSIFICATION_OVERRIDE,
        Permission.DATASET_GENERATE, Permission.BLOCKCHAIN_COMMIT,
        Permission.AUDIT_VIEW,
    },
    UserRole.INVESTIGATOR: {
        Permission.CASE_VIEW,
        Permission.EVIDENCE_VIEW,
        Permission.EVIDENCE_DISCLOSE,
        Permission.EVIDENCE_VERIFY,
    },
    UserRole.VERIFIER: {
        Permission.CASE_VIEW,
        Permission.EVIDENCE_VERIFY,
    },
}


def has_permission(role: str, permission: str) -> bool:
    """Check if a role has a given permission."""
    return permission in ROLE_PERMISSIONS.get(role, set())


def require_permission(role: str, permission: str) -> None:
    """Raise ValueError if the role lacks the required permission."""
    if not has_permission(role, permission):
        raise PermissionError(f"Role '{role}' does not have permission '{permission}'.")
