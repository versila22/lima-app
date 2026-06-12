"""sign_photo_url: presign R2 keys, pass through data URIs and foreign URLs."""

from app.config import settings
from app.services import storage


def _configure_r2(monkeypatch):
    monkeypatch.setattr(settings, "S3_PUBLIC_URL", "https://pub-test.r2.dev")
    monkeypatch.setattr(settings, "S3_BUCKET_NAME", "lima-photos")
    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", "https://test.r2.cloudflarestorage.com")
    monkeypatch.setattr(settings, "S3_ACCESS_KEY_ID", "test-key")
    monkeypatch.setattr(settings, "S3_SECRET_ACCESS_KEY", "test-secret")
    storage._s3_client.cache_clear()


def test_none_passes_through(monkeypatch):
    _configure_r2(monkeypatch)
    assert storage.sign_photo_url(None) is None


def test_data_uri_passes_through(monkeypatch):
    _configure_r2(monkeypatch)
    data_uri = "data:image/jpeg;base64,AAAA"
    assert storage.sign_photo_url(data_uri) == data_uri


def test_public_r2_url_is_presigned(monkeypatch):
    _configure_r2(monkeypatch)
    signed = storage.sign_photo_url("https://pub-test.r2.dev/photos/abc.jpg")
    assert signed is not None
    assert "X-Amz-Signature" in signed
    assert "photos/abc.jpg" in signed


def test_unconfigured_storage_passes_through(monkeypatch):
    monkeypatch.setattr(settings, "S3_PUBLIC_URL", None)
    storage._s3_client.cache_clear()
    url = "https://pub-test.r2.dev/photos/abc.jpg"
    assert storage.sign_photo_url(url) == url
