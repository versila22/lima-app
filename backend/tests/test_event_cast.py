import pytest
from sqlalchemy import select

from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent


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
