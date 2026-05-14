"""Feedback router tests."""
import pytest


@pytest.mark.asyncio
async def test_submit_feedback_anonymous(client):
    response = await client.post(
        "/feedback",
        json={"body": "Le bouton X ne fonctionne pas sur Safari"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["body"] == "Le bouton X ne fonctionne pas sur Safari"
    assert body["reporter_name"] is None
    assert body["reporter_member_id"] is None


@pytest.mark.asyncio
async def test_submit_feedback_with_optional_name(client):
    response = await client.post(
        "/feedback",
        json={"body": "Suggestion: ajouter un dark mode", "reporter_name": "Pierre"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["reporter_name"] == "Pierre"


@pytest.mark.asyncio
async def test_submit_feedback_authenticated_links_member(client, seeded_data):
    headers = {"Authorization": f"Bearer {seeded_data['regular_token']}"}
    response = await client.post(
        "/feedback",
        headers=headers,
        json={"body": "Test depuis un user authentifié"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["reporter_member_id"] == str(seeded_data["regular"].id)
    assert body["reporter_first_name"] == "Regular"


@pytest.mark.asyncio
async def test_submit_feedback_rejects_empty_body(client):
    response = await client.post("/feedback", json={"body": ""})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_feedback_requires_admin(regular_client):
    response = await regular_client.get("/feedback")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_feedback_returns_recent_first(client, seeded_data):
    headers_anon = {}
    headers_admin = {"Authorization": f"Bearer {seeded_data['admin_token']}"}

    await client.post("/feedback", headers=headers_anon, json={"body": "premier"})
    await client.post("/feedback", headers=headers_anon, json={"body": "second"})
    await client.post("/feedback", headers=headers_anon, json={"body": "troisième"})

    resp = await client.get("/feedback", headers=headers_admin)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 3
    # Most recent first
    assert items[0]["body"] == "troisième"
    assert items[2]["body"] == "premier"


@pytest.mark.asyncio
async def test_delete_feedback_requires_admin(client, regular_client, seeded_data):
    # Create one
    headers_admin = {"Authorization": f"Bearer {seeded_data['admin_token']}"}
    create_resp = await client.post("/feedback", json={"body": "à supprimer"})
    fb_id = create_resp.json()["id"]

    # Regular user gets 403
    resp = await regular_client.delete(f"/feedback/{fb_id}")
    assert resp.status_code == 403

    # Admin succeeds
    resp = await client.delete(f"/feedback/{fb_id}", headers=headers_admin)
    assert resp.status_code == 204
