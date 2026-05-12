"""Security headers middleware.

Adds OWASP / ANSSI-recommended security headers to every response.
References:
- ANSSI - Recommandations sur la sécurisation des sites web
- OWASP Secure Headers Project
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# Headers applied to every response. Values are conservative defaults; they can
# be overridden per-route by setting the same header on the response.
SECURITY_HEADERS = {
    # Force HTTPS for one year on all subdomains.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    # Block content-type sniffing.
    "X-Content-Type-Options": "nosniff",
    # Disallow framing (anti clickjacking).
    "X-Frame-Options": "DENY",
    # Send the referrer only on same-origin / strip path on cross-origin.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # Disable powerful APIs that the app does not need.
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    # Cross-origin isolation defaults.
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            # Don't overwrite a header an endpoint set explicitly.
            response.headers.setdefault(header, value)
        return response
