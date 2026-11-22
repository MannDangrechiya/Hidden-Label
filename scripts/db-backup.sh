#!/bin/bash
# =============================================================================
# THE HIDDEN LABEL — Automated PostgreSQL Backup Script
# =============================================================================
set -euo pipefail

# Fail safely if required tools are missing
command -v pg_dump >/dev/null 2>&1 || {
  echo "[$(date -Iseconds)] [ERROR] pg_dump is required but not installed or not in PATH." >&2
  exit 1
}

BACKUP_DIR="${BACKUP_DIR:-/var/backups/thehiddenlabel}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/thl_backup_${TIMESTAMP}.dump"
DATABASE_URL="${DATABASE_URL:-postgres://thl_prod_user@localhost:5432/the_hidden_label}"

# Function to sanitize database url for logging (masks password)
sanitize_url() {
  echo "$1" | sed -E 's/(postgres(ql)?:\/\/[^:]+:)[^@]+(@)/\1***\3/'
}

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting PostgreSQL database backup from $(sanitize_url "${DATABASE_URL}")..."
pg_dump --format=custom --compress=9 --file="${BACKUP_FILE}" "${DATABASE_URL}"

# Enforce restrictive permissions immediately
chmod 600 "${BACKUP_FILE}"

# Verify file size > 0
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[$(date -Iseconds)] [ERROR] Backup file is empty or missing: ${BACKUP_FILE}" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Verify archive integrity using pg_restore table list check
if command -v pg_restore >/dev/null 2>&1; then
  if ! pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1; then
    echo "[$(date -Iseconds)] [ERROR] Backup archive integrity verification failed! Dump file is corrupted." >&2
    rm -f "${BACKUP_FILE}"
    exit 1
  fi
  echo "[$(date -Iseconds)] Backup archive integrity verified successfully."
fi

echo "[$(date -Iseconds)] Backup successful: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Rotate backups older than 14 days
echo "[$(date -Iseconds)] Rotating backups older than 14 days..."
find "${BACKUP_DIR}" -name "thl_backup_*.dump" -mtime +14 -delete
echo "[$(date -Iseconds)] Backup rotation complete."
