"""Publication digests: one email per member with all their assignments + ICS."""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alignment import Alignment, AlignmentAssignment
from app.models.email_log import EmailLog
from app.models.event import Event
from app.models.member import Member
from app.models.venue import Venue
from app.services.email_service import ROLE_LABELS, send_alignment_digest_email
from app.utils.ical import ICalEvent, render_calendar

logger = logging.getLogger(__name__)


@dataclass
class DigestEvent:
    event_id: UUID
    title: str
    start_at: datetime
    end_at: datetime | None
    role: str
    venue_name: str | None

    @property
    def date_str(self) -> str:
        return self.start_at.strftime("%d/%m/%Y à %H:%M")


@dataclass
class MemberDigest:
    member_id: UUID
    email: str
    first_name: str
    events: list[DigestEvent] = field(default_factory=list)


async def build_publish_digests(
    db: AsyncSession, alignment_id: UUID
) -> list[MemberDigest]:
    """Group all assignments of an alignment by member."""
    rows = (
        await db.execute(
            select(
                Member.id,
                Member.email,
                Member.first_name,
                Event.id,
                Event.title,
                Event.start_at,
                Event.end_at,
                AlignmentAssignment.role,
                Venue.name,
            )
            .join(AlignmentAssignment, AlignmentAssignment.member_id == Member.id)
            .join(Event, Event.id == AlignmentAssignment.event_id)
            .outerjoin(Venue, Venue.id == Event.venue_id)
            .where(AlignmentAssignment.alignment_id == alignment_id)
            .where(Member.is_active.is_(True))
            .where(Member.email.is_not(None))
            .order_by(Event.start_at.asc())
        )
    ).all()

    digests: dict[UUID, MemberDigest] = {}
    for member_id, email, first_name, event_id, title, start_at, end_at, role, venue_name in rows:
        digest = digests.setdefault(
            member_id,
            MemberDigest(member_id=member_id, email=email, first_name=first_name),
        )
        digest.events.append(
            DigestEvent(
                event_id=event_id,
                title=title,
                start_at=start_at,
                end_at=end_at,
                role=role,
                venue_name=venue_name,
            )
        )
    return list(digests.values())


def build_ics_for_digest(digest: MemberDigest, alignment_name: str) -> str:
    events = [
        ICalEvent(
            uid=f"{e.event_id}-alignment@lima",
            start=e.start_at,
            end=e.end_at,
            summary=f"[{ROLE_LABELS.get(e.role, e.role)}] {e.title}",
            location=e.venue_name,
            description=alignment_name,
        )
        for e in digest.events
    ]
    return render_calendar(name=f"LIMA — {alignment_name}", events=events)


async def send_publish_digests(
    db: AsyncSession,
    alignment: Alignment,
    base_url: str,
) -> int:
    """Send one digest email per assigned member. Returns the number sent."""
    digests = await build_publish_digests(db, alignment.id)
    sent = 0
    for digest in digests:
        try:
            await send_alignment_digest_email(
                to=digest.email,
                first_name=digest.first_name,
                alignment_name=alignment.name,
                events=[
                    {
                        "title": e.title,
                        "date_str": e.date_str,
                        "role": e.role,
                        "venue_name": e.venue_name,
                    }
                    for e in digest.events
                ],
                base_url=base_url,
                ics_content=build_ics_for_digest(digest, alignment.name),
            )
            db.add(
                EmailLog(
                    member_id=digest.member_id,
                    alignment_id=alignment.id,
                    kind="digest",
                )
            )
            sent += 1
        except Exception:
            logger.exception("Digest failed for %s", digest.email)
    await db.commit()
    logger.info("Publish digests: %s sent for alignment %s", sent, alignment.id)
    return sent
