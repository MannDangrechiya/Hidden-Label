# 12 — TEST RESULTS AND EVIDENCE

Every item here was executed or read in this session. Commands are reproducible from the repository root on Windows/Git Bash unless noted.

## 1. Commands run and their exact outcomes

### 1.1 Typecheck — PASS

```
$ pnpm typecheck
Scope: 6 of 7 workspace projects
apps/backend typecheck$ tsc --noEmit        → Done
packages/shared typecheck$ tsc --noEmit     → Done
packages/ui typecheck$ tsc --noEmit         → Done
apps/storefront typecheck$ tsc --noEmit     → Done
apps/admin typecheck$ tsc --noEmit          → Done
TYPECHECK_EXIT=0
```

### 1.2 Unit tests — PASS (70/70)

```
$ pnpm test
packages/shared  2 files  23 tests  passed
  src/money.test.ts (8)      src/schemas.test.ts (15)
apps/backend     7 files  45 tests  passed
  src/lib/resale.test.ts (12)          src/lib/shiprocket.test.ts (5)
  src/lib/gemini.test.ts (9)           src/modules/razorpay/service.test.ts (5)
  src/lib/admin-auth.test.ts (2)       src/lib/shipment-status.test.ts (5)
  src/lib/returns.test.ts (7)
apps/admin       1 file    2 tests  passed
  lib/roles.test.ts (2)
TEST_EXIT=0
```

**What this does and does not prove.** These are pure unit tests: role rank arithmetic, return eligibility windows, courier status mapping/idempotency helper, payout maths, Indian phone/OTP helpers, Razorpay signature helpers, Gemini prompt/fallback, money formatting and Zod schemas. **No route handler, no database, no HTTP call and no browser interaction is covered.** The suite proves logic, not integration.

### 1.3 Lint — FAIL

```
$ pnpm lint
✖ 15 problems (15 errors, 0 warnings)
LINT_EXIT=1
```

All 15 are in tracked evidence scripts under `.audit/` (see `10_PERFORMANCE_AND_DEVOPS_AUDIT.md §1`). Application source is clean; the repository's `lint` gate is not.

### 1.4 Service availability

```
$ curl http://localhost:9000/health        → "OK"            (200)
$ curl http://localhost:3000/api/health    → 200
$ curl http://localhost:7001/login         → connection refused (admin dev server not running)
```

### 1.5 Storefront route probes

```
GET /                                             => 200
GET /collections/all                              => 200
GET /cart                                         => 200
GET /checkout                                     => 307   (→ /cart, empty bag)
GET /login                                        => 200
GET /register                                     => 200
GET /brands                                       => 200
GET /about                                        => 200
GET /search                                       => 200
GET /sell                                         => 200
GET /authenticity                                 => 200
GET /fit-studio                                   => 200
GET /policies/privacy                             => 200
GET /products/air-jordan-1-retro-high-og-chicago  => 200
GET /products/does-not-exist                      => 404
GET /brands/{jordan,nike,adidas,new-balance,salomon,asics} => 200 (all)
```

### 1.6 API probes (backend :9000)

```
GET  /admin/orders                        (no token)  => 401
GET  /store/orders                        (no token)  => 401
GET  /store/wishlist                      (no token)  => 401
GET  /store/customers/me                  (no header) => 400   ← inconsistent with 401
POST /webhooks/razorpay                   (unsigned)  => 503   ← secret unset, correctly refuses
GET  /store/products                      (no key)    => 400
GET  /store/products?limit=2              (key)       => 200, count:17
GET  /store/categories                    (key)       => 200, real tree (Footwear→Sneakers count 8)
GET  /store/brands                        (key)       => 200, real rows + audit fixtures
GET  /store/content/home                  (key)       => 200, real banner
GET  /store/search/suggest?q=air          (key)       => 200, real products
GET  /store/resale/recent-activity        (key)       => 200, real order lines
POST /store/catalog/stock {"variant_ids":[]}(key)     => 200 {"stock":{}}
GET  /store/catalog/stock                 (GET)       => 404 (route is POST-only — expected)
```

### 1.7 Database probes (read-only)

```sql
select count(*) from information_schema.tables where table_schema='public'  -- 171
select tgname from pg_trigger … where c.relname='audit_event'               -- audit_event_append_only
select count(*), sum(stocked_quantity), sum(reserved_quantity) from inventory_level
                                                                            -- 59, 170, 43
select count(*) from product_variant where deleted_at is null                -- 60
  … manage_inventory=true 60 ; allow_backorder=true 0
select status, count(*) from "order" group by status                        -- pending 54, canceled 1
select count(*), count(captured_at), count(canceled_at) from payment        -- 55, 9, 1
select status, count(*) from return_request …                               -- requested 21, approved 7
select count(*), count(awb) from shipment                                   -- 8, 6
select count(*) from audit_event                                            -- 256
select * from region_payment_provider                                       -- 0 rows  ← P0
select name, price_type from shipping_option                                -- Standard, Express (flat)
select count(*) from product where deleted_at is null                       -- 18
```

Shipping option prices: `Standard delivery` = 0 INR, `Express delivery` = 199 INR (both `flat`).

### 1.8 Environment key names (values never printed)

