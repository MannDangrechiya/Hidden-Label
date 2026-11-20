# THE HIDDEN LABEL — MASTER IMPLEMENTATION PLAN

**Document status:** PROPOSED — awaiting owner approval. No application code, schema, dependency or configuration has been changed to produce this plan.
**Plan date:** 2026-11-20.
**Supersedes, for execution purposes:** `AUDIT_REPORTS/15_RECOMMENDED_IMPLEMENTATION_ROADMAP.md` (refined here into work packages), `FULL_REMEDIATION_PLAN.md`, `REMEDIATION_EXECUTION_REPORT.md`, `REMEDIATION_REPORT.md`, `MISSING_FEATURES.md` at the repository root (kept for history, not authority).
**Authority:** this document is the single sequence of record until the owner approves it. Phase reports are appended as `PHASE_<n>_REPORT.md` at the repository root.

---

## 0. How to read this plan

- **Status vocabulary** is fixed by the mission and used everywhere:
  `IMPLEMENTED` · `UNIT TESTED` · `INTEGRATION TESTED` · `E2E VERIFIED` · `BLOCKED` · `NOT VERIFIED`.
  Nothing is called complete because code exists. A work package moves to `E2E VERIFIED` only with recorded evidence (command output, order id, HTTP response, screenshot path or DB query result) quoted in the phase report.
- **Work package (WP) IDs** are stable (`P1-03`). Every WP lists files, migrations, tests and a measurable exit criterion.
- **Evidence tags** used for the *current* state: **[VERIFIED-NOW]** (re-executed while writing this plan), **[CODE]** (read directly in this session), **[AUDIT]** (from `AUDIT_REPORTS/`, dated 2026-11-20, not re-executed here), **[BLOCKED]** (needs credentials/infrastructure absent from this environment).
- **Phases are sequential unless marked parallel.** No phase may start while a P0 from an earlier phase is open.

---

## 1. Basis of the plan — what was actually inspected

### 1.1 Documents read in full

`AUDIT_REPORTS/00`–`15` (16 constituent reports; `ALL_IN_ONE_AUDIT_REPORT.md` is the compiled concatenation of the same material). Earlier root-level reports were treated as claims, not evidence, consistent with `AUDIT_REPORTS/01 §8`.

Also read: `package.json`, `pnpm-workspace.yaml`, `apps/{backend,storefront,admin}/package.json`, `.github/workflows/ci.yml`, `.env.example`, `eslint.config.mjs`, `docs/OPEN_QUESTIONS.md`, and the code listed in §1.2.

### 1.2 Code directly re-verified in this session

| # | Finding | Where |
|---|---|---|
| 1 | Role-less staff default to **owner** | `apps/backend/src/lib/admin-auth.ts` → `const role = typeof metadata.role === "string" ? … : "owner";` |
| 2 | The admin UI mirrors the same default | `apps/admin/lib/api/auth.ts` → `fetchCurrentAdmin()` ends `: "owner";` |
| 3 | Refund idempotency key is time-based, therefore non-idempotent | `apps/backend/src/api/admin/orders/[id]/actions/route.ts` → `` idempotency_key: `order-${orderId}-refund-${Date.now()}` `` |
| 4 | Stock adjustment is read-then-write with no row lock | `apps/backend/src/api/admin/inventory/route.ts` → `first()` … `transaction(...update({ stocked_quantity: next }))` |
| 5 | Low-stock threshold is a hardcoded `<= 3` | same file, `whereRaw("(il.stocked_quantity - il.reserved_quantity) <= 3")` |
| 6 | RMA display id is derived from a row count | `apps/backend/src/api/store/return-requests/route.ts` → `` `RMA-${1000 + count + 1}` `` |
| 7 | `refund_amount` is a numeric **string** while the rest of the project stores rupee integers | same file → `refundAmount.toFixed(2)` |
| 8 | Fulfilment assumes a single stock location | `apps/backend/src/api/admin/orders/[id]/actions/route.ts` → `pg("stock_location").first("id")` |
| 9 | Refund defaults to the **whole** captured amount; partial refunds require an explicit amount | same file |
| 10 | Lint scope does not exclude `.audit/` | `eslint.config.mjs` ignores `scripts/**` but not `.audit/**` |
| 11 | CI runs typecheck → lint → test → storefront build, plus a migrations-from-empty job | `.github/workflows/ci.yml` |
| 12 | Storefront catalogue is capped by a default limit | `apps/storefront/lib/medusa.ts` → `search.set("limit", String(params?.limit ?? 24))` |
| 13 | Homepage brand cards and counts are a literal array | `apps/storefront/app/page.tsx` → `const BRANDS = [{ name: "Jordan", count: "12 Silhouettes" }, …]` |
| 14 | Payment provider linking is gated on `RAZORPAY_KEY_ID` and removes COD | `apps/backend/src/scripts/setup-payments.ts` |
| 15 | 19 project models / 8 project migrations; no supplier, review, credit-note, settlement or stock-ledger model | `apps/backend/src/modules/thl/models/`, `…/migrations/` |
| 16 | Exactly 10 test files exist, all unit level | `apps/admin/lib/roles.test.ts`, `apps/backend/src/lib/{admin-auth,gemini,resale,returns,shipment-status,shiprocket}.test.ts`, `apps/backend/src/modules/razorpay/service.test.ts`, `packages/shared/src/{money,schemas}.test.ts` |
| 17 | Admin RBAC is a real two-layer control (global middleware + per-route `requireRole`) with self-escalation blocked | `apps/backend/src/api/middlewares.ts` |
| 18 | Business-model decision is still listed as open | `docs/OPEN_QUESTIONS.md` (§3 Q4 describes v1 as single-sell-price; the shipped resale module contradicts that) |

