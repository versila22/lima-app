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


_SEED_MEMBERS = [
    {"email": "admin@lima-impro.fr",        "first_name": "Alexandre", "last_name": "Bertrand", "phone": "06 11 22 33 44", "app_role": "admin",   "password": "Admin1234!", "player_status": "M", "player_fee": "160.00", "asso_role": "co_president"},
    {"email": "marie.leroy@exemple.fr",     "first_name": "Marie",     "last_name": "Leroy",    "phone": "06 22 33 44 55", "app_role": "member",  "password": "Password1!", "player_status": "M", "player_fee": "160.00", "asso_role": "co_treasurer"},
    {"email": "thomas.martin@exemple.fr",   "first_name": "Thomas",    "last_name": "Martin",   "phone": "06 33 44 55 66", "app_role": "member",  "password": "Password1!", "player_status": "C", "player_fee": "75.00",  "asso_role": None},
    {"email": "sophie.dubois@exemple.fr",   "first_name": "Sophie",    "last_name": "Dubois",   "phone": "06 44 55 66 77", "app_role": "member",  "password": "Password1!", "player_status": "M", "player_fee": "160.00", "asso_role": "secretary"},
    {"email": "lucas.petit@exemple.fr",     "first_name": "Lucas",     "last_name": "Petit",    "phone": "06 55 66 77 88", "app_role": "member",  "password": "Password1!", "player_status": "L", "player_fee": "40.00",  "asso_role": None},
    {"email": "claire.moreau@exemple.fr",   "first_name": "Claire",    "last_name": "Moreau",   "phone": "06 66 77 88 99", "app_role": "member",  "password": "Password1!", "player_status": "C", "player_fee": "75.00",  "asso_role": "ca_member"},
    {"email": "julien.bernard@exemple.fr",  "first_name": "Julien",    "last_name": "Bernard",  "phone": "06 77 88 99 00", "app_role": "member",  "password": "Password1!", "player_status": "M", "player_fee": "160.00", "asso_role": "coach"},
    {"email": "emma.richard@exemple.fr",    "first_name": "Emma",      "last_name": "Richard",  "phone": "06 88 99 00 11", "app_role": "member",  "password": "Password1!", "player_status": "A", "player_fee": None,      "asso_role": None},
    {"email": "paul.durand@exemple.fr",     "first_name": "Paul",      "last_name": "Durand",   "phone": "06 99 00 11 22", "app_role": "member",  "password": "Password1!", "player_status": "M", "player_fee": "160.00", "asso_role": None},
]


async def _ensure_seed_data() -> None:
    """Create all seed members and the current season if the DB is freshly migrated."""
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
            existing = (await db.execute(select(Member.email))).scalars().all()
            existing_emails = set(existing)
            to_create = [m for m in _SEED_MEMBERS if m["email"] not in existing_emails]
            if not to_create:
                return  # already fully seeded

            print(f"INFO:     Seeding {len(to_create)} member(s)...")

            # Ensure the current season exists
            season = (await db.execute(select(Season).where(Season.is_current.is_(True)))).scalar_one_or_none()
            if season is None:
                season = Season(name="2025-2026", start_date=date(2025, 9, 1), end_date=date(2026, 8, 31), is_current=True)
                db.add(season)
                await db.flush()

            for m in to_create:
                member = Member(
                    email=m["email"],
                    first_name=m["first_name"],
                    last_name=m["last_name"],
                    phone=m["phone"],
                    app_role=m["app_role"],
                    password_hash=hash_password(m["password"]),
                    is_active=True,
                )
                db.add(member)
                await db.flush()
                db.add(MemberSeason(
                    member_id=member.id,
                    season_id=season.id,
                    player_status=m["player_status"],
                    membership_fee=Decimal("20.00"),
                    player_fee=Decimal(m["player_fee"]) if m["player_fee"] else None,
                    asso_role=m["asso_role"],
                ))

            await db.commit()
            print(f"INFO:     Seeded {len(to_create)} member(s) successfully.")
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
