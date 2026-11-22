# THE HIDDEN LABEL — PRODUCTION DEPLOYMENT & GO-LIVE CHECKLIST

**Execution Target:** Production Staging & Live Cutover  
**Target Architecture:** Docker Compose Multi-Stage Containers, PostgreSQL 18, Redis 7, Nginx Reverse Proxy  

---

## Phase 1: Commercial & Legal Sign-Off (Business Owner)

- [ ] **1.1 Legal Metrology & Corporate Registration Details**
  - [ ] Provide Corporate Identity Number (CIN).
  - [ ] Provide Registered Office Address & Official Contact Number.
  - [ ] Appoint Statutory Grievance Officer and supply name, email, and postal address.
  - [ ] Update placeholder strings in `apps/storefront/app/policies/grievance/page.tsx` and `apps/storefront/components/footer.tsx`.

- [ ] **1.2 Resale Commercial Policy Ratification**
  - [ ] Ratify fixed-price consignment curation (recommended for launch; leaves `NEXT_PUBLIC_FEATURE_BIDDING=false`).
  - [ ] Ratify official consignment commission rate (e.g., 10%, 12%, 15%) and inject into `.env.production` (`CONSIGNMENT_COMMISSION_RATE=0.12`).
  - [ ] Authorize payout disbursement cycle (e.g. weekly bank NEFT/RTGS after 7-day return clearance hold).

---

## Phase 2: External Account Onboarding & Credentials

- [ ] **2.1 Razorpay Payment Gateway**
  - [ ] Complete business KYC and activate live payment processing.
  - [ ] Generate Live Key ID and Live Key Secret in Razorpay Merchant Dashboard.
  - [ ] Configure Webhook URL: `https://api.thehiddenlabel.com/webhooks/razorpay`.
  - [ ] Select Webhook Events: `payment.captured`, `payment.failed`, `order.paid`.
  - [ ] Set a strong Webhook Secret and note it for `.env.production`.

- [ ] **2.2 Shiprocket Logistics**
  - [ ] Complete commercial business contract and load shipping wallet balance.
  - [ ] Configure pickup warehouse location in Ahmedabad / Gujarat hub.
  - [ ] Generate API credentials and set `SHIPROCKET_WEBHOOK_TOKEN`.
  - [ ] Configure Webhook URL in Shiprocket Dashboard: `https://api.thehiddenlabel.com/webhooks/shiprocket`.

- [ ] **2.3 Resend Transactional Email**
  - [ ] Create Resend production organization.
  - [ ] Add domain `thehiddenlabel.com` and configure DNS SPF, DKIM, and DMARC records.
  - [ ] Verify domain status in Resend dashboard.
  - [ ] Generate Production API Key (`re_...`).

- [ ] **2.4 Google Gemini AI**
  - [ ] Create Google Cloud project and enable Vertex AI / Gemini API.
  - [ ] Generate production API key with usage quotas configured.

---

## Phase 3: Server & Infrastructure Setup

- [ ] **3.1 Server Provisioning**
  - [ ] Provision Ubuntu 24.04 LTS VPS (recommended: 4 vCPU, 8GB RAM, 80GB SSD).
  - [ ] Install Docker Engine (`>= 26.x`) and Docker Compose (`>= 2.x`).
  - [ ] Configure UFW firewall: allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS); deny 5432 (Postgres), 6379 (Redis), 9000 (Backend).

- [ ] **3.2 Domain DNS Configuration**
  - [ ] Configure DNS A records pointing to server IP:
    - `thehiddenlabel.com` → `<SERVER_IP>`
    - `www.thehiddenlabel.com` → `<SERVER_IP>`
    - `admin.thehiddenlabel.com` → `<SERVER_IP>`
    - `api.thehiddenlabel.com` → `<SERVER_IP>`
  - [ ] Allow DNS propagation (TTL: 300s).

- [ ] **3.3 SSL Certificate Generation**
  - [ ] Execute Certbot in standalone/webroot mode:
    ```bash
    certbot certonly --webroot -w /var/www/certbot \
      -d thehiddenlabel.com -d www.thehiddenlabel.com \
      -d admin.thehiddenlabel.com -d api.thehiddenlabel.com
    ```
  - [ ] Symlink certificates to `./deploy/ssl/` as mapped in `docker-compose.prod.yml`:
    - `fullchain.pem`
    - `privkey.pem`

