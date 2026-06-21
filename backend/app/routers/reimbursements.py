"""Reimbursement router — soumission membre, relecture 5 min, suivi admin."""

import logging
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from uuid import UUID

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Request, UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.limiting import limiter
from app.models.member import Member
from app.models.reimbursement import (
    Reimbursement, ReimbursementAttachment,
    STATUS_AWAITING, STATUS_PENDING, STATUS_PROCESSED, FUNDS_OWN, FUNDS_ASSOCIATION,
)
from app.schemas.reimbursement import ReimbursementRead, build_read
from app.services import email_service, reimbursement_service
from app.utils.deps import get_current_user, require_admin

logger = logging.getLogger(__name__)

KM_RATE_EUR = Decimal("0.32")


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_amounts(
    direct_expenses: Decimal, km_distance: Decimal, toll: Decimal
) -> tuple[Decimal, Decimal]:
    """Recalcule serveur : (montant km, total). Jamais le front."""
    km_amount = _round2(km_distance * KM_RATE_EUR)
    total = _round2(direct_expenses + km_amount + toll)
    return km_amount, total


router = APIRouter(prefix="/reimbursements", tags=["reimbursements"])

CONFIRM_WINDOW = timedelta(minutes=5)
ALLOWED_CONTENT = ("image/", "application/pdf")
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES = 6


def _validate_amounts(direct, km, toll):
    if direct < 0 or km < 0 or toll < 0:
        raise HTTPException(422, "Les montants ne peuvent pas être négatifs")
    if direct == 0 and km == 0 and toll == 0:
        raise HTTPException(422, "Indique au moins une dépense, des km ou un péage")


async def _validate_files(files: List[UploadFile]):
    if len(files) > MAX_FILES:
        raise HTTPException(422, f"Maximum {MAX_FILES} fichiers")
    for f in files:
        if not f.filename:
            continue
        if not (f.content_type or "").startswith(ALLOWED_CONTENT):
            raise HTTPException(422, "Fichiers acceptés : images et PDF uniquement")


async def _load(db, reimbursement_id) -> Reimbursement:
    result = await db.execute(
        select(Reimbursement).options(selectinload(Reimbursement.attachments))
        .where(Reimbursement.id == reimbursement_id)
    )
    r = result.scalar_one_or_none()
    if r is None:
        raise HTTPException(404, "Demande introuvable")
    return r


@router.post("", response_model=ReimbursementRead, status_code=201)
@limiter.limit("10/minute")
async def submit(
    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    purchase_description: str = Form(...),
    store: str = Form(""),
    email: str = Form(...),
    direct_expenses_eur: Decimal = Form(Decimal("0")),
    funds_source: str = Form(FUNDS_OWN),
    km_distance: Decimal = Form(Decimal("0")),
    trip_description: str = Form(""),
    toll_eur: Decimal = Form(Decimal("0")),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    if funds_source not in (FUNDS_OWN, FUNDS_ASSOCIATION):
        raise HTTPException(422, "funds_source invalide")
    _validate_amounts(direct_expenses_eur, km_distance, toll_eur)
    real_files = [f for f in files if f and f.filename]
    await _validate_files(real_files)

    km_amount, total = compute_amounts(direct_expenses_eur, km_distance, toll_eur)
    r = Reimbursement(
        first_name=first_name.strip(), last_name=last_name.strip(),
        purchase_description=purchase_description.strip(), store=store.strip() or None,
        email=email.strip(), direct_expenses_eur=direct_expenses_eur, funds_source=funds_source,
        km_distance=km_distance, km_rate_eur=KM_RATE_EUR, km_amount_eur=km_amount,
        trip_description=trip_description.strip() or None, toll_eur=toll_eur, total_eur=total,
        status=STATUS_AWAITING, confirm_deadline=datetime.now(timezone.utc) + CONFIRM_WINDOW,
        submitter_member_id=current_user.id,
    )
    db.add(r)
    await db.flush()
    new_atts = await reimbursement_service.upload_files(r.id, real_files)
    for a in new_atts:
        db.add(a)
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])

    try:
        app_url = (settings.FRONTEND_URL or "").rstrip("/") + "/remboursement"
        await email_service.send_reimbursement_confirmation(
            r.email, reimbursement_service._recap_ctx(r), app_url
        )
    except Exception:
        logger.exception("Email de confirmation remboursement échoué")
    return build_read(r)


