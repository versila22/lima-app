import pytest


@pytest.mark.asyncio
async def test_list_seasons_requires_auth(client, seeded_data):
    response = await client.get("/seasons")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_seasons_returns_ordered_data(regular_client, seeded_data):
    response = await regular_client.get("/seasons")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["name"] == "2025-2026"
    assert len(body) == 2


@pytest.mark.asyncio
async def test_get_current_season_returns_current(regular_client, seeded_data):
    response = await regular_client.get("/seasons/current")

    assert response.status_code == 200
    assert response.json()["is_current"] is True


@pytest.mark.asyncio
async def test_get_season_not_found(regular_client, seeded_data):
    response = await regular_client.get("/seasons/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_season_requires_admin(regular_client, seeded_data):
    response = await regular_client.post(
        "/seasons",
        json={
            "name": "2026-2027",
            "start_date": "2026-09-01",
            "end_date": "2027-06-30",
            "is_current": False,
        },
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_season_success_and_unsets_previous_current(auth_client, seeded_data):
    response = await auth_client.post(
        "/seasons",
        json={
            "name": "2026-2027",
            "start_date": "2026-09-01",
            "end_date": "2027-06-30",
            "is_current": True,
        },
    )

    assert response.status_code == 201
    assert response.json()["is_current"] is True

    current_response = await auth_client.get("/seasons/current")
    assert current_response.json()["name"] == "2026-2027"


@pytest.mark.asyncio
async def test_create_season_validation_returns_422(auth_client, seeded_data):
    response = await auth_client.post(
        "/seasons",
        json={
            "name": "invalid",
            "start_date": "2026-09-01",
            "end_date": "2026-09-01",
            "is_current": False,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_season_success(auth_client, seeded_data):
    response = await auth_client.put(
        f"/seasons/{seeded_data['old_season'].id}",
        json={"name": "2024-2025 bis", "is_current": True},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "2024-2025 bis"
    assert response.json()["is_current"] is True


@pytest.mark.asyncio
async def test_update_season_not_found(auth_client, seeded_data):
    response = await auth_client.put(
        "/seasons/00000000-0000-0000-0000-000000000001",
        json={"name": "ghost"},
    )

    assert response.status_code == 404
