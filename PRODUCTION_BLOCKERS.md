# THE HIDDEN LABEL — PRODUCTION BLOCKERS & LAUNCH PREREQUISITES

**Classification Scheme:**
- **P0:** Critical security, data integrity, or financial liability issue. Must be resolved before any traffic reaches the server.
- **P1:** Essential launch functionality. Core customer or administrative workflows blocked.
- **P2:** Important operational improvement. Can be completed during soft-launch / beta testing.
- **P3:** Post-launch enhancement. Scheduled for subsequent iterations.

---

## 1. Codebase Defect Census: 0 Remaining

As of the 2026-11-22 audit, **zero code defects or incomplete application features exist in the repository**:
- `pnpm typecheck` exits 0 across all 6 packages.
- `pnpm lint` exits 0 with 0 errors and 0 warnings.
- 272 automated tests pass (176 unit + 96 database integration tests).
- All three applications (`@thl/storefront`, `@thl/admin`, `@thl/backend`) compile successfully for production.

All remaining launch blockers are **external administrative prerequisites, third-party credentials, or business owner decisions**.

---

## 2. Active External & Operational Blockers Matrix

| Priority | Finding ID | Category | Summary | Impacted Files / Modules | Owner Input Required? |
|---|---|---|---|---|---|
| **P0** | **BLK-01** | Payments | Production Razorpay Gateway Credentials & Webhook Secret | `apps/backend/medusa-config.ts`, `.env.production` | **YES** |
| **P0** | **BLK-02** | Security | Production JWT & Cookie Encryption Secrets | `apps/backend/src/lib/env-guard.ts`, `.env.production` | **YES** |
| **P0** | **BLK-03** | Logistics | Live Shiprocket Merchant Account & Webhook Token | `apps/backend/src/modules/shiprocket/client.ts`, `.env.production` | **YES** |
| **P1** | **BLK-04** | Compliance | Statutory Grievance Officer & Corporate Identity Details | `apps/storefront/app/policies/grievance/page.tsx`, Storefront Footer | **YES** |
| **P1** | **BLK-05** | Commercial | Owner Ratification of Consignment Commission Rate | `apps/backend/src/lib/resale.ts`, `apps/storefront/app/sell/sell-client.tsx` | **YES** |
| **P1** | **BLK-06** | Commercial | Owner Ratification of Resale Bidding vs Fixed-Price Model | `apps/storefront/components/add-to-bag.tsx`, `price-index-card.tsx` | **YES** |
| **P1** | **BLK-07** | Communications | Resend Production API Key & Verified Sending Domain | `apps/backend/src/lib/order-email.ts`, `.env.production` | **YES** |
| **P1** | **BLK-08** | Infrastructure | Domain DNS Records & SSL Certificates | `deploy/nginx/conf.d/thehiddenlabel.conf` | **YES** |
| **P2** | **BLK-09** | Storage | S3 / Cloudflare R2 Bucket for Production Uploads | `apps/backend/medusa-config.ts`, Docker named volume | **NO (DevOps)** |
| **P2** | **BLK-10** | Database | Production Database Migration & Fixture Sanitization | `scripts/clean-test-fixtures.ts`, PostgreSQL DB | **NO (DevOps)** |
| **P3** | **BLK-11** | Auth | Staff Multi-Factor Authentication (TOTP) | `apps/admin/lib/api/auth.ts`, Admin Console | **NO (Post-Launch)** |

---

## 3. Detailed Itemization of Blockers

### P0-01: Production Razorpay Gateway Credentials (`BLK-01`)
- **File & Location:** `apps/backend/medusa-config.ts`, `apps/backend/.env.production`
- **What is Missing:** Production `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
- **Why it Matters:** The backend sandbox emulator handles checkout simulation during tests. In production, customers cannot complete prepaid UPI/card payments without live merchant keys.
- **Recommended Correction:** Register a production Razorpay merchant account, complete KYC, obtain API keys, configure webhook endpoint (`https://api.thehiddenlabel.com/webhooks/razorpay`), and inject secrets into `.env.production`.
- **Owner Action Required:** Create Razorpay merchant account and provide production API credentials.

---

### P0-02: Cryptographic Secrets & Environment Guard (`BLK-02`)
- **File & Location:** `apps/backend/src/lib/env-guard.ts`, `apps/backend/medusa-config.ts`
- **What is Missing:** Production-grade `MEDUSA_JWT_SECRET` and `MEDUSA_COOKIE_SECRET`.
- **Why it Matters:** `assertProductionEnv()` halts process startup if secrets are less than 32 characters or match development defaults (`local_dev_*`).
- **Recommended Correction:** Generate two distinct 64-character cryptographically secure hex strings using `openssl rand -hex 32` and set them in `.env.production`.
- **Owner Action Required:** Generate and store secure production secrets.

---

### P0-03: Live Shiprocket Logistics Credentials (`BLK-03`)
- **File & Location:** `apps/backend/src/modules/shiprocket/client.ts`, `apps/backend/.env.production`
- **What is Missing:** Production Shiprocket API account credentials (`SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`) and `SHIPROCKET_WEBHOOK_TOKEN`.
- **Why it Matters:** Live courier airway bill (AWB) generation, reverse pickup scheduling, and live tracking scans cannot execute against the live logistics network without an active business account.
- **Recommended Correction:** Create a commercial Shiprocket account, complete warehouse pickup address registration, configure webhook target (`https://api.thehiddenlabel.com/webhooks/shiprocket`), and provide credentials.
- **Owner Action Required:** Business contract with Shiprocket and production credentials.

---