### 1.3 Measured baseline (re-run while writing this plan)

```
$ pnpm lint        → 15 errors, 0 warnings, exit 1  (all in .audit/*.mjs)
$ pnpm typecheck   → 6/6 packages, exit 0
$ pnpm test        → 70/70 tests, 10 files, exit 0
                     @thl/shared 23 · @thl/backend 45 · @thl/admin 2
$ grep '^# ' AUDIT_REPORTS/ALL_IN_ONE_AUDIT_REPORT.md
                   → sections 00…15, confirming it is the concatenation of the 16 reports
```

**[VERIFIED-NOW]** The lint failure is reproduced exactly as the audit described and is confined to the committed evidence scripts; application source is clean. Typecheck and unit tests are green.

Database figures (171 public tables, 60 variants with `manage_inventory=true` and `allow_backorder=false`, 0 rows in `region_payment_provider`, 256 audit rows, 55 orders / 9 captured payments) remain **[AUDIT]** — they were not re-queried here and Phase 0 P0-14 re-baselines them. Provider credentials (Razorpay, Resend, Shiprocket, SMS, S3, Redis, Sentry, business identity) remain absent **[AUDIT]**; presence is re-checked by key name only in Phase 0/1.

### 1.4 What this plan does *not* claim

- It does not claim the admin UI works. No admin session has ever been exercised (`AUDIT_REPORTS/06`, and no staff credentials exist here).
- It does not claim payments, logistics, email, SMS or WhatsApp work. Zero credentials are present for any of them.
- It does not claim the production builds of admin/backend work. Only the storefront build is wired into CI.
- It does not claim the current working database is clean; it contains audit fixtures (`Audit Brand`/`TestBrand`).

---

## 2. Architecture to be preserved (not replaced)

```
Browser ──httpOnly thl_auth / thl_cart──▶ Next.js storefront :3000 ─┐
Browser ──httpOnly thl_admin_token─────▶ Next.js admin    :7001 ─┤ server-side fetch only
                                                                  ▼
                                              Medusa 2.22.7 backend :9000
                              /store/*  /admin/*  /webhooks/*  /auth/*  /hooks/payment/*
                                   │                    │
                        Medusa core schema      ThlModule (19 tables, 8 migrations)
                                   └────────┬───────────┘
                                     PostgreSQL 18 :5437 · Redis :6380 (optional)
```

**Fixed constraints**

| Constraint | Rule for all phases |
|---|---|
| Medusa 2.22.7 | No framework upgrade. Core flows (`completeCart`, `capturePaymentWorkflow`, `createOrderFulfillmentWorkflow`, `refundPaymentWorkflow`, `cancelOrderWorkflow`) stay the only writers of order/payment/inventory state. |
| Next.js 16.4.6 + React 19 | App Router + Server Actions retained. Admin keeps `--webpack` (documented Turbopack CSS-chunk workaround). |
| PostgreSQL 18 | Migrations only. No `synchronize`, no hand-edited schema. |
| ThlModule boundary | New domain tables go into `apps/backend/src/modules/thl/models` + a dated migration. Nothing that Medusa already models (customers, orders, payments, refunds, fulfilment, inventory levels, reservations, promotions, tax) is duplicated. |
| Money | Integer rupees in project tables (`docs/DATABASE_PLAN.md §13`); the one existing exception (`return_request.refund_amount` numeric string) is normalised in Phase 1. |
| Trust boundary | Customer and admin JWTs remain server-side only, in httpOnly cookies. No token ever reaches browser JS. |
| Windows dev | `scripts/dev-db.mjs` env sanitisation, `.bat` launchers and the `apps/admin --webpack` constraint are preserved; every new script must run under Git Bash on Windows. |

---

## 3. Current state — one screen

| Area | State | Evidence |
|---|---|---|
| Catalogue / PDP / CMS / brands / search / account / cart | Working in dev | [AUDIT] route probes 200, real data |
| Checkout | Cannot complete — no payment provider linked, no keys, COD removed | [AUDIT] `region_payment_provider` = 0 rows; [CODE] `setup-payments.ts` |
| Refunds | Workflow correct, **caller not idempotent** | [CODE] finding 3 |
| Inventory | Framework reservations correct; **admin adjustment loses updates**; no cost or ledger | [CODE] finding 4; [AUDIT] §05 |
| Returns | Logic complete incl. "restock only if resellable"; **RMA numbering racy**; no credit note | [CODE] finding 6; [AUDIT] §05/§11 |
| RBAC | Strong design, **defeated by default-owner** | [CODE] findings 1–2 |
| Email | Templates exist; **no transport configured ⇒ no message ever sends** | [AUDIT] §08 |
| Logistics | Client exists; **no credentials; hardcoded return address** | [AUDIT] §08 |
| Storefront integrity | Pagination cap 24, duplicate category model, hardcoded homepage brands, unsupported "In Stock" label | [CODE] 12–13; [AUDIT] §03 |
| Admin | 19 modules in code, **never exercised**; reports lack date ranges/GST/margin | [AUDIT] §06 |
| Infrastructure | No Dockerfile, host, backups, monitoring, staging or Redis | [AUDIT] §10 |
| Tests | 70 unit tests; **zero integration or E2E** | [CODE] finding 16 |
| Missing domains | Supplier/purchasing/costing, reviews, bespoke consultation→job card→fitting, consignment intake/settlement, credit notes | [AUDIT] §11/§13 |

**Verdict carried forward:** a real codebase that cannot take money, cannot notify a customer, cannot ship with a tracking number, and has one High-severity authorisation defect. Retail first; bespoke and resale after.

---

## 4. Non-negotiable rules → enforceable controls

Each rule from the brief is mapped to a *mechanism*, so compliance is checkable rather than aspirational.

