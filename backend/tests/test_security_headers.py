"""Security headers middleware tests.

Ensures every response carries the ANSSI/OWASP-recommended headers so
new endpoints can't accidentally drop them.
"""
import pytest

REQUIRED_HEADERS = [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
]


@pytest.mark.asyncio
async def test_health_endpoint_has_security_headers(client):
    response = await client.get("/health")
    assert response.status_code == 200
    for header in REQUIRED_HEADERS:
        assert header in response.headers, f"Missing security header: {header}"


@pytest.mark.asyncio
async def test_x_content_type_options_value(client):
    response = await client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"


@pytest.mark.asyncio
async def test_x_frame_options_value(client):
    response = await client.get("/health")
    assert response.headers["X-Frame-Options"] == "DENY"


@pytest.mark.asyncio
async def test_hsts_includes_subdomains_and_one_year(client):
    response = await client.get("/health")
    hsts = response.headers["Strict-Transport-Security"]
    assert "max-age=31536000" in hsts
    assert "includeSubDomains" in hsts


@pytest.mark.asyncio
async def test_authenticated_endpoint_also_has_security_headers(client, seeded_data):
    headers = {"Authorization": f"Bearer {seeded_data['admin_token']}"}
    response = await client.get("/members", headers=headers)
    assert response.status_code == 200
    for header in REQUIRED_HEADERS:
        assert header in response.headers, f"Missing security header on /members: {header}"
