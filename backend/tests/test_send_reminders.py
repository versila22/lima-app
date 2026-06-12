from datetime import datetime

import pytest
from sqlalchemy import delete

from app.config import settings
from app.models.alignment import AlignmentAssignment, AlignmentEvent
from app.models.event import Event
from app.services import reminder_service


@pytest.mark.asyncio
async def test_get_due_reminders_returns_published_assignments_only(
    seeded_data,
    db_session,
):
    extra_event = Event(
        season_id=seeded_data["current_season"].id,
        venue_id=seeded_data["venue"].id,
        title="Cabaret brouillon",
        event_type="cabaret",
        start_at=datetime(2026, 2, 10, 21, 0),
        visibility="all",
    )
    db_session.add(extra_event)
    await db_session.flush()

    db_session.add(
        AlignmentEvent(
            alignment_id=seeded_data["draft_alignment"].id,
            event_id=extra_event.id,
            sort_order=1,
        )
    )
    db_session.add_all(
        [
            AlignmentAssignment(
                alignment_id=seeded_data["published_alignment"].id,
                event_id=seeded_data["public_event"].id,
                member_id=seeded_data["regular"].id,
                role="JR",
            ),
            AlignmentAssignment(
                alignment_id=seeded_data["draft_alignment"].id,
                event_id=extra_event.id,
                member_id=seeded_data["regular"].id,
                role="DJ",
            ),
        ]
    )
    await db_session.commit()

    reminders = await reminder_service.get_due_reminders(
        db_session,
        kind="J1",
        now=datetime(2026, 2, 9, 20, 0),
    )

    assert len(reminders) == 1
    assert reminders[0].email == seeded_data["regular"].email
    assert reminders[0].event_title == seeded_data["public_event"].title
    assert reminders[0].role == "JR"


@pytest.mark.asyncio
async def test_send_due_reminders_sends_email_for_each_due_assignment(
    seeded_data,
    db_session,
    monkeypatch,
):
    await db_session.execute(delete(AlignmentAssignment))
    db_session.add(
        AlignmentAssignment(
            alignment_id=seeded_data["published_alignment"].id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["regular"].id,
            role="MJ",
        )
    )
    await db_session.commit()

    calls = []

    async def fake_send_event_reminder_email(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(
        "app.services.reminder_service.send_event_reminder_email",
        fake_send_event_reminder_email,
    )
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")

    sent, failed = await reminder_service.send_due_reminders(
        db_session,
        kind="J1",
        now=datetime(2026, 2, 9, 20, 0),
        base_url="https://lima.example.org",
    )

    assert (sent, failed) == (1, 0)
    assert calls[0]["to"] == seeded_data["regular"].email
    assert calls[0]["first_name"] == seeded_data["regular"].first_name
    assert calls[0]["event_title"] == seeded_data["public_event"].title
    assert calls[0]["role"] == "MJ"
    assert calls[0]["base_url"] == "https://lima.example.org"


@pytest.mark.asyncio
async def test_j7_window_targets_events_six_to_seven_days_out(seeded_data, db_session):
    from app.models.alignment import AlignmentAssignment

    db_session.add(
        AlignmentAssignment(
            alignment_id=seeded_data["published_alignment"].id,
            event_id=seeded_data["public_event"].id,  # start_at = 2026-02-10 20:00
            member_id=seeded_data["regular"].id,
            role="JR",
        )
    )
    await db_session.commit()

    # 7 jours avant : dans la fenêtre J7
    in_window = await reminder_service.get_due_reminders(
        db_session, kind="J7", now=datetime(2026, 2, 4, 10, 0)
    )
    assert len(in_window) == 1

    # 2 jours avant : hors fenêtre J7
    out_window = await reminder_service.get_due_reminders(
        db_session, kind="J7", now=datetime(2026, 2, 8, 10, 0)
    )
    assert out_window == []


@pytest.mark.asyncio
async def test_reminders_are_idempotent(seeded_data, db_session, monkeypatch):
    from app.models.alignment import AlignmentAssignment

    db_session.add(
        AlignmentAssignment(
            alignment_id=seeded_data["published_alignment"].id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["regular"].id,
            role="JR",
        )
    )
    await db_session.commit()

    calls = []

    async def fake_send(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(
        "app.services.reminder_service.send_event_reminder_email", fake_send
    )
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")

    now = datetime(2026, 2, 9, 22, 0)
    sent1, _ = await reminder_service.send_due_reminders(db_session, kind="J1", now=now)
    sent2, _ = await reminder_service.send_due_reminders(db_session, kind="J1", now=now)
    assert sent1 == 1
    assert sent2 == 0
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_no_email_log_written_when_smtp_unconfigured(
    seeded_data, db_session, monkeypatch
):
    """Sans SMTP, le run est ignoré SANS marquer les rappels comme envoyés."""
    from sqlalchemy import select

    from app.models.alignment import AlignmentAssignment
    from app.models.email_log import EmailLog

    db_session.add(
        AlignmentAssignment(
            alignment_id=seeded_data["published_alignment"].id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["regular"].id,
            role="JR",
        )
    )
    await db_session.commit()

    monkeypatch.setattr(settings, "SMTP_HOST", "")
    sent, failed = await reminder_service.send_due_reminders(
        db_session, kind="J1", now=datetime(2026, 2, 9, 22, 0)
    )
    assert (sent, failed) == (0, 0)
    logs = (await db_session.execute(select(EmailLog))).scalars().all()
    assert logs == []


@pytest.mark.asyncio
async def test_opted_out_member_gets_no_reminder(seeded_data, db_session):
    from app.models.alignment import AlignmentAssignment
    from app.models.member import Member

    member = await db_session.get(Member, seeded_data["regular"].id)
    member.email_reminders_enabled = False
    db_session.add(
        AlignmentAssignment(
            alignment_id=seeded_data["published_alignment"].id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["regular"].id,
            role="JR",
        )
    )
    await db_session.commit()

    reminders = await reminder_service.get_due_reminders(
        db_session, kind="J1", now=datetime(2026, 2, 9, 22, 0)
    )
    assert reminders == []


def test_seconds_until_next_run():
    from zoneinfo import ZoneInfo
    from app.scheduler import seconds_until_next_run

    paris = ZoneInfo("Europe/Paris")
    # à 08:00 → 1h d'attente
    assert seconds_until_next_run(datetime(2026, 6, 12, 8, 0, tzinfo=paris)) == 3600
    # à 09:00 pile → 24h d'attente (prochain run demain)
    assert seconds_until_next_run(datetime(2026, 6, 12, 9, 0, tzinfo=paris)) == 86400
