# THE HIDDEN LABEL — PRODUCTION ROLLBACK & DISASTER RECOVERY PLAN

**Purpose:** Comprehensive runbook to abort, revert, and restore the production environment in the event of an unrecoverable failure during or immediately after cutover.  
**Recovery Objectives:**
- **Recovery Time Objective (RTO):** `< 15 minutes` to restore service or present a branded maintenance notice.
- **Recovery Point Objective (RPO):** `0 data loss` for captured financial orders; point-in-time recovery to pre-deployment backup.

---

## 1. Rollback Trigger Criteria

An immediate rollback is mandatory if any of the following occur during deployment or the smoke drill:
1. **Fatal Gateway Failure:** Payment webhook verification fails continuously or captures cannot be confirmed server-side.
2. **Database Migration Corruption:** A migration crashes mid-way and leaves the database in an inconsistent state that cannot be resolved in 5 minutes.
3. **Application Crash Loop:** Backend or storefront containers fail health checks (`/healthz` or `/api/health`) and restart continuously.
4. **Data Contamination:** Sensitive customer or payment data is logged in plain text or rendered to unauthorized users.
5. **Elevated Error Rate:** HTTP 5xx responses exceed 1% of total traffic over a 5-minute window.

---

## 2. Emergency Circuit Breaker (Payment & Order Lock)

If payments or orders are malfunctioning and immediate traffic mitigation is required while diagnosing:
1. In `apps/backend/.env.production`, unset or invalidate `RAZORPAY_KEY_ID`:
   ```bash
   sed -i 's/^RAZORPAY_KEY_ID=.*/RAZORPAY_KEY_ID=disabled/' apps/backend/.env.production
   docker compose -f docker-compose.prod.yml restart backend
   ```
2. **Effect:** Checkout instantly fails closed with a clear message: *"Online payment is temporarily undergoing scheduled maintenance."* No customers will be charged while diagnosis is underway.

---

## 3. Rollback Procedures

### Scenario A: Application Version Rollback (Containers Only)
Used when the database is healthy, but the newly deployed frontend or backend application code contains a critical bug.

1. **Stop Faulty Containers:**
   ```bash
   docker compose -f docker-compose.prod.yml stop storefront admin backend
   ```

2. **Revert Working Tree to Last Known Good Commit:**
   ```bash
   # Revert code to previous release tag (e.g. debd5df or release-1.0.0)
   git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>
   ```

3. **Rebuild and Relaunch Previous Release:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build storefront admin backend
   ```

4. **Verify Health Probes:**
   ```bash
   curl -I http://localhost:9000/healthz
   curl -I http://localhost:3000/api/health
   curl -I http://localhost:7001/api/health
   ```

---

### Scenario B: Database Rollback (Full State Recovery)
Used when a migration corrupts database relations or schema integrity is compromised.

1. **Place Applications in Maintenance Mode:**
   Stop the application containers so no incoming writes occur during restoration:
   ```bash
   docker compose -f docker-compose.prod.yml stop storefront admin backend
   ```

2. **Execute Database Restore from Pre-Deployment Dump:**
   Locate the pre-cutover dump file and run the restore script:
   ```bash
   ./scripts/db-restore.sh /var/backups/thehiddenlabel/thl_pre_cutover_backup.dump
   ```
   *Note: Operator must type `RESTORE` when prompted.*

3. **Verify Restored Schema:**
   Verify table count and key tables exist:
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres psql -U thl_prod_user -d the_hidden_label -c \
     "SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema='public';"
   ```

4. **Restart Applications:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d backend storefront admin
   ```

---

### Scenario C: Persistent Media & Upload Volume Recovery
Used if uploaded media in `thl-prod-uploads` is damaged or deleted.

1. **Extract Media Archive:**
   If a pre-deployment tarball was created:
   ```bash
   tar -tzvf /var/backups/thehiddenlabel/uploads_pre_cutover.tar.gz
   ```

2. **Restore into Named Volume:**
   ```bash
   docker compose -f docker-compose.prod.yml run --rm \
     -v thl-prod-uploads:/target \
     -v /var/backups/thehiddenlabel:/backup \
     alpine sh -c "rm -rf /target/* && tar -xzvf /backup/uploads_pre_cutover.tar.gz -C /target"
   ```

3. **Restart Backend:**
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```

---

### Scenario D: DNS Failover to Static Maintenance Page
If the entire server host suffers hardware or network failure:

1. **Cloudflare / Registrar DNS Failover:**
   Update the `@` and `admin` DNS A records to point to a fallback maintenance server or Cloudflare Workers static page:
   ```
   thehiddenlabel.com A <MAINTENANCE_SERVER_IP> (TTL: 60s)
   ```

2. **Maintenance Response:**
   Serves a static luxury-branded maintenance page:
   *"THE HIDDEN LABEL Specimen Vault is currently undergoing scheduled system enhancement. Operations will resume shortly."*

---

## 4. Post-Rollback Protocol & Incident Review

1. **Notify Stakeholders:** Immediately notify executive ownership and operations leads that a rollback was completed and the platform has returned to stable baseline.
2. **Preserve Logs:** Dump container logs immediately before restarting or removing any containers:
   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=5000 > /var/log/thl_incident_$(date +%Y%m%d_%H%M%S).log
   ```
3. **Root Cause Analysis (RCA):** Conduct a formal post-mortem to determine whether the failure was due to code, database locks, third-party timeout, or configuration error.
4. **No Re-Deployment:** No subsequent deployment attempt may be scheduled until the root cause has been reproduced, resolved, and verified in staging.