- `apps/backend/.env`: DATABASE_URL, MEDUSA_BACKEND_URL, STOREFRONT_ORIGIN, ADMIN_ORIGIN, MEDUSA_JWT_SECRET, MEDUSA_COOKIE_SECRET, LOG_LEVEL, PORT, OTP_DEV_ECHO, GEMINI_API_KEY.
- `apps/storefront/.env.local`: MEDUSA_URL, NEXT_PUBLIC_MEDUSA_URL, MEDUSA_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_FEATURE_{AI_LAYER,INSPECTION,FIT_STUDIO,BIDDING}.
- `apps/admin`: no env file.
- **Absent everywhere:** RAZORPAY_*, RESEND_API_KEY, SHIPROCKET_*, OTP_PROVIDER/MSG91_*/TWILIO_*, S3_*, SENTRY_DSN, BUSINESS_*, GRIEVANCE_OFFICER_*, REDIS_URL, REPORTS_EMAIL.

### 1.9 Response-time samples (dev mode, warm)

```
/store/products  (5)  0.402 0.021 0.021 0.024 0.020  s
/                (5)  1.816 0.303 0.291 0.276 0.318  s
/collections/all (3)  0.368 0.178 0.146            s
```

### 1.10 Repository state

```
$ git log --oneline -12   → HEAD 2428b97 "docs: add a real, verification-graded project status for handoff"
$ git status --short      → clean at audit start
$ node -v                 → v26.10.0   (engines: >=22.22.0)
$ pnpm -v                 → 10.32.1
$ git ls-files | grep .env → only .env.example, apps/admin/.env.example
```

## 2. The 12 required end-to-end scenarios

| # | Scenario | Result | Reason / evidence |
|---|---|---|---|
| 1 | Standard purchase → sandbox payment → order → shipment → delivery | **BLOCKED** | `region_payment_provider` is empty and no Razorpay keys exist; checkout cannot pass the payment step. Proved at the DB level, not inferred. |
| 2 | Failed payment → unpaid order → retry/cancel, reservation handling | **BLOCKED** | Same cause. Behaviour is Medusa's cart/reservation lifecycle; no custom code to test. |
| 3 | Duplicate payment webhook → no duplicate payment/order/stock | **BLOCKED (payment)** / **PASS-by-design (shipment)** | Razorpay replay safety cannot be exercised without keys. Shipment side is provably idempotent: unique `(shipment_id,event_key)` + `onConflict().ignore()` + `deduped` flag, covered by `shipment-status.test.ts` (5 tests). |
| 4 | Last available item, two buyers → no oversell | **NOT PERFORMED** | Requires completing a cart, which requires payment. Configuration is correct (`manage_inventory` true on all 60 variants, `allow_backorder` false on all 60) so Medusa's reservation engine is the gate. |
| 5 | Cancellation → refund rules → inventory reconciled | **NOT PERFORMED** | `cancelOrderWorkflow` is wired for both admin and customer paths; existing DB has 1 canceled order. No HTTP test because no admin session and no customer credentials. |
| 6 | Return: request → review → pickup → inspection → refund/exchange → disposition | **PARTIAL (code only)** | Logic is implemented and unit-tested (`returns.test.ts` 7 tests): 7-day window, delivered-only, quantity cap, condition grading, restock only when `resellable`. DB shows 21 requested / 7 approved RMAs (fixtures). Reverse pickup is BLOCKED without Shiprocket. |
| 7 | Admin permissions: authorised vs unauthorised per role | **PARTIAL** | Unauthenticated access is provably 401 **[LIVE]**. Role differentiation is code + `roles.test.ts` only; no role accounts/credentials available. |
| 8 | Customer A must not read Customer B's orders/addresses | **CODE-verified only** | `order detail` page compares `order.customer_id` to the session customer and 404s; `cancel`, `shipment` and `return-requests` filter by `customer_id`. No two-account test was run (would create accounts). |
| 9 | Inventory: receive → sell → reserve → cancel → inspect return → reconcile | **NOT PERFORMED** | Requires selling. Adjustment and restock logic read; one lost-update defect found (BUG-05). |
| 10 | Integration outage: provider failure → error handling, retries, alerts | **PARTIAL** | Unconfigured providers fail visibly (501/503/log) — observed for Razorpay 503. No retry/backoff exists anywhere, and no alerting exists. |
| 11 | Tailoring: consultation → measurement → quote → approval → production → fitting → delivery | **BLOCKED / PARTIAL** | Measurement capture + 5-stage tracker + tailor sheet exist. Consultation, quotation, approval, job card, tailor assignment, fittings and alterations do not exist, so the scenario cannot be run. |
| 12 | Resale: intake → authentication → approval → listing → purchase → fulfilment → settlement | **BLOCKED / PARTIAL** | Inspection/approval/listing exist; intake and settlement do not. Purchase would hit the disabled payment path. |

## 3. Evidence location

Raw artefacts used by this audit are the live HTTP responses, SQL result sets and command outputs quoted above. No new test scripts were added; the repository's own `.audit/` result files (`results.json`, `results2.json`) were **read for context only** and are not treated as evidence for anything in this report.

## 4. Honest statement of what was not tested

- No payment, add-to-cart, registration, login, checkout or admin action was executed (all would mutate the shared development database or require absent credentials).
- No browser, screenshot, responsive or accessibility check was performed.
- No production build was run (would clobber the running dev server's `.next`).
- No load test, no query-plan analysis, no Lighthouse.
- No penetration test; only read-only/refusing probes against protected endpoints.
