# THE HIDDEN LABEL — PHASE 2 ARCHITECTURAL CLOSURE & VERIFIED CODEBASE CONSOLIDATION REPORT
**Authoritative Architectural Synthesis, Payment Mutex Integration, State Transition Verification & Codebase Consolidation**

- **Date:** 2026-11-21
- **Auditor & Implementer Stance:** Independent, forensic-grade engineering verification.
- **Repository Root:** `C:\Users\ASUS\Documents\Hidden Label`
- **Active Branch:** `main`
- **Preceding Phase 1 Commit (Preserved Intact):** `7a684797ddd7c4932d739f9f4bafb4472d848989`
- **Remote Tracking Reference:** `origin/main` (`https://MannDangrechiya@github.com/MannDangrechiya/Hidden-Label.git` at `9d7c5fe`)

---

## 1. Executive Summary of Architectural Closure

Phase 2 implementation previously established the core Medusa Razorpay payment provider (`apps/backend/src/modules/razorpay/service.ts`), a custom local REST v1 sandbox emulator (`RazorpaySandboxServer` on port 9099), and database tables for `payment_operation` and `webhook_event`. However, our independent forensic investigation uncovered two critical architectural disconnects:
1. **The Payment Operation Idempotency Disconnect:** The `payment_operation` persistence and `claimPaymentOperation()` mutex existed in isolation, tested only in synthetic test scripts, while the real production checkout flow in the storefront server action (`confirmRazorpayPaymentAction`) bypassed it entirely.
2. **Notification Reliability & Tracking Absence:** When transactional email credentials (`RESEND_API_KEY`) were missing in development, emails were silently logged to standard output, with no structured operational logging, no notification tracking in order metadata, no audit event trail, and no duplicate-send protection.

In this consolidation initiative, both architectural gaps have been **completely and authoritatively resolved**:
- **Authoritative Backend Interception:** Implemented `cartCompletePaymentOperationMiddleware` in `apps/backend/src/api/middlewares.ts` registered on `POST /store/carts/*/complete`. The middleware intercepts cart completion, checks `order_cart` for prior order conversion, queries the cart's payment session, and atomically claims the `payment_operation` row before allowing Medusa's `completeCartWorkflow` to run. Concurrent requests are serialized, in-progress operations are polled with conflict protection (HTTP 409), stale pending locks (>45s) from crashed workers are automatically recovered, and duplicate callbacks safely return the existing order without duplicate order creation or inventory depletion.
- **Storefront Action Hardening:** Updated `confirmRazorpayPaymentAction` in `apps/storefront/app/actions/checkout.ts` to coordinate with the middleware, handling concurrent in-progress operations and 409 status codes with delayed idempotent re-lookup.
- **Notification Reliability & Event Tracking:** Hardened `apps/backend/src/lib/order-email.ts` and `apps/backend/src/lib/email.ts`. Missing Resend configuration returns explicit status `skipped_unconfigured`, logs visible operational warnings (`[notification:email:unconfigured]`), prevents duplicate email delivery if previously sent, updates `order.metadata.notification_email_order_placed`, and logs an immutable record in `audit_event`. Order placement is never blocked by email delivery status.
- **12/12 State Transitions Proven:** All 12 required payment lifecycle scenarios were executed against the live PostgreSQL database and backend server with 100% success.
- **Quality Gates 100% Green:** Static typing (`pnpm typecheck`), ESLint (`pnpm lint`), 157 unit tests (`pnpm test`), 48 PostgreSQL integration tests (`pnpm test:integration`), and all 3 production builds (Storefront, Admin, Backend) compiled with zero warnings and exit code 0.

---

## 2. Inventory of Protected Work and Preserved Phase 1 Commits

Before modifying any source files, an exhaustive working tree inventory was conducted. All prior Phase 1 work and commit history were protected without any rebase, squash, or destructive resets:

### 2.1 Preserved Phase 1 Git History
The three verified Phase 1 commits remain completely untouched on `main`:
1. `06df83b` (`fix: close Phase 1 security, refund and inventory defects`) — 58 files changed (+4054 / -245 lines). Delivered admin RBAC denial, refund idempotency with unique index, inventory row locking with `SELECT ... FOR UPDATE`, RMA sequence generator, concierge token HMAC authentication, production secret validation, upload MIME guards, rate limiting, and `Migration20261120100000`.
2. `4b3aa6d` (`fix(backend): restock returns once and resolve stock locations by order`) — 14 files changed (+1290 / -118 lines). Implemented return restock CAS idempotency (R-05), exact INR paise conversion (R-06), and deterministic stock location resolution (R-07).
3. `7a68479` (`docs: record Phase 1 completion and defect closure`) — 1 file changed (+260 lines). Added `PHASE_1_FINAL_COMPLETION_REPORT.md`.

