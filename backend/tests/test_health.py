"""Health endpoints: only the plain /health must exist; debug endpoints are removed."""

import pytest


@pytest.mark.asyncio
async def test_health_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_health_db_removed(client):
    resp = await client.get("/health/db")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_health_migrations_removed(client):
    resp = await client.get("/health/migrations")
    assert resp.status_code == 404


def test_no_seed_data_in_production_code():
    """The hardcoded-password seed must not exist in app code."""
    import app.main as main_module

    assert not hasattr(main_module, "_SEED_MEMBERS")
    assert not hasattr(main_module, "_ensure_seed_data")
