#!/bin/bash
# Install daily PostgreSQL backup cron on the VPS.
# Run on the VPS (ssh root@72.61.196.210) once.
#
# Prerequisites:
#   - /docker/openclaw-nmtd/data/.openclaw/workspace/lima-app cloned and up to date
#   - Python 3.10+ with `pip install boto3` available
#   - Env file at /etc/lima-backup.env with all required variables
#
# What it does:
#   - Adds a daily 03:30 cron entry running scripts/backup_db.py
#   - Logs to /var/log/lima-backup.log
set -euo pipefail

PROJECT_DIR="/docker/openclaw-nmtd/data/.openclaw/workspace/lima-app"
ENV_FILE="/etc/lima-backup.env"
LOG_FILE="/var/log/lima-backup.log"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create $ENV_FILE first with:"
  echo "  DATABASE_URL=postgresql://..."
  echo "  S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com"
  echo "  S3_ACCESS_KEY_ID=..."
  echo "  S3_SECRET_ACCESS_KEY=..."
  echo "  S3_BUCKET_NAME=lima-backups"
  echo "  BACKUP_RETENTION_COUNT=30  # optional"
  exit 1
fi
chmod 600 "$ENV_FILE"

# Add cron entry (idempotent: replaces any existing lima-backup line)
CRON_CMD="set -a && source $ENV_FILE && set +a && cd $PROJECT_DIR && python3 scripts/backup_db.py >> $LOG_FILE 2>&1"
CRON_LINE="30 3 * * * $CRON_CMD"

(crontab -l 2>/dev/null | grep -v "lima-app/scripts/backup_db.py" ; echo "$CRON_LINE  # lima-app daily backup") | crontab -

echo "Cron installed: $CRON_LINE"
echo "Tail logs with: tail -f $LOG_FILE"
echo "Test once now: bash -c \"$CRON_CMD\""
