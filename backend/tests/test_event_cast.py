import pytest
from sqlalchemy import select

from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent
from app.models.season import Season
from app.services import cast_service


@pytest.mark.asyncio
async def test_alignment_is_auto_defaults_false(db_session, seeded_data):
    alignment = Alignment(
        season_id=seeded_data["current_season"].id,
        name="Brouillon test",
        start_date=seeded_data["current_season"].start_date,
        end_date=seeded_data["current_season"].end_date,
    )
    db_session.add(alignment)
    await db_session.flush()
    assert alignment.is_auto is False


@pytest.mark.asyncio
async def test_assignment_accepts_split_mj_mc_roles(db_session, seeded_data):
    alignment = Alignment(
        season_id=seeded_data["current_season"].id,
        name="Casting",
        start_date=seeded_data["current_season"].start_date,
        end_date=seeded_data["current_season"].end_date,
        is_auto=True,
    )
    db_session.add(alignment)
    await db_session.flush()
    db_session.add(
        AlignmentEvent(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            sort_order=0,
        )
    )
    db_session.add_all([
        AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["regular"].id,
            role="MJ",
        ),
        AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["admin"].id,
            role="MC",
        ),
    ])
    await db_session.flush()
    result = await db_session.execute(
        select(AlignmentAssignment.role).where(
            AlignmentAssignment.alignment_id == alignment.id
        )
    )
    roles = {row[0] for row in result.all()}
    assert roles == {"MJ", "MC"}


@pytest.mark.asyncio
async def test_get_or_create_auto_alignment_is_idempotent(db_session, seeded_data):
    season_id = seeded_data["current_season"].id
    a1 = await cast_service.get_or_create_auto_alignment(db_session, season_id)
    a2 = await cast_service.get_or_create_auto_alignment(db_session, season_id)
    assert a1.id == a2.id
    assert a1.is_auto is True
    assert a1.status == "published"
    assert a1.name == "Casting"


@pytest.mark.asyncio
async def test_set_event_cast_member_creates_then_upserts(db_session, seeded_data):
    event_id = seeded_data["public_event"].id
    member_id = seeded_data["regular"].id

    created = await cast_service.set_event_cast_member(db_session, event_id, member_id, "JR")
    assert created.role == "JR"

    updated = await cast_service.set_event_cast_member(db_session, event_id, member_id, "MC")
    assert updated.id == created.id
    assert updated.role == "MC"

    result = await db_session.execute(
        select(AlignmentAssignment).where(
            AlignmentAssignment.event_id == event_id,
            AlignmentAssignment.member_id == member_id,
        )
    )
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_remove_event_cast_member(db_session, seeded_data):
    event_id = seeded_data["public_event"].id
    member_id = seeded_data["regular"].id
    await cast_service.set_event_cast_member(db_session, event_id, member_id, "JR")

    removed = await cast_service.remove_event_cast_member(db_session, event_id, member_id)
    assert removed is True

    again = await cast_service.remove_event_cast_member(db_session, event_id, member_id)
    assert again is False


@pytest.mark.asyncio
async def test_set_event_cast_member_unknown_event_raises(db_session):
    import uuid
    with pytest.raises(ValueError):
        await cast_service.set_event_cast_member(
            db_session, uuid.uuid4(), uuid.uuid4(), "JR"
        )


@pytest.mark.asyncio
async def test_add_cast_member_requires_admin(regular_client, seeded_data):
    resp = await regular_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_add_cast_member_creates_assignment(auth_client, seeded_data):
    resp = await auth_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["member_id"] == str(seeded_data["regular"].id)
    assert body["role"] == "JR"

    cast = await auth_client.get(f"/events/{seeded_data['public_event'].id}/cast")
    assert cast.status_code == 200
    members = {(m["member_id"], m["role"]) for m in cast.json()}
    assert (str(seeded_data["regular"].id), "JR") in members


@pytest.mark.asyncio
async def test_add_cast_member_upsert_changes_role(auth_client, seeded_data):
    url = f"/events/{seeded_data['public_event'].id}/cast"
    body = {"member_id": str(seeded_data["regular"].id), "role": "JR"}
    await auth_client.post(url, json=body)
    await auth_client.post(url, json={**body, "role": "MC"})

    cast = (await auth_client.get(url)).json()
    rows = [m for m in cast if m["member_id"] == str(seeded_data["regular"].id)]
    assert len(rows) == 1
    assert rows[0]["role"] == "MC"


@pytest.mark.asyncio
async def test_add_cast_member_rejects_legacy_role(auth_client, seeded_data):
    resp = await auth_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "MJ_MC"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_cast_member_unknown_event_404(auth_client, seeded_data):
    resp = await auth_client.post(
        "/events/00000000-0000-0000-0000-000000000009/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_remove_cast_member(auth_client, seeded_data):
    url = f"/events/{seeded_data['public_event'].id}/cast"
    await auth_client.post(url, json={"member_id": str(seeded_data["regular"].id), "role": "JR"})

    resp = await auth_client.delete(f"{url}/{seeded_data['regular'].id}")
    assert resp.status_code == 204

    cast = (await auth_client.get(url)).json()
    assert all(m["member_id"] != str(seeded_data["regular"].id) for m in cast)


@pytest.mark.asyncio
async def test_remove_cast_member_not_assigned_404(auth_client, seeded_data):
    resp = await auth_client.delete(
        f"/events/{seeded_data['public_event'].id}/cast/{seeded_data['regular'].id}"
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_auto_alignment_excluded_from_list(auth_client, seeded_data):
    await auth_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    resp = await auth_client.get("/alignments")
    assert resp.status_code == 200
    names = [a["name"] for a in resp.json()]
    assert "Casting" not in names
