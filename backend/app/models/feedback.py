"""Feedback model — bug reports and feature suggestions from members."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Feedback(Base):
    __tablename__ = "feedbacks"
    __table_args__ = (
        Index("idx_feedbacks_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Free text — bug report or feature suggestion
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional display name typed by the user (may be empty even when logged in)
    reporter_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # If the request had an Authorization header, we link the member for context.
    reporter_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("members.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    reporter = relationship("Member", foreign_keys=[reporter_member_id])