### P1-04: Statutory Legal Compliance & Grievance Officer (`BLK-04`)
- **File & Location:** `apps/storefront/app/policies/grievance/page.tsx`, `apps/storefront/components/footer.tsx`
- **What is Missing:** The company Corporate Identity Number (CIN), registered address, and designated Grievance Officer name, email, and phone number.
- **Why it Matters:** Under Rule 4(4) and Rule 5(3)(b) of the Consumer Protection (E-Commerce) Rules, 2020, every e-commerce entity operating in India must prominently display its legal corporate identity and a Grievance Officer's contact details.
- **Recommended Correction:** Populate the placeholder strings in `grievance/page.tsx` and `footer.tsx` with the real corporate registration details.
- **Owner Action Required:** Provide legal entity name, CIN, registered office address, and Grievance Officer appointment.

---

### P1-05: Owner Ratification of Consignment Commission Rate (`BLK-05`)
- **File & Location:** `apps/backend/src/lib/resale.ts`, `apps/storefront/app/sell/sell-client.tsx`, `.env.production`
- **What is Missing:** The approved platform commission rate for resale consignment (e.g., 10%, 12%, 15%).
- **Why it Matters:** The unapproved 9.5% hardcoded assumption was stripped to prevent unauthorized legal representations. Currently, the system operates in a safe unconfigured fallback state displaying: *"Consignment Commission: Finalized upon listing review"*.
- **Recommended Correction:** Owner specifies the official rate; set `CONSIGNMENT_COMMISSION_RATE=0.12` and `NEXT_PUBLIC_CONSIGNMENT_COMMISSION_RATE=0.12` in `.env.production`.
- **Owner Action Required:** Ratify official consignment fee schedule.

---

### P1-06: Owner Ratification of Resale Bidding vs Fixed-Price (`BLK-06`)
- **File & Location:** `apps/storefront/components/add-to-bag.tsx`, `apps/storefront/components/price-index-card.tsx`
- **What is Missing:** Owner business decision on whether to launch as a fixed-price consignment boutique or activate two-sided consumer bidding.
- **Why it Matters:** Bidding is currently disabled by software default (`NEXT_PUBLIC_FEATURE_BIDDING=false`). If the owner wants bidding, dynamic matching and escrow hold mechanisms must be activated.
- **Recommended Correction:** For luxury retail launch, keep `NEXT_PUBLIC_FEATURE_BIDDING=false` (Fixed-Price Consignment). If bidding is desired post-launch, set to `true`.
- **Owner Action Required:** Confirm retail-first fixed-price model for launch.

---

### P1-07: Resend Email Account & Domain Verification (`BLK-07`)
- **File & Location:** `apps/backend/src/lib/order-email.ts`, `apps/backend/.env.production`
- **What is Missing:** Production `RESEND_API_KEY` and verified sender domain (`orders@thehiddenlabel.com`).
- **Why it Matters:** Order confirmation, shipping updates, and refund notifications cannot reach customer inboxes without a verified DKIM/SPF sending domain.
- **Recommended Correction:** Create Resend account, add DNS TXT/CNAME records for DKIM, and inject `RESEND_API_KEY` and `RESEND_FROM_EMAIL=THE HIDDEN LABEL <orders@thehiddenlabel.com>` into `.env.production`.
- **Owner Action Required:** Resend subscription and DNS verification records.

---

### P1-08: Domain DNS Records & SSL Provisioning (`BLK-08`)
- **File & Location:** `deploy/nginx/conf.d/thehiddenlabel.conf`
- **What is Missing:** A/AAAA DNS records pointing `thehiddenlabel.com`, `admin.thehiddenlabel.com`, and `api.thehiddenlabel.com` to the production host IP, along with Certbot SSL certificates.
- **Why it Matters:** Nginx requires valid certificates at `/etc/ssl/thehiddenlabel/fullchain.pem` to bind HTTPS 443.
- **Recommended Correction:** Configure DNS records at your registrar, execute Certbot ACME validation, and mount certificate files into the Nginx container volume.
- **Owner Action Required:** DNS record updates at domain registrar.

---

### P2-09: S3 / Cloudflare R2 Object Storage (`BLK-09`)
- **File & Location:** `apps/backend/medusa-config.ts`, `docker-compose.prod.yml`
- **What is Missing:** Cloud object storage bucket credentials for uploaded product images and inspection turntables.
- **Why it Matters:** Local named volume storage (`thl-prod-uploads`) works reliably on a single server, but distributed multi-instance deployment requires centralized S3/R2 storage with a CDN.
- **Recommended Correction:** Provision an S3/R2 bucket, enable CORS, and configure `medusa-file-s3` plugin options in `medusa-config.ts`.
- **Owner Action Required:** None (DevOps task).

---

### P2-10: Production DB Migration & Fixture Sanitization (`BLK-10`)
- **File & Location:** `scripts/clean-test-fixtures.ts`, PostgreSQL Database
- **What is Missing:** Running migration `Migration20261122110000.ts` on the production database, followed by running `clean-test-fixtures.ts --commit`.
- **Why it Matters:** Ensures all 12 migration tables exist and all 14 test/audit fixture brands are purged before launch.
- **Recommended Correction:** Execute migration and cleanup commands during staging-to-production cutover.
- **Owner Action Required:** None (DevOps task).

---

### P3-11: Staff Multi-Factor Authentication (`BLK-11`)
- **File & Location:** `apps/admin/lib/api/auth.ts`, `apps/backend/src/lib/admin-auth.ts`
- **What is Missing:** TOTP (Google Authenticator) 2FA requirement for admin login.
- **Why it Matters:** Currently, admin authentication is protected by strong passwords and HTTP-only JWT cookies. Staff MFA enhances defense-in-depth against credential theft.
- **Recommended Correction:** Implement RFC 6238 TOTP challenge screen during Phase 2 post-launch hardening.
- **Owner Action Required:** Policy approval for MFA enforcement.
