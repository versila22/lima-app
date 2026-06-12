"""Maintenance jobs (data retention)."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog

logger = logging.getLogger(__name__)

# CNIL : journaux de connexion conservés 6 à 13 mois maximum.
ACTIVITY_LOG_RETENTION_DAYS = 365


async def purge_old_activity_logs(db: AsyncSession) -> int:
    """Delete activity logs older than the retention window. Returns rows deleted."""
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(
        days=ACTIVITY_LOG_RETENTION_DAYS
    )
    result = await db.execute(
        delete(ActivityLog).where(ActivityLog.created_at < cutoff)
    )
    await db.commit()
    deleted = result.rowcount or 0
    if deleted:
        logger.info(
            "Purged %s activity log rows older than %s days",
            deleted,
            ACTIVITY_LOG_RETENTION_DAYS,
        )
    return deleted
