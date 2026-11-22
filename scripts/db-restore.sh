#!/bin/bash
# =============================================================================
# THE HIDDEN LABEL — PostgreSQL Database Restore Script
# =============================================================================
set -euo pipefail

# Fail safely if required tools are missing
command -v pg_restore >/dev/null 2>&1 || {
  echo "[ERROR] pg_restore is required but not installed or not in PATH." >&2
  exit 1
}
command -v psql >/dev/null 2>&1 || {
  echo "[ERROR] psql is required but not installed or not in PATH." >&2
  exit 1
}

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.dump>" >&2
  echo "Optional environment variables: DATABASE_URL, ALLOW_PRODUCTION_RESTORE" >&2
  exit 1
fi

BACKUP_FILE="$1"
DATABASE_URL="${DATABASE_URL:-postgres://thl_prod_user@localhost:5432/the_hidden_label}"
NODE_ENV="${NODE_ENV:-development}"

# Function to sanitize database url for logging (masks password)
sanitize_url() {
  echo "$1" | sed -E 's/(postgres(ql)?:\/\/[^:]+:)[^@]+(@)/\1***\3/'
}

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file '${BACKUP_FILE}' does not exist or is not a regular file." >&2
  exit 1
fi

if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file '${BACKUP_FILE}' is empty." >&2
  exit 1
fi

# Verify archive integrity before taking any action
echo "[$(date -Iseconds)] Verifying backup archive integrity..."
if ! pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1; then
  echo "[ERROR] Backup file is not a valid PostgreSQL custom-format archive or is corrupted." >&2
  exit 1
fi
echo "[$(date -Iseconds)] Backup archive integrity verified."

# Production destination safety check
IS_PROD=false
if [ "${NODE_ENV}" = "production" ]; then
  IS_PROD=true
fi
if echo "${DATABASE_URL}" | grep -qiE "thehiddenlabel\.com|rds\.amazonaws\.com|cloudsql|_prod|production"; then
  IS_PROD=true
fi

if [ "${IS_PROD}" = "true" ]; then
  if [ "${ALLOW_PRODUCTION_RESTORE:-false}" != "true" ]; then
    echo "=============================================================================" >&2
    echo "[CRITICAL SAFETY BLOCK] Production database restore detected!" >&2
    echo "Target URL matches production indicators, but ALLOW_PRODUCTION_RESTORE is not 'true'." >&2
    echo "To restore against production, you must explicitly set: export ALLOW_PRODUCTION_RESTORE=true" >&2
    echo "Aborting immediately to protect production data." >&2
    echo "=============================================================================" >&2
    exit 1
  fi
  echo "WARNING: Production safety bypass enabled (ALLOW_PRODUCTION_RESTORE=true)."
fi

echo "============================================================================="
echo "WARNING: This will restore database from '${BACKUP_FILE}'."
echo "Target Database: $(sanitize_url "${DATABASE_URL}")"
echo "Target Environment: ${NODE_ENV}"
echo "============================================================================="
read -p "Are you sure you want to proceed with restore? (type 'RESTORE'): " CONFIRM

if [ "${CONFIRM}" != "RESTORE" ]; then
  echo "Restore aborted by operator."
  exit 0
fi

echo "[$(date -Iseconds)] Starting restore..."
pg_restore --clean --if-exists --no-owner --no-privileges -d "${DATABASE_URL}" "${BACKUP_FILE}"
echo "[$(date -Iseconds)] Restore complete. Running verification..."
psql "${DATABASE_URL}" -c "SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema='public';"
echo "[$(date -Iseconds)] Database restoration and verification complete."
