"""Cast service — édition du casting d'un événement via un alignement auto masqué."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent
from app.models.event import Event
from app.models.member import Member
from app.models.season import Season

logger = logging.getLogger(__name__)

AUTO_ALIGNMENT_NAME = "Casting"


async def get_or_create_auto_alignment(db: AsyncSession, season_id: UUID) -> Alignment:
    """Renvoie l'alignement auto (masqué) de la saison, le crée au besoin.

    Statut `published` : c'est ce qui permet aux rappels J-7/J-1
    (reminder_service, filtré sur status == 'published') de partir pour les
    membres castés. `is_auto=True` l'exclut de la page Grilles.
    """
    result = await db.execute(
        select(Alignment).where(
            Alignment.season_id == season_id,
            Alignment.is_auto.is_(True),
        )
    )
    alignment = result.scalar_one_or_none()
    if alignment is not None:
        return alignment

    season_result = await db.execute(select(Season).where(Season.id == season_id))
    season = season_result.scalar_one_or_none()
    if season is None:
        raise ValueError("Saison introuvable")

    alignment = Alignment(
        season_id=season_id,
        name=AUTO_ALIGNMENT_NAME,
        start_date=season.start_date,
        end_date=season.end_date,
        status="published",
        is_auto=True,
    )
    db.add(alignment)
    await db.flush()
    return alignment


async def set_event_cast_member(
    db: AsyncSession,
    event_id: UUID,
    member_id: UUID,
    role: str,
) -> AlignmentAssignment:
    """Ajoute (ou recase) un membre dans le casting d'un événement.

    Résout l'événement → sa saison → l'alignement auto, garantit le lien
    AlignmentEvent, puis upsert l'affectation (alignment_auto, event, member).
    Lève ValueError si l'événement ou le membre est introuvable.
    """
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if event is None:
        raise ValueError("Événement introuvable")

    member_result = await db.execute(select(Member).where(Member.id == member_id))
    if member_result.scalar_one_or_none() is None:
        raise ValueError("Membre introuvable")

    alignment = await get_or_create_auto_alignment(db, event.season_id)

    ae_result = await db.execute(
        select(AlignmentEvent).where(
            AlignmentEvent.alignment_id == alignment.id,
            AlignmentEvent.event_id == event_id,
        )
    )
    if ae_result.scalar_one_or_none() is None:
        db.add(
            AlignmentEvent(
                alignment_id=alignment.id, event_id=event_id, sort_order=0
            )
        )
        await db.flush()

    existing_result = await db.execute(
        select(AlignmentAssignment).where(
            AlignmentAssignment.alignment_id == alignment.id,
            AlignmentAssignment.event_id == event_id,
            AlignmentAssignment.member_id == member_id,
        )
    )
    assignment = existing_result.scalar_one_or_none()
    if assignment is not None:
        assignment.role = role
    else:
        assignment = AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=event_id,
            member_id=member_id,
            role=role,
        )
        db.add(assignment)

    await db.flush()
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def remove_event_cast_member(
    db: AsyncSession,
    event_id: UUID,
    member_id: UUID,
) -> bool:
    """Retire un membre du casting (affectation dans l'alignement auto).

    Renvoie False si l'événement, l'alignement auto ou l'affectation n'existe pas.
    """
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if event is None:
        return False

    align_result = await db.execute(
        select(Alignment).where(
            Alignment.season_id == event.season_id,
            Alignment.is_auto.is_(True),
        )
    )
    alignment = align_result.scalar_one_or_none()
    if alignment is None:
        return False

    assign_result = await db.execute(
        select(AlignmentAssignment).where(
            AlignmentAssignment.alignment_id == alignment.id,
            AlignmentAssignment.event_id == event_id,
            AlignmentAssignment.member_id == member_id,
        )
    )
    assignment = assign_result.scalar_one_or_none()
    if assignment is None:
        return False

    await db.delete(assignment)
    await db.flush()
    await db.commit()
    return True