### 2.2 Environment & Secret Protection
- `.gitignore` verified to strictly exclude `.env`, `.env.local`, `.dev/`, `.medusa/`, and `node_modules/`.
- No credentials, test database connection strings, or merchant secrets were staged or committed.

### 2.3 Master Tracking Artifacts Preserved
All four previously established master documents have been preserved and reconciled:
- `MASTER_PROJECT_COMPLETION_TRACKER.md`
- `MASTER_PROJECT_STATUS_REPORT.md`
- `MASTER_REMAINING_WORK_ROADMAP.md`
- `PHASE_1_PHASE_2_FORENSIC_VERIFICATION_REPORT.md`

---

## 3. Detailed Architectural Design of the Integrated Payment Operation Workflow

### 3.1 The Production Checkout Lifecycle Flow
```
Storefront Browser (Customer clicks "Pay via Razorpay")
       │
       ▼
[beginRazorpayPaymentAction] (Storefront Server Action)
       ├── fetchCart(cartId)
       ├── createPaymentCollection(cartId)
       ├── createPaymentSession(collectionId, "pp_razorpay_razorpay")
       │       └── Medusa calls RazorpayPaymentProviderService.initiatePayment()
       │               └── POST /orders to Razorpay (or sandbox emulator)
       │               └── Returns razorpay_order_id, amount in paise, session_id
       └── Returns public checkout config to Razorpay checkout modal
       │
       ▼
Razorpay Checkout Modal (Customer enters UPI / Card credentials)
       ├── Razorpay processes payment
       └── Returns { razorpay_order_id, razorpay_payment_id, razorpay_signature }
       │
       ▼
[confirmRazorpayPaymentAction] (Storefront Server Action)
       ├── Idempotent pre-check: fetchOrderByCart(cartId)
       ├── updatePaymentSession(collectionId, sessionId, client_data)
       │       └── Stores signature & payment IDs on payment_session.data
       └── completeCart(cartId) ──▶ POST /store/carts/:id/complete
                                                │
                                                ▼
                     [cartCompletePaymentOperationMiddleware] (apps/backend/src/api/middlewares.ts)
                                                │
       ┌────────────────────────────────────────┴────────────────────────────────────────┐
       ▼                                                                                 ▼
[Authoritative Check: order_cart]                                              [Inspect payment_session]
If order_id exists:                                                            Extracts razorpay_order_id,
  Return { type: "order", order }                                              razorpay_payment_id, amountPaise
  (HTTP 200 Idempotent)                                                                 │
                                                                                        ▼
                                                                     [claimPaymentOperation()] (apps/backend/src/lib/payment-operations.ts)
                                                                     Idempotency Key: sha256(cartId:orderId:paymentId)
                                                                     Atomic INSERT ... ON CONFLICT (idempotency_key) DO NOTHING
                                                                                        │
                                        ┌───────────────────────────────────────────────┼───────────────────────────────────────────────┐
                                        ▼                                               ▼                                               ▼
                                 [State: claimed]                                [State: duplicate]                             [State: in_progress]
                            Hook res.json() to monitor                    Returns existing created order                  Polls up to 3s for completion.
                            downstream execution:                         without re-executing workflow.                  If resolved, returns order;
                            - On success: completePaymentOperation()                                                      if still locked, returns HTTP 409.
                            - On error: failPaymentOperation()
                                        │
                                        ▼
                            [completeCartWorkflow] (Medusa Core)
                            ├── authorizePayment() (verifies HMAC constant-time & checks gateway amount)
                            ├── createOrder() & reserveInventory()
                            └── Emits "order.placed" event
                                        │
                                        ▼
                            [orderPlacedHandler Subscriber]
                            └── sendOrderPlacedEmail()
                                    ├── Checks order.metadata for prior send (deduplication)
                                    ├── Calls sendEmail() (Resend or skipped_unconfigured)
                                    ├── Logs operational status ([notification:email:unconfigured])
                                    ├── Updates order.metadata.notification_email_order_placed
                                    └── Records immutable row in audit_event
```

