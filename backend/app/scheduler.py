"""Daily in-process scheduler: reminder emails + maintenance.

Railway runs the web service 24/7 and has no built-in cron for this service,
so a lifespan-managed asyncio task fires once a day at 09:00 Europe/Paris.
email_logs makes reminder sends idempotent across restarts/replicas.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

RUN_AT_HOUR = 9
_PARIS_KEY = "Europe/Paris"


def seconds_until_next_run(now: datetime | None = None) -> float:
    paris = ZoneInfo(_PARIS_KEY)
    current = now or datetime.now(paris)
    target = current.replace(hour=RUN_AT_HOUR, minute=0, second=0, microsecond=0)
    if target <= current:
        target += timedelta(days=1)
    return (target - current).total_seconds()


async def run_daily_jobs() -> None:
    import app.database as app_database
    from app.services import maintenance_service, reminder_service

    async with app_database.AsyncSessionLocal() as db:
        await reminder_service.send_due_reminders(db, kind="J1")
        await reminder_service.send_due_reminders(db, kind="J7")
        await maintenance_service.purge_old_activity_logs(db)


async def scheduler_loop() -> None:
    logger.info("Scheduler started (daily at %02d:00 Europe/Paris)", RUN_AT_HOUR)
    while True:
        await asyncio.sleep(seconds_until_next_run())
        try:
            await run_daily_jobs()
        except Exception:
            logger.exception("Daily jobs failed; will retry tomorrow")


CONFIRM_SWEEP_SECONDS = 60


async def confirmation_sweep_loop() -> None:
    import app.database as app_database
    from app.services import reimbursement_service
    logger.info("Confirmation sweep started (every %ds)", CONFIRM_SWEEP_SECONDS)
    while True:
        try:
            async with app_database.AsyncSessionLocal() as db:
                n = await reimbursement_service.finalize_due_confirmations(db)
                if n:
                    logger.info("Finalisé %d demande(s) de remboursement", n)
        except Exception:
            logger.exception("Confirmation sweep failed; retry in %ds", CONFIRM_SWEEP_SECONDS)
        await asyncio.sleep(CONFIRM_SWEEP_SECONDS)