| Rule | Mechanism in this repo |
|---|---|
| Inspect before changing | WP files lists; every phase report states files read |
| No duplicated Medusa functionality | Review checklist item; new models must cite why no core entity fits |
| No duplicate DB models | Same; Phase 6/7/8 introduce only supplier, PO, GRN, cost, stock ledger, review, credit note, bespoke, intake, settlement |
| Migrations for schema change | Dated file in `apps/backend/src/modules/thl/migrations/`; CI migrations-from-empty job is the gate |
| Transactions for money/stock | `pg.transaction(...)`; `SELECT … FOR UPDATE` for stock; audit row in the **same** transaction |
| Stable idempotency keys | Deterministic key = hash of `(operation, entity id, amount, reason, request fingerprint)`; persisted in a new `idempotency_key` table before the side effect |
| Backend authorisation | `authenticate("user")` + `adminRbacMiddleware` + `requireRole`; no frontend-only gating |
| No default-owner | `resolveAdmin` returns `null` for a missing/unknown role; middleware answers 403 `no_role_assigned` |
| No client-trusted price/discount/GST/amount | Amounts derive from the fetched cart/order; signature verified server-side over the raw body |
| No fabricated data | No fallback arrays in data paths; missing data renders an explicit empty/error state (this is already the house style — keep it) |
| No secret exposure | Only `.env.example` tracked; secrets never printed, never in chat, never in logs; plan reports presence only |
| No fake success | Unconfigured integrations keep returning 501/503 |
| No silent error swallowing | `catch` must log with context or rethrow; the two intentional `catch {}` in `.audit/` scripts are excluded from lint scope rather than edited |
| No deleting working features to pass tests | Regression guard: every phase report re-runs the full existing unit suite; any test change is justified line-by-line |
| Preserve Windows dev scripts | No change to `scripts/dev-db.mjs`, `*.bat`; new scripts must be cross-platform Node |

---

## 5. Business decisions required before specific phases

Two decisions are gated by the brief. Both are **owner decisions, not engineering ones**, and this plan does not invent answers.

### BD-1 — Primary resale model (blocks Phase 8 only)

| Option | What it implies | Work delta |
|---|---|---|
| **A. Fixed-price resale** (recommended default) | Listed price is the price; buy button creates a normal order. Bidding stays behind `NEXT_PUBLIC_FEATURE_BIDDING=false`. | Simpler: intake → authenticate → list → sell → settle. Bid tables remain unused, not deleted. |
| **B. Bid/ask orderbook (StockX-style)** | Requires matching engine, bid acceptance, expiry, seller fulfilment SLA, buyer/seller cancellation rules, and a fraud model. | Adds 6–10 weeks and a new risk surface. The current code (asks/bids/price index) is a starting point only — there is no matching or bid→order conversion today. |
| **C. Hybrid** | Fixed price for catalogue brands; bidding only for authenticated grails. | Option A first, then B scoped to a flag-gated category. |

**Interim rule:** preserve both code paths, keep `NEXT_PUBLIC_FEATURE_BIDDING=false` in every environment, and do not build settlement until the model is chosen (settlement rules differ between A and B).

### BD-2 — Brand positioning (blocks Phase 4 copy and Phase 6/7 scope)

| Option | Implications |
|---|---|
| **A. Sneaker/streetwear** (what the seed data and homepage copy say today) | Keep silhouettes/size language, fit studio, grail framing. |
| **B. Broader premium fashion & lifestyle** | Needs apparel taxonomy, colour variants, fabric/care attributes, editorial; bespoke atelier becomes central rather than adjacent. |

**Interim rule:** no change to taxonomy, navigation or content until decided. Phase 4 work is positioning-neutral (pagination, gallery, honest stock labels, CMS-driven homepage). Note: `docs/OPEN_QUESTIONS.md` §3 Q4 ("single sell price per variant, no resale in v1") contradicts the shipped resale module; BD-1 must also record which document is authoritative.

### BD-3 — Commercial parameters (needed before Phase 6/8, not before)

Consignment commission split (the UI hardcodes a 9.5% fee via `calculateConsignorPayout`), settlement cadence, supplier payment terms, and GST treatment of consignment margin. **Engineering will parameterise these, not invent them.** The 9.5% becomes a configuration value in Phase 8, never a literal.

---

## 6. Phase plan

Estimates assume **one senior full-stack engineer** with owner access to provider dashboards, plus part-time QA for E2E. They are planning ranges, not commitments.

```
Phase 0  Stabilise & baseline            1 wk    ── mandatory, no dependencies
Phase 1  Prove the money path            2 wk    ── needs owner: Razorpay TEST keys
Phase 2  Close the commerce loop          3 wk    ── needs owner: Resend + Shiprocket
Phase 3  Production infrastructure       3 wk    ── parallel with 2
Phase 4  Storefront integrity            2 wk    ── parallel with 2/3
Phase 5  Reviews & truthful merchandising 1.5 wk
Phase 6  Retail back office (buy/cost)   4 wk
Phase 7  Bespoke atelier                 4 wk    ── needs BD-2
Phase 8  Resale completion               4 wk    ── needs BD-1, BD-3
Phase 9  Launch hardening & handover     2 wk
```

---

### PHASE 0 — Stabilise and baseline (1 week)

**Goal:** a green release gate, no open High-severity defect, a trustworthy baseline, and a test harness capable of proving anything later.

