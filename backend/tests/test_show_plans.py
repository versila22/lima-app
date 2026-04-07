import pytest


@pytest.mark.asyncio
async def test_list_show_plans_requires_auth(client, seeded_data):
    response = await client.get("/show-plans")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_show_plans_defaults_to_current_season(regular_client, seeded_data):
    response = await regular_client.get("/show-plans")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Plan match"


@pytest.mark.asyncio
async def test_get_show_plan_not_found(regular_client, seeded_data):
    response = await regular_client.get("/show-plans/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_show_plan_requires_admin(regular_client, seeded_data):
    response = await regular_client.post(
        "/show-plans",
        json={"title": "Plan", "show_type": "match", "config": {}},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_show_plan_success(auth_client, seeded_data):
    response = await auth_client.post(
        "/show-plans",
        json={
            "event_id": str(seeded_data['public_event'].id),
            "title": "Nouveau plan",
            "show_type": "cabaret",
            "config": {"rounds": 4},
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Nouveau plan"


@pytest.mark.asyncio
async def test_update_show_plan_success(auth_client, seeded_data):
    list_response = await auth_client.get("/show-plans")
    plan_id = list_response.json()[0]["id"]

    response = await auth_client.put(
        f"/show-plans/{plan_id}",
        json={"generated_plan": "# Conducteur", "theme": "Impro"},
    )

    assert response.status_code == 200
    assert response.json()["generated_plan"] == "# Conducteur"


@pytest.mark.asyncio
async def test_delete_show_plan_not_found(auth_client, seeded_data):
    response = await auth_client.delete("/show-plans/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404
