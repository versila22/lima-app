"""
LIMA — Ligue d'Improvisation du Maine-et-Loire
FastAPI Application Entry Point
"""

import os

# Initialize Sentry as early as possible so import-time errors are captured.
# No-op when SENTRY_DSN is unset (local dev / CI).
_SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if _SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        environment=os.environ.get("APP_ENV", "production"),
        integrations=[StarletteIntegration(), FastApiIntegration()],
        # Capture 100% of errors. Sample 10% of transactions for performance traces.
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiting import limiter
from app.middleware.activity_tracker import ActivityTrackerMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import (
    admin,
    auth,
    alignments,
    commissions,
    events,
    feedback,
    members,
    seasons,
    settings as settings_router,
    show_plans,
    venues,
)

from contextlib import asynccontextmanager
from app.run_migrations import run_migrations



@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup
    print("INFO:     Starting up and running migrations...")
    try:
        run_migrations()
        print("INFO:     Migrations finished successfully.")
    except Exception as e:
        import traceback
        print(f"WARN:     Migrations failed (continuing anyway for diagnostics): {e}")
        print(traceback.format_exc())

    yield
    # On shutdown
    print("INFO:     Shutting down.")


app = FastAPI(
    title="LIMA API",
    description="API backend de la Ligue d'Improvisation du Maine-et-Loire",
    version="0.1.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Length"],
)
app.add_middleware(ActivityTrackerMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(members.router)
app.include_router(seasons.router)
app.include_router(events.router)
app.include_router(venues.router)
app.include_router(alignments.router)
app.include_router(commissions.router)
app.include_router(show_plans.router)
app.include_router(settings_router.router)
app.include_router(feedback.router)
app.include_router(admin.router, prefix="/api/admin")

# ---------------------------------------------------------------------------
# Static files (member photos)
# ---------------------------------------------------------------------------
# Storage is now delegated to S3/R2. Local static serving disabled.
# _static_root = os.environ.get("STATIC_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "static"))
# _static_root = os.path.abspath(_static_root)
# _photos_dir = os.path.join(_static_root, "photos")
# os.makedirs(_photos_dir, exist_ok=True)
# app.mount("/static", StaticFiles(directory=_static_root), name="static")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health_check():
    """Returns 200 OK when the service is running."""
    return {"status": "ok", "version": "0.1.0"}


