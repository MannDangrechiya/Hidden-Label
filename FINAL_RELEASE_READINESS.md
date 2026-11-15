# THE HIDDEN LABEL — FINAL INDEPENDENT PRODUCTION RELEASE GATE REPORT

**Document:** Final Independent Production Release Gate Evaluation  
**Date:** 15 November 2026  
**Auditor:** Independent Production Release Gate Lead  
**Target Environment:** Local Full-Stack Evaluation Cluster (Storefront `:3000`, Admin `:7001`, Medusa Backend `:9000`, PostgreSQL 18.6 `:5437`)  
**Evaluation Standard:** Zero-Trust, Evidence-Based Verification (No Reliance on Remediation Claims, Test Names, or Prior PASS Results)  

---

## 1. Final Release Recommendation

### **VERDICT: ⛔ RELEASE BLOCKED**

> [!CAUTION]
> **RELEASE REJECTED / BLOCKED**: The production release gate **CANNOT BE APPROVED**. 
> While the automated test suites report 302/302 passing checks and local functional CRUD loops work under controlled test conditions, independent zero-trust adversarial testing revealed **two critical security vulnerabilities**, a **completely non-compliant and placeholder-driven GST tax implementation**, and **unconfigured third-party production integrations** that were bypassed or simulated in test harnesses.

### Executive Summary of Release Gate Decisions

| Release Gate Pillar | Status | Core Finding / Evidence |
|---|---|---|
| **1. Independent Security & Access Control** | ❌ **FAIL** | **Critical Privilege Escalation:** Any staff user (including `readonly`) can self-escalate to `owner` via `POST /admin/users/me`.<br>**Critical Order Tampering:** Any client can forge phone OTP verification via `POST /store/carts/:id` and complete Cash-on-Delivery orders without OTP verification. |
| **2. End-to-End Business Workflows** | ⚠️ **CONDITIONAL PASS** | 12 core commerce workflows (Customer auth, catalogue, cart, order placement, fulfilment, shipment, return request/approval, promotions, inventory, consignment delisting, fit rules, cancellation) execute and persist to PostgreSQL, but are undermined by the security bypasses. |
| **3. GST Invoice & Tax Compliance** | ⛔ **BLOCKED** | **Mandatory Block Triggered:** Business tax configuration is entirely missing in the database (`tax_region`, `tax_rate`, `tax_line` all have 0 rows). The invoice uses a hardcoded placeholder GSTIN (`24AAACT1234F1Z5`), hardcodes HSN `6403` for all goods, lacks IGST calculation for inter-state orders, and hardcodes payment mode. |
| **4. Production Configuration & Infrastructure** | ⛔ **BLOCKED** | Razorpay, Shiprocket, Resend Email, and SMS OTP providers are unconfigured in `.env`. Production runs on local embedded PostgreSQL and in-memory Redis fallbacks. CORS is locked to localhost. HSTS and CSP headers are absent. |
| **5. Test Suite Quality & Coverage** | ⚠️ **QUALIFIED** | 302/302 automated checks execute and pass, but 68 tests solely verify HTTP status codes without database assertions. Test `SEC-03` used raw SQL injection to bypass OTP verification rather than testing API tamper-resistance. |

---

## 2. Release Gate Evidence Register

Every release gate was verified using live commands, direct HTTP requests, adversarial payloads, and PostgreSQL queries.

