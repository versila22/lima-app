"""Reimbursement model — demandes de remboursement des membres."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime, ForeignKey, Index, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Statuts logiques (pas d'Enum SQL — String pour rester simple et migratable)
STATUS_AWAITING = "awaiting_confirmation"
STATUS_PENDING = "pending"
STATUS_PROCESSED = "processed"

FUNDS_OWN = "own"
FUNDS_ASSOCIATION = "association"


class Reimbursement(Base):
    __tablename__ = "reimbursements"
    __table_args__ = (
        Index("idx_reimbursements_created_at", "created_at"),
        Index("idx_reimbursements_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    purchase_description: Mapped[str] = mapped_column(Text, nullable=False)
    store: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    direct_expenses_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    funds_source: Mapped[str] = mapped_column(String(20), nullable=False, default=FUNDS_OWN)

    km_distance: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    km_rate_eur: Mapped[float] = mapped_column(Numeric(6, 3), nullable=False, default=0.32)
    km_amount_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    trip_description: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    toll_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default=STATUS_AWAITING)
    confirm_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    submitter_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    submitter = relationship("Member", foreign_keys=[submitter_member_id])
    attachments = relationship(
        "ReimbursementAttachment",
        back_populates="reimbursement",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ReimbursementAttachment(Base):
    __tablename__ = "reimbursement_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reimbursement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reimbursements.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(600), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(400), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    reimbursement = relationship("Reimbursement", back_populates="attachments")
