"""Schémas Pydantic des demandes de remboursement."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.services.storage import sign_photo_url


class ReimbursementAttachmentRead(BaseModel):
    id: UUID
    url: str
    filename: str
    content_type: str


class ReimbursementRead(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    purchase_description: str
    store: str | None
    email: str
    direct_expenses_eur: float
    funds_source: str
    km_distance: float
    km_rate_eur: float
    km_amount_eur: float
    trip_description: str | None
    toll_eur: float
    total_eur: float
    status: str
    confirm_deadline: datetime | None
    finalized_at: datetime | None
    created_at: datetime
    attachments: list[ReimbursementAttachmentRead]


def build_read(r) -> ReimbursementRead:
    return ReimbursementRead(
        id=r.id, first_name=r.first_name, last_name=r.last_name,
        purchase_description=r.purchase_description, store=r.store, email=r.email,
        direct_expenses_eur=float(r.direct_expenses_eur), funds_source=r.funds_source,
        km_distance=float(r.km_distance), km_rate_eur=float(r.km_rate_eur),
        km_amount_eur=float(r.km_amount_eur), trip_description=r.trip_description,
        toll_eur=float(r.toll_eur), total_eur=float(r.total_eur),
        status=r.status, confirm_deadline=r.confirm_deadline,
        finalized_at=r.finalized_at, created_at=r.created_at,
        attachments=[
            ReimbursementAttachmentRead(
                id=a.id, url=sign_photo_url(a.url) or a.url,
                filename=a.filename, content_type=a.content_type,
            )
            for a in r.attachments
        ],
    )
