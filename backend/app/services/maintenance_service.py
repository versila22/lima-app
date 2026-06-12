"""Maintenance jobs (data retention)."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def purge_old_activity_logs(db: AsyncSession) -> int:
    """Implemented in the RGPD phase — no-op until then."""
    return 0
