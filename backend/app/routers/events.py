"""Events router."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
import os
import uuid as _uuid
import boto3
from botocore.exceptions import ClientError
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.models.alignment import AlignmentAssignment, AlignmentEvent
from app.models.event import Event, EventPhoto
from app.models.member import Member
from app.models.show_plan import ShowPlan
from app.models.event import EventRegistration
from app.schemas.event import (
    CalendarImportReport,
    EventCreate,
    EventPhotoRead,
    EventRead,
    EventUpdate,
    GalleryPhotoRead,
    RegistrationRead,
)
from app.services import import_service
from app.services.storage import sign_photo_url
from app.utils.deps import get_current_user, require_admin

router = APIRouter(prefix="/events", tags=["events"])


class EventCastMember(BaseModel):
    member_id: UUID
    first_name: str
    last_name: str
    role: str


@router.get("/photos", response_model=List[GalleryPhotoRead])
async def list_gallery_photos(
    event_type: Optional[str] = Query(None),
    venue_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """Return all event photos with event info, most recent events first."""
    query = (
        select(
            EventPhoto.id,
            EventPhoto.event_id,
            Event.title.label("event_title"),
            Event.event_type.label("event_type"),
            Event.start_at.label("event_date"),
            EventPhoto.url,
            EventPhoto.caption,
            EventPhoto.created_at,
        )
        .join(Event, Event.id == EventPhoto.event_id)
        .order_by(Event.start_at.desc(), EventPhoto.created_at)
    )
    if event_type:
        query = query.where(Event.event_type == event_type)
    if venue_id:
        query = query.where(Event.venue_id == venue_id)
    result = await db.execute(query)
    return [
        GalleryPhotoRead(
            id=row.id,
            event_id=row.event_id,
            event_title=row.event_title,
            event_type=row.event_type,
            event_date=row.event_date,
            url=sign_photo_url(row.url),
            caption=row.caption,
            created_at=row.created_at,
        )
        for row in result.all()
    ]


@router.get("", response_model=List[EventRead])
async def list_events(
    season_id: Optional[UUID] = Query(None),
    event_type: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """
    List events with optional filters.

    Non-admin users cannot see events with visibility='admin'.
    Each event is augmented with cover_url = first photo URL by created_at.
    """
    # Subquery: first photo per event by created_at
    from sqlalchemy import func as sa_func
    first_photo = (
        select(
            EventPhoto.event_id,
            sa_func.min(EventPhoto.created_at).label("first_at"),
        )
        .group_by(EventPhoto.event_id)
        .subquery()
    )

    query = (
        select(Event, EventPhoto.url)
        .outerjoin(
            first_photo,
            first_photo.c.event_id == Event.id,
        )
        .outerjoin(
            EventPhoto,
            (EventPhoto.event_id == Event.id)
            & (EventPhoto.created_at == first_photo.c.first_at),
        )
    )
    if season_id:
        query = query.where(Event.season_id == season_id)
    if event_type:
        query = query.where(Event.event_type == event_type)
    if from_date:
        query = query.where(Event.start_at >= from_date)
    if to_date:
        query = query.where(Event.start_at <= to_date)
    if not current_user.is_admin:
        query = query.where(Event.visibility != "admin")

    query = query.order_by(Event.start_at)
    result = await db.execute(query)
    return [
        EventRead.model_validate(
            {
                **{c.name: getattr(event, c.name) for c in Event.__table__.columns},
                "cover_url": sign_photo_url(photo_url),
            },
        )
        for event, photo_url in result.all()
    ]


@router.get("/{event_id}", response_model=EventRead)
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Retrieve an event by ID."""
    result = await db.execute(
        select(Event, EventPhoto.url)
        .outerjoin(
            EventPhoto,
            EventPhoto.event_id == Event.id,
        )
        .where(Event.id == event_id)
        .order_by(EventPhoto.created_at.asc().nulls_last())
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    event, photo_url = row
    if event.visibility == "admin" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return EventRead.model_validate(
        {
            **{c.name: getattr(event, c.name) for c in Event.__table__.columns},
            "cover_url": sign_photo_url(photo_url),
        },
    )


@router.get("/{event_id}/cast", response_model=List[EventCastMember])
async def get_event_cast(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """Return the cast assignments for a given event."""
    event_result = await db.execute(select(Event.id).where(Event.id == event_id))
    if event_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    result = await db.execute(
        select(
            AlignmentAssignment.member_id,
            Member.first_name,
            Member.last_name,
            AlignmentAssignment.role,
        )
        .join(Member, Member.id == AlignmentAssignment.member_id)
        .where(AlignmentAssignment.event_id == event_id)
        .order_by(AlignmentAssignment.role, Member.last_name, Member.first_name)
    )
    return [
        EventCastMember(
            member_id=member_id,
            first_name=first_name,
            last_name=last_name,
            role=role,
        )
        for member_id, first_name, last_name, role in result.all()
    ]


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    data: EventCreate,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Create a new event (admin only)."""
    event = Event(**data.model_dump())
    db.add(event)
    await db.flush()
    await db.commit()
    await db.refresh(event)
    return event


@router.put("/{event_id}", response_model=EventRead)
async def update_event(
    event_id: UUID,
    data: EventUpdate,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Update an event (admin only)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    await db.flush()
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Delete an event (admin only)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    await db.execute(
        delete(AlignmentAssignment).where(AlignmentAssignment.event_id == event_id)
    )
    await db.execute(delete(AlignmentEvent).where(AlignmentEvent.event_id == event_id))
    await db.execute(delete(ShowPlan).where(ShowPlan.event_id == event_id))
    await db.delete(event)
    await db.flush()
    await db.commit()


@router.get("/{event_id}/photos", response_model=List[EventPhotoRead])
async def list_event_photos(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """List all photos for an event."""
    result = await db.execute(
        select(EventPhoto)
        .where(EventPhoto.event_id == event_id)
        .order_by(EventPhoto.created_at)
    )
    photos = result.scalars().all()
    return [
        EventPhotoRead(
            id=p.id,
            event_id=p.event_id,
            url=sign_photo_url(p.url),
            caption=p.caption,
            created_at=p.created_at,
        )
        for p in photos
    ]


@router.post("/{event_id}/photos", response_model=EventPhotoRead, status_code=201)
async def upload_event_photo(
    event_id: UUID,
    file: UploadFile = File(...),
    caption: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Upload a photo for an event to Cloudflare R2 (admin only)."""
    event_result = await db.execute(select(Event.id).where(Event.id == event_id))
    if event_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")

    if not settings.S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="Stockage S3 non configuré")

    ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
    photo_id = _uuid.uuid4()
    s3_key = f"event-photos/{photo_id}{ext}"

    s3_client = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name="auto",
    )

    file_bytes = await file.read()

    def _upload():
        s3_client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_bytes,
            ContentType=file.content_type,
        )

    try:
        await run_in_threadpool(_upload)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Erreur upload: {e}")

    photo_url = f"{settings.S3_PUBLIC_URL}/{s3_key}"
    photo = EventPhoto(
        id=photo_id,
        event_id=event_id,
        url=photo_url,
        s3_key=s3_key,
        caption=caption,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return EventPhotoRead(
        id=photo.id,
        event_id=photo.event_id,
        url=sign_photo_url(photo.url),
        caption=photo.caption,
        created_at=photo.created_at,
    )


@router.delete("/{event_id}/photos/{photo_id}", status_code=204)
async def delete_event_photo(
    event_id: UUID,
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Delete an event photo (admin only)."""
    result = await db.execute(
        select(EventPhoto).where(
            EventPhoto.id == photo_id,
            EventPhoto.event_id == event_id,
        )
    )
    photo = result.scalar_one_or_none()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo introuvable")

    if photo.s3_key and settings.S3_BUCKET_NAME:
        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            region_name="auto",
        )
        try:
            await run_in_threadpool(
                lambda: s3_client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=photo.s3_key)
            )
        except ClientError:
            pass  # best-effort R2 cleanup

    await db.delete(photo)
    await db.commit()


@router.get("/{event_id}/registrations", response_model=List[RegistrationRead])
async def list_registrations(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """List all members registered for an event."""
    result = await db.execute(
        select(
            EventRegistration.id,
            EventRegistration.member_id,
            Member.first_name,
            Member.last_name,
            EventRegistration.created_at,
        )
        .join(Member, Member.id == EventRegistration.member_id)
        .where(EventRegistration.event_id == event_id)
        .order_by(Member.last_name, Member.first_name)
    )
    return [
        RegistrationRead(
            id=r.id,
            member_id=r.member_id,
            first_name=r.first_name,
            last_name=r.last_name,
            created_at=r.created_at,
        )
        for r in result.all()
    ]


@router.post("/{event_id}/register", status_code=201)
async def register_for_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Register the current member for an event."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    TRAINING_TYPES = ("training_show", "training_leisure")
    if not event.allow_registration and event.event_type not in TRAINING_TYPES:
        raise HTTPException(status_code=400, detail="Les inscriptions ne sont pas ouvertes")

    existing = await db.execute(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.member_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Déjà inscrit")

    reg = EventRegistration(event_id=event_id, member_id=current_user.id)
    db.add(reg)
    await db.commit()
    return {"detail": "Inscription confirmée"}


@router.delete("/{event_id}/register", status_code=204)
async def unregister_from_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Unregister the current member from an event."""
    result = await db.execute(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.member_id == current_user.id,
        )
    )
    reg = result.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Inscription introuvable")
    await db.delete(reg)
    await db.commit()


@router.post("/import-calendar", response_model=CalendarImportReport)
async def import_calendar(
    season_id: UUID = Query(..., description="Saison cible"),
    file: UploadFile = File(..., description="Fichier Excel du calendrier"),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """
    Import events from an Excel calendar file (admin only).

    Detects event types from title keywords. Skips duplicate entries.
    """
    excel_bytes = await file.read()
    report = await import_service.import_excel_calendar(db, excel_bytes, season_id)
    return report
