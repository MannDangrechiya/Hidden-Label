# THE HIDDEN LABEL — STAGING DEPLOYMENT REHEARSAL GUIDE

**Purpose:** Comprehensive protocol to rehearse full-stack deployment on an isolated staging server prior to production launch.  
**Critical Rule:** **Staging must NEVER connect to production databases or use live merchant credentials.**  

---

## 1. Staging Architecture & Isolation

Staging mirrors the exact production container topology (`docker-compose.prod.yml`), but runs against separate ports and an isolated test database:

```
Staging Host (or VM):
├── PostgreSQL 18 (Isolated volume: thl-staging-pgdata)
├── Redis 7 (Isolated volume: thl-staging-redisdata)
├── Backend Engine (Port 9000 -> Staging DB)
├── Admin Console (Port 7001)
├── Storefront (Port 3000)
└── Nginx (Staging domain e.g. staging.thehiddenlabel.com)
```

---

## 2. Staging Environment Preparation

1. **Clone Repository on Staging Host:**
   ```bash
   git clone https://github.com/MannDangrechiya/Hidden-Label.git /opt/the-hidden-label-staging
   cd /opt/the-hidden-label-staging
   ```

2. **Prepare Staging Environment Files:**
   Create staging env files with sandbox keys:
   ```bash
   # Backend
   cp .env.production.example apps/backend/.env.production
   # Populate with staging DB URL and sandbox Razorpay/Shiprocket keys
   
   # Storefront
   cp .env.production.example apps/storefront/.env.production
   
   # Admin
   cp .env.production.example apps/admin/.env.production
   ```

3. **Set Safe File Permissions:**
   ```bash
   chmod 600 apps/*/.env.production
   ```

---

## 3. Step-by-Step Staging Launch Sequence

### Step 1: Initialize Database and Cache
```bash
docker compose -f docker-compose.prod.yml up -d postgres redis
```
Verify health:
```bash
docker compose -f docker-compose.prod.yml ps
# Both must report: "(healthy)"
```

### Step 2: Run Database Migrations
```bash
docker compose -f docker-compose.prod.yml exec backend pnpm medusa db:migrate
```
Verify that all 12 migrations run cleanly and the `mikro_orm_migrations` table records them.

### Step 3: Launch Core Backend Engine
```bash
docker compose -f docker-compose.prod.yml up -d backend
```
Verify backend logs and health:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
# Test healthz probe:
curl -I http://localhost:9000/healthz
# Expected: HTTP/1.1 200 OK
```

### Step 4: Launch Frontend Applications
```bash
docker compose -f docker-compose.prod.yml up -d admin storefront
```
Verify health probes:
```bash
curl -I http://localhost:7001/api/health # Admin -> HTTP 200 OK
curl -I http://localhost:3000/api/health # Storefront -> HTTP 200 OK
```

### Step 5: Launch Reverse Proxy
```bash
docker compose -f docker-compose.prod.yml up -d reverse-proxy
```
Verify public port binding:
```bash
curl -I http://localhost/ # Should return HTTP 301 redirect to HTTPS
```

---

## 4. Rehearsal Verification Tests

### Test 1: Upload Persistence Across Container Restart
Verify that user uploads in `/app/apps/backend/uploads` survive container termination:
```bash
# 1. Place a test file into the mounted upload volume
docker compose -f docker-compose.prod.yml exec backend \
  sh -c "echo 'persistence test' > /app/apps/backend/uploads/test_upload.txt"

# 2. Restart the backend container completely
docker compose -f docker-compose.prod.yml restart backend

# 3. Verify file persists
docker compose -f docker-compose.prod.yml exec backend \
  sh -c "cat /app/apps/backend/uploads/test_upload.txt"
# Expected output: "persistence test"
```

### Test 2: Synthetic Customer Checkout
1. Open staging storefront URL in browser.
2. Register a customer account and log in.
3. Add a garment to the shopping bag.
4. Complete address with a serviceable PIN code (e.g. `380054`).
5. Complete payment using Razorpay test card credentials (`4111 1111 ...`).
6. Confirm redirection to order confirmation screen (`/checkout/confirmation/[id]`).

### Test 3: Admin Operations & Receiving
1. Log into staging admin console (`https://admin.staging.thehiddenlabel.com`).
2. Navigate to Purchasing (`/purchasing`).
3. Create a supplier and draft a purchase order for 10 units.
4. Execute partial receipt of 5 units.
5. Confirm that inventory increments by 5 and an immutable entry appears in `/stock-movements`.

---

## 5. Staging Teardown & Reset Protocol

If a fresh rehearsal is needed:
```bash
# Stop all containers
docker compose -f docker-compose.prod.yml down

# Reset volumes if testing initial migration from scratch:
docker volume rm thl-prod-pgdata thl-prod-redisdata thl-prod-uploads
```
