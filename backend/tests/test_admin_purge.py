"""Admin bulk purge of old events + their dependent rows."""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent
from app.models.event import Event
from app.models.show_plan import ShowPlan


@pytest.mark.asyncio
async def test_purge_events_before_requires_admin(regular_client):
    resp = await regular_client.post(
        "/api/admin/events/purge-before", params={"before": "2026-03-01"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_purge_events_before_deletes_old_and_dependents(
    auth_client, seeded_data, db_session
):
    season = seeded_data["current_season"]
    old = Event(
        season_id=season.id, title="Vieux", event_type="match",
        start_at=datetime(2026, 1, 15, 20, 0), visibility="all",
    )
    kept = Event(
        season_id=season.id, title="Récent", event_type="match",
        start_at=datetime(2026, 3, 10, 20, 0), visibility="all",
    )
    db_session.add_all([old, kept])
    await db_session.flush()

    alignment = Alignment(
        season_id=season.id, name="G", start_date=datetime(2026, 1, 1).date(),
        end_date=datetime(2026, 1, 31).date(), status="published",
        created_by=seeded_data["admin"].id,
    )
    db_session.add(alignment)
    await db_session.flush()
    db_session.add_all([
        AlignmentEvent(alignment_id=alignment.id, event_id=old.id, sort_order=0),
        AlignmentAssignment(alignment_id=alignment.id, event_id=old.id,
                            member_id=seeded_data["regular"].id, role="JR"),
        ShowPlan(event_id=old.id, created_by=seeded_data["admin"].id,
                 title="Plan", show_type="match", config={}),
    ])
    await db_session.commit()

    resp = await auth_client.post(
        "/api/admin/events/purge-before", params={"before": "2026-03-01"}
    )
    assert resp.status_code == 200
    # seeded_data also seeds events before March, so >= our one "Vieux"
    assert resp.json()["deleted"] >= 1

    remaining = (await db_session.execute(select(Event.title))).scalars().all()
    assert "Vieux" not in remaining
    assert "Récent" in remaining
    # dependent rows of the purged event are gone
    assert (await db_session.execute(select(AlignmentAssignment))).scalars().all() == []
    assert (await db_session.execute(select(AlignmentEvent))).scalars().all() == []
    assert (await db_session.execute(select(ShowPlan))).scalars().all() == []


@pytest.mark.asyncio
async def test_purge_events_before_noop_when_nothing_old(auth_client, seeded_data):
    resp = await auth_client.post(
        "/api/admin/events/purge-before", params={"before": "2000-01-01"}
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 0
