"""Email send log — idempotence for reminders and digests."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EmailLog(Base):
    __tablename__ = "email_logs"
    __table_args__ = (
        # Unique pour empêcher un double envoi de rappel (instances concurrentes).
        # Les digests ont event_id NULL : non contraints (NULLs distincts en Postgres).
        UniqueConstraint(
            "member_id", "event_id", "kind", name="uq_email_logs_member_event_kind"
        ),
        Index("ix_email_logs_sent_at", "sent_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False
    )
    # NULL pour un digest (lié à une grille, pas à un événement)
    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=True
    )
    alignment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("alignments.id", ondelete="CASCADE"), nullable=True
    )
    # "digest" | "J1" | "J7"
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
