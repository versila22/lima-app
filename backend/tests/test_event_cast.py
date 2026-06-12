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