---

## Phase 4: Environment Configuration & Secret Injection

- [ ] **4.1 Generate Cryptographic Secrets**
  - [ ] Generate JWT secret: `openssl rand -hex 32`
  - [ ] Generate Cookie secret: `openssl rand -hex 32`
  - [ ] Generate Postgres password: `openssl rand -hex 24`
  - [ ] Generate Redis password: `openssl rand -hex 24`

- [ ] **4.2 Create Environment Files**
  - [ ] Populate `apps/backend/.env.production` (see `.env.production.example`).
  - [ ] Populate `apps/storefront/.env.production`.
  - [ ] Populate `apps/admin/.env.production`.
  - [ ] Restrict file permissions: `chmod 600 apps/*/.env.production`.

---

## Phase 5: Database Deployment & Seed Migration

- [ ] **5.1 Database Initialization**
  - [ ] Start database and cache services:
    ```bash
    docker compose -f docker-compose.prod.yml up -d postgres redis
    ```
  - [ ] Verify health: `docker compose -f docker-compose.prod.yml ps` (both must show `healthy`).

- [ ] **5.2 Execute Database Migrations**
  - [ ] Run Medusa core and custom THL migrations:
    ```bash
    pnpm --filter @thl/backend medusa db:migrate
    ```

- [ ] **5.3 Sanitize Database Fixtures**
  - [ ] Ensure no development audit artifacts exist:
    ```bash
    npx tsx scripts/clean-test-fixtures.ts --commit
    ```

---

## Phase 6: Application Deployment & Reverse Proxy Launch

- [ ] **6.1 Build and Launch All Containers**
  - [ ] Execute Docker Compose production launch:
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```
  - [ ] Verify container states:
    ```bash
    docker compose -f docker-compose.prod.yml ps
    ```
  - [ ] Ensure `thl-backend-prod`, `thl-storefront-prod`, `thl-admin-prod`, and `thl-nginx-prod` are all `Up`.

- [ ] **6.2 Telemetry & Health Probe Verification**
  - [ ] Test Storefront health probe: `curl -I https://thehiddenlabel.com/api/health` → HTTP 200
  - [ ] Test Admin health probe: `curl -I https://admin.thehiddenlabel.com/api/health` → HTTP 200
  - [ ] Test Backend health probe: `curl -I https://api.thehiddenlabel.com/healthz` → HTTP 200
  - [ ] Test SSL headers: verify `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`.

---

## Phase 7: Live Gateway Smoke Test & Go-Live Verification

- [ ] **7.1 Live Payment Drill**
  - [ ] Customer registers vault account on `https://thehiddenlabel.com/register`.
  - [ ] Adds a test piece to bag and proceeds through checkout.
  - [ ] Executes real ₹1 test transaction using UPI or Card.
  - [ ] Verifies redirection to `/checkout/confirmation/[id]` with real order display ID (`THL-XXXX`).
  - [ ] Verifies order confirmation email delivered via Resend.
  - [ ] Verifies webhook processed in `apps/backend` logs (`order.paid`).

- [ ] **7.2 Order Fulfillment & AWB Drill**
  - [ ] Admin logs into `https://admin.thehiddenlabel.com`.
  - [ ] Opens order detail and generates packing slip.
  - [ ] Triggers Shiprocket courier booking; confirms AWB generation.
  - [ ] Customer order detail reflects courier tracking link.

- [ ] **7.3 Refund & Credit Note Drill**
  - [ ] Admin issues full refund on the ₹1 test transaction.
  - [ ] Verifies Razorpay refund status and credit note generation (`CN-THL-XXXX`).
  - [ ] Confirms inventory remains correctly balanced.

---

## Phase 8: Rollback & Incident Response Procedures

- **Container Rollback:** If a defect is detected during deployment:
  ```bash
  docker compose -f docker-compose.prod.yml down
  # Revert to previous image tag or commit
  docker compose -f docker-compose.prod.yml up -d
  ```
- **Database Rollback:** If database corruption occurs:
  ```bash
  ./scripts/db-restore.sh /path/to/backup/thl_db_YYYYMMDD.dump
  ```
- **Emergency Circuit Breaker:** In case of payment gateway anomaly, revoke keys or unset `RAZORPAY_KEY_ID` to immediately fail checkout closed rather than risking uncaptured transactions.