| ID | Work package | Files | Tests / evidence | Exit criterion |
|---|---|---|---|---|
| P0-01 | Exclude evidence scripts from lint scope (do **not** delete `.audit/`; it is audit history) | `eslint.config.mjs` | `pnpm lint` | Exit 0, 0 errors |
| P0-02 | Fix default-owner in backend: missing/unknown role ⇒ no role | `apps/backend/src/lib/admin-auth.ts` | New unit test: role-less ⇒ `null`; middleware ⇒ 403 `no_role_assigned`. Existing `admin-auth.test.ts` extended | No path yields `owner` without explicit metadata |
| P0-03 | Fix the same in admin UI; render a "no role assigned" blocker page instead of an owner UI | `apps/admin/lib/api/auth.ts`, `apps/admin/app/(dashboard)/layout.tsx` | Unit test on role resolution | A role-less staff account sees a 403 page, never owner navigation |
| P0-04 | Role remediation script: report every staff user without an explicit role; assign nothing automatically | new `apps/backend/src/scripts/audit-admin-roles.ts` + root script `db:roles:audit` | Run against dev DB, paste output | Every staff user has an explicit role *before* a second staff account exists |
| P0-05 | Document the bootstrap path for the first/only owner so P0-02 cannot lock the business out | `docs/HANDOFF.md`, `.env.example` comment | Manual dry run with a fresh DB | A fresh install can create exactly one owner deterministically |
| P0-06 | Atomic stock adjustment: `SELECT … FOR UPDATE` inside the transaction, negative-guard recomputed under the lock | `apps/backend/src/api/admin/inventory/route.ts` | Integration test: two concurrent +1/−1 ⇒ correct final level | 50 concurrent adjustments ⇒ arithmetic sum holds |
| P0-07 | Stable refund idempotency key | `apps/backend/src/api/admin/orders/[id]/actions/route.ts`, new `idempotency_key` table (migration `Migration20261124xxxxxx`) | Unit test for key derivation; integration test: same request twice ⇒ one refund | One refund row for duplicate submissions |
| P0-08 | RMA numbering via a real sequence | new migration (sequence + `return_request.display_id` default), `api/store/return-requests/route.ts` | Concurrency test: 20 parallel requests ⇒ 20 unique ids | No unique-violation 500s |
| P0-09 | Normalise `return_request.refund_amount` to integer rupees, with a backfill migration | migration + `api/store/return-requests/route.ts`, `lib/returns.ts`, admin returns screens | Migration test on seeded data; unit test for amount maths | One money representation in project tables |
| P0-10 | Concierge thread ownership: bind thread to `customer_id` **or** a signed session token; reject mismatches | `api/store/concierge/chat/route.ts` | Integration test: second session cannot append | 403/404 for foreign thread |
| P0-11 | Rate-limit public write routes (`/store/support/tickets`, `/store/concierge/chat`, `/store/sight-search`, `/store/resale/asks|bids`) | `api/middlewares.ts`, `lib/rate-limit.ts` | Integration test: 11th call ⇒ 429 | 429 observed on each route |
| P0-12 | Integration test harness | new `apps/backend/src/**/*.integration.test.ts` + `vitest.config` project split, dev dependency `@medusajs/test-utils` (version-locked to 2.22.7 — confirm at implementation) | One smoke test: boot, migrate, hit `/health` and one authenticated route | `pnpm test:integration` runs against a disposable Postgres |
| P0-13 | Clean-database fixtures policy: no audit noise in seed; a `db:reset` that refuses to run when `NODE_ENV=production` | `apps/backend/src/scripts/seed.ts`, new `scripts/db-reset.mjs`, root scripts | Run on a scratch DB | Additive seed is idempotent; reset is guarded |
| P0-14 | Fill baseline evidence table (tables, variants, reservations, providers) into `PHASE_0_REPORT.md` | — | SQL captured | Numbers recorded for later comparison |

**Migrations:** `idempotency_key` table; `return_request_display_id_seq`; `refund_amount` type/backfill.
**Exit gate:** `typecheck`, `lint`, `test`, `test:integration` green; duplicate-refund, concurrent-adjustment and concurrent-RMA tests pass; no High finding open; no staff account without a role.
**Out of scope here:** any payment or provider work.

---

### PHASE 1 — Prove the money path (2 weeks)

**Goal:** one genuine sandbox purchase, captured exactly once, with an audit trail — the mission's first success criterion.

| ID | Work package | Files | Evidence | Exit criterion |
|---|---|---|---|---|
| P1-01 | Owner supplies **test-mode** Razorpay keys; document exact keys and where each is read | `.env.example` (names only), owner's secret store | Presence check only, never values | `/store/payment-providers?region_id=<inr>` lists `pp_razorpay_razorpay` |
| P1-02 | Verify provider link on a fresh DB and on the existing DB | `pnpm db:setup-payments` | Command output + DB query | Both paths list Razorpay, none list `pp_system_default` |
| P1-03 | Webhook topology: register **Medusa's** `/hooks/payment/razorpay_razorpay` as the state endpoint and the custom `/webhooks/razorpay` as the verified logger; document it | `docs/INTEGRATIONS.md`, route comments | Razorpay dashboard config screenshot (owner) | Documented, single source of payment truth |
| P1-04 | Duplicate-submit guard: disable the pay action while in flight; derive a stable key for `completeCart` | storefront checkout actions/components | Browser test double-click | One order for a double click |
| P1-05 | Sandbox purchase run: guest + signed-in, UPI/card test instruments, one full happy path | — | Order id, payment id, captured amount, audit rows | **E2E VERIFIED** with quoted ids |
| P1-06 | Webhook replay: same event twice | — | Two deliveries, one payment event, one order | Idempotency **proved**, not asserted |
| P1-07 | Payment failure path: abandoned session, failed authorization, retry | — | Evidence per case | Reservations released per Medusa lifecycle; no orphan order |
| P1-08 | Refund once, then replay the request | admin refund route | One refund, one provider call | Phase 0 key proven under replay |
| P1-09 | Email transport for order confirmation (Resend, verified domain) | `lib/email.ts`, `.env.example`, subscribers | Received message with headers | Confirmation actually arrives |
| P1-10 | Payment mismatch/amount-tamper negative test: forged signature, mismatched amount | provider + checkout | 4xx/422, no order | Server-authoritative amount confirmed |

