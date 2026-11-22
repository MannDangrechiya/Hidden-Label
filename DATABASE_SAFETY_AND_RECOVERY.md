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

### B. Dry-Run Capability & Multi-Layer Safeguards
By default, executing the script runs in **READ-ONLY INSPECTION MODE**:
```bash
npx tsx scripts/clean-test-fixtures.ts
```
- It inspects the database, logs every matching fixture ID and handle, and exits without mutating any tables.
- **Fail-Closed Environment Validation:** Rejects execution if `NODE_ENV=production` or missing. Requires `--confirm-environment=<env>` where `<env>` strictly matches `NODE_ENV` (e.g. `NODE_ENV=development --confirm-environment=development` or `NODE_ENV=staging --confirm-environment=staging`).
- **Production Host and DB Block:** Rejects execution against any database host matching production indicators (`thehiddenlabel.com`, `rds.amazonaws.com`, `cloudsql`, etc.) or database names containing `prod`.
- **Catalogue & Foreign Key Guard:** It executes a count check on `product_brand`:
  ```sql
  SELECT count(*) FROM product_brand WHERE brand_id IN (...);
  ```
  If any test brand has active products attached to it, the script prints an explicit warning and **aborts execution immediately**. To prevent accidental catalogue corruption, `--force` has been decommissioned.
- **Transaction Encapsulation:** If `--execute` is supplied, deletions execute inside a Knex transaction:
  ```typescript
  await db.transaction(async (trx) => {
    const deleted = await trx("brand").whereIn("id", brandIds).delete();
    console.log(`Successfully deleted ${deleted} test brand fixture(s).`);
  });
  ```
  If a network blip or lock contention occurs, the transaction rolls back completely.
- **Credential Sanitization:** All logged database URLs automatically mask passwords.

### C. Recommended Safe Staging/Dev Cleanup Procedure
1. Run the dry-run first and review the logged IDs:
   ```bash
   NODE_ENV=development npx tsx scripts/clean-test-fixtures.ts
   ```
2. Take a database backup before applying any mutation:
   ```bash
   ./scripts/db-backup.sh
   ```
3. Only after inspecting the dry-run log and taking a backup, execute the deletion with matching confirmation:
   ```bash
   NODE_ENV=development npx tsx scripts/clean-test-fixtures.ts --execute --confirm-environment=development
   ```
4. Confirm zero test fixtures remain:
   ```bash
   NODE_ENV=development npx tsx scripts/clean-test-fixtures.ts
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
- **Tool Availability Check:** Verifies `pg_dump` exists before attempting execution, failing safely with a clean message.
- **Restrictive File Permissions:** Sets `chmod 700` on the backup directory and `chmod 600` on the generated `.dump` file so only the file owner can access database dumps.
- **Masked Credentials:** Database URLs are sanitized in all log statements to prevent password leakage into terminal/logs.
- **Integrity Validation:** Validates non-empty size and executes `pg_restore --list "${BACKUP_FILE}"` to confirm archive header and table table of contents integrity before reporting success.
- **Automated Retention:** Automatically prunes dumps older than 14 days (`find ... -name "thl_backup_*.dump" -mtime +14 -delete`), preventing disk exhaustion.

### B. Recommended Cron Automation
Install this cron job on the production database host:
```crontab
# Run daily database backup at 02:00 AM IST
0 2 * * * /app/scripts/db-backup.sh >> /var/log/thl_db_backup.log 2>&1
```

---

## 4. Database Restoration Procedure (`scripts/db-restore.sh`)

### A. Execution & Operator Confirmation Gate
To prevent catastrophic accidental database overwrites, the restore script implements strict safety checks and an interactive gate:
```bash
./scripts/db-restore.sh /var/backups/thehiddenlabel/thl_backup_20261122_020000.dump
```
**Safety Mechanisms:**
- **Tool Check:** Verifies `pg_restore` and `psql` exist before starting.
- **Pre-flight Integrity Verification:** Runs `pg_restore --list` on the backup file to guarantee the dump is uncorrupted before touching any database.
- **Production Guard:** If target database or `NODE_ENV` indicates production, the script immediately halts unless `ALLOW_PRODUCTION_RESTORE=true` is explicitly exported in the environment.
- **Interactive Operator Gate:** Requires typing the word **`RESTORE`** exactly to proceed:
  ```
  =============================================================================
  WARNING: This will restore database from '.../thl_backup_20261122_020000.dump'.
  Target Database: postgres://thl_prod_user:***@localhost:5432/the_hidden_label
  Target Environment: development
  =============================================================================
  Are you sure you want to proceed with restore? (type 'RESTORE'):
  ```
- **Credential Masking:** Target URL password is masked.

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

---

## 6. Isolated Test Restoration Procedure (Dry-Run Drill)

To verify disaster recovery readiness without impacting production or staging:

### Step 1: Spin up an isolated disposable PostgreSQL instance
```bash
# Using Docker on a separate test port (e.g. 5439)
docker run --name thl-test-restore -e POSTGRES_PASSWORD=test_restore_pwd -p 5439:5432 -d postgres:18-alpine
```

### Step 2: Create a fresh target database
```bash
docker exec -i thl-test-restore psql -U postgres -c "CREATE DATABASE thl_restore_drill;"
```

### Step 3: Run the restore script against the test target
```bash
DATABASE_URL="postgres://postgres:test_restore_pwd@localhost:5439/thl_restore_drill" \
  ./scripts/db-restore.sh /var/backups/thehiddenlabel/thl_backup_YYYYMMDD_HHMMSS.dump
```
When prompted, type `RESTORE`.

### Step 4: Run Data Integrity & Consistency Verification Queries
Verify key tables and records restored successfully:
```sql
-- 1. Verify schema tables count (expect ~60+ tables across Medusa core + THL custom modules)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- 2. Verify applied migrations
SELECT id, name, executed_at FROM mikro_orm_migrations ORDER BY id DESC LIMIT 5;

-- 3. Verify core entities exist
SELECT count(*) AS product_count FROM product;
SELECT count(*) AS brand_count FROM brand;
SELECT count(*) AS order_count FROM "order";

-- 4. Verify no corrupted null foreign keys on custom relations
SELECT count(*) AS orphaned_receipts FROM goods_receipt WHERE supplier_id IS NULL;
```

### Step 5: Teardown test container
```bash
docker rm -f thl-test-restore
```
