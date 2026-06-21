"""Logique métier remboursement : upload R2, finalisation, balayage."""

import logging
import os
import uuid as _uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.app_setting import AppSetting
from app.models.reimbursement import (
    Reimbursement, ReimbursementAttachment, STATUS_AWAITING, STATUS_PENDING,
)
from app.services import email_service

logger = logging.getLogger(__name__)

MAX_ATTACH_EMAIL_BYTES = 8 * 1024 * 1024  # au-delà : lien plutôt que PJ


def _s3():
    return boto3.client(
        "s3", endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY, region_name="auto",
    )


async def upload_files(reimbursement_id, files: list[UploadFile]) -> list[ReimbursementAttachment]:
    out: list[ReimbursementAttachment] = []
    if not settings.S3_BUCKET_NAME:
        logger.warning("S3 non configuré : pièces jointes ignorées")
        return out
    client = _s3()
    for f in files:
        ext = os.path.splitext(f.filename or "fichier")[1] or ".bin"
        att_id = _uuid.uuid4()
        key = f"reimbursements/{reimbursement_id}/{att_id}{ext}"
        blob = await f.read()
        ctype = f.content_type or "application/octet-stream"

        def _put():
            client.put_object(Bucket=settings.S3_BUCKET_NAME, Key=key, Body=blob, ContentType=ctype)

        try:
            await run_in_threadpool(_put)
        except ClientError as e:
            logger.exception("Upload R2 échoué (%s): %s", key, e)
            continue
        out.append(ReimbursementAttachment(
            id=att_id, reimbursement_id=reimbursement_id,
            url=f"{settings.S3_PUBLIC_URL}/{key}", s3_key=key,
            filename=f.filename or f"fichier{ext}", content_type=ctype,
        ))
    return out


async def fetch_attachment_blobs(attachments) -> list[tuple[str, bytes, str]]:
    """Relit les fichiers depuis R2 pour les joindre au mail trésorier."""
    if not settings.S3_BUCKET_NAME:
        return []
    client = _s3()
    blobs: list[tuple[str, bytes, str]] = []
    for a in attachments:
        def _get():
            return client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=a.s3_key)["Body"].read()
        try:
            data = await run_in_threadpool(_get)
        except ClientError as e:
            logger.warning("Lecture R2 échouée (%s): %s", a.s3_key, e)
            continue
        if len(data) <= MAX_ATTACH_EMAIL_BYTES:
            blobs.append((a.filename, data, a.content_type))
    return blobs


async def delete_r2_object(s3_key: str) -> None:
    if not settings.S3_BUCKET_NAME:
        return
    client = _s3()
    def _del():
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    try:
        await run_in_threadpool(_del)
    except ClientError as e:
        logger.warning("Suppression R2 échouée (%s): %s", s3_key, e)


async def load_treasurer_emails(db: AsyncSession) -> list[str]:
    result = await db.execute(select(AppSetting).where(AppSetting.key == "association"))
    setting = result.scalar_one_or_none()
    raw = ""
    if setting and isinstance(setting.data, dict):
        raw = setting.data.get("treasurer_emails", "")
    if not raw:
        raw = "maraisvincent@hotmail.fr"
    return [e.strip() for e in raw.split(",") if e.strip()]


def _recap_ctx(r: Reimbursement) -> dict:
    return {
        "first_name": r.first_name, "last_name": r.last_name, "email": r.email,
        "purchase_description": r.purchase_description, "store": r.store,
        "direct_expenses": float(r.direct_expenses_eur), "km_distance": float(r.km_distance),
        "km_amount": float(r.km_amount_eur), "toll": float(r.toll_eur),
        "total": float(r.total_eur), "funds_source": r.funds_source,
    }


async def finalize_reimbursement(db: AsyncSession, r: Reimbursement) -> None:
    """Passe pending + notifie le trésorier. Idempotent."""
    if r.status != STATUS_AWAITING:
        return
    r.status = STATUS_PENDING
    r.confirm_deadline = None
    r.finalized_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])
    try:
        emails = await load_treasurer_emails(db)
        blobs = await fetch_attachment_blobs(r.attachments)
        await email_service.send_reimbursement_notification(emails, _recap_ctx(r), blobs)
    except Exception:
        logger.exception("Notification trésorier échouée pour %s", r.id)


async def finalize_due_confirmations(db: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Reimbursement)
        .options(selectinload(Reimbursement.attachments))
        .where(Reimbursement.status == STATUS_AWAITING, Reimbursement.confirm_deadline <= now)
    )
    due = result.scalars().all()
    for r in due:
        await finalize_reimbursement(db, r)
    return len(due)