**Accounts needed:** at least one synthetic customer per flow (guest + registered), one staff operations account, one owner account.
**Exit gate:** mission criterion 1, 2 and 9 (for the purchase) are **E2E VERIFIED**; duplicate webhook and duplicate refund both proved single-effect.
**Blockers outside engineering:** Razorpay test keys, Resend API key + verified sender domain.

---

### PHASE 2 — Close the commerce loop (3 weeks)

**Goal:** deliver, track, return, refund, credit-note — a second order proven end to end.

| ID | Work package | Files / migration | Evidence | Exit criterion |
|---|---|---|---|---|
| P2-01 | Shiprocket credentials + one adhoc shipment created from an admin fulfilment | `lib/shiprocket.ts`, admin shipment route | AWB + provider shipment id + label URL | Playback of a real sandbox AWB |
| P2-02 | Remove the hardcoded return destination (Ahmedabad/380054/9999999999); make pickup/return address config | `lib/shiprocket.ts`, `.env.example` | Diff + one reverse pickup | No hardcoded address remains |
| P2-03 | Harden the Shiprocket webhook (HMAC or IP allowlist per current provider docs) | `api/webhooks/shiprocket/route.ts` | Forged request ⇒ 401 | Token-in-query retired |
| P2-04 | Delivery transition + customer notification | `lib/shipment-status.ts`, subscriber, email template | Status `delivered` + email received | Delivered is idempotent and notified |
| P2-05 | Full RMA run: request → approve → reverse pickup → receive with grading → restock-if-resellable → refund | `lib/returns.ts`, admin returns screens | Audit rows for each step | **E2E VERIFIED**; damaged item does **not** restock |
| P2-06 | GST credit note: model, numbered sequence, document, admin + customer access | migration (credit note + counters), `packages/shared/src/gst.ts` reuse, storefront invoice-adjacent page | PDF/HTML credit note with CGST/SGST or IGST split | Credit note matches refund to the rupee |
| P2-07 | Refund/payment reconciliation view: import Razorpay settlement CSV, match to payments/refunds | new admin route + screen, `payment_settlement` table | Imported file → matched/unmatched buckets | Unmatched remain visible, never hidden |
| P2-08 | Courier cost per shipment (expense field, no provider dependency) | shipment model extension + admin field | Entry → appears in cost reporting | Shipping cost is capturable |
| P2-09 | Base CSP/HSTS/frame headers on the admin app; restrict `images.remotePatterns` to known hosts | `apps/admin/next.config.ts`, `apps/storefront/next.config.ts` | Response header probe | Headers present on both apps |
| P2-10 | Staff walkthrough with four role accounts (owner/manager/operations/support/readonly), each action attempted and denied where expected | — | Per-role results table | Role boundaries demonstrated, not asserted |
| P2-11 | Legal/identity values: `BUSINESS_GSTIN`, `BUSINESS_CIN`, `BUSINESS_LEGAL_NAME`, `GRIEVANCE_OFFICER_*`, `SUPPORT_*` | owner secret store | Rendered footer/invoice | No placeholder reaches staging |
| P2-12 | Country-of-origin required per product (no silent "India" default) | admin product form + shared validation | Product without origin ⇒ blocked | Declaration is data, not a default |

**Exit gate:** a second sandbox order is delivered, tracked, returned, graded, refunded, and has a credit note; every step has an audit row; duplicate webhooks still single-effect.

---

### PHASE 3 — Production infrastructure (3 weeks, parallel to Phase 2)

| ID | Work package | Exit criterion |
|---|---|---|
| P3-01 | Three Dockerfiles (backend, storefront, admin) with multi-stage builds | Images build locally; storefront/admin images run |
| P3-02 | Managed PostgreSQL + Redis; `REDIS_URL` wired so jobs/event bus/rate limits are shared | Restart a replica, queued job still runs |
| P3-03 | Object storage (S3-compatible) for uploads; local `uploads/` retired | Upload survives replica restart |
| P3-04 | Secret store + **fail-fast** production assertions (no `local_dev_*` fallback when `NODE_ENV=production`) | Boot with missing secret fails loudly and immediately |
| P3-05 | Error monitoring + structured request logs + uptime check | A thrown test error appears with stack and request id |
| P3-06 | Automated backups + **rehearsed restore** into a scratch database | Restore verified by row counts and one order lookup |
| P3-07 | Staging environment + deploy pipeline with rollback | Merge to main deploys staging; a deliberately broken release is rolled back |
| P3-08 | CI hardening: `pnpm audit`, Dependabot, Actions pinned by SHA, backend+admin production builds | CI green including both new builds |
| P3-09 | Backup/restore/incident runbooks in `docs/OPERATIONS.md` | Runbook executable by a second person |

**Exit gate:** staging deploys from `main`; a backup is restored and verified; monitoring alerts on a forced error. **No public traffic before this gate.**

---

### PHASE 4 — Storefront integrity (2 weeks, parallel to 2/3)

These are correctness fixes to existing surfaces, not new features. Positioning-neutral, so BD-2 does not block them.

