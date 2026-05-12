"""Members router — admin management + CSV import."""

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent
from app.models.commission import Commission, MemberCommission
from app.models.event import Event, EventRegistration
from app.models.member import Member
from app.models.member_season import MemberSeason
from app.models.season import Season
from app.models.venue import Venue
from app.schemas.member import (
    MemberPlanning,
    PlanningEvent,
    ImportMemberReport,
    MemberCreate,
    MemberProfileRead,
    MemberRead,
    MemberRoleUpdate,
    MemberSummary,
    MemberUpdate,
    SeasonHistoryEntry,
)
from app.services import auth_service, import_service
from app.services.email_service import send_activation_email
from app.utils.deps import get_current_user, require_admin

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/uninvited")
async def list_uninvited(
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Admin-only: list active members who have never had a successful login event."""
    from app.models.activity_log import ActivityLog

    # Members who have at least one successful login in the activity log
    logged_in_subq = (
        select(ActivityLog.user_id)
        .where(ActivityLog.user_id.is_not(None))
        .where(ActivityLog.status_code < 400)
        .distinct()
    )

    result = await db.execute(
        select(Member.id, Member.first_name, Member.last_name, Member.email)
        .where(Member.is_active.is_(True))
        .where(Member.id.not_in(logged_in_subq))
        .order_by(Member.last_name, Member.first_name)
    )
    return [
        {"id": str(r.id), "first_name": r.first_name, "last_name": r.last_name, "email": r.email}
        for r in result.all()
    ]


async def _get_member_for_response(db: AsyncSession, member_id: UUID) -> Member:
    result = await db.execute(
        select(Member)
        .options(selectinload(Member.member_seasons).selectinload(MemberSeason.season))
        .where(Member.id == member_id)
    )
    return result.scalar_one()


async def _build_member_profile(db: AsyncSession, member_id: UUID) -> MemberProfileRead:
    member = await _get_member_for_response(db, member_id)

    current_season_result = await db.execute(
        select(Season).where(Season.is_current.is_(True)).limit(1)
    )
    current_season = current_season_result.scalar_one_or_none()

    current_membership = None
    if current_season is not None:
        current_membership = next(
            (ms for ms in member.member_seasons if ms.season_id == current_season.id),
            None,
        )

    commission_names: list[str] = []
    if current_season is not None:
        commissions_result = await db.execute(
            select(Commission.name)
            .join(MemberCommission, MemberCommission.commission_id == Commission.id)
            .where(
                MemberCommission.member_id == member_id,
                MemberCommission.season_id == current_season.id,
            )
            .order_by(Commission.name)
        )
        commission_names = list(commissions_result.scalars().all())

    base_payload = MemberRead.model_validate(member).model_dump()
    base_payload["member_seasons"] = [
        {
            **season_payload,
            "season_name": member_season.season.name if member_season.season else None,
        }
        for season_payload, member_season in zip(
            base_payload["member_seasons"], member.member_seasons
        )
    ]
    base_payload["player_status"] = (
        current_membership.player_status if current_membership else None
    )
    base_payload["asso_role"] = current_membership.asso_role if current_membership else None
    base_payload["commissions"] = commission_names
    base_payload["season_history"] = [
        SeasonHistoryEntry(
            season_id=member_season.season_id,
            season_name=(
                member_season.season.name if member_season.season else "Saison inconnue"
            ),
            player_status=member_season.player_status,
            asso_role=member_season.asso_role,
        ).model_dump()
        for member_season in sorted(
            member.member_seasons,
            key=lambda ms: (
                ms.season.start_date if ms.season else datetime.min.date(),
                ms.created_at,
            ),
            reverse=True,
        )
    ]

    return MemberProfileRead(**base_payload)


@router.get("", response_model=List[MemberSummary])
async def list_members(
    season_id: Optional[UUID] = Query(None, description="Filtrer par saison"),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """
    List members, optionally filtered by season or active status.

    Any authenticated user can access this endpoint.
    """
    effective_season_id = season_id
    if effective_season_id is None:
        current_season_result = await db.execute(
            select(Season).where(Season.is_current.is_(True)).limit(1)
        )
        current_season = current_season_result.scalar_one_or_none()
        effective_season_id = current_season.id if current_season else None

    query = select(Member).options(selectinload(Member.member_seasons))
    if is_active is not None:
        query = query.where(Member.is_active == is_active)
    if season_id is not None:
        query = query.join(MemberSeason).where(MemberSeason.season_id == season_id)
    result = await db.execute(query.order_by(Member.last_name, Member.first_name))
    members = result.scalars().unique().all()

    summaries = []
    for member in members:
        player_status = None
        if effective_season_id is not None:
            season_entry = next(
                (
                    ms
                    for ms in member.member_seasons
                    if ms.season_id == effective_season_id
                ),
                None,
            )
            if season_entry is not None:
                player_status = season_entry.player_status

        summaries.append(
            MemberSummary(
                id=member.id,
                email=member.email,
                first_name=member.first_name,
                last_name=member.last_name,
                app_role=member.app_role,
                is_active=member.is_active,
                player_status=player_status,
                photo_url=member.photo_url,
            )
        )
    return summaries


@router.get("/{member_id}/profile", response_model=MemberProfileRead)
async def get_member_profile(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Retrieve the enriched profile of a member.

    Any authenticated member can view any profile.
    """
    result = await db.execute(select(Member.id).where(Member.id == member_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    return await _build_member_profile(db, member_id)


@router.get("/{member_id}", response_model=MemberRead)
async def get_member(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """Retrieve full details of a member by ID."""
    result = await db.execute(
        select(Member)
        .options(selectinload(Member.member_seasons).selectinload(MemberSeason.season))
        .where(Member.id == member_id)
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    return member


@router.post("", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
async def create_member(
    data: MemberCreate,
    db: AsyncSession = Depends(get_db),
    admin: Member = Depends(require_admin),
):
    """
    Create a new member manually (admin only).

    Generates an activation token that should be sent by email.
    """
    # Check unique email
    existing = await db.execute(
        select(Member).where(Member.email == data.email.lower())
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un membre avec cet email existe déjà",
        )

    member = Member(
        email=data.email.lower(),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        date_of_birth=data.date_of_birth,
        address=data.address,
        postal_code=data.postal_code,
        city=data.city,
        app_role=data.app_role,
    )
    db.add(member)
    await db.flush()
    await db.commit()

    # Generate activation token
    token = await auth_service.generate_activation_token(db, member)
    try:
        await send_activation_email(
            to=member.email,
            first_name=member.first_name,
            token=token,
            base_url=settings.FRONTEND_URL,
        )
    except Exception as exc:
        logger.warning("Could not send activation email to %s: %s", member.email, exc)

    return await _get_member_for_response(db, member.id)


@router.put("/{member_id}", response_model=MemberRead)
async def update_member(
    member_id: UUID,
    data: MemberUpdate,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Update a member's information (admin only)."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    update_data = data.model_dump(exclude_unset=True)
    if "email" in update_data:
        update_data["email"] = update_data["email"].lower()
        # Check for duplicate email
        dup = await db.execute(
            select(Member).where(
                Member.email == update_data["email"],
                Member.id != member_id,
            )
        )
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cet email est déjà utilisé par un autre membre",
            )

    for field, value in update_data.items():
        setattr(member, field, value)
    await db.flush()
    await db.commit()
    return await _get_member_for_response(db, member.id)


import boto3
from botocore.exceptions import ClientError
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel as _BaseModel


class PhotoDataPayload(_BaseModel):
    data: str  # data:image/jpeg;base64,...


@router.post("/{member_id}/photo-data", status_code=status.HTTP_200_OK)
async def upload_member_photo_data(
    member_id: UUID,
    payload: PhotoDataPayload,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Store a base64-encoded profile photo (max ~300×300 JPEG sent by client)."""
    if not current_user.is_admin and current_user.id != member_id:
        raise HTTPException(status_code=403, detail="Accès réservé à votre profil")
    if not payload.data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Format invalide — data URI attendu")
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    member.photo_url = payload.data
    await db.commit()
    return {"photo_url": payload.data}


@router.post("/{member_id}/photo", status_code=status.HTTP_200_OK)
async def upload_member_photo(
    member_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Upload a profile photo for a member to Cloudflare R2. Admin or self."""
    if not current_user.is_admin and current_user.id != member_id:
        raise HTTPException(status_code=403, detail="Accès réservé à votre profil")

    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")

    import os
    ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
    filename = f"photos/{member_id}{ext}"
    
    if not settings.S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="Stockage S3 non configuré")

    s3_client = boto3.client(
        's3',
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name="auto"
    )

    file_bytes = await file.read()

    def s3_upload():
        s3_client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=filename,
            Body=file_bytes,
            ContentType=file.content_type
        )

    try:
        await run_in_threadpool(s3_upload)
    except ClientError as e:
        print(f"S3 Upload Error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'upload de l'image")

    photo_url = f"{settings.S3_PUBLIC_URL}/{filename}"
    member.photo_url = photo_url
    await db.commit()

    return {"photo_url": photo_url}


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_member(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Deactivate a member (soft-delete). Admin only."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    member.is_active = False
    await db.flush()
    await db.commit()


@router.patch("/{member_id}/reactivate", response_model=MemberRead)
async def reactivate_member(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Reactivate a previously deactivated member (admin only)."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    member.is_active = True
    await db.flush()
    await db.commit()
    return await _get_member_for_response(db, member.id)


@router.post("/{member_id}/resend-activation", status_code=status.HTTP_200_OK)
async def resend_activation(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Regenerate and (optionally) resend the activation email. Admin only."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if member.password_hash is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce membre a déjà activé son compte",
        )

    token = await auth_service.generate_activation_token(db, member)
    await send_activation_email(
        to=member.email,
        first_name=member.first_name,
        token=token,
        base_url=settings.FRONTEND_URL,
    )
    return {"detail": "Email d'activation envoyé", "token": token}


@router.put("/{member_id}/role", response_model=MemberRead)
async def update_member_role(
    member_id: UUID,
    data: MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Change a member's application role (admin only)."""
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    member.app_role = data.app_role
    await db.flush()
    await db.commit()
    return await _get_member_for_response(db, member.id)


@router.post("/import", response_model=ImportMemberReport)
async def import_members(
    season_id: UUID = Query(..., description="Saison cible"),
    adherents: UploadFile = File(..., description="CSV adhérents HelloAsso"),
    joueurs: UploadFile = File(..., description="CSV joueurs HelloAsso"),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """
    Import members from two HelloAsso CSV exports (admin only).

    - **adherents**: CSV export des adhérents (cotisation de base)
    - **joueurs**: CSV export des joueurs (cotisation joueur)

    Members are matched by email. Creates or updates records and member_seasons.
    """
    adherents_bytes = await adherents.read()
    joueurs_bytes = await joueurs.read()

    report = await import_service.import_csv_helloasso(
        db, adherents_bytes, joueurs_bytes, season_id
    )
    return report


async def _build_member_planning(db: AsyncSession, member_id: UUID) -> MemberPlanning:
    from datetime import timezone
    now = datetime.now(timezone.utc)
    # Event.start_at column is declared TIMESTAMP WITHOUT TIME ZONE in SQLAlchemy,
    # so asyncpg rejects tz-aware datetimes for filter parameters. Use naive UTC
    # for the SQL WHERE, keep aware UTC for Python comparisons (the rows returned
    # are aware because the underlying postgres column is timestamptz).
    three_months_ago_naive = (now - timedelta(days=90)).replace(tzinfo=None)

    try:
        align_stmt = (
            select(AlignmentAssignment, Alignment, Event)
            .join(Alignment, AlignmentAssignment.alignment_id == Alignment.id)
            .join(Event, AlignmentAssignment.event_id == Event.id)
            .where(AlignmentAssignment.member_id == member_id)
            .where(Event.start_at >= three_months_ago_naive)
            .order_by(Event.start_at.asc())
        )
        align_rows = (await db.execute(align_stmt)).all()

        # Registrations: pull the Event objects via join (no need to keep the registration row)
        reg_event_stmt = (
            select(Event)
            .join(EventRegistration, EventRegistration.event_id == Event.id)
            .where(EventRegistration.member_id == member_id)
            .where(Event.start_at >= three_months_ago_naive)
            .order_by(Event.start_at.asc())
        )
        reg_events = (await db.execute(reg_event_stmt)).scalars().all()

        venue_cache: dict[UUID, Optional[str]] = {}

        async def venue_name_for(event: Event) -> Optional[str]:
            if not event.venue_id:
                return None
            if event.venue_id not in venue_cache:
                venue = await db.get(Venue, event.venue_id)
                venue_cache[event.venue_id] = venue.name if venue else None
            return venue_cache[event.venue_id]

        upcoming: list[PlanningEvent] = []
        past: list[PlanningEvent] = []
        assigned_event_ids: set[UUID] = set()

        def _is_upcoming(start_at: datetime) -> bool:
            # Normalize both sides to naive (interpret naive db values as UTC)
            ref = start_at.replace(tzinfo=None) if start_at.tzinfo else start_at
            return ref >= now.replace(tzinfo=None)

        for assignment, alignment, event in align_rows:
            assigned_event_ids.add(event.id)
            pe = PlanningEvent(
                event_id=event.id,
                title=event.title,
                event_type=event.event_type,
                start_at=event.start_at,
                end_at=event.end_at,
                venue_name=await venue_name_for(event),
                source="alignment",
                role=assignment.role,
                alignment_name=alignment.name,
                alignment_status=alignment.status,
            )
            if _is_upcoming(event.start_at):
                upcoming.append(pe)
            else:
                past.append(pe)

        attendance_count = 0
        for event in reg_events:
            if event.id in assigned_event_ids:
                continue
            attendance_count += 1
            pe = PlanningEvent(
                event_id=event.id,
                title=event.title,
                event_type=event.event_type,
                start_at=event.start_at,
                end_at=event.end_at,
                venue_name=await venue_name_for(event),
                source="registration",
            )
            if _is_upcoming(event.start_at):
                upcoming.append(pe)
            else:
                past.append(pe)

        upcoming.sort(key=lambda e: e.start_at)
        past.sort(key=lambda e: e.start_at, reverse=True)

        return MemberPlanning(
            upcoming=upcoming,
            past=past,
            total_shows=len(align_rows),
            total_attendances=attendance_count,
        )
    except Exception:
        logger.exception("Failed to build planning for member %s", member_id)
        raise


@router.get("/me/planning", response_model=MemberPlanning)
async def get_my_planning(
    current_user: Member = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current member's planning: upcoming and past show assignments."""
    return await _build_member_planning(db, current_user.id)


@router.get("/{member_id}/planning", response_model=MemberPlanning)
async def get_member_planning(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """Return a member's planning: upcoming and past show assignments."""
    return await _build_member_planning(db, member_id)


@router.get("/me/stats")
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Return show participation stats for the current member (all time)."""
    return await _build_member_stats(db, current_user.id)


@router.get("/{member_id}/stats")
async def get_member_stats(
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """Return show participation stats for a member (all time)."""
    return await _build_member_stats(db, member_id)


async def _build_member_stats(db: AsyncSession, member_id: UUID) -> dict:
    stmt = (
        select(AlignmentAssignment.role, Event.event_type)
        .join(Event, AlignmentAssignment.event_id == Event.id)
        .join(Alignment, AlignmentAssignment.alignment_id == Alignment.id)
        .where(AlignmentAssignment.member_id == member_id)
        .where(Alignment.status == "published")
    )
    result = await db.execute(stmt)
    rows = result.all()

    by_type: dict[str, int] = {}
    by_role: dict[str, int] = {}
    for role, event_type in rows:
        by_type[event_type] = by_type.get(event_type, 0) + 1
        by_role[role] = by_role.get(role, 0) + 1

    return {
        "total_shows": len(rows),
        "by_type": by_type,
        "by_role": by_role,
    }
