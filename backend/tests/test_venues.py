import pytest


@pytest.mark.asyncio
async def test_list_venues_requires_auth(client, seeded_data):
    response = await client.get("/venues")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_venues_success(regular_client, seeded_data):
    response = await regular_client.get("/venues")

    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_get_venue_not_found(regular_client, seeded_data):
    response = await regular_client.get("/venues/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_venue_requires_admin(regular_client, seeded_data):
    response = await regular_client.post("/venues", json={"name": "New venue"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_venue_success(auth_client, seeded_data):
    response = await auth_client.post(
        "/venues",
        json={"name": "Théâtre", "city": "Angers", "is_home": False},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Théâtre"


@pytest.mark.asyncio
async def test_update_venue_success(auth_client, seeded_data):
    response = await auth_client.put(
        f"/venues/{seeded_data['venue'].id}",
        json={"city": "Avrillé", "contact_info": "02 41 00 00 00"},
    )

    assert response.status_code == 200
    assert response.json()["city"] == "Avrillé"


@pytest.mark.asyncio
async def test_update_venue_not_found(auth_client, seeded_data):
    response = await auth_client.put(
        "/venues/00000000-0000-0000-0000-000000000001",
        json={"city": "Ghost"},
    )

    assert response.status_code == 404
