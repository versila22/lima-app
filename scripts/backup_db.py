"""Daily PostgreSQL backup → Cloudflare R2.

Run from a host that has Docker + the prod DATABASE_URL + R2 creds.
Designed to be triggered by cron (see scripts/setup_backup_cron.sh).

Steps:
1. Run `pg_dump` inside a postgres:16 container (no pg_dump install needed locally).
2. Gzip the dump (in-memory pipe).
3. Upload to R2 under `db-backups/lima-YYYY-MM-DD-HHMM.sql.gz`.
4. Keep only the latest N backups (default 30) — delete older ones.

Required environment variables:
- DATABASE_URL                postgresql://...   (read-only role recommended)
- S3_ENDPOINT_URL             https://<account>.r2.cloudflarestorage.com
- S3_ACCESS_KEY_ID
- S3_SECRET_ACCESS_KEY
- S3_BUCKET_NAME              (e.g. lima-backups)
- BACKUP_RETENTION_COUNT      (optional, default 30)
- BACKUP_PREFIX               (optional, default 'db-backups/')
"""
from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime, timezone

import boto3
from botocore.config import Config


def env_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Missing required env var: {name}")
    return value


def main() -> None:
    database_url = env_required("DATABASE_URL")
    endpoint = env_required("S3_ENDPOINT_URL")
    key_id = env_required("S3_ACCESS_KEY_ID")
    secret = env_required("S3_SECRET_ACCESS_KEY")
    bucket = env_required("S3_BUCKET_NAME")
    retention = int(os.environ.get("BACKUP_RETENTION_COUNT", "30"))
    prefix = os.environ.get("BACKUP_PREFIX", "db-backups/")

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M")
    key = f"{prefix}lima-{timestamp}.sql.gz"

    print(f"[backup] dumping → {key}")

    # pg_dump inside docker, piped through gzip locally.
    dump = subprocess.Popen(
        [
            "docker", "run", "--rm", "-i",
            "-e", f"PGPASSWORD_HIDDEN=1",  # cosmetic
            "postgres:16",
            "sh", "-c", f"pg_dump --no-owner --no-acl '{database_url}'",
        ],
        stdout=subprocess.PIPE,
    )
    gzip = subprocess.Popen(["gzip", "-9"], stdin=dump.stdout, stdout=subprocess.PIPE)
    if dump.stdout:
        dump.stdout.close()  # let gzip get SIGPIPE if dump dies

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        config=Config(signature_version="s3v4"),
    )

    s3.upload_fileobj(gzip.stdout, bucket, key)
    gzip.wait()
    dump.wait()

    if dump.returncode != 0 or gzip.returncode != 0:
        sys.exit(f"[backup] dump or gzip failed: dump={dump.returncode} gzip={gzip.returncode}")

    print(f"[backup] uploaded {key}")

    # Retention: list, sort by name (timestamp encoded), drop the oldest beyond N.
    listing = s3.list_objects_v2(Bucket=bucket, Prefix=prefix).get("Contents", [])
    backups = sorted([o["Key"] for o in listing], reverse=True)
    to_delete = backups[retention:]
    if to_delete:
        print(f"[backup] retention: deleting {len(to_delete)} old backup(s)")
        s3.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": k} for k in to_delete]},
        )

    print(f"[backup] done — {len(backups) - len(to_delete)} backups retained")


if __name__ == "__main__":
    main()