| ID | Work package | Files | Exit criterion |
|---|---|---|---|
| P4-01 | Server-side pagination + filtering + sorting in the catalogue (limit/offset API-driven) | `apps/storefront/lib/medusa.ts`, `app/collections/all/*`, `catalog-client.tsx`, backend query params | Catalogue shows correct total and filters beyond page 1 |
| P4-02 | One category model: tabs and mega-menu both from `product_category`; delete metadata heuristics | `lib/catalog.ts`, `lib/medusa.ts`, collections pages | Same product, same category, every entry point |
| P4-03 | Homepage from data: brand pavilion from `/store/brands` with real counts; render `banner_slot` content | `app/page.tsx`, `/store/content/home` | Adding a brand in admin changes the homepage without a deploy |
| P4-04 | Honest availability: remove the unconditional "In Stock"; show availability only from `POST /store/catalog/stock` | `app/page.tsx`, product card component | No availability claim without a stock source |
| P4-05 | PDP image gallery (render `product.images`), multi-image seed, image ordering in admin | PDP, admin media manager, seed | ≥3 images per seeded product, gallery navigable |
| P4-06 | In-stock facet on catalogue | catalogue filters | Facet counts match server totals |
| P4-07 | Remove/gate `/design` token galleries from production builds | both apps | 404 in production build |
| P4-08 | PDP SEO: description, canonical, OpenGraph, JSON-LD `Product` (no price claims without data) | PDP `generateMetadata` | Tags render for a real product |

**Exit gate:** no hardcoded product/marketing claim remains in a data path; catalogue correctness proved at >24 products.

---

### PHASE 5 — Reviews and truthful merchandising (1.5 weeks)

| ID | Work package | Notes |
|---|---|---|
| P5-01 | `product_review` model + migration: rating, title, body, verified-purchase flag derived from order history server-side, moderation state, author display name | Never accept `verified` from the client |
| P5-02 | Store API: create (authenticated, one per purchased line), list approved only, aggregate rating | Rate-limited |
| P5-03 | Admin moderation queue with audit rows | operations role |
| P5-04 | PDP: rating summary + review list + write form (purchase-gated) | No reviews ⇒ no rating shown |
| P5-05 | Structured data: `AggregateRating` only when real approved reviews exist | Prevents fabricated review markup |

**Exit gate:** a review can only be created by a customer who bought the item; unapproved reviews are invisible; counts are real.

---

### PHASE 6 — Retail back office: buy, cost, replenish (4 weeks)

**Depends on:** Phase 1 (real orders) and Phase 2 (returns), because costing touches both.

| ID | Work package | New models / migrations | Exit criterion |
|---|---|---|---|
| P6-01 | Supplier records (CRUD, audit) | `supplier` | Supplier manageable without DB edits |
| P6-02 | Purchase orders with lines, expected cost, status | `purchase_order`, `purchase_order_item` | PO created and approved with audit |
| P6-03 | Goods-received note: receive against PO lines, write stock ledger + inventory level, support partial receipt | `goods_receipt`, `goods_receipt_item` | Receiving increases stock atomically; over-receipt blocked |
| P6-04 | Stock movement ledger written by **every** stock mutation (adjustment, receipt, fulfilment, return restock, transfer, shrinkage) | `stock_movement` | Replaying the ledger reconciles to `inventory_level` for all items |
| P6-05 | Cost basis per variant: purchase cost, landed cost (freight/duty), effective date | `variant_cost` | Cost editable, historised, never inferred |
| P6-06 | Margin report (date-ranged): revenue − COGS by product/brand/category | admin reports | Totals tie to orders and ledger |
| P6-07 | Inventory valuation report at cost, as of a date | admin reports | Valuation reproducible from ledger |
| P6-08 | GST output report (rate × state, CGST/SGST/IGST) and GSTR-shaped CSV | admin reports, `packages/shared` | Totals tie to invoice tax lines |
| P6-09 | Reorder points per variant/location replacing the hardcoded `<= 3` | `inventory_level` metadata or `reorder_point` | Low-stock queue uses data |
| P6-10 | Multi-location correctness: explicit location on fulfil and return restock (no `.first()`) | order actions, `lib/returns.ts` | Correct location recorded; second location usable |
| P6-11 | Audit coverage for price, publish/draft, media, promotions, customer flags | admin server actions | Every mutation leaves an audit row |
| P6-12 | Date filters on operational lists and dashboard | admin queries | Any range selectable |

**Explicitly not in Phase 6:** pick/pack waves, carrier rate shopping, warehouse transfers UI beyond ledger support, ERP integration.

---

### PHASE 7 — Bespoke atelier (4 weeks) — **requires BD-2**

Sequence chosen so each step is independently useful:

| ID | Work package | Exit criterion |
|---|---|---|
| P7-01 | Consultation booking (slot, channel, status, staff assignment, audit) | A booking can be created, scheduled, completed |
| P7-02 | Customer measurement profile with **revision history** (append-only versions, "in use" pointer, per-garment-type fields) | Two revisions preserved; an order references the exact version used |
| P7-03 | Fabric catalogue (fabric, composition, weight, colourway, swatch asset, availability, surcharge) | Fabric selectable and priced from data |
| P7-04 | Structured customisation option sets (lapel, lining, monogram, etc.) replacing free text, with pricing rules | Customisation reproducible on the job card |
| P7-05 | Quotation → customer approval (versioned quote, expiry, acceptance record) | Approved quote is immutable and linked to the order |
| P7-06 | Production job card + tailor assignment + due date, generated from an approved order | Atelier can work from the system |
| P7-07 | Extend the existing 5-stage tracker with fittings and alterations records | Fitting/alteration history per garment |
| P7-08 | Garment QC record (checklist, inspector, verdict) replacing the `qc_passed` flag | QC evidence trail exists |
| P7-09 | Customer-facing atelier timeline incl. quote approval and fitting appointments | Customer sees the same truth as staff |

**Explicitly not in Phase 7:** automated pattern generation, tailor payroll, external atelier marketplace.

---

### PHASE 8 — Resale completion (4 weeks) — **requires BD-1 + BD-3**