@router.get("/mine", response_model=Optional[ReimbursementRead])
async def my_pending(
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    result = await db.execute(
        select(Reimbursement).options(selectinload(Reimbursement.attachments))
        .where(Reimbursement.submitter_member_id == current_user.id,
               Reimbursement.status == STATUS_AWAITING)
        .order_by(Reimbursement.created_at.desc()).limit(1)
    )
    r = result.scalar_one_or_none()
    return build_read(r) if r else None


@router.patch("/{reimbursement_id}", response_model=ReimbursementRead)
async def adjust(
    reimbursement_id: UUID,
    first_name: str = Form(...),
    last_name: str = Form(...),
    purchase_description: str = Form(...),
    store: str = Form(""),
    email: str = Form(...),
    direct_expenses_eur: Decimal = Form(Decimal("0")),
    funds_source: str = Form(FUNDS_OWN),
    km_distance: Decimal = Form(Decimal("0")),
    trip_description: str = Form(""),
    toll_eur: Decimal = Form(Decimal("0")),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    r = await _load(db, reimbursement_id)
    if r.submitter_member_id != current_user.id:
        raise HTTPException(403, "Ce n'est pas ta demande")
    if r.status != STATUS_AWAITING:
        raise HTTPException(409, "Demande déjà envoyée au trésorier, ajustement impossible")
    if funds_source not in (FUNDS_OWN, FUNDS_ASSOCIATION):
        raise HTTPException(422, "funds_source invalide")
    _validate_amounts(direct_expenses_eur, km_distance, toll_eur)
    real_files = [f for f in files if f and f.filename]
    await _validate_files(real_files)

    km_amount, total = compute_amounts(direct_expenses_eur, km_distance, toll_eur)
    r.first_name, r.last_name = first_name.strip(), last_name.strip()
    r.purchase_description, r.store = purchase_description.strip(), store.strip() or None
    r.email, r.funds_source = email.strip(), funds_source
    r.direct_expenses_eur, r.km_distance, r.toll_eur = direct_expenses_eur, km_distance, toll_eur
    r.km_amount_eur, r.total_eur = km_amount, total
    r.trip_description = trip_description.strip() or None
    r.confirm_deadline = datetime.now(timezone.utc) + CONFIRM_WINDOW  # le timer repart
    if real_files:
        new_atts = await reimbursement_service.upload_files(r.id, real_files)
        for a in new_atts:
            db.add(a)
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])
    return build_read(r)


@router.post("/{reimbursement_id}/confirm", response_model=ReimbursementRead)
async def confirm_now(
    reimbursement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    r = await _load(db, reimbursement_id)
    if r.submitter_member_id != current_user.id:
        raise HTTPException(403, "Ce n'est pas ta demande")
    await reimbursement_service.finalize_reimbursement(db, r)
    await db.refresh(r, attribute_names=["attachments"])
    return build_read(r)


@router.delete("/{reimbursement_id}/attachments/{att_id}", status_code=204)
async def remove_attachment(
    reimbursement_id: UUID, att_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    r = await _load(db, reimbursement_id)
    is_owner = r.submitter_member_id == current_user.id and r.status == STATUS_AWAITING
    if not (is_owner or current_user.app_role == "admin"):
        raise HTTPException(403, "Non autorisé")
    att = next((a for a in r.attachments if a.id == att_id), None)
    if att is None:
        raise HTTPException(404, "Pièce jointe introuvable")
    await reimbursement_service.delete_r2_object(att.s3_key)
    await db.delete(att)
    await db.commit()


@router.get("", response_model=List[ReimbursementRead])
async def list_all(
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    result = await db.execute(
        select(Reimbursement).options(selectinload(Reimbursement.attachments))
        .order_by(Reimbursement.created_at.desc()).limit(500)
    )
    return [build_read(r) for r in result.scalars().all()]


@router.patch("/{reimbursement_id}/status", response_model=ReimbursementRead)
async def set_status(
    reimbursement_id: UUID,
    status: str = Form(...),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    if status not in (STATUS_PENDING, STATUS_PROCESSED):
        raise HTTPException(422, "Statut invalide")
    r = await _load(db, reimbursement_id)
    r.status = status
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])
    return build_read(r)


@router.delete("/{reimbursement_id}", status_code=204)
async def delete_reimbursement(
    reimbursement_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    r = await _load(db, reimbursement_id)
    for a in r.attachments:
        await reimbursement_service.delete_r2_object(a.s3_key)
    await db.delete(r)
    await db.commit()