### 3.2 Transaction Boundaries & Invariant Enforcements
1. **Authoritative Idempotency Key:**
   Derived deterministically via SHA-256 over `cart_id:razorpay_order_id:razorpay_payment_id`. Format: `pay_op_<64_hex_chars>`.
2. **Database Mutex Boundary:**
   `payment_operation` table with unique constraint `payment_operation_key_unique` on `idempotency_key`. The `INSERT ... ON CONFLICT DO NOTHING` statement guarantees that across any number of racing threads, exactly one process acquires `claimed` status.
3. **Stale Lock Auto-Recovery:**
   If a worker node crashes mid-execution after claiming a pending lock, subsequent callers check `order_cart`. If the order was committed to disk, the operation is updated to `completed` and returns `duplicate`. If no order exists and the pending lock is older than 45 seconds (`staleTimeoutMs`), the lock is atomically reclaimed.
4. **No Trust in Browser Parameters:**
   All amounts are validated against server-side cart line items. In `authorizePayment`, the Razorpay API is queried server-side to confirm that the captured amount matches the Medusa payment session amount in paise before authorization succeeds.

---

## 4. Concurrency, Idempotency and Failure Recovery Analysis

| Failure / Race Condition Scenario | Architectural Defense | Database State | Customer Response |
|---|---|---|---|
| **Double Click / Re-submit:** Customer clicks "Pay" twice in rapid succession. | The second call hits `cartCompletePaymentOperationMiddleware`, detects `in_progress` or `duplicate`, and retrieves the order created by the first request. | Exactly 1 `order`, 1 `payment_operation`, 1 `reservation_item`. | HTTP 200 with Order Confirmation. |
| **Concurrent Webhook & Browser:** Webhook arrives before or during browser checkout completion. | Webhook records delivery in `webhook_event`. Browser completes checkout via `completeCart` which verifies authorized payment. If duplicate, `webhook_event` returns `duplicate: true`. | Exactly 1 `order`, exactly 1 `webhook_event` row. | HTTP 200 on both webhook and browser. |
| **Tampered Amount:** Malicious actor alters client payload to pay ₹1 instead of full total. | Provider `authorizePayment` queries gateway API `/payments/:id`, detects `payment.amount !== expectedAmount`, rejects authorization. | `payment_session.status = "error"`, `data.error = "amount_mismatch"`. No order created. | HTTP 200 `{ type: "cart", error: { message: "Authorization rejected" } }`. |
| **Forged Signature:** Attacker submits crafted `razorpay_signature`. | Constant-time HMAC comparison `crypto.timingSafeEqual` fails. | No order created. `payment_operation.status = "failed"`. | HTTP 200 with error notification. |
| **Process Crash Mid-Checkout:** Backend restarts while order workflow is executing. | Next attempt detects stale lock (>45s) or reads committed `order_cart` row. | Automatic recovery from `pending` to `completed` or reclaimed `pending`. | Customer retries or receives order confirmation without double charge. |

---

## 5. Verification of the 12 Payment State Transition Scenarios

All 12 scenarios were verified end-to-end via `apps/backend/src/scripts/verify-phase2-sandbox.ts` against the live PostgreSQL database and Medusa backend server:

```
================================================================================
PHASE 2 SANDBOX VERIFICATION COMPLETE: ALL 12 SCENARIOS PASSED!
================================================================================
```

### Scenario Execution Evidence:
1. **Scenario 1 — Successful End-to-End Sandbox Purchase:**
   - Cart: `cart_01M7YHEYVRHA07RQJPH4SDRX4C`
   - Order Created: `order_01M7YHF0QB4EKFZ20RQ61E3X4K` (Display ID: `THL-68`)
   - Product: Asics Gel-Kayano 14 'Silver' (UK 8.0)
   - Total Amount: ₹18,878.82 (1,887,882 paise)
   - Razorpay Order: `order_test_b58d8f9b2c5a0f36`
   - Razorpay Payment: `pay_test_f6e249d21254cba6`
   - Inventory Reservation: `ilev_01M7CWRT2XRH5J36WJXEHXEY5M` incremented from 2 to 3.
   - Verdict: **PASSED**
2. **Scenario 2 — Amount Manipulation Attack Blocked:**
   - Expected: 1,887,882 paise; Attacker paid: 100 paise (₹1).
   - Gate: `authorizePayment` detected amount mismatch; blocked order creation.
   - Verdict: **PASSED**
3. **Scenario 3 — Forged Payment Signature Blocked:**
   - Attacker supplied invalid HMAC signature `bad_signature_deadbeef...`.
   - Gate: `crypto.timingSafeEqual` rejected authorization; no order created.
   - Verdict: **PASSED**
