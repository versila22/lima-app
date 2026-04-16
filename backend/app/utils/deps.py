"""FastAPI dependencies: current user, admin guard."""

from typing import Optional
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.member import Member
from app.utils.security import decode_access_token


async def get_current_user(
    request: Request,
    access_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> Member:
    """
    Decode the JWT and return the authenticated Member.

    Reads from the httpOnly 'access_token' cookie first, then falls back to
    the Authorization: Bearer header for backward compatibility.

    Raises 401 if the token is missing, invalid, or the user is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try cookie
    token = access_token

    # 2. Fall back to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]

    if not token:
        raise credentials_exception

    try:
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(Member)
        .options(selectinload(Member.member_seasons))
        .where(Member.id == UUID(user_id))
    )
    member = result.scalar_one_or_none()

    if member is None:
        raise credentials_exception
    if not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )
    return member


async def require_admin(
    current_user: Member = Depends(get_current_user),
) -> Member:
    """
    Require the current user to have the 'admin' role.

    Raises 403 if not admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )
    return current_user
