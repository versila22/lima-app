"""
LIMA — Ligue d'Improvisation du Maine-et-Loire
FastAPI Application Entry Point
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiting import limiter
from app.middleware.activity_tracker import ActivityTrackerMiddleware
from app.routers import (
    admin,
    auth,
    alignments,
    commissions,
    events,
    members,
    seasons,
    settings as settings_router,
    show_plans,
    venues,
)

from contextlib import asynccontextmanager
from app.run_migrations import run_migrations


async def _ensure_seed_data() -> None:
    """Create admin user and season if the DB is freshly migrated (no members)."""
    from decimal import Decimal
    from datetime import date
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.member import Member
    from app.models.season import Season
    from app.models.member_season import MemberSeason
    from app.utils.security import hash_password

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Member).where(Member.email == "admin@lima-impro.fr"))
            if result.scalar_one_or_none() is not None:
                return  # already seeded

            print("INFO:     Seeding initial data...")

            season = Season(
                name="2025-2026",
                start_date=date(2025, 9, 1),
                end_date=date(2026, 8, 31),
                is_current=True,
            )
            db.add(season)
            await db.flush()

            admin = Member(
                email="admin@lima-impro.fr",
                first_name="Alexandre",
                last_name="Bertrand",
                phone="06 11 22 33 44",
                app_role="admin",
                password_hash=hash_password("Admin1234!"),
                is_active=True,
            )
            db.add(admin)
            await db.flush()

            db.add(MemberSeason(
                member_id=admin.id,
                season_id=season.id,
                player_status="M",
                membership_fee=Decimal("20.00"),
                player_fee=Decimal("160.00"),
                asso_role="co_president",
            ))

            await db.commit()
            print("INFO:     Seed data created (admin@lima-impro.fr / Admin1234!).")
        except Exception:
            await db.rollback()
            import traceback
            print(f"WARN:     Seed data failed (non-fatal): {traceback.format_exc()}")


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

    await _ensure_seed_data()

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


@app.get("/health/db", tags=["health"])
async def health_check_db():
    """Test asyncpg DB connectivity — returns URL prefix and table list."""
    from sqlalchemy import text
    from app.database import engine
    from app.config import settings
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            result = await conn.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
            ))
            tables = [row[0] for row in result.fetchall()]
        return {
            "status": "ok",
            "async_url_prefix": settings.async_database_url[:60],
            "tables": tables,
        }
    except Exception as exc:
        return {"status": "error", "async_url_prefix": settings.async_database_url[:60], "db": str(exc)}


@app.get("/health/migrations", tags=["health"])
def health_check_migrations():
    """Run Alembic migrations and return result — shows exact migration error."""
    from app.config import settings
    from app.run_migrations import run_migrations
    import traceback
    try:
        run_migrations()
        return {"status": "ok", "sync_url_prefix": settings.sync_database_url[:60]}
    except Exception as exc:
        return {
            "status": "error",
            "sync_url_prefix": settings.sync_database_url[:60],
            "error": str(exc),
            "traceback": traceback.format_exc()[-2000:],
        }
