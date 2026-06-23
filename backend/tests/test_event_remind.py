import uuid

import pytest

from app.models.alignment import AlignmentAssignment


@pytest.mark.asyncio
async def test_remind_event_sends_to_casting(auth_client, seeded_data, db_session, monkeypatch):
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

    monkeypatch.setattr("app.routers.events.send_event_reminder_email", fake_send)

    resp = await auth_client.post(f"/events/{seeded_data['public_event'].id}/remind")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["recipients"] == 1
    assert body["sent"] == 1
    assert calls[0]["to"] == seeded_data["regular"].email
    assert calls[0]["role"] == "JR"
    assert calls[0]["event_title"] == seeded_data["public_event"].title


@pytest.mark.asyncio
async def test_remind_dry_run_counts_without_sending(auth_client, seeded_data, db_session, monkeypatch):
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

    monkeypatch.setattr("app.routers.events.send_event_reminder_email", fake_send)

    resp = await auth_client.post(
        f"/events/{seeded_data['public_event'].id}/remind", params={"dry_run": "true"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["recipients"] == 1
    assert body["sent"] == 0
    assert body["dry_run"] is True
    assert calls == []  # aucun envoi en dry-run


@pytest.mark.asyncio
async def test_remind_event_requires_admin(regular_client, seeded_data):
    resp = await regular_client.post(f"/events/{seeded_data['public_event'].id}/remind")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_remind_unknown_event_404(auth_client):
    resp = await auth_client.post(f"/events/{uuid.uuid4()}/remind")
    assert resp.status_code == 404