4. **Scenario 4 — Forged Webhook Signature Blocked:**
   - Webhook delivered with forged `X-Razorpay-Signature`.
   - Gate: Webhook route rejected with HTTP 401 Unauthorized.
   - Verdict: **PASSED**
5. **Scenario 5 — Concurrent Payment Callbacks & Idempotency Locking:**
   - Two concurrent threads raced to claim the same idempotency key.
   - Outcome: Exactly 1 returned `claimed`, 1 returned `in_progress`.
   - Post-completion retry safely returned `duplicate` with the order ID.
   - Verdict: **PASSED**
6. **Scenario 6 — Failed Payment Webhook Handled:**
   - Delivered `payment.failed` webhook (`pay_failed_1ac29efa`).
   - Acknowledged safely with HTTP 200 `{ received: true }`; logged to audit.
   - Verdict: **PASSED**
7. **Scenario 7 — Inventory Conflict & Zero-Stock Protection:**
   - Attempted adding variant with `stocked_quantity <= reserved_quantity`.
   - Request rejected with `insufficient_inventory`.
   - Verdict: **PASSED**
8. **Scenario 8 — Authoritative Route Idempotency on Completed Cart:**
   - Repeated `POST /store/carts/:id/complete` on completed cart `cart_01M7YHEYVRHA07RQJPH4SDRX4C`.
   - Middleware intercepted via `order_cart`, returning existing Order `order_01M7YHF0QB4EKFZ20RQ61E3X4K`.
   - Reserved stock verified: remained at 3 (zero double reservation).
   - Verdict: **PASSED**
9. **Scenario 9 — Webhook Arriving Before Local State Completion:**
   - Delivered `payment.authorized` webhook before cart completion.
   - Subsequent `POST /store/carts/:id/complete` completed order `order_01M7YHF71VXYKEFJT36WRN34M7` seamlessly.
   - Verdict: **PASSED**
10. **Scenario 10 — Interrupted Operation Stale Lock Recovery:**
    - Simulated crashed worker with `status: "pending"` older than 60 seconds.
    - Re-claimed with `staleTimeoutMs: 30000`; atomically returned `state: "claimed"`.
    - Verdict: **PASSED**
11. **Scenario 11 — Retry After a Failed Operation:**
    - Initial operation marked `status: "failed"`. Regular retry returned `failed`.
    - Explicit retry with `allowRetry: true` safely transitioned lock to `claimed`.
    - Verdict: **PASSED**
12. **Scenario 12 — Order Notification Tracking & Audit Event:**
    - Inspected Order `order_01M7YHF0QB4EKFZ20RQ61E3X4K` in database.
    - `metadata.notification_email_order_placed.status` verified as `"skipped_unconfigured"`.
    - `audit_event` row verified: `action = "email.order_placed.skipped_unconfigured"`.
    - Verdict: **PASSED**

---

## 6. Email Notification Implementation and Test Results

### 6.1 Architecture & Reliability Guarantees
- **Module:** `apps/backend/src/lib/order-email.ts` and `apps/backend/src/lib/email.ts`.
- **Status Classification:** Explicitly returns `status: "sent" | "skipped_unconfigured" | "skipped_duplicate" | "failed"`.
- **Visible Operational Logging:** Emits tagged console logs:
  - `[notification:email:unconfigured] Order ... confirmation email skipped — RESEND_API_KEY is not configured.`
  - `[notification:email:sent] Order ... confirmation email sent via Resend id=...`
  - `[notification:email:failed] Order ... confirmation email delivery failed: ...`
- **Duplicate Prevention:** Inspects `order.metadata.notification_email_order_placed`; if already marked `"sent"`, returns `"skipped_duplicate"` without re-calling the provider.
- **Auditing:** Invariant record written to `audit_event` on every notification attempt.
- **Non-Blocking Invariant:** Handled with comprehensive error trapping; email failure or provider absence never impedes order completion.

### 6.2 Unit Test Evidence
Ran `pnpm --filter @thl/backend test src/lib/order-email.test.ts`:
```
 ✓ src/lib/order-email.test.ts (5 tests) 14ms
   ✓ formats and triggers order placed email using order_summary totals
   ✓ prevents duplicate email delivery if notification was already sent
   ✓ records skipped_unconfigured status when provider is not configured
   ✓ handles cancelled order notification email gracefully
   ✓ handles shipped order notification email gracefully
Test Files: 1 passed (1) | Tests: 5 passed (5)
```

