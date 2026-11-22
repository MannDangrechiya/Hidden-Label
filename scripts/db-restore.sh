#!/bin/bash
# =============================================================================
# THE HIDDEN LABEL — PostgreSQL Database Restore Script
# =============================================================================
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.dump>" >&2
  exit 1
fi

BACKUP_FILE="$1"
DATABASE_URL="${DATABASE_URL:-postgres://thl_prod_user@localhost:5432/the_hidden_label}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' does not exist." >&2
  exit 1
fi

echo "============================================================================="
echo "WARNING: This will restore database from '${BACKUP_FILE}'."
echo "Target Database: ${DATABASE_URL}"
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
