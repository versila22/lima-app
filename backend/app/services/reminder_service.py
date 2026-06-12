"""Reminder emails for assigned events: J-1 (24h) and J-7 windows, idempotent."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.alignment import Alignment, AlignmentAssignment
from app.models.email_log import EmailLog
from app.models.event import Event
from app.models.member import Member
from app.models.venue import Venue
from app.services.email_service import send_event_reminder_email

logger = logging.getLogger(__name__)

ReminderKind = Literal["J1", "J7"]

WINDOWS: dict[ReminderKind, tuple[timedelta, timedelta]] = {
    "J1": (timedelta(hours=0), timedelta(hours=24)),
    "J7": (timedelta(days=6), timedelta(days=7)),
}

WHEN_LABELS: dict[ReminderKind, str] = {
    "J1": "demain",
    "J7": "dans une semaine",
}


@dataclass(frozen=True)
class ReminderRecipient:
    email: str
    first_name: str
    event_title: str
    event_date: str
    role: str
    venue_name: str | None
    event_id: str
    member_id: str


def _format_event_date(start_at: datetime) -> str:
    return start_at.strftime("%d/%m/%Y à %H:%M")


def build_reminders_query(window_start: datetime, window_end: datetime) -> Select:
    return (
        select(
            Member.id,
            Member.email,
            Member.first_name,
            Event.id,
            Event.title,
            Event.start_at,
            AlignmentAssignment.role,
            Venue.name,
        )
        .join(AlignmentAssignment, AlignmentAssignment.member_id == Member.id)
        .join(Event, Event.id == AlignmentAssignment.event_id)
        .join(Alignment, Alignment.id == AlignmentAssignment.alignment_id)
        .outerjoin(Venue, Venue.id == Event.venue_id)
        .where(Member.is_active.is_(True))
        .where(Member.email.is_not(None))
        .where(Member.email_reminders_enabled.is_(True))
        .where(Alignment.status == "published")
        .where(Event.start_at >= window_start)
        .where(Event.start_at <= window_end)
        .order_by(Event.start_at.asc(), Member.last_name.asc(), Member.first_name.asc())
    )


async def get_due_reminders(
    db: AsyncSession,
    kind: ReminderKind = "J1",
    now: datetime | None = None,
) -> list[ReminderRecipient]:
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    offset_start, offset_end = WINDOWS[kind]
    window_start = current_time + offset_start
    window_end = current_time + offset_end

    rows = (await db.execute(build_reminders_query(window_start, window_end))).all()

    # Already-sent (member, event) pairs for this kind
    sent_rows = (
        await db.execute(
            select(EmailLog.member_id, EmailLog.event_id).where(EmailLog.kind == kind)
        )
    ).all()
    already_sent = {(str(m), str(e)) for m, e in sent_rows}

    reminders: list[ReminderRecipient] = []
    seen: set[tuple[str, str]] = set()

    for member_id, email, first_name, event_id, title, start_at, role, venue_name in rows:
        if not email:
            continue
        key = (str(member_id), str(event_id))
        if key in seen or key in already_sent:
            continue
        seen.add(key)
        reminders.append(
            ReminderRecipient(
                email=email,
                first_name=first_name,
                event_title=title,
                event_date=_format_event_date(start_at),
                role=role,
                venue_name=venue_name,
                event_id=str(event_id),
                member_id=str(member_id),
            )
        )
    return reminders


async def send_due_reminders(
    db: AsyncSession,
    kind: ReminderKind = "J1",
    now: datetime | None = None,
    base_url: str | None = None,
) -> tuple[int, int]:
    if not settings.SMTP_HOST:
        # Sans SMTP, send_email no-op : ne PAS marquer les rappels comme envoyés
        # dans email_logs, sinon ils seraient définitivement supprimés.
        logger.warning("SMTP non configuré : run de rappels %s ignoré sans traçage", kind)
        return 0, 0

    reminders = await get_due_reminders(db=db, kind=kind, now=now)
    frontend_url = (base_url or settings.FRONTEND_URL).rstrip("/")

    sent = 0
    failed = 0
    for reminder in reminders:
        try:
            await send_event_reminder_email(
                to=reminder.email,
                first_name=reminder.first_name,
                event_title=reminder.event_title,
                event_date=reminder.event_date,
                role=reminder.role,
                venue_name=reminder.venue_name,
                base_url=frontend_url,
                when_label=WHEN_LABELS[kind],
            )
            db.add(
                EmailLog(
                    member_id=UUID(reminder.member_id),
                    event_id=UUID(reminder.event_id),
                    kind=kind,
                )
            )
            sent += 1
            logger.info(
                "Reminder %s sent to %s for %s (%s)",
                kind, reminder.email, reminder.event_title, reminder.role,
            )
        except Exception:
            failed += 1
            logger.exception(
                "Reminder %s failed for %s on event %s",
                kind, reminder.email, reminder.event_id,
            )
    await db.commit()
    logger.info("Reminder run %s complete: %s sent, %s failed", kind, sent, failed)
    return sent, failed