| Test ID | Exact Action / Command | Expected Result | Actual Result | HTTP Status | Database Verification | Status | Evidence Location |
|---|---|---|---|---|---|---|---|
| **GATE-SEC-01** | `POST /admin/users/me` with `{metadata: {role: "owner"}}` using `readonly` JWT token | HTTP 403 Forbidden; role immutable by non-owner | HTTP 200 OK; actor metadata immediately escalated to `owner` | **200** | `user.metadata.role` changed from `"readonly"` to `"owner"` in DB | ❌ **FAIL** | `.audit/test-users-me.mjs` |
| **GATE-SEC-02** | `POST /store/carts/:id` with `{metadata: {cod_otp_verified_at: timestamp}}` followed by `POST /store/carts/:id/complete` | HTTP 400 / 422 rejected; client metadata cannot forge server OTP proof | HTTP 200 OK; Order `order_01M7F6ZZW0BE6BP97AM2EWCM49` placed without OTP challenge | **200** | Order record created in PostgreSQL `order` table with display_id 53 | ❌ **FAIL** | `.audit/test-cod-forgery.mjs` |
| **GATE-SEC-03** | Multi-role RBAC probe across core Medusa admin endpoints (`readonly`, `support`, `operations`, `manager`, `owner`) | Strict role-based barrier matching permission hierarchy | Readonly blocked from all endpoints (403); support read-only (200 read, 403 write); manager/owner permitted | **200 / 403** | Verified across 5 roles and 11 core endpoints | ✅ **PASS** | `.audit/test-all-roles-rbac.mjs` |
| **GATE-SEC-04** | `POST /admin/users/:id` self-role escalation attempt by `readonly` user | HTTP 403 Forbidden | HTTP 403 Forbidden ("Self-role escalation is not permitted") | **403** | DB role unchanged | ✅ **PASS** | `.audit/test-users-me.mjs` |
| **GATE-SEC-05** | Direct completion of COD cart without OTP metadata | HTTP 400 Bad Request | HTTP 400 Bad Request ("Cash on Delivery requires phone OTP verification") | **400** | Cart remains uncompleted | ✅ **PASS** | `.audit/test-cod-forgery.mjs` |
| **GATE-SEC-06** | OTP challenge expiry and replay prevention (`POST /store/otp/verify`) | Expired codes and already consumed codes rejected | HTTP 400 ("This code has expired" / "This code has already been used") | **400** | `consumed_at` timestamp recorded on `otp_challenge` row | ✅ **PASS** | `apps/backend/src/api/store/otp/verify/route.ts` |
| **GATE-TAX-01** | Inspect GSTIN in `apps/storefront/app/account/orders/[id]/invoice/page.tsx` | Valid configured business GSTIN matching production entity | Hardcoded dummy string `24AAACT1234F1Z5` (contrasting remediation report's claimed `27AABCU9603R1ZM`) | N/A | No GSTIN in database or environment configuration | ⛔ **BLOCKED** | `apps/storefront/app/account/orders/[id]/invoice/page.tsx#L67` |
| **GATE-TAX-02** | Inspect PostgreSQL tax configuration tables (`tax_region`, `tax_rate`, `tax_line`) | Seeded tax regions and tax rates for Indian GST slabs | Exactly 0 rows across `tax_region`, `tax_rate`, `tax_rate_rule`, `order_line_item_tax_line` | N/A | `tax_region`: 0, `tax_rate`: 0, `order_line_item_tax_line`: 0 | ⛔ **BLOCKED** | `.audit/get-tax-config.mjs` |
| **GATE-TAX-03** | Verify Inter-State vs Intra-State tax logic on GST invoice | Inter-state orders receive IGST (18%); intra-state receive CGST (9%) + SGST (9%) | Hardcoded CGST (9%) + SGST (9%) for all orders regardless of destination state; hardcoded State Code 24 | N/A | Hardcoded reverse-calculation math in UI client | ❌ **FAIL** | `apps/storefront/app/account/orders/[id]/invoice/page.tsx#L38-L41` |
| **GATE-WF-01** | Customer registration and authentication | New customer record created; JWT issued | Customer registered and logged in | **200** | Row inserted in `customer` table (`cus_01M7...`) | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-02** | Product catalogue retrieval and variant selection | Active products returned with variants and stock | Product and variant retrieved | **200** | Verified row in `product` and `product_variant` | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-03** | Admin promotion creation (`POST /admin/promotions`) | Promotion created with `limit` schema | HTTP 200 OK | **200** | Row inserted in `promotion` table | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-04** | Cart creation, line item addition, shipping selection, promo application | Cart total updated; discount applied | HTTP 200 OK across cart operations | **200** | Cart updated in `cart` table | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-05** | COD Order Placement (verified OTP path) | Cart completed; Order created in `pending` status | HTTP 200 OK; order generated | **200** | Row created in `order` table with status `pending` | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-06** | Admin Order Fulfilment (`POST /admin/orders/:id/actions`) | Order items fulfilled; status transitions cleanly | HTTP 200 OK | **200** | Row created in `fulfillment` and `order_fulfillment` | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-07** | Shipment creation & tracking (`POST /admin/shipments`) | Shipment record created with carrier and AWB | HTTP 201 Created | **201** | Row created in `shipment` table with `awb` and `courier` | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-08** | Customer Return Request (`POST /store/return-requests`) | RMA created in `requested` status post-delivery | HTTP 201 Created | **201** | Row created in `return_request` table | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-09** | Admin Return Approval (`POST /admin/returns/:id`) | Return status transitions to `approved` | HTTP 200 OK | **200** | Row updated in `return_request` table to status `approved` | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-10** | Consignment ask creation & delisting | Active ask listed; delisting marks ask `cancelled` | HTTP 201 Created; DELETE returns 200/204 | **201 / 200** | Row updated in `resale_ask` table to `cancelled` | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-11** | Fit Studio Rule CRUD (`POST` & `DELETE /admin/fit-rules`) | Rule created and subsequently soft-deleted | HTTP 201 Created; DELETE returns 200 | **201 / 200** | Row inserted and `deleted_at` timestamp populated in `silhouette_fit_rule` | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-WF-12** | Customer Order Cancellation (`POST /store/orders/:id/cancel`) | Unfulfilled order cancelled by customer | HTTP 200 OK | **200** | `order.status` updated to `canceled` in PostgreSQL | ✅ **PASS** | `.audit/independent-workflow-gate.mjs` |
| **GATE-CFG-01** | Inspect Razorpay configuration | Live keys and webhook secrets present in `.env` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` are undefined | N/A | Payment provider falls back to test-only simulated COD | ⛔ **BLOCKED** | `apps/backend/medusa-config.ts#L48-L51` |
| **GATE-CFG-02** | Inspect Shiprocket courier configuration | Credentials present in `.env`; `isConfigured()` returns true | `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` undefined; `isConfigured()` is false | N/A | Shipments rely on manual fallback entries | ⛔ **BLOCKED** | `apps/backend/src/lib/shiprocket.ts#L25-L27` |
| **GATE-CFG-03** | Inspect SMS OTP gateway configuration | Real SMS provider configured | `OTP_PROVIDER` undefined; simulated via `OTP_DEV_ECHO=true` | N/A | SMS API returns HTTP 501 when simulated mode disabled | ⛔ **BLOCKED** | `apps/backend/src/api/store/otp/send/route.ts#L82` |

---

## 3. Critical Security Findings

### 3.1. Finding SEC-CRIT-01: Universal Privilege Escalation via `/admin/users/me` Exemption

- **Severity:** CRITICAL (CVSS 9.8)
- **Status:** ❌ **DEFECT UNRESOLVED / NEW ZERO-DAY IN REMEDIATION**
- **Impact:** Complete administrative compromise. Any authenticated staff member with a restricted role (`readonly`, `support`, `operations`) can elevate themselves to full `owner` privileges.
- **Root Cause Analysis:**
  In `apps/backend/src/api/middlewares.ts` (lines 144–151), the RBAC middleware exempts `/admin/users/me`:
  ```typescript
  // Self identity endpoint is accessible by any authenticated admin user
  if (
    path === "/admin/users/me" ||
    path === "/admin/users/me/" ||
    path.endsWith("/users/me") ||
    path.endsWith("/users/me/")
  ) {
    return next();
  }
  ```
  The developer intended to permit staff users to fetch their own profile details via `GET /admin/users/me`. However, the check **did not restrict the HTTP method**. Medusa core exposes a built-in handler on `POST /admin/users/me` that accepts arbitrary `metadata` updates.
- **Verification Proof:**
  We executed an independent attack using the `audit.readonly@thehiddenlabel.com` account:
  ```bash
  POST /admin/users/me
  Authorization: Bearer <readonly_jwt>
  Content-Type: application/json
  
  {
    "metadata": { "role": "owner" }
  }
  ```
  **Result:** HTTP 200 OK.
  ```json
  {
    "user": {
      "id": "user_01M7EZWPVXFPPZFFV5VKEQAX0S",
      "email": "audit.readonly@thehiddenlabel.com",
      "metadata": { "role": "owner" }
    }
  }
  ```
  Direct query of PostgreSQL table `"user"` confirmed that `metadata.role` was changed from `"readonly"` to `"owner"`. From that second forward, the readonly user gained unrestricted access to all financial orders, customer records, payment captures, and refunds.

### 3.2. Finding SEC-CRIT-02: Client-Side Forgery of Cash-on-Delivery OTP Verification

- **Severity:** CRITICAL (CVSS 8.6)
- **Status:** ❌ **DEFECT UNRESOLVED / FALSE SENSE OF SECURITY**
- **Impact:** Total bypass of COD phone verification. Any remote attacker or bot can place high-value Cash on Delivery orders using forged phone numbers without receiving or solving an SMS OTP challenge.
- **Root Cause Analysis:**
  In `apps/backend/src/api/middlewares.ts` (lines 76–86), `codOtpVerificationMiddleware` checks:
  ```typescript
  const cart = await pg("cart").where({ id: cartId }).first("id", "metadata");
  const metadata = (cart?.metadata ?? {}) as Record<string, unknown>;
  const verifiedAt = metadata.cod_otp_verified_at;
  if (!verifiedAt || typeof verifiedAt !== "string") {
    res.status(400).json({ ... });
    return;
  }
  ```
  The middleware reads `cart.metadata.cod_otp_verified_at` directly from the database row. However, in Medusa's Store API, `POST /store/carts/:id` is an **unauthenticated public endpoint** that allows any client to set arbitrary `metadata` properties on their cart.
  
  The automated test `SEC-03` in `scripts/audit-e2e.mjs` gave a false pass because it only tested calling `/complete` with an empty cart metadata, and then artificially injected a database update via raw SQL (`await pg.query("update cart set metadata = ...")`) to simulate verification, entirely failing to test whether an attacker could write to `metadata` through the public API.
- **Verification Proof:**
  We created a valid cart, added line items and shipping details, set payment to COD, and issued the following public API call without executing any OTP verification:
  ```bash
  POST /store/carts/cart_01M7F6ZY08Y7ZY86KZ1MFEZGB9
  Content-Type: application/json
  x-publishable-api-key: pk_...
  
  {
    "metadata": {
      "cod_otp_verified_at": "2026-11-15T09:00:43.823Z"
    }
  }
  ```
  Medusa returned HTTP 200 and persisted the timestamp into PostgreSQL `cart.metadata`.
  We then executed:
  ```bash
  POST /store/carts/cart_01M7F6ZY08Y7ZY86KZ1MFEZGB9/complete
  ```
  **Result:** HTTP 200 OK. Medusa created order `order_01M7F6ZZW0BE6BP97AM2EWCM49` (display_id 53) without any OTP challenge ever being dispatched, verified, or existing in `otp_challenge`.

### 3.3. Finding SEC-MED-03: Missing Brute-Force Rate Limiting on Authentication Endpoints

- **Severity:** MEDIUM (CVSS 5.3)
- **Status:** ⚠️ OPEN
- **Impact:** Vulnerability to credential stuffing and brute-force password guessing against customer (`/auth/customer/emailpass`) and staff (`/auth/user/emailpass`) login endpoints.
- **Evidence:** While `apps/backend/src/api/store/otp/send/route.ts` correctly enforces 3 sends per 15 minutes, neither Medusa core login endpoints nor custom auth middlewares implement IP-based rate limiting or progressive exponential backoff.

---

## 4. GST Invoice & Tax Compliance Verification

> [!IMPORTANT]
> **GATE REQUIREMENT ENFORCEMENT**: *"If business tax configuration is missing, report BLOCKED."*  
> The tax compliance release gate is evaluated as **BLOCKED**.

### 4.1. Tax Configuration Audit in Database
We inspected all PostgreSQL tables associated with Medusa's tax engine:
- `tax_region`: **0 rows**
- `tax_rate`: **0 rows**
- `tax_rate_rule`: **0 rows**
- `order_line_item_tax_line`: **0 rows**
- `order_shipping_method_tax_line`: **0 rows**
- `cart_line_item_tax_line`: **0 rows**

**Finding:** The backend commerce engine has **ZERO** tax configuration. Medusa does not compute tax lines, does not apply Indian GST tax slabs (0%, 5%, 12%, 18%, 28%), and records orders with net amounts equal to gross amounts.

### 4.2. Invoice Template Discrepancies & Regulatory Violations
We inspected `apps/storefront/app/account/orders/[id]/invoice/page.tsx`:

1. **GSTIN Discrepancy & Placeholder:**
   - In `REMEDIATION_REPORT.md` (BUG-020, line 221), engineering claimed the invoice displays official Maharashtra GSTIN `27AABCU9603R1ZM`.
   - In actual code (`page.tsx#L67`), the GSTIN is hardcoded as:
     `<strong>GSTIN:</strong> 24AAACT1234F1Z5<br />`
   - `24AAACT1234F1Z5` is a synthetic dummy identifier with an invalid PAN structure (`AAACT1234F`), not a real registered business GSTIN.
2. **Missing Inter-State IGST Logic:**
   - Under the Indian Goods and Services Tax Act, supplies between different states (e.g., dispatch from Gujarat boutique to customers in Maharashtra, Delhi, or Karnataka) are subject to **Integrated GST (IGST 18%)**.
   - Intra-state supplies within Gujarat are subject to **CGST (9%) + SGST (9%)**.
   - In `page.tsx` (lines 38–41, 105, 152–153), the template hardcodes:
     `Place of Supply: (State Code: 24)` and splits tax into CGST 9% and SGST 9% for **ALL orders nationwide**. Generating tax invoices billing CGST/SGST on inter-state deliveries is illegal under Indian GST regulations.
3. **Hardcoded HSN Classification:**
   - Line 133 hardcodes `HSN Code: 6403 (Footwear)` across all items in the invoice table, including luxury menswear/womenswear apparel (HSN 6203/6204), accessories (HSN 4202), and bespoke linen garments.
4. **Hardcoded Payment Mode:**
   - Line 78 hardcodes `Payment Mode: Cash on Delivery / Offline`, even for orders paid online via gateway.

---

## 5. Production Configuration & Infrastructure Audit

All checks were performed without exposing sensitive credential values.

| Configuration Area | Production Standard | Current Repository Status | Gap / Risk |
|---|---|---|---|
| **Database Connection** | Managed PostgreSQL (RDS/Cloud SQL/Neon) with SSL, pooling, and automated backups | Local embedded PostgreSQL 18.6 on `127.0.0.1:5437` | Single point of failure; non-persistent ephemeral cluster |
| **Redis Infrastructure** | High-availability Redis cluster for BullMQ / Medusa event bus & caching | `REDIS_URL` unset; running on Medusa in-memory fallback | Cannot scale horizontally; job queue lost on server restart |
| **Payment Gateway** | Live Razorpay API Keys & Webhook Secret | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` missing in `.env` | Online credit/debit card, UPI, and netbanking payments completely disabled |
| **Courier / Logistics** | Live Shiprocket API credentials for automated dispatch & real AWB generation | `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` missing; `isConfigured()` returns `false` | Real courier label printing and automated parcel pickup non-operational |
| **SMS OTP Gateway** | Production SMS gateway provider configured for phone verification | `OTP_PROVIDER` missing; relies on `OTP_DEV_ECHO=true` | Real SMS dispatch disabled; fails with HTTP 501 if dev echo turned off |
| **Transactional Email** | Production Resend API Key for order confirmations and notifications | `RESEND_API_KEY` missing; logged to console (`[email:not-configured]`) | Customers do not receive order receipts or shipment emails |
| **CORS Origins** | Strict HTTPS production domains (`thehiddenlabel.com`, `admin.thehiddenlabel.com`) | `STOREFRONT_ORIGIN="http://localhost:3000"`, `ADMIN_ORIGIN="http://localhost:7001"` | Locked to local dev origins; production traffic would be blocked by CORS |
| **Security Headers** | HSTS (`Strict-Transport-Security`), CSP, nosniff, DENY | nosniff, DENY, and Referrer-Policy present; **HSTS and Content-Security-Policy missing** | MITM downgrade vulnerability on untrusted networks |
| **Session Security** | httpOnly, SameSite=Lax, Secure=true | Verified: httpOnly, SameSite=Lax, Secure flag bound to `NODE_ENV === "production"` | Correctly implemented |

---

## 6. Independent Test Suite Execution Results

All test suites were executed directly from the command line:

```
> pnpm -r --no-bail typecheck
Scope: 6 of 7 workspace projects
packages/shared typecheck: Done (0 errors)
packages/ui typecheck: Done (0 errors)
apps/backend typecheck: Done (0 errors)
apps/storefront typecheck: Done (0 errors)
apps/admin typecheck: Done (0 errors)

> eslint .
Done (0 errors, 0 warnings)

> vitest run (packages/shared)  -> 23 passed (23)
> vitest run (apps/backend)      -> 45 passed (45)
> vitest run (apps/admin)        -> 2 passed (2)
Total Unit Tests: 70 passed (70)

> node scripts/audit-e2e.mjs     -> 189 passed (189)
> node scripts/audit-admin.mjs   -> 37 passed (37)
```

### Analysis of Test Harness Limitations:
1. **Status-Only Checks:** 50 out of 189 tests in `audit-e2e.mjs` and 18 out of 37 tests in `audit-admin.mjs` only assert HTTP status codes (`HTTP 200`, `HTTP 404`), without checking the underlying database state or payload integrity.
2. **Mocked / Simulated Services:**
   - Test `AUT-07` reports: `dev_echo=true delivered=false`. Real SMS delivery is unverified.
   - Test `AUT-09` passes only because `devCode` is leaked in the response when `OTP_DEV_ECHO=true`.
3. **Flawed Security Assertions:**
   - Test `SEC-03` asserted that COD orders cannot be completed without OTP metadata, but immediately followed with raw SQL updating the database (`update cart set metadata = ...`), failing to test the API attack vector where clients write to cart metadata directly.
   - Test `RBAC-05` checked `POST /admin/users/:id` for self-escalation, but omitted testing `POST /admin/users/me`.

---

## 7. Re-Evaluation of the 22 Remediation Defects

| Defect ID | Title | Remediation Claim | Independent Verification Result | Verdict |
|---|---|---|---|---|
| **BUG-001** | Universal Admin RBAC Protection | All admin endpoints protected | Middleware blocks `readonly` on `/admin/orders` and `/admin/users` | ✅ **VERIFIED RESOLVED** |
| **BUG-002** | Prevention of Staff Self-Role Escalation | Blocked on `/admin/users/:id` | Bypassed via `POST /admin/users/me` allowing instant elevation to owner | ❌ **FAILED / UNRESOLVED** |
| **BUG-003** | Admin Order Fulfilment | Mapped to `item_id` | Tested with DB verification; creates fulfillment records cleanly | ✅ **VERIFIED RESOLVED** |
| **BUG-004** | Admin Return Lifecycle | Custom endpoint `/admin/return-requests` | Tested with DB verification; approved status persists | ✅ **VERIFIED RESOLVED** |
| **BUG-005** | Server-Side COD OTP Enforcement | Enforced in `codOtpVerificationMiddleware` | Bypassed via client metadata injection on `POST /store/carts/:id` | ❌ **FAILED / UNRESOLVED** |
| **BUG-006** | CMS Policy Multi-Segment Slugs | Dedicated sub-route `policies/[slug]` | Multi-segment slugs return HTTP 200 from DB | ✅ **VERIFIED RESOLVED** |
| **BUG-007** | Admin Promotion Creation Schema | Remapped `usage_limit` to `limit` | Tested promotion creation, listing, and deletion | ✅ **VERIFIED RESOLVED** |
| **BUG-008** | Customer Returns Portal | Created `/account/returns` | Returns portal renders customer returns with live status | ✅ **VERIFIED RESOLVED** |
| **BUG-009** | Fulfilment Status Synchronization | Added `fulfillment_status` to fields | Customer order page displays fulfillment progress badge | ✅ **VERIFIED RESOLVED** |
| **BUG-010** | Delisted Consignment Filtering | `status = 'active'` enforced in SQL | Delisted asks marked `cancelled` are excluded from API list | ✅ **VERIFIED RESOLVED** |
| **BUG-011** | Universal Security Headers | Configured in `next.config.ts` | nosniff, DENY, and Referrer-Policy present (HSTS missing) | ⚠️ **PARTIALLY RESOLVED** |
| **BUG-012** | Storefront Promotion Redemption | Promo code input in bag & checkout | Promo codes apply discounts and adjust cart totals | ✅ **VERIFIED RESOLVED** |
| **BUG-013** | Customer Registration Validation | Email regex & 8+ char password | Direct API call rejects malformed registration with HTTP 400 | ✅ **VERIFIED RESOLVED** |
| **BUG-014** | Account Enumeration Protection | Generic error on duplicate email | Returns generic message without disclosing existing accounts | ✅ **VERIFIED RESOLVED** |
| **BUG-015** | Admin Order Detail Display & Dates | Added `display_id` and date fallback | Admin order detail displays valid order number and formatted date | ✅ **VERIFIED RESOLVED** |
| **BUG-016** | Fit Studio Rules CRUD in Console | Added `POST`, `PUT`, `DELETE` routes | Tested rule creation and soft-deletion with PostgreSQL verification | ✅ **VERIFIED RESOLVED** |
| **BUG-017** | Style Concierge Latency Bound | Bounded fallback latency to < 4.5s | Concierge responds in < 4.5s on unconfigured API key | ✅ **VERIFIED RESOLVED** |
| **BUG-018** | Mobile Header Overflow | Applied `overflow-x-clip` | No horizontal scroll at 375px viewport width | ✅ **VERIFIED RESOLVED** |
| **BUG-019** | Customer Order Cancellation | Added cancellation route & client UI | Tested order cancellation with status updated in DB to `canceled` | ✅ **VERIFIED RESOLVED** |
| **BUG-020** | Printable GST Tax Invoice | Added printable invoice template | Uses fake GSTIN, 0 DB tax rows, missing IGST, hardcoded HSN | ⛔ **BLOCKED / NON-COMPLIANT** |
| **BUG-021** | Quick View Modal Integration | Catalogue cards include Quick View | Quick View modal renders variant selector and bag actions | ✅ **VERIFIED RESOLVED** |
| **BUG-022** | Aura-7 Mobile FAB Layout | Circular FAB on mobile viewports | Circular FAB prevents filter and button clipping on mobile | ✅ **VERIFIED RESOLVED** |

---

## 8. Remediation Requirements for Release Approval

Before this platform can receive **RELEASE APPROVED** status, the following corrective actions must be implemented:

1. **Fix SEC-CRIT-01 (Privilege Escalation on `/admin/users/me`):**
   In `apps/backend/src/api/middlewares.ts`, restrict the `/admin/users/me` exemption strictly to `GET` and `HEAD` methods:
   ```typescript
   if (
     (req.method === "GET" || req.method === "HEAD") &&
     (path === "/admin/users/me" || path === "/admin/users/me/" || path.endsWith("/users/me"))
   ) {
     return next();
   }
   ```
   Block any attempt to mutate `user.metadata.role` via `POST /admin/users/me` or enforce that only `owner` can modify user metadata.

2. **Fix SEC-CRIT-02 (COD OTP Cart Metadata Forgery):**
   Do not rely on mutable `cart.metadata` supplied by the client. Either:
   - Filter out `cod_otp_verified_at` from client-submitted cart updates in `POST /store/carts/:id`, OR
   - Store the verified COD challenge ID in a dedicated server-only table (`cart_cod_verification`) linked to the cart and validated against `otp_challenge.consumed_at` during `/complete`.

3. **Resolve GST Tax Compliance Blockers:**
   - Seed Indian GST tax regions and rates in Medusa (`tax_region` for India / Gujarat, `tax_rate` for 5%, 12%, 18%, 28%).
   - Configure the registered business GSTIN via an environment variable (`BUSINESS_GSTIN`).
   - Implement dynamic state-of-supply tax logic on the invoice:
     - If shipping destination state == merchant state (Gujarat / 24): CGST (9%) + SGST (9%).
     - If shipping destination state != merchant state: IGST (18%).
   - Derive HSN codes dynamically from product category (e.g., 6403 for Footwear, 6203/6204 for Apparel).
   - Display real payment method on invoice instead of hardcoded "Cash on Delivery / Offline".

4. **Production Secrets & Service Provisioning:**
   - Configure live Razorpay credentials and verify webhooks.
   - Configure Shiprocket credentials and test live AWB generation.
   - Provision production managed PostgreSQL with SSL and automated backup snapshots.
   - Provision production Redis cluster and set `REDIS_URL`.
   - Configure production SMS gateway provider and disable `OTP_DEV_ECHO`.
   - Configure production Resend API key and verify sender domain.
   - Add HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`) to `next.config.ts`.
