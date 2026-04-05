"""
LIMA — Ligue d'Improvisation du Maine-et-Loire
FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
import app.models  # noqa: F401 — register all models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup if they don't exist."""
    import asyncio
    import os
    for attempt in range(15):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            break
        except Exception as e:
            if attempt < 14:
                print(f"DB not ready (attempt {attempt + 1}/15): {e}")
                await asyncio.sleep(2)
            else:
                print(f"Could not connect to DB after 15 attempts: {e}")
                raise

    # Run seed if SEED_ON_STARTUP=1
    if os.environ.get("SEED_ON_STARTUP") == "1":
        print("SEED_ON_STARTUP=1 — running seed...")
        try:
            import sys, os
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from seed import seed as run_seed
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                await run_seed(db)
            print("Seed completed.")
        except Exception as e:
            print(f"Seed failed (non-fatal): {e}")

    yield


from app.routers import (
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

app = FastAPI(
    title="LIMA API",
    description="API backend de la Ligue d'Improvisation du Maine-et-Loire",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
origins = settings.CORS_ORIGINS
if origins == ["*"]:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health_check():
    """Returns 200 OK when the service is running."""
    return {"status": "ok", "version": "0.1.0"}


# ---------------------------------------------------------------------------
# One-shot seed endpoint (protected by secret token)
# ---------------------------------------------------------------------------
from fastapi import Header
from app.database import AsyncSessionLocal

@app.post("/admin/seed", tags=["admin"], include_in_schema=False)
async def trigger_seed(x_seed_token: str = Header(...)):
    """Trigger seed manually via secret token."""
    expected = os.environ.get("SEED_SECRET", "")
    if not expected or x_seed_token != expected:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from seed import seed as run_seed
        async with AsyncSessionLocal() as db:
            await run_seed(db)
        return {"status": "seed completed"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.post("/admin/reset-admin", tags=["admin"], include_in_schema=False)
async def reset_admin(x_seed_token: str = Header(...)):
    """Create or reset admin account."""
    from fastapi import HTTPException
    expected = os.environ.get("SEED_SECRET", "")
    if not expected or x_seed_token != expected:
        raise HTTPException(status_code=403, detail="Forbidden")
    from sqlalchemy import select
    from app.models.member import Member
    from app.utils.security import hash_password
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Member).where(Member.email == "admin@lima-impro.fr"))
        member = result.scalar_one_or_none()
        if member is None:
            member = Member(
                email="admin@lima-impro.fr",
                first_name="Alexandre",
                last_name="Bertrand",
                app_role="admin",
                password_hash=hash_password("Admin1234!"),
                is_active=True,
            )
            db.add(member)
            await db.commit()
            return {"status": "admin created"}
        else:
            member.password_hash = hash_password("Admin1234!")
            member.is_active = True
            await db.commit()
            return {"status": "admin password reset", "id": str(member.id)}


# ---------------------------------------------------------------------------
# Serve frontend static files (SPA)
# ---------------------------------------------------------------------------
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="static-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Serve the SPA index.html for all non-API routes."""
        file_path = os.path.join(_static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_static_dir, "index.html"))
