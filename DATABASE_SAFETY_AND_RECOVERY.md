# THE HIDDEN LABEL — DATABASE SAFETY, MIGRATIONS & DISASTER RECOVERY

**Auditor:** Database Administrator & Backend Architect  
**Engine:** PostgreSQL 18.x  
**ORM Framework:** MikroORM 6.x (Medusa Framework)  

---

## 1. Production Database Initialization & Migration Sequence

### A. Initialization Protocol
When spinning up a fresh PostgreSQL database for production:
1. Initialize the PostgreSQL container or managed RDS/CloudSQL instance:
   ```bash
   docker compose -f docker-compose.prod.yml up -d postgres
   ```
2. Verify connectivity using `pg_isready`:
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres pg_isready -U thl_prod_user -d the_hidden_label
   ```

### B. Migration Execution Safeguards
Migrations are executed strictly via the Medusa CLI runner:
```bash
pnpm --filter @thl/backend medusa db:migrate
```
**Migration Safety Guarantees:**
- **Idempotency:** Every migration statement in `apps/backend/src/modules/thl/migrations/` uses `create table if not exists`, `create index if not exists`, and `create sequence if not exists`.
- **Atomic Transactions:** Each migration file is wrapped in an atomic transaction. If any DDL statement fails, the entire migration aborts and rolls back, leaving no orphaned tables or partial states.
- **Migration Ledger:** MikroORM records applied migrations in the `mikro_orm_migrations` table. A migration is never executed twice against the same database.

### C. Existing Database Upgrade Compatibility
All 12 custom migrations have been designed for additive backwards compatibility:
- New columns on existing tables are either `NULL` by default or supply a deterministic `DEFAULT` value.
- No existing production columns are renamed or dropped in any migration.
- Foreign keys use `ON DELETE RESTRICT` on business records (`supplier`, `purchase_order`, `goods_receipt`) to prevent accidental cascade deletions of financial ledgers.

---

## 2. In-Depth Inspection of Test Fixture Cleaner (`scripts/clean-test-fixtures.ts`)

During development and automated auditing, synthetic fixtures (such as test brands) were inserted into development databases. Production must never launch with accidental test fixtures.

### A. Exact Records Targeted
The cleanup script scans specifically for records matching:
```sql
SELECT id, name, handle FROM brand 
WHERE name LIKE 'Audit Brand%' 
   OR name LIKE 'TestBrand%' 
   OR handle LIKE 'audit-brand%' 
   OR handle LIKE 'testbrand%';
```
Currently in the local development database, **14 audit fixture records** match this pattern. Zero real luxury brands (e.g. Dior, Balenciaga, Jacquemus, Saint Laurent) match this criteria.

### B. Dry-Run Capability & Safeguards
By default, executing the script runs in **READ-ONLY INSPECTION MODE**:
```bash
npx tsx scripts/clean-test-fixtures.ts
```
- It inspects the database, logs every matching fixture ID and handle, and exits without mutating any tables.
- **Foreign Key Guard:** It executes a count check on `product_brand`:
  ```sql
  SELECT count(*) FROM product_brand WHERE brand_id IN (...);
  ```
- If any test brand has active products attached to it, the script prints an explicit warning and **aborts execution immediately**, refusing to delete the brand unless the `--force` flag is deliberately supplied.
- **Transaction Encapsulation:** If `--execute` is supplied, deletions execute inside a Knex transaction:
  ```typescript
  await db.transaction(async (trx) => {
    await trx("product_brand").whereIn("brand_id", brandIds).delete();
    const deleted = await trx("brand").whereIn("id", brandIds).delete();
    console.log(`Successfully deleted ${deleted} test brand fixture(s).`);
  });
  ```
  If a network blip or lock contention occurs, the transaction rolls back completely.

### C. Recommended Safe Production Cleanup Procedure
1. **Never run `--execute` blind.**
2. Run the dry-run first and review the logged IDs:
   ```bash
   npx tsx scripts/clean-test-fixtures.ts
   ```
3. Take a database backup before applying any mutation:
   ```bash
   ./scripts/db-backup.sh
   ```
4. Only after inspecting the dry-run log and taking a backup, execute the deletion:
   ```bash
   npx tsx scripts/clean-test-fixtures.ts --execute
   ```
5. Confirm zero test fixtures remain:
   ```bash
   npx tsx scripts/clean-test-fixtures.ts
   # Expected output: "No test fixtures found in database. Clean state confirmed."
   ```

---

## 3. Database Backup Procedure (`scripts/db-backup.sh`)

### A. Execution & Verification
The backup script executes a custom-format compressed dump (`pg_dump -Fc`):
```bash
BACKUP_DIR=/var/backups/thehiddenlabel ./scripts/db-backup.sh
```
**Safety Mechanisms Built In:**
- Script runs with `set -euo pipefail` (halts immediately on any error).
- **Integrity Validation:** Before reporting success, the script runs a non-empty size check:
  ```bash
  if [ -s "${BACKUP_FILE}" ]; then
    echo "Backup successful: ${BACKUP_FILE}"
  else
    echo "ERROR: Backup file is empty!" >&2
    exit 1
  fi
  ```
- **Automated Retention:** Automatically prunes dumps older than 14 days (`find ... -mtime +14 -delete`), preventing disk exhaustion.

### B. Recommended Cron Automation
Install this cron job on the production database host:
```crontab
# Run daily database backup at 02:00 AM IST
0 2 * * * /app/scripts/db-backup.sh >> /var/log/thl_db_backup.log 2>&1
```

---

## 4. Database Restoration Procedure (`scripts/db-restore.sh`)

### A. Execution & Operator Confirmation Gate
To prevent catastrophic accidental database overwrites, the restore script implements an interactive safety gate:
```bash
./scripts/db-restore.sh /var/backups/thehiddenlabel/thl_backup_20261122_020000.dump
```
**Operator Gate:**
The script pauses and requires the operator to explicitly type the word **`RESTORE`**:
```
=============================================================================
WARNING: This will restore database from '.../thl_backup_20261122_020000.dump'.
Target Database: postgres://...
=============================================================================
Are you sure you want to proceed with restore? (type 'RESTORE'):
```
If anything other than `RESTORE` is entered, the process aborts instantly.

### B. Restoration Execution
Once confirmed, the script executes:
```bash
pg_restore --clean --if-exists --no-owner --no-privileges -d "${DATABASE_URL}" "${BACKUP_FILE}"
```
- `--clean --if-exists`: Drops existing database objects before recreating them, preventing duplicate table or primary key conflicts.
- `--no-owner --no-privileges`: Restores cleanly regardless of differences in PostgreSQL system user names between environments.
- **Post-Restore Verification:** Executes an automated table count query to verify schema recreation:
  ```bash
  psql "${DATABASE_URL}" -c "SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema='public';"
  ```

---

## 5. Live Database Health Verification

To verify database health without interrupting service:
```bash
# 1. Check database connectivity
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U thl_prod_user -d the_hidden_label

# 2. Check active connection pool count
docker compose -f docker-compose.prod.yml exec postgres psql -U thl_prod_user -d the_hidden_label -c \
  "SELECT count(*) as active_connections FROM pg_stat_activity WHERE datname='the_hidden_label';"

# 3. Check for transaction lock contentions
docker compose -f docker-compose.prod.yml exec postgres psql -U thl_prod_user -d the_hidden_label -c \
  "SELECT pid, locktype, mode, granted FROM pg_locks WHERE NOT granted;"
```
