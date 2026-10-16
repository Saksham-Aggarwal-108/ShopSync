#!/usr/bin/env bash
# ==============================================================================
# ShopSync — Automated Rolling Database Backup Script
# ==============================================================================
# Intended to be run via daily crontab (e.g. 0 3 * * * /var/www/shopsync/deploy/backup-cron.sh)
# Uses SQLite VACUUM INTO to create an atomic, crash-consistent live snapshot,
# verifies integrity, and purges backups older than 14 days.
# ==============================================================================

set -euo pipefail

APP_DIR="/var/www/shopsync"
BACKUP_DIR="${APP_DIR}/data/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/shopsync_backup_${TIMESTAMP}.db"
LOG_FILE="${APP_DIR}/data/backup.log"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup..." >> "${LOG_FILE}"

cd "${APP_DIR}"

# Run backup utility
if node scripts/backup.js "${BACKUP_FILE}" >> "${LOG_FILE}" 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup succeeded: ${BACKUP_FILE}" >> "${LOG_FILE}"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Backup FAILED!" >> "${LOG_FILE}"
    exit 1
fi

# Rotate backups: retain snapshots for 14 days, delete older
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Purging backups older than 14 days..." >> "${LOG_FILE}"
find "${BACKUP_DIR}" -name "shopsync_backup_*.db" -type f -mtime +14 -delete >> "${LOG_FILE}" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Automated backup cycle completed successfully." >> "${LOG_FILE}"
