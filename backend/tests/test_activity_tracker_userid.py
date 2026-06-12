"""Unit tests for ActivityTrackerMiddleware user-id extraction.

Auth is cookie-based in production, so the tracker must read the access_token
cookie (not only the Authorization header) for DAU / login attribution to work.
"""

import uuid

from app.middleware.activity_tracker import ActivityTrackerMiddleware
from app.utils.security import create_access_token


def _mw() -> ActivityTrackerMiddleware:
    return ActivityTrackerMiddleware(app=lambda *a, **k: None)


def test_user_id_from_cookie():
    user_id = uuid.uuid4()
    token = create_access_token(str(user_id))
    headers = {b"cookie": f"access_token={token}; other=x".encode()}
    assert _mw()._extract_user_id(headers) == user_id


def test_user_id_from_bearer_header():
    user_id = uuid.uuid4()
    token = create_access_token(str(user_id))
    headers = {b"authorization": f"Bearer {token}".encode()}
    assert _mw()._extract_user_id(headers) == user_id


def test_bearer_takes_precedence_over_cookie():
    bearer_id = uuid.uuid4()
    cookie_id = uuid.uuid4()
    headers = {
        b"authorization": f"Bearer {create_access_token(str(bearer_id))}".encode(),
        b"cookie": f"access_token={create_access_token(str(cookie_id))}".encode(),
    }
    assert _mw()._extract_user_id(headers) == bearer_id


def test_no_token_returns_none():
    assert _mw()._extract_user_id({}) is None
    assert _mw()._extract_user_id({b"cookie": b"foo=bar"}) is None


def test_invalid_token_returns_none():
    headers = {b"cookie": b"access_token=not-a-jwt"}
    assert _mw()._extract_user_id(headers) is None
