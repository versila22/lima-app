"""Shared rate limiting configuration."""

import ipaddress
import os

from starlette.requests import Request
from slowapi import Limiter


def _parse_trusted_proxies() -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    raw = os.environ.get("TRUSTED_PROXIES", "")
    result = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            result.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            pass
    return result


_TRUSTED_PROXIES = _parse_trusted_proxies()


def _is_trusted_proxy(ip: str) -> bool:
    if not _TRUSTED_PROXIES:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in network for network in _TRUSTED_PROXIES)


def get_client_ip(request: Request) -> str:
    """Return the real client IP.

    Reads X-Forwarded-For only when the immediate connection comes from a
    trusted proxy (configured via TRUSTED_PROXIES env var, comma-separated
    CIDRs). Falls back to the socket address otherwise.
    """
    client_host = request.client.host if request.client else "unknown"
    if _is_trusted_proxy(client_host):
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return client_host


limiter = Limiter(key_func=get_client_ip)
