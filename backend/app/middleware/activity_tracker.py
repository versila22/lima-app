"""Middleware to persist API activity logs."""

import asyncio
import logging
import time
from typing import Optional
from uuid import UUID

from jose import JWTError
from starlette.types import ASGIApp, Receive, Scope, Send

from app.database import AsyncSessionLocal
from app.models.activity_log import ActivityLog
from app.utils.security import decode_access_token

logger = logging.getLogger(__name__)

SKIPPED_PATHS = {"/health", "/health/db", "/health/migrations", "/docs", "/redoc", "/openapi.json"}


class ActivityTrackerMiddleware:
    """Pure ASGI middleware — avoids BaseHTTPMiddleware which breaks SQLAlchemy async greenlets."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in SKIPPED_PATHS:
            await self.app(scope, receive, send)
            return

        started_at = time.perf_counter()
        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            method = scope.get("method", "")
            query = (scope.get("query_string") or b"").decode("utf-8", errors="replace")[:1000] or None
            headers = dict(scope.get("headers", []))
            activity_data = {
                "user_id": self._extract_user_id(headers),
                "method": method,
                "path": path,
                "query_params": query,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "user_agent": (headers.get(b"user-agent") or b"").decode("utf-8", errors="replace")[:500] or None,
                "ip": self._extract_ip(headers, scope),
            }
            asyncio.ensure_future(self._write_activity_log(activity_data))

    def _extract_user_id(self, headers: dict) -> Optional[UUID]:
        authorization = (headers.get(b"authorization") or b"").decode("utf-8", errors="replace")
        if not authorization:
            return None
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        try:
            payload = decode_access_token(token)
        except JWTError:
            return None
        subject = payload.get("sub")
        if not subject:
            return None
        try:
            return UUID(str(subject))
        except (TypeError, ValueError):
            return None

    def _extract_ip(self, headers: dict, scope: Scope) -> Optional[str]:
        forwarded_for = (headers.get(b"x-forwarded-for") or b"").decode("utf-8", errors="replace")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()[:45] or None
        client = scope.get("client")
        if client:
            return str(client[0])[:45]
        return None

    async def _write_activity_log(self, activity_data: dict) -> None:
        async with AsyncSessionLocal() as session:
            try:
                session.add(ActivityLog(**activity_data))
                await session.commit()
            except Exception:
                await session.rollback()
                logger.exception("Failed to write activity log")