| ID | Work package | Exit criterion |
|---|---|---|
| P8-01 | Intake: receive physical item, intake reference, condition-at-intake photos, status machine | Item tracked from receipt to listing |
| P8-02 | Ownership declaration + consignment terms acceptance (signed record, version, timestamp, IP) | Legal record exists per item |
| P8-03 | Link authentication to intake/ask (`condition_inspection` FK), public certificate shows the linked item | A listing can prove which item was inspected |
| P8-04 | Listing/pricing: parameterised commission (replace the 9.5% literal), price guidance from real data only | Commission is configuration, not code |
| P8-05 | Sale → settlement ledger: payable, fees, hold period, payout status, reference | Consignor balance is computable and auditable |
| P8-06 | Payout records (manual execution recorded; no automated money movement without explicit authorisation) | Payout history per consignor |
| P8-07 | Resale-specific returns/disputes (case, evidence, resolution, audit) | Dispute resolvable in-system |
| P8-08 | Bid handling per BD-1: if fixed-price, keep bidding disabled; if bidding, add matching + bid→order conversion + expiry | Behaviour matches the approved model exactly |

**Financial safety:** no real payout, no bank-detail storage beyond a tokenised reference, no automated transfer in this phase.

---

### PHASE 9 — Launch hardening and handover (2 weeks)

| ID | Work package | Exit criterion |
|---|---|---|
| P9-01 | Full regression: all suites, both builds, migrations-from-empty | Green, quoted |
| P9-02 | Security review pass over the diff since Phase 0 (authorisation, idempotency, PII, secrets) | Written sign-off, no open High |
| P9-03 | Data retention/archival policy for `audit_event` and logs | Policy implemented or explicitly deferred with rationale |
| P9-04 | Staff runbook: refunds, returns, purchasing, bespoke, resale, incident escalation | Second person can execute each |
| P9-05 | Load sanity check on catalogue + PDP + cart (not a benchmark claim unless measured) | Numbers reported honestly |
| P9-06 | Go-live checklist signed by owner: legal text reviewed, values set, backups verified, monitoring live, on-call named | Signed |
| P9-07 | Handover pack: architecture as built, env matrix, runbooks, known limitations | Reviewed with owner |

---

## 7. Testing strategy (the missing capability)

Today: 70 unit tests, zero integration, zero E2E. The plan adds layers rather than more unit tests.

| Layer | Scope | Tooling | Gate |
|---|---|---|---|
| Unit (existing) | pure logic: money, GST, roles, eligibility, status mapping, payout maths, signature helpers | Vitest | Every PR |
| Integration (new, Phase 0) | route handlers against a disposable PostgreSQL: auth/RBAC matrix, idempotency, concurrency (`FOR UPDATE`), ownership scoping, migration-from-empty | Vitest + Medusa's published integration runner (`@medusajs/test-utils`, version-locked — verify at implementation); fallback: HTTP harness against `scripts/dev-db` | Every PR; must include the five concurrency/idempotency tests from Phase 0 |
| Contract | storefront/admin ↔ backend response shapes for changed endpoints | Vitest + recorded fixtures | On endpoint change |
| E2E (Phase 1 onward) | money path, RMA, credit note, role walkthrough | Playwright against staging with **test-mode** providers | Before each phase exit and before go-live |
| Manual evidence | provider dashboards, received email, AWB, restored backup | Recorded artefacts in phase report | Phase exit |

**Rules:** no test may create real charges; all provider tests use sandbox; E2E uses synthetic customers only; failures are reported, never skipped to make a gate pass.

---

## 8. Migration and data-safety policy

1. One dated migration per logical change, in `apps/backend/src/modules/thl/migrations/`; Medusa core migrations never edited.
2. Expand → backfill → contract for any column change (adding `refund_amount` integer, for example, lands alongside a backfill and a later drop).
3. Every backfill is idempotent and logs counts; no destructive statement without a pre-check count recorded in the phase report.
4. CI's migrations-from-empty job remains the schema gate; a second CI job runs migrations against a seeded database to catch backfill failures.
5. No production data operation in this plan. Restores are rehearsed into scratch databases only.
6. Any new unique constraint on money/idempotency is added only after duplicate detection queries are run and reported.

---

## 9. Security workstream (mapped, not deferred)

| Priority | Item | Phase |
|---|---|---|
| P0 | Default-owner removal + role remediation | 0 |
| P0 | Refund idempotency | 0 |
| P1 | Stock lost-update | 0 |
| P1 | Admin security headers; image host allowlist | 2 |
| P1 | Rate limits on public write/AI routes | 0 |
| P1 | Production secret fail-fast | 3 |
| P1 | Dependency scanning | 3 |
| P2 | Staff MFA (TOTP) for owner/manager | 9 (or earlier if owner asks) |
| P2 | Session revocation / active sessions | 5–9, discretionary |
| P3 | Audit retention policy | 9 |

Explicit non-goals now: WAF procurement, penetration test engagement (recommend before public launch, owner decision), SOC2-style controls.

---

## 10. Blocked external configuration (owner actions)

| Integration | Env keys (names only) | Blocks | Needed by |
|---|---|---|---|
| Razorpay **test mode** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Phases 1–2 | Start of Phase 1 |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, verified sending domain | Order/return/auth email | Phase 1 (P1-09) |
| Shiprocket | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_TOKEN`, `SHIPROCKET_PICKUP_LOCATION` | AWB, reverse pickup, tracking | Phase 2 |
| Business identity | `BUSINESS_GSTIN`, `BUSINESS_CIN`, `BUSINESS_LEGAL_NAME`, `BUSINESS_STATE_*`, `BUSINESS_ADDRESS` | Compliant invoice/footer | Phase 2 |
| Grievance/support | `GRIEVANCE_OFFICER_*`, `SUPPORT_EMAIL`, `SUPPORT_PHONE` | Consumer-protection pages | Phase 2 |
| Object storage | `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | Durable media | Phase 3 |
| Redis | `REDIS_URL` | Shared queues, event bus, rate limits | Phase 3 |
| Monitoring | `SENTRY_DSN` (or chosen provider) | Incident visibility | Phase 3 |
| SMS/DLT | `OTP_PROVIDER`, `OTP_API_KEY`, `OTP_TEMPLATE_ID`, `OTP_SENDER_ID` | Phone verification | After launch, unless owner prioritises |
| WhatsApp | `MSG91_WHATSAPP_*`, four template names | Notification channel | Optional |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | AI layer (flag-gated) | Optional |