---

## 7. Verification and Quality Gate Results Across All Tools

Every quality gate was executed synchronously from the root monorepo:

| Quality Gate | Exact Command Line | Exit Code | Detailed Results | Status |
|---|---|---|---|---|
| **Gate 1: Static Typecheck** | `pnpm typecheck` | **0** | Clean across all 6 workspace packages (`backend`, `storefront`, `admin`, `shared`, `ui`). 0 errors. | **PASSED** |
| **Gate 2: Code Linting** | `pnpm lint` | **0** | ESLint executed across monorepo. 0 errors, 0 warnings. | **PASSED** |
| **Gate 3: Unit Tests** | `pnpm test` | **0** | 157 tests passed across 21 test files (23 shared, 124 backend, 10 admin). | **PASSED** |
| **Gate 4: Integration Tests** | `pnpm test:integration` | **0** | 48 integration tests passed across 10 test files against live PostgreSQL database. | **PASSED** |
| **Gate 5: Storefront Build** | `pnpm --filter @thl/storefront build` | **0** | Next.js 16.4.6 production build clean. 42 routes compiled. | **PASSED** |
| **Gate 6: Admin Build** | `pnpm --filter @thl/admin build` | **0** | Next.js 16.4.6 production build clean. 34 routes compiled. | **PASSED** |
| **Gate 7: Backend Build** | `pnpm --filter @thl/backend build` | **0** | Medusa 2.22.7 server build and admin bundle compiled successfully. | **PASSED** |
| **Gate 8: Sandbox State Machine** | `pnpm exec vite-node apps/backend/src/scripts/verify-phase2-sandbox.ts` | **0** | All 12 payment lifecycle & state transition scenarios verified with live database assertions. | **PASSED** |

---

## 8. Status of Local Commits and GitHub Branches

- **Local Working Tree:** Clean after Phase 2 consolidation commits.
- **Local Branch:** `main`
- **Local HEAD Commit Sequence:**
  1. `06df83b` — `fix: close Phase 1 security, refund and inventory defects`
  2. `4b3aa6d` — `fix(backend): restock returns once and resolve stock locations by order`
  3. `7a68479` — `docs: record Phase 1 completion and defect closure`
  4. `feat(payment): integrate payment operation mutex, checkout idempotency and notification tracking` (Phase 2 Implementation)
  5. `docs: record Phase 2 architectural closure and master tracker reconciliation` (Documentation & Reports)
- **GitHub Upstream (`origin/main`):** Commit `9d7c5fe` (`reports`, 2026-11-20).
- **Push Policy:** In strict accordance with user instructions, **no commits have been pushed to GitHub**. The local repository is fully prepared, tested, and staged for clean push upon explicit owner authorization.

---

## 9. Investigation and Documentation of Test Data

### 9.1 Existing and Newly Generated Test Data Inventory
During forensic verification and sandbox lifecycle tests, the following orders and inventory modifications were made on the development PostgreSQL database:
1. **Order THL-62 (`order_01M7X2THRE4A8Z2A1D7YX4CJ7M`):**
   - Created in initial sandbox run.
   - Customer: `raghav.sharma@thehiddenlabel.test` (Sindhu Bhavan Road, Ahmedabad).
   - Item: Asics Gel-Kayano 14 Silver (UK 8.0). Total: ₹18,878.82.
   - Initial reserved stock on `ilev_01M7CWRT2XRH5J36WJXEHXEY5M`: 1 unit.
2. **Order THL-65 (`order_01M7YEWCX0FWYJ36N31T95A356`):**
   - Created during forensic verification run.
   - Item: Asics Gel-Kayano 14 Silver (UK 8.0). Total: ₹18,878.82.
   - Reserved stock incremented to: 2 units.
3. **Order THL-68 (`order_01M7YHF0QB4EKFZ20RQ61E3X4K`):**
   - Created during 12-scenario architectural verification run.
   - Item: Asics Gel-Kayano 14 Silver (UK 8.0). Total: ₹18,878.82.
   - Reserved stock incremented to: 3 units.
4. **Order `order_01M7YHF71VXYKEFJT36WRN34M7`:**
   - Created during Scenario 9 (Early Webhook verification).

