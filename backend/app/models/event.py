"""Event model — événements du calendrier."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("idx_events_season", "season_id"),
        Index("idx_events_start", "start_at"),
        Index("idx_events_type", "event_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seasons.id", ondelete="CASCADE"),
        nullable=False,
    )
    venue_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("venues.id"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Types: match | cabaret | training_show | training_leisure | welsh | formation | ag | other
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # DB column is TIMESTAMPTZ — without timezone=True asyncpg rejects tz-aware writes.
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    is_away: Mapped[bool] = mapped_column(Boolean, default=False)
    away_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    away_opponent: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    match_report: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    facebook_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ticketing_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    allow_registration: Mapped[bool] = mapped_column(Boolean, default=False)

    # Visibility: all | match | cabaret | loisir | admin
    visibility: Mapped[str] = mapped_column(String(20), default="all")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )

    # Relationships
    season = relationship("Season", back_populates="events")
    venue = relationship("Venue", back_populates="events")
    alignment_events = relationship("AlignmentEvent", back_populates="event")
    alignment_assignments = relationship("AlignmentAssignment", back_populates="event")
    show_plans = relationship("ShowPlan", back_populates="event")
    registrations = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")
    photos = relationship("EventPhoto", back_populates="event", cascade="all, delete-orphan", order_by="EventPhoto.created_at")


class EventPhoto(Base):
    __tablename__ = "event_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    s3_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    caption: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    event = relationship("Event", back_populates="photos")


class EventRegistration(Base):
    __tablename__ = "event_registrations"
    __table_args__ = (
        Index("idx_event_registrations_event", "event_id"),
        Index("idx_event_registrations_member", "member_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    event = relationship("Event", back_populates="registrations")
    member = relationship("Member")
