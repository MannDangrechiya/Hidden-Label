#!/bin/bash
# =============================================================================
# THE HIDDEN LABEL — Automated PostgreSQL Backup Script
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/thehiddenlabel}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/thl_backup_${TIMESTAMP}.dump"
DATABASE_URL="${DATABASE_URL:-postgres://thl_prod_user@localhost:5432/the_hidden_label}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting PostgreSQL database backup..."
pg_dump --format=custom --compress=9 --file="${BACKUP_FILE}" "${DATABASE_URL}"

# Verify file size > 0
if [ -s "${BACKUP_FILE}" ]; then
  echo "[$(date -Iseconds)] Backup successful: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
else
  echo "[$(date -Iseconds)] ERROR: Backup file is empty!" >&2
  exit 1
fi

# Rotate backups older than 14 days
echo "[$(date -Iseconds)] Rotating backups older than 14 days..."
find "${BACKUP_DIR}" -name "thl_backup_*.dump" -mtime +14 -delete
echo "[$(date -Iseconds)] Backup rotation complete."
