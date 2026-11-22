# THE HIDDEN LABEL — PRODUCTION DEPLOYMENT & OPERATIONS GUIDE

This document serves as the authoritative, provider-independent runbook for deploying, configuring, monitoring, and operating The Hidden Label e-commerce platform in production.

---

## 1. System Topology & Architecture

The production architecture consists of three containerized services fronted by a reverse proxy and backed by managed persistent data stores:

```
                                  Internet
                                     │ (HTTPS / 443)
                                     ▼
                      ┌─────────────────────────────┐
                      │    Nginx Reverse Proxy      │
                      │  - SSL / TLS Termination    │
                      │  - HSTS & Security Headers  │
                      │  - Rate Limiting (IP/Zone)  │
                      │  - Static Asset Caching     │
                      └───────┬─────────────┬───────┘
                              │             │
              ┌───────────────┘             └───────────────┐
              ▼                                             ▼
    ┌───────────────────┐                         ┌───────────────────┐
    │  apps/storefront  │                         │    apps/admin     │
    │  Next.js 16.4.6   │                         │  Next.js 16.4.6   │
    │  Port: 3000       │                         │  Port: 7001       │
    └─────────┬─────────┘                         └─────────┬─────────┘
              │                                             │
              └───────────────┐             ┌───────────────┘
                              ▼             ▼
                      ┌─────────────────────────────┐
                      │        apps/backend         │
                      │       Medusa 2.22.7         │
                      │       Port: 9000            │
                      └───────┬─────────────┬───────┘
                              │             │
              ┌───────────────┘             └───────────────┐
              ▼                                             ▼
    ┌───────────────────┐                         ┌───────────────────┐
    │   PostgreSQL 18   │                         │      Redis 7      │
    │  - Connection Pool│                         │  - Auth Limiter   │
    │  - Row Locks (CAS)│                         │  - Event Bus      │
    └───────────────────┘                         └───────────────────┘
```

---

## 2. Infrastructure Requirements

| Component | Minimum Specification | Recommended Production |
|---|---|---|
| **Host Compute** | 4 vCPU, 8 GB RAM | 8 vCPU, 16 GB RAM (Cluster / ECS / K8s) |
| **PostgreSQL** | PostgreSQL 18 (2 vCPU, 4 GB RAM, 50 GB NVMe) | Managed PostgreSQL 18 with connection pooling (PgBouncer) |
| **Redis** | Redis 7 (1 vCPU, 2 GB RAM) | Managed Redis 7 / ElastiCache with replication |
| **Storage** | 20 GB local disk | AWS S3 / Cloudflare R2 + CloudFront CDN |
| **Network** | 1 Gbps egress | Static Elastic IPs with Cloudflare DNS / DDoS protection |

---

## 3. Environment Variable Provisioning

Production variables must be injected via a secure secrets manager (AWS Secrets Manager, HashiCorp Vault, Kubernetes Secrets). Follow the schema defined in `.env.production.example`:

1. **Mandatory Security Secrets:**
   - `MEDUSA_JWT_SECRET`: Random 32+ byte hex string.
   - `MEDUSA_COOKIE_SECRET`: Random 32+ byte hex string (must differ from JWT secret).
   - `DATABASE_URL`: Connection string with SSL enabled (`sslmode=require`).
   - `REDIS_URL`: Authenticated connection string.
   - `STOREFRONT_ORIGIN`: Must begin with `https://`.
   - `ADMIN_ORIGIN`: Must begin with `https://`.
   - `OTP_DEV_ECHO`: Must be explicitly `false`.

2. **Commercial Rails (Gated on Business Owner):**
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
   - `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_TOKEN`
   - `BUSINESS_GSTIN`, `BUSINESS_LEGAL_NAME`, `BUSINESS_STATE_CODE`
   - `RESEND_API_KEY`, `EMAIL_FROM`

---

## 4. Container Build & Deployment

### Step 1: Build Container Images
```bash
docker compose -f docker-compose.prod.yml build
```

### Step 2: Run Production Migrations
Before traffic is directed to new containers, database schema migrations must be applied:
```bash
docker compose -f docker-compose.prod.yml run --rm backend pnpm --filter @thl/backend exec medusa db:migrate
```

### Step 3: Launch Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 5. Health Checks & Synthetic Monitoring

- **Backend Health Check:** `GET https://api.thehiddenlabel.com/healthz`
  - Validates PostgreSQL connection with `SELECT 1` and Redis responsiveness.
  - Returns `HTTP 200 { "status": "healthy", "components": { "database": "up", "redis": "up" } }`.
- **Storefront Health Check:** `GET https://thehiddenlabel.com/api/health`
  - Validates Storefront status and roundtrip latency to the backend.
- **Admin Health Check:** `GET https://admin.thehiddenlabel.com/api/health`
  - Validates Admin dashboard container responsiveness.

---

## 6. Backup & Disaster Recovery Procedures

1. **Automated Daily Backups:**
   - Execute `scripts/db-backup.sh` via cron: `0 2 * * * /app/scripts/db-backup.sh`.
   - Backups are compressed (`.dump`), verified non-empty, and rotated after 14 days.
2. **Disaster Recovery Restore:**
   - Execute `scripts/db-restore.sh /var/backups/thehiddenlabel/thl_backup_YYYYMMDD_HHMMSS.dump`.
   - Requires explicit operator confirmation `RESTORE` before performing non-destructive schema restore.

---

## 7. Rollback Protocol

If a release fails post-deployment:
1. Revert container tags to the previous stable image in `docker-compose.prod.yml`.
2. Re-deploy containers: `docker compose -f docker-compose.prod.yml up -d --no-deps backend storefront admin`.
3. If database changes must be rolled back, execute `down()` migration for the relevant release.
