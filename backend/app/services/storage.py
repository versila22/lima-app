"""R2/S3 storage helpers — presigned URLs so the bucket can stay private."""

from functools import lru_cache

import boto3

from app.config import settings

# SigV4 max is 7 days; 6 keeps a margin vs client-side caching.
PRESIGN_EXPIRY_SECONDS = 6 * 24 * 3600


@lru_cache()
def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def sign_photo_url(stored: str | None) -> str | None:
    """Turn a stored public R2 URL into a presigned one.

    Data URIs, None, and URLs outside S3_PUBLIC_URL pass through unchanged.
    """
    if not stored or not settings.S3_PUBLIC_URL or not settings.S3_BUCKET_NAME:
        return stored
    public_prefix = settings.S3_PUBLIC_URL.rstrip("/") + "/"
    if not stored.startswith(public_prefix):
        return stored
    key = stored[len(public_prefix):]
    return _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
        ExpiresIn=PRESIGN_EXPIRY_SECONDS,
    )