**Never** paste key values into chat, commits, tickets or logs. Presence is reported as present/absent only.

---

## 11. Mapping to the mission's definition of success

| Success criterion | Phase | Evidence required |
|---|---|---|
| Genuine sandbox purchase completed | 1 | Order id, payment id, amount, captured-at, screenshots/steps |
| Payment captured exactly once | 1 | Duplicate-submit test + replay test |
| Order fulfilled and tracked | 2 | AWB, shipment rows, webhook transitions |
| Customer requests a return | 2 | RMA id, audit row, acknowledgement email |
| Staff receive and grade the return | 2 | Condition record + audit |
| Refund processed exactly once | 2 | One refund row, one provider refund, replay proof |
| Correct GST credit note produced | 2 | Document with tax split matching the refund |
| All actions auditable | 0–8 | Audit query output per phase |
| Correct role permissions | 0, 2 | Per-role matrix executed |
| Backup restorable | 3 | Restore transcript |
| Business runs without editing the DB | 6–8 | Every listed action performed through UI/API |

**Launch gate:** phases 0–4 complete, phase 9 signed, zero open P0/P1. Phases 5–8 may trail launch only if the owner accepts the documented business limitation (reviews absent, no purchasing/costing, no bespoke workflow, no settlement) — this must be an explicit written acceptance, not an engineering assumption.

---

## 12. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Provider credentials never arrive | Medium | Phases 1–2 stall | Phase 0 and 4 proceed; owner escalation at week 1 |
| Razorpay webhook topology misconfigured at go-live | Medium | Payments never settle | P1-03 documents exactly one state endpoint; verify in staging |
| Duplicate-refund/stock fixes regress Medusa invariants | Low | Data corruption | Workflow-only writes retained; integration tests added first |
| Credit-note format rejected by accountant | Medium | Rework | Get accountant input before P2-06 build |
| Bespoke/resale scope creep before retail is proven | High | Project stalls (historical pattern) | Phase order enforced; features behind flags; this plan's non-goals list |
| Admin UI turns out to be broken once exercised | Medium | Extra rework | Phase 2 P2-10 walkthrough booked early; budget contingency |
| Audit fixtures leak into staging | Medium | Misleading reporting | P0-13 clean seed + guarded reset |
| Windows dev environment regressions | Low | Team blocked | Preserve `dev-db.mjs`/`.bat`; no POSIX-only scripts |
| Redis absent in production | Low (if Phase 3 done) | Lost jobs, per-replica limits | P3-02 gate |

---

## 13. Ownership checkpoints (what I need from you)

1. **Approve this plan** (or amend phase order/scope).
2. **BD-1** resale model: fixed-price (recommended), bidding, or hybrid.
3. **BD-2** positioning: sneaker/streetwear or broader premium fashion.
4. **Sandbox credentials** for Razorpay test mode and Resend, supplied via the environment/secret store — names only in any message.
5. **Confirm** whether phases 5–8 must precede public launch, or whether retail launch with documented limitations is acceptable.
6. **Confirm** the legal/accounting contact who will approve credit-note format, policy text and GST treatment of consignment.

Until 1–2 are answered, work proceeds only on **Phase 0**, which is model-neutral, positioning-neutral and requires no credentials.

---

## 14. Phase report template (used at every phase end)

```md
# PHASE <n> REPORT — <name>
Date · Engineer · Plan WP coverage

## 1. Changes made            (per WP, with rationale)
## 2. Files changed            (paths, added/modified/deleted)
## 3. Database migrations      (file name, forward/back, backfill counts, applied where)
## 4. Tests executed           (exact commands, exit codes, counts, failures)
## 5. Manual/E2E evidence      (ids, responses, artefact paths)
## 6. Status per WP            (IMPLEMENTED / UNIT TESTED / INTEGRATION TESTED / E2E VERIFIED / BLOCKED / NOT VERIFIED)
## 7. Remaining defects        (with severity + owner)
## 8. Blocked external config  (present/absent only, never values)
## 9. Security & data review   (authorisation, idempotency, PII, transactions)
## 10. Regressions checked     (full unit suite + affected builds)
## 11. Next phase dependencies
```

---

## 15. Immediate next actions on approval

```
1. Owner: approve plan; answer BD-1 and BD-2; supply Razorpay TEST keys + Resend key via env.
2. P0-01  eslint.config.mjs — ignore .audit/**            → pnpm lint exit 0
3. P0-02  admin-auth.ts — no default owner                → unit test + 403
4. P0-03  apps/admin/lib/api/auth.ts — no default owner    → role-less blocker page
5. P0-04  scripts/audit-admin-roles.ts                    → every staff user has a role
6. P0-06  inventory route — SELECT … FOR UPDATE            → concurrency test
7. P0-07  refund idempotency key + table                   → duplicate refund test
8. P0-08  RMA sequence                                     → parallel-request test
9. P0-09  refund_amount integer backfill                   → one money type
10. P0-10/11 concierge ownership + write rate limits
11. P0-12 integration harness                              → pnpm test:integration
12. Write PHASE_0_REPORT.md with quoted evidence.
```

No implementation begins until item 1 is answered.
