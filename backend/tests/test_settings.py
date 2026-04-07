import pytest


@pytest.mark.asyncio
async def test_get_settings_requires_admin(regular_client, seeded_data):
    response = await regular_client.get("/settings")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_settings_success(auth_client, seeded_data):
    response = await auth_client.get("/settings")
    assert response.status_code == 200
    assert "association_name" in response.json()


@pytest.mark.asyncio
async def test_update_settings_success(auth_client, seeded_data):
    response = await auth_client.put(
        "/settings",
        json={"data": {"association_name": "LIMA Test"}},
    )

    assert response.status_code == 200
    assert response.json()["association_name"] == "LIMA Test"


@pytest.mark.asyncio
async def test_settings_persist_in_database(auth_client, seeded_data):
    update_response = await auth_client.put(
        "/settings",
        json={"data": {"association_email": "bureau@test.lima"}},
    )
    assert update_response.status_code == 200

    get_response = await auth_client.get("/settings")
    assert get_response.status_code == 200
    assert get_response.json()["association_email"] == "bureau@test.lima"
