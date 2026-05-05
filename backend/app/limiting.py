"""Shared rate limiting configuration."""

import ipaddress
import os

from starlette.requests import Request
from slowapi import Limiter


def get_client_ip(request: Request) -> str:
    """Return the real client IP.

    Reads X-Forwarded-For first because we are behind a proxy (Railway/Cloudflare).
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_client_ip)
