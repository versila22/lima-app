"""Admin router for activity monitoring."""

from datetime import UTC, date, datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Float, and_, case, cast, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.member import Member
from app.schemas.activity import (
    ActivityLogRead,
    ActivityStatsResponse,
    DailyActiveUserStat,
    EndpointStat,
    LoginAttemptGroup,
    LoginAttemptRead,
    LoginAttemptsResponse,
)
from app.utils.deps import require_admin

router = APIRouter(tags=["admin"])


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_day(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


@router.get("/activity/recent", response_model=List[ActivityLogRead])
async def get_recent_activity(
    limit: int = Query(50, ge=1, le=200),
    user_id: Optional[UUID] = Query(None),
    path_prefix: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Return recent activity logs with optional filters."""
    query = select(ActivityLog).options(selectinload(ActivityLog.user))

    if user_id is not None:
        query = query.where(ActivityLog.user_id == user_id)
    if path_prefix:
        query = query.where(ActivityLog.path.like(f"{path_prefix}%"))

    result = await db.execute(
        query.order_by(ActivityLog.created_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/activity/stats", response_model=ActivityStatsResponse)
async def get_activity_stats(
    days: int = Query(7, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Return aggregate activity statistics for the given period."""
    since = _utcnow() - timedelta(days=days)
    base_filter = ActivityLog.created_at >= since

    total_requests = await db.scalar(
        select(func.count(ActivityLog.id)).where(base_filter)
    )
    unique_users = await db.scalar(
        select(func.count(distinct(ActivityLog.user_id))).where(
            base_filter,
            ActivityLog.user_id.is_not(None),
        )
    )
    avg_response_time_ms = await db.scalar(
        select(func.avg(cast(ActivityLog.duration_ms, Float))).where(base_filter)
    )

    top_endpoints_result = await db.execute(
        select(ActivityLog.path, func.count(ActivityLog.id).label("count"))
        .where(base_filter)
        .group_by(ActivityLog.path)
        .order_by(func.count(ActivityLog.id).desc(), ActivityLog.path)
        .limit(10)
    )

    error_endpoints_result = await db.execute(
        select(ActivityLog.path, func.count(ActivityLog.id).label("count"))
        .where(base_filter, ActivityLog.status_code >= 400)
        .group_by(ActivityLog.path)
        .order_by(func.count(ActivityLog.id).desc(), ActivityLog.path)
        .limit(10)
    )

    activity_day = func.date(ActivityLog.created_at)
    daily_active_users_result = await db.execute(
        select(
            activity_day.label("day"),
            func.count(distinct(ActivityLog.user_id)).label("unique_users"),
        )
        .where(base_filter, ActivityLog.user_id.is_not(None))
        .group_by(activity_day)
        .order_by(activity_day)
    )

    return ActivityStatsResponse(
        total_requests=total_requests or 0,
        unique_users=unique_users or 0,
        top_endpoints=[EndpointStat(path=path, count=count) for path, count in top_endpoints_result.all()],
        error_endpoints=[EndpointStat(path=path, count=count) for path, count in error_endpoints_result.all()],
        daily_active_users=[
            DailyActiveUserStat(day=_normalize_day(day), unique_users=unique_users)
            for day, unique_users in daily_active_users_result.all()
        ],
        avg_response_time_ms=round(float(avg_response_time_ms or 0), 2),
    )


@router.get("/activity/logins", response_model=LoginAttemptsResponse)
async def get_login_attempts(
    days: int = Query(7, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Return login attempts and success/failure summary for the given period."""
    since = _utcnow() - timedelta(days=days)
    login_filter = and_(
        ActivityLog.created_at >= since,
        ActivityLog.method == "POST",
        ActivityLog.path.in_(["/auth/login", "/api/auth/login"]),
    )

    # Conditional aggregation over a typed column (id) — avoids GROUP BY on a
    # CASE built from string bind params, which asyncpg/Postgres rejects with
    # "could not determine data type of parameter". (sqlite tolerated it, Postgres
    # did not — hence the section never loaded in prod.)
    summary_row = (
        await db.execute(
            select(
                func.count(case((ActivityLog.status_code < 400, ActivityLog.id))).label("success"),
                func.count(case((ActivityLog.status_code >= 400, ActivityLog.id))).label("failure"),
            ).where(login_filter)
        )
    ).one()

    attempts_result = await db.execute(
        select(ActivityLog)
        .options(selectinload(ActivityLog.user))
        .where(login_filter)
        .order_by(ActivityLog.created_at.desc())
        .limit(200)
    )

    return LoginAttemptsResponse(
        days=days,
        summary=[
            LoginAttemptGroup(outcome="success", count=summary_row.success or 0),
            LoginAttemptGroup(outcome="failure", count=summary_row.failure or 0),
        ],
        attempts=[LoginAttemptRead.model_validate(item) for item in attempts_result.scalars().all()],
    )


@router.post("/reminders/send", tags=["admin"])
async def trigger_reminders(
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Trigger reminder emails (J-7 and J-1) on demand (admin only)."""
    from app.services import reminder_service

    sent_j1, failed_j1 = await reminder_service.send_due_reminders(db, kind="J1")
    sent_j7, failed_j7 = await reminder_service.send_due_reminders(db, kind="J7")
    sent = sent_j1 + sent_j7
    failed = failed_j1 + failed_j7
    return {"sent": sent, "failed": failed, "total": sent + failed}
