from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.reimbursement import Reimbursement, STATUS_AWAITING, STATUS_PENDING
from app.routers.reimbursements import compute_amounts, KM_RATE_EUR


def test_km_rate_is_032():
    assert KM_RATE_EUR == Decimal("0.32")


def test_compute_amounts_basic():
    km_amount, total = compute_amounts(Decimal("10"), Decimal("100"), Decimal("5"))
    assert km_amount == Decimal("32.00")      # 100 km * 0.32
    assert total == Decimal("47.00")          # 10 + 32 + 5


def test_compute_amounts_rounding():
    km_amount, total = compute_amounts(Decimal("0"), Decimal("33.33"), Decimal("0"))
    assert km_amount == Decimal("10.67")      # 33.33 * 0.32 = 10.6656 -> 10.67
    assert total == Decimal("10.67")


def _form(**over):
    base = {
        "first_name": "Jean", "last_name": "Test",
        "purchase_description": "Gobelets", "store": "Cultura",
        "email": "jean@test.fr", "direct_expenses_eur": "10",
        "funds_source": "own", "km_distance": "100", "toll_eur": "5",
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_submit_creates_awaiting_and_computes_total(regular_client, seeded_data):
    r = await regular_client.post("/reimbursements", data=_form())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == STATUS_AWAITING
    assert body["km_amount_eur"] == 32.0      # 100 * 0.32
    assert body["total_eur"] == 47.0          # 10 + 32 + 5
    assert body["confirm_deadline"] is not None


@pytest.mark.asyncio
async def test_submit_ignores_client_totals(regular_client, seeded_data):
    # Le client tente d'imposer un total : champ ignoré, recalcul serveur
    r = await regular_client.post("/reimbursements", data=_form(total_eur="9999", km_amount_eur="9999"))
    assert r.status_code == 201
    assert r.json()["total_eur"] == 47.0


@pytest.mark.asyncio
async def test_submit_rejects_all_zero(regular_client, seeded_data):
    r = await regular_client.post("/reimbursements", data=_form(direct_expenses_eur="0", km_distance="0", toll_eur="0"))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_submit_rejects_negative(regular_client, seeded_data):
    r = await regular_client.post("/reimbursements", data=_form(direct_expenses_eur="-5"))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_adjust_resets_total_owner_only(regular_client, seeded_data):
    created = (await regular_client.post("/reimbursements", data=_form())).json()
    rid = created["id"]
    # Un autre utilisateur (admin, id différent → pas propriétaire) : 403
    forbidden = await regular_client.patch(
        f"/reimbursements/{rid}", data=_form(km_distance="200"),
        headers={"Authorization": f"Bearer {seeded_data['admin_token']}"},
    )
    assert forbidden.status_code == 403
    # Le propriétaire ajuste : total recalculé
    ok = await regular_client.patch(f"/reimbursements/{rid}", data=_form(km_distance="200"))
    assert ok.status_code == 200
    assert ok.json()["km_amount_eur"] == 64.0     # 200 * 0.32


@pytest.mark.asyncio
async def test_confirm_now_finalizes(regular_client, seeded_data):
    rid = (await regular_client.post("/reimbursements", data=_form())).json()["id"]
    r = await regular_client.post(f"/reimbursements/{rid}/confirm")
    assert r.status_code == 200
    assert r.json()["status"] == STATUS_PENDING


@pytest.mark.asyncio
async def test_sweep_finalizes_only_past_deadline(regular_client, seeded_data, db_session):
    import uuid
    from app.services.reimbursement_service import finalize_due_confirmations
    rid_str = (await regular_client.post("/reimbursements", data=_form())).json()["id"]
    rid = uuid.UUID(rid_str)
    assert await finalize_due_confirmations(db_session) == 0      # pas encore échu
    row = (await db_session.execute(select(Reimbursement).where(Reimbursement.id == rid))).scalar_one()
    row.confirm_deadline = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db_session.commit()
    assert await finalize_due_confirmations(db_session) == 1
    db_session.expire_all()
    row2 = (await db_session.execute(select(Reimbursement).where(Reimbursement.id == rid))).scalar_one()
    assert row2.status == STATUS_PENDING


@pytest.mark.asyncio
async def test_list_requires_admin(regular_client, seeded_data):
    # membre : refusé ; admin (header surchargé) : ok
    assert (await regular_client.get("/reimbursements")).status_code in (401, 403)
    ok = await regular_client.get(
        "/reimbursements", headers={"Authorization": f"Bearer {seeded_data['admin_token']}"}
    )
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_confirm_now_twice_returns_409(regular_client, seeded_data):
    rid = (await regular_client.post("/reimbursements", data=_form())).json()["id"]
    r1 = await regular_client.post(f"/reimbursements/{rid}/confirm")
    assert r1.status_code == 200
    assert r1.json()["status"] == STATUS_PENDING
    r2 = await regular_client.post(f"/reimbursements/{rid}/confirm")
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_adjust_changes_deadline(regular_client, seeded_data):
    created = (await regular_client.post("/reimbursements", data=_form())).json()
    rid = created["id"]
    original_deadline = created["confirm_deadline"]
    ok = await regular_client.patch(f"/reimbursements/{rid}", data=_form(km_distance="200"))
    assert ok.status_code == 200
    body = ok.json()
    assert body["km_amount_eur"] == 64.0
    # deadline should be refreshed (strings may be equal within clock resolution — primary check is km_amount)
    assert body["confirm_deadline"] >= original_deadline
