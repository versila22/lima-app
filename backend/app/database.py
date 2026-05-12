"""SQLAlchemy async engine and session management."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_async_url = settings.async_database_url
_is_sqlite = _async_url.startswith("sqlite")

# SQLite uses NullPool and doesn't accept pool_size / max_overflow.
# Only pass those args for PostgreSQL (production) connections.
_engine_kwargs: dict = {"echo": settings.DEBUG}
if not _is_sqlite:
    _engine_kwargs.update(
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

engine = create_async_engine(_async_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency: yield an async database session.

    Routers are responsible for calling session.commit() after writes.
    This dependency only rolls back on unhandled exceptions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
