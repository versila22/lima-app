"""Feedback router — anyone authenticated can post; admins can list."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.limiting import limiter
from app.models.feedback import Feedback
from app.models.member import Member
from app.schemas.feedback import FeedbackCreate, FeedbackRead
from app.utils.deps import get_current_user_optional, require_admin

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackRead, status_code=201)
@limiter.limit("10/minute")
async def submit_feedback(
    request: Request,
    payload: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional),
):
    """Submit a bug report or feature request.

    Open to authenticated members and guests. Rate-limited to prevent spam.
    """
    fb = Feedback(
        body=payload.body.strip(),
        reporter_name=(payload.reporter_name or "").strip() or None,
        reporter_member_id=current_user.id if current_user else None,
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return FeedbackRead(
        id=fb.id,
        body=fb.body,
        reporter_name=fb.reporter_name,
        reporter_member_id=fb.reporter_member_id,
        reporter_first_name=current_user.first_name if current_user else None,
        reporter_last_name=current_user.last_name if current_user else None,
        created_at=fb.created_at,
    )


@router.get("", response_model=List[FeedbackRead])
async def list_feedback(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """List submitted feedback (admin only, most recent first)."""
    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.reporter))
        .order_by(Feedback.created_at.desc())
        .limit(limit)
    )
    out: list[FeedbackRead] = []
    for fb in result.scalars().all():
        out.append(
            FeedbackRead(
                id=fb.id,
                body=fb.body,
                reporter_name=fb.reporter_name,
                reporter_member_id=fb.reporter_member_id,
                reporter_first_name=fb.reporter.first_name if fb.reporter else None,
                reporter_last_name=fb.reporter.last_name if fb.reporter else None,
                created_at=fb.created_at,
            )
        )
    return out


@router.delete("/{feedback_id}", status_code=204)
async def delete_feedback(
    feedback_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Delete a feedback entry (admin only — after reviewing)."""
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    fb = result.scalar_one_or_none()
    if fb is None:
        raise HTTPException(status_code=404, detail="Feedback introuvable")
    await db.delete(fb)
    await db.commit()
