"""CLI wrapper: send J-7 and J-1 reminder emails (logic in app.services.reminder_service)."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import AsyncSessionLocal
from app.services import reminder_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await reminder_service.send_due_reminders(db, kind="J1")
        await reminder_service.send_due_reminders(db, kind="J7")


if __name__ == "__main__":
    asyncio.run(main())
