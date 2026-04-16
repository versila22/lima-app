"""JWT and bcrypt security utilities."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject: The `sub` claim (typically user UUID).
        extra_claims: Additional claims to embed (e.g., app_role).
        expires_delta: Custom expiry; defaults to settings value.

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload: Dict[str, Any] = {"sub": subject, "iat": now, "exp": expire, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT access token.

    Raises:
        JWTError: If the token is invalid, expired, or not an access token.
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    if payload.get("type") != "access":
        raise JWTError("Not an access token")
    return payload


def generate_secure_token(length: int = 32) -> str:
    """Generate a URL-safe random token for activation / password reset."""
    return secrets.token_urlsafe(length)


def create_refresh_token(subject: str) -> str:
    """Create a signed JWT refresh token with long expiry."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: Dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.REFRESH_JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_refresh_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a refresh token.

    Raises:
        JWTError: If the token is invalid, expired, or not a refresh token.
    """
    payload = jwt.decode(
        token,
        settings.REFRESH_JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    if payload.get("type") != "refresh":
        raise JWTError("Not a refresh token")
    return payload


def set_auth_cookies(response, access_token: str, refresh_token: str, secure: bool) -> None:
    """Set httpOnly auth cookies on a FastAPI Response object."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/auth/refresh",  # must match the auth router prefix + /refresh
    )


def clear_auth_cookies(response, secure: bool) -> None:
    """Expire auth cookies."""
    response.delete_cookie(key="access_token", path="/", secure=secure, httponly=True, samesite="lax")
    response.delete_cookie(key="refresh_token", path="/auth/refresh", secure=secure, httponly=True, samesite="lax")  # must match the auth router prefix + /refresh
