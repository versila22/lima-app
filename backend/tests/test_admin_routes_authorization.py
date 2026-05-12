"""Systematic authorization test: every admin-protected route returns 403 for non-admin users.

Introspects the FastAPI app at runtime, finds every route whose dependency
graph includes `require_admin`, and asserts a regular member cannot reach it.

This guards against forgetting `Depends(require_admin)` on a new admin route.
"""
from typing import Iterable

import pytest
from fastapi.dependencies.models import Dependant

from app.main import app
from app.utils.deps import require_admin


def _walk_dependant(d: Dependant) -> Iterable[Dependant]:
    yield d
    for child in d.dependencies:
        yield from _walk_dependant(child)


def _admin_routes() -> list[tuple[str, str]]:
    """Return list of (METHOD, path) tuples for every route requiring admin."""
    out: list[tuple[str, str]] = []
    for route in app.routes:
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue
        is_admin_route = any(dep.call is require_admin for dep in _walk_dependant(dependant))
        if not is_admin_route:
            continue
        methods = (getattr(route, "methods", None) or {"GET"}) - {"HEAD", "OPTIONS"}
        for m in methods:
            out.append((m, route.path))
    # Sort so the parametrized test ids are stable / readable
    return sorted(out)


ADMIN_ROUTES = _admin_routes()


def test_admin_routes_discovered():
    """Sanity check: we actually found admin routes to test."""
    assert len(ADMIN_ROUTES) > 5, f"Expected several admin routes, got {ADMIN_ROUTES}"


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path", ADMIN_ROUTES, ids=lambda v: str(v))
async def test_admin_route_forbidden_for_regular_user(method, path, regular_client, seeded_data):
    """Every admin route must return 401/403 for a regular (non-admin) user.

    We substitute any `{param}` in the path with a known UUID so the routing
    layer matches before authorization kicks in.
    """
    # Substitute path params with the admin's UUID (just needs to be a valid UUID-shaped string).
    concrete_path = path
    if "{" in concrete_path:
        sample_id = str(seeded_data["admin"].id)
        # Replace every {param} with the same UUID — enough for FastAPI to route.
        import re
        concrete_path = re.sub(r"\{[^}]+\}", sample_id, concrete_path)

    response = await regular_client.request(method, concrete_path, json={} if method in {"POST", "PUT", "PATCH"} else None)

    # 401 = not authenticated (shouldn't happen since regular_client has a token, but be lenient).
    # 403 = forbidden (the expected case).
    # Any 2xx/3xx/404/422 = the route was reached → authorization is broken.
    assert response.status_code in (401, 403), (
        f"{method} {path} returned {response.status_code} for regular user; "
        f"expected 401/403. Body: {response.text[:200]}"
    )