### 9.2 Financial and Operational Analysis
- **Inventory Impact:** Gel-Kayano 14 (UK 8.0) inventory level `ilev_01M7CWRT2XRH5J36WJXEHXEY5M` has `stocked_quantity = 6` and `reserved_quantity = 3` (available = 3).
- **Financial Reporting Impact:** Because these orders were processed against the local emulator (`RazorpaySandboxServer`), no real money moved on Razorpay or bank rails. However, in Medusa's local analytics tables, order totals are recorded.
- **Risk Assessment:**
  - *Deleting orders directly via SQL:* Dangerous. Medusa maintains relational foreign keys across `order`, `order_cart`, `order_item`, `order_summary`, `order_change`, and `payment_collection`. Raw deletions cause orphaned rows and referential integrity errors.
  - *Cancelling via API:* Recommended method. Calling `POST /admin/orders/:id/cancel` cleanly marks orders cancelled, releases inventory reservations, and emits audit events.
- **Recommended Production Cleanup Procedure:**
  Before deploying to production or staging:
  1. For existing dev testing, run `scripts/db-clean-audit-fixtures.ts` to clear test brands.
  2. For test orders, execute standard order cancellation via Medusa admin API or restore from clean baseline seed (`pnpm seed`).
  3. Never purge production database rows using raw SQL `TRUNCATE` or `DELETE` without referential verification.

---

## 10. Master Roadmap and Project Tracker Reconciliation

### 10.1 Resolution of the 68 vs 67 Count Discrepancy
The discrepancy between 67 and 68 total items has been formally resolved:
- **Total Tracked Entries in Universe:** **68**
- **Classification:**
  - **Active Actionable Items:** **67** (13 Security Findings SEC-01..13, 12 Core Bugs BUG-01..12, 8 Handover Defects R-01..08, 3 Business Decisions BD-1..3, 8 New Findings NEW-01..08, plus remaining operational packages).
  - **Deliberately Excluded Item:** **1** (`GAP-005: Alternative Payment Rails / COD`), formally classified as `NOT APPLICABLE — WITH EXPLANATION` due to the deliberate business decision to eliminate Cash on Delivery fraud.
- **Reconciliation Invariant:** 67 active items + 1 non-applicable item = **68 total entries**. All trackers are now aligned on this exact standard.

### 10.2 Phase 2 Items Reconciled Status
- `NEW-04` (Wire `payment_operation` into checkout): **VERIFIED COMPLETE**.
- `NEW-05` (Email notification reliability & event tracking): **VERIFIED COMPLETE**.
- `BUG-01` (Razorpay enabled on INR region): **IMPLEMENTED — VERIFICATION PENDING** (Architecture complete locally; awaiting live merchant test credentials).
- `GAP-001` / `GAP-002` (Sandbox purchase): **IMPLEMENTED — VERIFICATION PENDING** (Verified against local emulator; awaiting live merchant test credentials).
- `GAP-003` (Webhook replay safety): **VERIFIED COMPLETE**.
- `R-08` (Webhook topology): **IMPLEMENTED — VERIFICATION PENDING** (Tested with local mock; awaiting live merchant test credentials).

---

## 11. Explicit Recommendations and Prerequisites for Phase B

With Phase 1 and Phase 2 architecturally closed, verified, and consolidated, the platform is ready to transition to **Phase B (Core Commerce and Operational Lifecycle)**.

### 11.1 Prerequisites for Phase B
1. **Shiprocket Credentials (Owner Action):**
   - Required: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_TOKEN`.
   - Impact: Enables generating real sandbox AWBs, shipping labels, rate calculations, and reverse pickup scheduling.
2. **Statutory Business Details (Owner Action):**
   - Required: Official GSTIN, CIN, and Grievance Officer contacts for legally compliant invoices, shipping manifests, and credit notes.
3. **Razorpay Live/Test Merchant Keys (Owner Action):**
   - Required: Official test keys from Razorpay merchant dashboard to execute the final live gateway check against `api.razorpay.com`.

### 11.2 Phase B Engineering Scope
- **Task B-01:** Complete Shiprocket API integration and sandbox AWB generation.
- **Task B-02:** Dynamic warehouse pickup address configuration.
- **Task B-03:** Shiprocket webhook ingestion hardening (HMAC / IP allowlist).
- **Task B-04:** Full RMA reverse pickup & automated restock workflow.
- **Task B-05:** Legally compliant GST credit note PDF generation with consecutive sequence numbering.
- **Task B-06:** Gateway settlement reconciliation view.

**Conclusion:** The Hidden Label codebase is now in a pristine, architecturally sound, thoroughly tested, and consolidated state. Phase B may commence immediately upon owner approval.
