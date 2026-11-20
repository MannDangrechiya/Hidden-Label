# THE HIDDEN LABEL — COMPLETE AUDIT REPORT (ALL SECTIONS IN ONE FILE)

**Repository:** `C:\Users\ASUS\Documents\Hidden Label` (pnpm monorepo)
**Audit type:** Independent, evidence-first, read-only production-readiness audit
**Report date:** 20 November 2026
**HEAD commit audited:** `2428b97`
**Evidence tags:** `[LIVE]` = observed against the running system, `[CODE]` = verified in source, `[BLOCKED]` / `NOT VERIFIED` = could not be proven in this environment.

> This file is a single-document merge of the 16 individual reports in this directory (00–15).
> The individual files remain the canonical per-section reports; nothing in them was changed by this merge.
> No application source code, dependency, schema, migration or deployment was modified by the audit.

## Contents

| # | Section | File |
|---|---------|------|
| 00 | Executive Summary | `00_EXECUTIVE_SUMMARY.md` |
| 01 | Repository Discovery | `01_REPOSITORY_DISCOVERY.md` |
| 02 | Architecture Audit | `02_ARCHITECTURE_AUDIT.md` |
| 03 | Storefront Audit | `03_STOREFRONT_AUDIT.md` |
| 04 | Backend & API Audit | `04_BACKEND_API_AUDIT.md` |
| 05 | Database and Inventory Audit | `05_DATABASE_AND_INVENTORY_AUDIT.md` |
| 06 | Admin Panel and Internal Operations Audit | `06_ADMIN_AND_OPERATIONS_AUDIT.md` |
| 07 | Commerce and Checkout Audit | `07_COMMERCE_AND_CHECKOUT_AUDIT.md` |
| 08 | External Integration Audit | `08_INTEGRATION_AUDIT.md` |
| 09 | Security and Compliance Audit | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` |
| 10 | Performance, Build and DevOps Audit | `10_PERFORMANCE_AND_DEVOPS_AUDIT.md` |
| 11 | Real-World Ecommerce Business Operations Audit | `11_ECOMMERCE_BUSINESS_OPERATIONS_AUDIT.md` |
| 12 | Test Results and Evidence | `12_TEST_RESULTS_AND_EVIDENCE.md` |
| 13 | Master Gap Register | `13_MISSING_FEATURES_AND_GAP_REGISTER.md` |
| 14 | Final Production Readiness | `14_FINAL_PRODUCTION_READINESS.md` |
| 15 | Recommended Implementation Roadmap | `15_RECOMMENDED_IMPLEMENTATION_ROADMAP.md` |

---

<!-- ===== BEGIN 00_EXECUTIVE_SUMMARY.md ===== -->

# THE HIDDEN LABEL — 00 EXECUTIVE SUMMARY

**Audit type:** independent, evidence-first repository and runtime audit.
**Audit date:** 2026-11-20.
**Auditor stance:** no source code changed, nothing deployed, no schema changed, no dependency installed.
**Evidence standard:** every claim below is tagged **[LIVE]** (an HTTP request, database query or command was actually executed in this session), **[CODE]** (read and typechecked, not executed), or **[BLOCKED]** (could not be verified — missing credential/infrastructure). No claim is inherited from the 40+ pre-existing `*.md` reports at the repository root.

---

## 1. Overall project verdict

**This is a substantial, genuinely implemented commerce platform — not a mock-up — that cannot take a real payment in its current state.**

The codebase is a real pnpm monorepo containing a Medusa 2.22.7 commerce backend, a Next.js 16.4.6 customer storefront and a Next.js 16.4.6 custom admin dashboard. The database is real (171 public tables, live inventory, live orders, live audit log). The storefront renders real catalogue data from the backend over the Medusa Store API. Authorisation is enforced server-side, not just hidden in the UI. There is no evidence anywhere of the "fake it" patterns that usually plague AI-built storefronts: no hardcoded product arrays in the catalogue path, no fabricated prices in the product/price components, no mock backend fallback in `apps/storefront/lib/medusa.ts`.

Against that, the decisive operational facts are:

| Fact | Evidence |
|---|---|
| **Zero payment providers are linked to the INR region.** `region_payment_provider` returned 0 rows. | **[LIVE]** `select * from region_payment_provider` → `[]` |
| **No Razorpay credentials exist in this environment.** `apps/backend/.env` contains no `RAZORPAY_*` key; `apps/storefront/.env.local` has no `NEXT_PUBLIC_RAZORPAY_KEY_ID`. | **[LIVE]** env key-name enumeration |
| **Cash on Delivery was deliberately removed** (`docs/BUILD_LOG.md`, `.env.example`), so with Razorpay unlinked there is currently **no way to complete a checkout at all**. | **[LIVE]** DB + **[CODE]** `apps/storefront/app/checkout/page.tsx`, `apps/backend/src/scripts/setup-payments.ts` |
| **`pnpm lint` fails** — 15 errors, all in committed `.audit/*.mjs` evidence scripts, which the root ESLint config does not ignore. CI runs `pnpm lint`. | **[LIVE]** `pnpm lint` → exit 1 |
| **`pnpm typecheck` passes** across all 6 packages, and **`pnpm test` passes 70/70** — but every test is a unit test. There is no integration or end-to-end test in the repository's test suite. | **[LIVE]** |
| **Email, SMS OTP, Shiprocket and image storage are all unconfigured** in this environment; each is gated to fail visibly rather than fake success. | **[LIVE]** env keys + **[CODE]** `lib/email.ts`, `lib/sms.ts`, `lib/shiprocket.ts` |

**Verdict: CONDITIONALLY READY as a codebase; NOT READY as a business.**

The engineering is broadly sound and honest. The commerce lifecycle — catalogue → cart → address → shipping option → payment → order → fulfilment → return → refund — is implemented end-to-end *in code*, and the money-sensitive parts are implemented correctly (server-side HMAC verification, amount computed server-side, no client-supplied totals). But the critical path is **unproven in this environment** because the payment leg is switched off, and several business-critical modules (supplier/purchasing, consignment settlement, reviews, production infrastructure) do not exist at all.

---

## 2. Actual technology stack (verified from manifests and lockfile)

| Layer | Technology | Version | Evidence |
|---|---|---|---|
| Monorepo | pnpm workspaces | pnpm 10.32.1 | `package.json`, `pnpm-workspace.yaml` |
| Runtime | Node.js | engines `>=22.22.0`; host running v26.10.0 | **[LIVE]** `node -v` |
| Commerce backend | Medusa | **2.22.7** (all `@medusajs/*` lockstep) | `apps/backend/package.json` |
| Storefront | Next.js (App Router) + React 19 | **16.4.6** | `apps/storefront/package.json` |
| Admin | Next.js (App Router) + React 19 | **16.4.6**, `--webpack` dev | `apps/admin/package.json` |
| Language | TypeScript | 5.9.3 | root `package.json` |
| Styling | Tailwind CSS v4 (`@theme`) | 4.3.5 | `apps/*/package.json`, `packages/ui/src/styles/tokens.css` |
| Database | PostgreSQL | 18.x (portable `embedded-postgres`, port **5437**; also Docker `postgres:18-alpine`) | `scripts/dev-db.mjs`, `docker-compose.yml` |
| Cache / event bus | Redis 7 (Docker, port **6380**) — **not running/not configured here**; Medusa falls back to in-memory modules | `docker-compose.yml`, `medusa-config.ts` (`redisUrl: process.env.REDIS_URL \|\| undefined`) |
| Validation | Zod | ^4.6.6 (`packages/shared`) | `packages/shared/src/schemas.ts` |
| Unit tests | Vitest | 3.2.4 | root `package.json` |
| CI | GitHub Actions | `.github/workflows/ci.yml` | typecheck → lint → test → storefront build + migrations-from-empty job |
| Payments | Razorpay (custom Medusa payment provider module) | hand-written provider | `apps/backend/src/modules/razorpay/service.ts` |
| Logistics | Shiprocket (custom REST client) | hand-written | `apps/backend/src/lib/shiprocket.ts` |
| Email | Resend (raw REST) | hand-written | `apps/backend/src/lib/email.ts` |
| SMS OTP | MSG91 or Twilio (raw REST) | hand-written | `apps/backend/src/lib/sms.ts` |
| AI | Google Gemini (`gemini-2.0-flash` default) | hand-written REST | `apps/backend/src/lib/gemini.ts` |
| Hosting | **None configured** — local dev only; no Dockerfile for the apps, no deploy workflow | `.github/workflows/ci.yml` has no deploy job |

Notable: **there is no Prisma, no NextAuth, no Stripe, no external ecommerce SaaS.** All commerce state lives in Medusa's own schema plus 19 project-owned tables registered through one custom Medusa module (`apps/backend/src/modules/thl`).

---

## 3. Features VERIFIED working (executed this session)

**[LIVE] Backend**
- `GET /health` → `200 OK`.
- `GET /store/products` with the publishable key → real JSON, `count: 17`.
- `GET /store/categories` → real `product_category` tree with per-node `product_count` (e.g. Footwear → Sneakers = 8).
- `GET /store/brands`, `GET /store/content/home`, `GET /store/search/suggest?q=air`, `POST /store/catalog/stock` → real JSON from the database.
- `GET /store/resale/recent-activity` → real order-line rows (not the previously-fabricated ticker).
- **Authorisation is real:** `GET /admin/orders` → **401**; `GET /store/orders` → **401**; `GET /store/wishlist` → **401**; unsigned `POST /webhooks/razorpay` → **503** (not configured, correctly refuses).

**[LIVE] Storefront (port 3000)**
- `200` on `/`, `/collections/all`, `/cart`, `/login`, `/register`, `/brands`, `/brands/{nike,jordan,adidas,new-balance,salomon,asics}`, `/about`, `/search`, `/sell`, `/authenticity`, `/fit-studio`, `/policies/privacy`, and a real PDP (`/products/air-jordan-1-retro-high-og-chicago`).
- `/checkout` → `307` redirect to `/cart` when the bag is empty (correct guard, not an error).
- Unknown product → `404` (honest not-found, no fake success page).

**[LIVE] Database**
- 171 public tables; the custom `audit_event` table carries a real append-only trigger (`audit_event_append_only`).
- 60 variants, **all 60 with `manage_inventory = true` and 0 with `allow_backorder`** — Medusa's own reservation engine is therefore the oversell gate.
- 59 inventory levels: 170 stocked, 43 reserved.
- Real unique constraints on `shipment_event(shipment_id, event_key)`, `return_request.display_id`, `shipment.provider_shipment_id`.

**[LIVE] Toolchain**
- `pnpm typecheck` → exit 0, 6/6 packages.
- `pnpm test` → exit 0, **70/70 tests** across `@thl/shared` (23), `@thl/backend` (45), `@thl/admin` (2).

---

## 4. Features implemented but NOT verified

Everything below exists in code, is typechecked, and in several cases has unit tests — but was not exercised end-to-end in this session.

- **Razorpay checkout** (provider, signature verification, refunds) — no keys, no region link **[BLOCKED]**.
- **Shiprocket** shipment creation, AWB, reverse pickup — no credentials **[BLOCKED]**.
- **Resend transactional email** (order confirmation, password reset, delivery, RMA, daily report) — no key; falls back to logging **[BLOCKED]**.
- **MSG91/Twilio SMS OTP** — no provider key; returns 501 by design **[BLOCKED]**.
- **WhatsApp order notifications** via MSG91 — no key **[BLOCKED]**.
- **Gemini concierge / sight search** — `GEMINI_API_KEY` is present in `apps/backend/.env` but no call was made (cost + would be a live third-party call); fallback template path is deterministic **[CODE]**.
- **Admin dashboard** — the admin dev server was **not running** on port 7001 and no admin password is available, so no admin screen or action was clicked through **[BLOCKED]**.
- **Return lifecycle** (requested → approved → received → refunded, with condition grading and restock) — code + unit tests only; existing rows in `return_request` are fixtures **[CODE]**.
- **Order actions** (capture / fulfil / cancel / refund) — code only **[CODE]**.

---

## 5. Partially implemented features

| Feature | What exists | What is missing |
|---|---|---|
| **Product media** | Admin can upload real images via `/admin/uploads` and manage a gallery (`media-manager.tsx`); `product.images` is writable | The **PDP renders only `product.thumbnail`** — no gallery on the storefront; seed data assigns one image per product |
| **Bespoke tailoring** | Measurement capture drawer (chest/waist/shoulder/sleeve/inseam), measurements ride on the cart line item as `metadata.custom_measurements`, admin "master tailor sheet" + 5-stage pipeline, customer-facing stage timeline | No consultation booking, no stored measurement profile with revisions, no fabric catalogue, no quotations/approvals, no production job cards, no tailor assignment, no fittings/alterations, no QC record |
| **Resale / authentication** | Resale asks + bids with a 9.5% fee calculator, per-variant price-index curves, per-unit condition inspection records with 360° frames, admin inspection queue, sell/consign page | No **seller intake** of a physical item, no ownership declaration, no intake reference, no authentication checklist entity tied to a submitted item, no consignor settlement/payout ledger, no authentication dispute flow, no resale-specific returns |
| **Inventory** | Levels, adjustments with mandatory reason codes, low-stock queue, audit rows, return restock gated on `resellable` condition | Admin UI assumes a **single stock location** (`stock_location.first()`); no transfers UI, no multi-warehouse pick/pack, no stock ageing report, no reconciliation workflow |
| **Returns** | Eligibility computed and re-checked at approval, RMA numbering, reverse pickup attempt, received-condition grading, restock | No credit note document, no exchange flow, no refund provider reconciliation |
| **Support** | Customer ticket creation, admin support inbox, "Get help with this order" deep link | No SLA timers, no canned responses, no ticket categories from a controlled list, no customer communication history view |
| **Reports** | Dashboard KPIs (orders by status, captured/refunded revenue, low stock, open returns, pending shipments), two CSV exports | No date-range filters, no GST report, no margin/profitability, no payment-gateway reconciliation, no inventory valuation |
| **Search** | Typeahead over products + brands, SKU included | No pagination on search results, no relevance tuning, no fuzzy matching, no zero-result analytics |
| **Catalogue filters** | Category tabs, brand, price buckets, size, sort — all client-side over the loaded page | **No server-side pagination**: `fetchProducts({limit: 24})` default means a catalogue beyond the loaded page is invisible to filters and search-within-page |

---

## 6. Missing features (confirmed absent — not a credentials problem)

Confirmed by directory listing, route inventory and grep across the whole repository:

1. **Product reviews / ratings** — zero model, zero route, zero UI.
2. **Supplier & purchasing** — no supplier table, no purchase orders, no goods-received notes, no purchase cost, no landed-cost or margin data.
3. **Customer measurement profiles with revisions** — only per-line bespoke measurements and a foot-size fit profile (`customer_fit_profile`).
4. **Consignment settlement** — an estimated payout is computed in the UI (`ask × 0.905`) but no settlement record, payout status, or bank details are stored.
5. **Marketing consent / newsletter / communication history** — only a `privacy_consent_at` stamp on registration and checkout.
6. **Loyalty / membership / segmentation.**
7. **Multi-location inventory operations** (transfers, per-location pick/pack).
8. **GST credit notes** and formal accounting exports.
9. **Production infrastructure** — no Dockerfile, no IaC, no deploy pipeline, no backup/restore procedure, no error monitoring (`SENTRY_DSN` unset), no log aggregation.
10. **Analytics** — no product analytics, no funnel instrumentation.
11. **Email template management / CMS-driven notifications.**
12. **Wishlist/stock alert notifications** (wishlist exists, "notify me when back" does not).

---

## 7. Critical bugs (defects in existing code, ranked)

| ID | Defect | Evidence | Impact |
|---|---|---|---|
| **BUG-01** | **No payment provider is enabled**, so `/checkout?step=payment` has an empty provider list and `beginRazorpayPaymentAction` returns "Online payment is not configured on this environment." COD is removed. Checkout is a dead end. | **[LIVE]** `region_payment_provider` = 0 rows; **[CODE]** `checkout.ts` guards on `NEXT_PUBLIC_RAZORPAY_KEY_ID` | **P0** — no revenue possible |
| **BUG-02** | **`pnpm lint` fails with 15 errors**; CI's `Lint` step therefore fails on `main`. | **[LIVE]** `pnpm lint` → 15 problems, all under `.audit/*.mjs` | **P1** — CI red, release gate broken |
| **BUG-03** | **Missing role metadata defaults to `owner`.** `resolveAdmin()` (`apps/backend/src/lib/admin-auth.ts`) and `fetchCurrentAdmin()` (`apps/admin/lib/api/auth.ts`) both fall back to `"owner"` when `metadata.role` is absent. Any admin user created without an explicit role is a full owner. | **[CODE]** both files | **P0 security** — silent privilege escalation |
| **BUG-04** | **Refund "idempotency" key is not idempotent.** `idempotency_key: \`order-${orderId}-refund-${Date.now()}\`` generates a new key on every retry, so the documented "a retry cannot move money twice" guarantee does not hold for two concurrent/duplicate refund requests. | **[CODE]** `apps/backend/src/api/admin/orders/[id]/actions/route.ts` | **P1** — double refund risk |
| **BUG-05** | **Inventory adjustment is read-then-write without row locking.** `POST /admin/inventory` reads `stocked_quantity`, computes `next`, then updates. Two concurrent adjustments lose one of them. | **[CODE]** `apps/backend/src/api/admin/inventory/route.ts` | **P1** — stock drift |
| **BUG-06** | **Homepage hardcodes brand cards and counts.** `apps/storefront/app/page.tsx` ships a literal `BRANDS` array ("Jordan · 12 Silhouettes", "Nike · 18 Silhouettes", …) instead of reading `/store/brands`. The numbers are invented; adding a brand or changing counts in admin has no effect. The links *do* resolve (verified 200) because those brands happen to exist. | **[LIVE]** pages 200; **[CODE]** `page.tsx` | **P1** — operations cannot change the homepage without a deploy; published numbers are unverified claims |
| **BUG-07** | **Every homepage card says "In Stock →" unconditionally**, even when the variant is out of stock — the store API does not expose stock, so the label is an assertion the page cannot support. | **[CODE]** `apps/storefront/app/page.tsx` | **P2** — misleading availability |
| **BUG-08** | **RMA display id is derived from a row count** (`RMA-${1000 + count + 1}`). Two concurrent requests collide; the unique index then turns one into a 500 rather than a retry. | **[CODE]** `apps/backend/src/api/store/return-requests/route.ts` | **P2** |
| **BUG-09** | **Concierge thread ownership is not checked.** `POST /store/concierge/chat` accepts any `thread_id` and appends the message to it if the row exists — no `customer_id`/`session_token` match. | **[CODE]** `apps/backend/src/api/store/concierge/chat/route.ts` | **P2** |
| **BUG-10** | **Storefront catalogue is capped at the first page.** `fetchProducts` defaults to `limit: 24`; category/brand/price/size filtering and "N pieces" counts run only over that page. | **[CODE]** `lib/medusa.ts`, `catalog-client.tsx` | **P2** — will silently under-report once the catalogue exceeds a page |
| **BUG-11** | **`GET /store/customers/me` unauthenticated returns `400`, not `401`** (no bearer header at all). Not a security hole, but it makes client error handling inconsistent with every other protected route. | **[LIVE]** `400` | **P3** |
| **BUG-12** | **Audit fixtures are still in the working database**: 36 brands named `Audit Brand`/`TestBrand`, audit test products, 43 units reserved. Anyone treating this DB as "seeded demo data" will misread the catalogue. | **[LIVE]** `select handle,name from brand` | **P2** — environment hygiene |

---

## 8. Security issues (defensive review)

Strengths actually present in code: httpOnly + SameSite=Lax session cookies (`thl_auth`, `thl_cart`, `thl_admin_token`), no token in `localStorage`; CSP/HSTS/nosniff/frame-deny headers on the storefront (`next.config.ts`); universal server-side RBAC on `/admin/*`; timing-safe `crypto.timingSafeEqual` webhook signature comparison over the **raw** body; OTP hashed with HMAC, 5-minute TTL, 5 attempts, 3 sends per 15 minutes; auth rate limiting keyed by IP+email, Redis-backed with in-memory fallback; append-only audit table enforced by trigger; order/return/wishlist/shipment access scoped to `customer_id`; secrets not committed (only `.env.example` files are tracked).

Issues found:

| ID | Severity | Issue |
|---|---|---|
| SEC-01 | **High** | Default role is `owner` when `metadata.role` is missing (BUG-03). |
| SEC-02 | Medium | Refund idempotency key not stable (BUG-04). |
| SEC-03 | Medium | Inventory adjustment lost-update (BUG-05). |
| SEC-04 | Medium | Concierge thread not owner-scoped (BUG-09); the route also trusts a client-supplied `session_token`. |
| SEC-05 | Medium | **Shiprocket webhook uses a static shared token in a query string** (`?token=`), not an HMAC over the body. Query strings land in access logs and proxies. Acceptable as an interim measure only, and it is documented as such in the route. |
| SEC-06 | Low | Admin cookie `maxAge` is 24h while Medusa admin JWTs are short-lived; there is no refresh or explicit revocation path beyond deleting the cookie. |
| SEC-07 | Low | `customers/me` returns 400 rather than 401 (BUG-11) — inconsistent auth signalling. |
| SEC-08 | Low | No WAF/bot protection; public `/store/otp/send` is reachable cross-origin (rate-limited server-side, but keyed on `ip`+destination only). |
| SEC-09 | Informational | `OTP_DEV_ECHO=true` is set in `apps/backend/.env` (development). Correctly gated on `NODE_ENV !== "production"`, but it must never be copied into a production environment file. |
| SEC-10 | Informational | No dependency vulnerability scan in CI (no `pnpm audit` / Dependabot). |

No SQL-injection exposure was found: all raw knex usage inspected uses bound parameters or static identifiers. No SSRF-shaped fetch takes a user-supplied URL except the Gemini image path, which posts an image URL to Google, not an arbitrary host.

---

## 9. Production blockers

1. **Payments are not enabled** (no provider link + no keys). Without this the store cannot sell.
2. **No production infrastructure** — no hosting, no managed Postgres/Redis, no secrets store, no DNS/TLS, no backups, no monitoring.
3. **No email transport configured** — customers would receive no order confirmation, no password reset, no RMA acknowledgement.
4. **No logistics configured** — no AWB, so no shipping label or tracking; fulfilment would be entirely manual.
5. **`pnpm lint` is red**, so the repo's own release gate fails.
6. **Default-owner role fallback** must be closed before any second staff account is created.
7. **Business identity fields are unset** — `BUSINESS_GSTIN`, `BUSINESS_CIN`, `GRIEVANCE_OFFICER_*`, `SUPPORT_PHONE`. The storefront prints placeholders (`GSTIN: —`) and a default phone number.
8. **Legal Metrology / consumer disclosures are template copy**, not reviewed legal text; the grievance page text is seeded in the CMS, not authored by counsel.

---

## 10. Business operations gaps

- **Retail**: no supplier records, purchase orders, goods-received notes, purchase cost, landed cost, or margin reporting. Inventory exists as *quantities*, not as *stock with a cost basis*. Stock ageing, reordering and supplier invoices do not exist.
- **Bespoke**: customer-facing measurement capture and an internal tailor sheet exist; the *business process* around it (consultation, fabric selection, quote, approval, job card, tailor assignment, fitting, alteration, QC) does not.
- **Resale/authentication**: the orderbook, price index and per-unit inspection records are real and DB-backed, but the **intake** side of consignment (receive item → verify ownership → authenticate → price → list → settle) is not built. A consignor can create an ask; nothing records that the physical item was received, authenticated against that ask, or that the consignor was paid.
- **CRM**: profiles, order history, internal notes and a risk/blacklist flag exist; segmentation, loyalty, marketing consent and communication history do not.
- **Finance**: GST is computed correctly at cart time and printed on an invoice page (CGST+SGST vs IGST by state), but there are no credit notes, no gateway settlement reconciliation, no purchase-cost/gross-margin reporting, and no daily reconciliation.

---

## 11. Recommended priority order

1. **Close the payment loop** (link Razorpay to the INR region with test keys; run one full sandbox purchase; verify webhook replay safety).
2. **Fix the release gate** (`pnpm lint` — either ignore `.audit/` in the ESLint config or remove the scripts from the repo) and add `pnpm audit` to CI.
3. **Fix SEC-01 (default-owner), BUG-04 (refund key), BUG-05 (inventory lock)**.
4. **Configure email** so order/auth/RMA messages actually send.
5. **Close the RMA end-to-end** in a sandbox (request → approve → receive with condition → restock/refund).
6. **Configure Shiprocket** and verify one sandbox AWB + webhook delivery transition.
7. **Decide the business model question** that `CURRENT_PROJECT_STATUS.md` already flags: StockX-style bidding vs CultureCircle-style fixed price + comparison. The code currently ships the former.
8. **Only then** build the missing operational modules in this order: supplier/purchasing → consignment settlement → reviews → multi-location inventory.

---

## 12. Exact next actions

```
1. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET (test mode) to apps/backend/.env
2. Add NEXT_PUBLIC_RAZORPAY_KEY_ID to apps/storefront/.env.local
3. pnpm db:setup-payments          # links pp_razorpay_razorpay to the INR region
4. Restart backend; GET /store/payment-providers?region_id=<inr> must list razorpay
5. Run one sandbox purchase end-to-end and record the order id
6. Replay the same Razorpay webhook twice; assert one payment event and one order
7. Fix lint: add "!.audit/**" (or a dedicated ignore) to eslint.config.mjs — do not delete evidence
8. Change the role fallback in admin-auth.ts + admin/lib/api/auth.ts from "owner" to null + 403
9. Replace Date.now() with a stable idempotency key derived from (orderId, amount, reason)
10. Wrap the inventory adjustment in a transaction with SELECT ... FOR UPDATE
```

None of the above was performed during this audit. The repository is unchanged apart from this `AUDIT_REPORTS/` directory.

<!-- ===== END 00_EXECUTIVE_SUMMARY.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 01_REPOSITORY_DISCOVERY.md ===== -->

# 01 — REPOSITORY DISCOVERY

## 1. Root inventory

```
C:\Users\ASUS\Documents\Hidden Label
├── apps/
│   ├── backend/        Medusa 2.22.7 commerce API + custom modules, routes, jobs, subscribers, seeds
│   ├── storefront/     Next.js 16.4.6 customer application (port 3000)
│   └── admin/          Next.js 16.4.6 custom admin dashboard (port 7001, --webpack)
├── packages/
│   ├── shared/         money/INR, GST, HSN, schemas, phone helpers + unit tests
│   ├── ui/             design-system components + Tailwind v4 tokens
│   └── config/         shared ESLint config
├── docs/               19 specification / handover documents + screenshots
├── scripts/            dev DB launcher, operational scripts, an ad-hoc e2e script
├── agent/              coding-agent rules and phase prompts
├── .audit/             committed evidence scripts + JSON result files from earlier audit rounds
├── .github/workflows/  single CI workflow
├── AUDIT_REPORTS/      ← this audit (new, dated)
├── *.md (40 files)     previous audit / status reports at the root
├── docker-compose.yml  postgres:18-alpine :5437, redis:7-alpine :6380
├── pnpm-workspace.yaml apps/* + packages/*
├── .env.example        the only tracked env file (values are placeholders)
└── *.bat               Windows start/stop launchers for backend, admin, storefront
```

**Workspace count:** 6 projects (`apps/backend`, `apps/storefront`, `apps/admin`, `packages/shared`, `packages/ui`, `packages/config`) plus the root.

**Excluded from this map:** `node_modules/`, `.next/`, `.dev/` (local Postgres cluster + logs), `*.log`, `pnpm-lock.yaml` internals.

## 2. Entry points and how the system starts

| Service | Command | Port | Config |
|---|---|---|---|
| PostgreSQL | `pnpm db:start` (portable `embedded-postgres`) or `docker compose up -d` | **5437** | `scripts/dev-db.mjs` sanitises env on Windows (documented `0xC0000142` failure) |
| Redis | `docker compose up -d` only | **6380** | not required — `MEDUSA_REDIS_URL` unset ⇒ Medusa in-memory modules |
| Backend | `pnpm dev:backend` → `medusa develop --port 9000` | **9000** | `apps/backend/medusa-config.ts`, `apps/backend/.env` |
| Storefront | `pnpm dev:storefront` → `next dev -p 3000` | **3000** | `apps/storefront/.env.local` |
| Admin | `pnpm dev:admin` → `next dev -p 7001 --webpack` | **7001** | `BACKEND_URL` (defaults to `http://localhost:9000`) |

CORS is restricted in `medusa-config.ts`:

```ts
const STOREFRONT_ORIGIN = process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000";
const ADMIN_ORIGIN      = process.env.ADMIN_ORIGIN      ?? "http://localhost:7001";
storeCors: STOREFRONT_ORIGIN,
adminCors: `${ADMIN_ORIGIN},${STOREFRONT_ORIGIN}`,
```

**Windows-specific caveat honoured during this audit:** the dev servers were already running (backend `:9000` healthy, storefront `:3000` healthy). The admin app was **not** running on `:7001`. No service was restarted or altered.

## 3. Backend structure (`apps/backend`, 118 TypeScript files)

```
src/
├── api/
│   ├── middlewares.ts            ← the single routing/middleware registry
│   ├── admin/      (21 route handlers)
│   ├── store/      (27 route handlers)
│   └── webhooks/   razorpay, shiprocket (2)
├── lib/
│   ├── admin-auth.ts    role resolution + requireRole + canWrite
│   ├── audit.ts         append-only audit writer
│   ├── auth.ts          typed access to req.auth_context
│   ├── email.ts resend │ sms.ts MSG91/Twilio │ whatsapp.ts MSG91 Wa
│   ├── shiprocket.ts    shipment + reverse pickup client
│   ├── shipment-status.ts  the single courier→status mapper (idempotent)
│   ├── returns.ts       eligibility + admin return actions + restock
│   ├── tax.ts hsn.ts    GST slabs / HSN derivation
│   ├── otp.ts phone.ts  OTP hashing and Indian phone normalisation
│   ├── rate-limit.ts    Redis-backed, in-memory fallback
│   ├── package.ts       volumetric/chargeable weight for couriers
│   ├── resale.ts        payout maths, size conversion, price index
│   ├── gemini.ts        grounded LLM prompt / fallback
│   └── csv.ts
├── modules/
│   ├── thl/             19 models, 8 migrations, MedusaService
│   └── razorpay/        AbstractPaymentProvider implementation
├── jobs/emailed-reports.ts   scheduled daily orders report
├── subscribers/         order-placed, order-canceled, order-fulfillment-created, auth-password-reset
└── scripts/             seed.ts, seed-phase5-5.ts, setup-tax.ts, setup-payments.ts
```

**Total custom HTTP route handlers: 50** (21 admin + 27 store + 2 webhooks).

## 4. Storefront structure (`apps/storefront`, 105 files)

Routes (`app/`):
`/` · `/collections/all` · `/collections/[handle]` · `/products/[handle]` · `/brands` · `/brands/[handle]` · `/search` · `/cart` · `/checkout` (+ `/payment`, `/confirmation/[id]`) · `/account` (+ `addresses`, `orders`, `orders/[id]`, `orders/[id]/cancel`, `orders/[id]/invoice`, `orders/[id]/return`, `returns`, `wishlist`, `asks`, `bids`) · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/verify` · `/verify/[serial]` · `/fit-studio` · `/inspection/[serial]` · `/sell` · `/support` · `/about` · `/authenticity` · `/size-guide` · `/policies/[slug]` · `/policies/grievance` · `/[...slug]` (generic CMS) · `/design` (token gallery) · `not-found` · `error`.

Server actions in `app/actions/`: `account`, `auth`, `cart`, `checkout`, `pincode`, `resale`, `returns`, `support`.
Route handlers: `/api/health`, `/api/search`, `/api/cart`.

Data access is centralised in `lib/medusa.ts` (server-only Medusa Store API client, no mock fallback) plus `lib/catalog.ts` (metadata-driven category heuristics), `lib/pincode.ts`, `lib/resale.ts`, `lib/session.ts`, `lib/auth-cookie.ts`, `lib/cart-cookie.ts`.

## 5. Admin structure (`apps/admin`, 108 files)

Route group `app/(dashboard)/` with 19 navigation modules:
Dashboard · Products (+ new, [id]/edit, media, variants, publish controls) · Brands · Categories · Inventory · Orders (+ [id] with bespoke pipeline and action bar) · Customers (+ [id], notes) · Payments · Shipments (+ [id]) · Returns (+ [id]) · Support · Promotions (+ new, [id]) · Content/CMS (+ new, [id]) · Reports (+ CSV exports) · Inspections · Resale orderbook · Fit rules · Settings (staff/invites) · Audit log.

Auth: `app/login` + `lib/session.ts` (httpOnly `thl_admin_token`) + `proxy.ts` (Next 16 proxy convention; redirects to `/login` when the cookie is absent — explicitly documented as UX only, not authorisation).

## 6. Database configuration

- Engine: PostgreSQL 18 (portable binaries via `embedded-postgres`, or Docker `postgres:18-alpine`).
- Connection: `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5437/the_hidden_label`.
- Pool: `DB_POOL_MIN=2`, `DB_POOL_MAX=20` via `databaseDriverOptions.pool` in `medusa-config.ts` (a real, previously measured optimisation recorded in `CURRENT_PROJECT_STATUS.md`).
- Migrations: Medusa core migrations (run by `pnpm db:migrate`) **plus** 8 hand-written migrations in `apps/backend/src/modules/thl/migrations/`:
  `Migration20261114090000`, `…091000`, `…092000`, `…093000`, `…100000`, `Migration20261117100000`, `Migration20261119100000` (COD/payout drop), `Migration20261119110000`.
- Current size: **171 public tables** **[LIVE]**.

## 7. Background jobs, subscribers, webhooks

| Kind | File | Trigger |
|---|---|---|
| Scheduled job | `src/jobs/emailed-reports.ts` | daily orders report email (no-op without `REPORTS_EMAIL` + `RESEND_API_KEY`) |
| Subscriber | `subscribers/order-placed.ts` | confirmation email + WhatsApp |
| Subscriber | `subscribers/order-canceled.ts` | cancellation email |
| Subscriber | `subscribers/order-fulfillment-created.ts` | shipment/dispatch notice |
| Subscriber | `subscribers/auth-password-reset.ts` | reset email with tokenised link |
| Webhook | `api/webhooks/razorpay` | HMAC-verified raw body; logs the event; payment state itself advances through Medusa's canonical `/hooks/payment/razorpay_razorpay` |
| Webhook | `api/webhooks/shiprocket` | static-token auth; updates `shipment` + `shipment_event`; reflects `delivered` into Medusa fulfilment; sends delivery email |

## 8. Existing documentation and audit artefacts (read, not trusted)

- `docs/` — 19 files: PROJECT_PLAN, SCREEN_MAP, DATABASE_PLAN, API_PLAN, ORDER_STATE_MACHINE, INTEGRATIONS, QA_PLAN, BUILD_LOG, HANDOFF, PHASE_5.5_PLAN, OMNICHANNEL_MASTER_ARCHITECTURE, …
- Root — 40 `*.md` reports from earlier rounds, including `FINAL_RELEASE_READINESS.md` and `CURRENT_PROJECT_STATUS.md`, which themselves warn that an earlier round's "100% production ready" claim was independently disproven.
- `.audit/` — 25 committed `.mjs`/`.mts` evidence scripts and `results.json` / `results2.json` JSON outputs from previous rounds.
- `scripts/audit-e2e.mjs` — a large ad-hoc end-to-end script (not part of `pnpm test`).

**This audit treated all of the above as claims to re-verify.** Where a prior report's claim is repeated here, it carries its own `[LIVE]`/`[CODE]` tag; where it could not be reproduced it is recorded as unverified. Two concrete contradictions were found and are recorded in `12_TEST_RESULTS_AND_EVIDENCE.md`: `pnpm lint` is **not** clean (BUILD_LOG claims "100% clean"), and the storefront catalogue is capped at one page.

## 9. Existing audit directory handling

The repository already contains `.audit/` (scripts + results) and 40 root-level audit documents. Per the audit brief, **nothing was overwritten**. This audit writes a new, dated directory: `AUDIT_REPORTS/`.

## 10. Environment observations

- `.env` and `.env.local` files exist locally and are correctly **untracked** (`git ls-files` shows only `.env.example` and `apps/admin/.env.example`).
- `apps/storefront/.env.local` keys: `MEDUSA_URL`, `NEXT_PUBLIC_MEDUSA_URL`, `MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and the four `NEXT_PUBLIC_FEATURE_*` flags.
- `apps/backend/.env` keys: `DATABASE_URL`, `MEDUSA_BACKEND_URL`, `STOREFRONT_ORIGIN`, `ADMIN_ORIGIN`, `MEDUSA_JWT_SECRET`, `MEDUSA_COOKIE_SECRET`, `LOG_LEVEL`, `PORT`, `OTP_DEV_ECHO`, `GEMINI_API_KEY`.
  **Absent:** every `RAZORPAY_*`, `RESEND_API_KEY`, `SHIPROCKET_*`, `OTP_PROVIDER`/`MSG91_*`/`TWILIO_*`, `S3_*`, `SENTRY_DSN`, `BUSINESS_*`, `GRIEVANCE_OFFICER_*`, `REDIS_URL`, `REPORTS_EMAIL`.
- `apps/admin` has **no** local env file; it relies on defaults.
- The working database contains **audit fixture data** left behind by earlier rounds (36 `Audit Brand`/`TestBrand` rows, test products, 43 reserved units). This is documented as BUG-12 and is *not* a clean demo dataset.

<!-- ===== END 01_REPOSITORY_DISCOVERY.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 02_ARCHITECTURE_AUDIT.md ===== -->

# 02 — ARCHITECTURE AUDIT

## 1. Architecture as built

```
Browser
  │  (httpOnly cookies: thl_auth, thl_cart | thl_admin_token)
  ▼
Next.js storefront :3000 (RSC + Server Actions)        Next.js admin :7001 (RSC + Server Actions)
  │  server-side fetch, x-publishable-api-key            │  server-side fetch, Bearer <admin JWT>
  │  Bearer <customer JWT> (never from browser)          │  Authorization re-checked per request
  ▼                                                       ▼
                    Medusa 2.22.7 backend :9000
        /store/*        /admin/*        /webhooks/*        /auth/*
        middleware.ts: authN, RBAC, rate limit, raw-body webhook parser
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Medusa core schema      ThlModule (19 tables)
  (product, cart, order,  (brand, cms, wishlist, otp, returns,
   payment, fulfillment,   shipments, inspections, resale asks/bids,
   inventory, promotion)   fit rules, concierge, support, audit_event)
                    │
                    ▼
             PostgreSQL 18 :5437        Redis :6380 (optional)
```

**Strengths**

- **Clear trust boundary.** The browser never holds a customer or admin JWT; both are httpOnly cookies read only by server components/actions (`apps/storefront/lib/auth-cookie.ts`, `apps/admin/lib/session.ts`). This is the single most important structural decision in the repo and it is implemented consistently.
- **One backend client per app.** `apps/storefront/lib/medusa.ts` and `apps/admin/lib/backend.ts` are the only places that talk to Medusa. Both throw on non-2xx and neither has a mock-data fallback — so a backend outage surfaces as an error state rather than invented products. Verified by reading both files in full.
- **Commerce transitions delegate to Medusa workflows.** `cancelOrderWorkflow`, `capturePaymentWorkflow`, `createOrderFulfillmentWorkflow`, `refundPaymentWorkflow` (`apps/backend/src/api/admin/orders/[id]/actions/route.ts`) rather than hand-written SQL state changes. This preserves Medusa's invariants (reservation release, payment/order consistency).
- **One mapper for courier status.** `lib/shipment-status.ts` is the only writer of shipment state; both the admin route and the webhook call `applyShipmentUpdate`, and the `(shipment_id, event_key)` unique index provides idempotency. This is a genuinely good design decision.
- **One audit writer.** `lib/audit.ts` inserts into an append-only table protected by a database trigger (`audit_event_append_only`, verified present in `pg_trigger`). Money and stock mutations write the audit row in the **same knex transaction**.
- **Universal RBAC.** `adminRbacMiddleware` in `api/middlewares.ts` covers `/admin/*` with `authenticate("user")` + role resolution; individual handlers additionally call `requireRole(req,res,minimum)`. Two independent layers.
- **Money is integer rupees end-to-end** (documented in `docs/DATABASE_PLAN.md §13`), with `moneyFromRupees` at the display edge. `packages/shared/src/money.ts` is unit-tested. This removes the classic ×100 bug class, and prior-round ×100 defects are visibly fixed with comments explaining each.

**Weaknesses**

1. **Two sources of domain truth for "what a product is".** `apps/storefront/lib/catalog.ts` derives categories from product `metadata`, while the mega-menu and `/collections/[handle]` use the real `product_category` tree. The catalogue page's category tabs therefore do **not** match the taxonomy an operator maintains in admin. This is a real consistency defect, not a style preference.
2. **No server-side pagination anywhere in the storefront catalogue.** See BUG-10.
3. **Raw knex alongside the module service.** Many admin routes bypass `ThlModuleService` and query tables directly (`pg("inventory_level")`, `pg("order")`). This is pragmatic and keeps reads fast, but it duplicates schema knowledge in ~20 files and is where the lost-update bug (BUG-05) lives.
4. **Single stock location assumption.** `stock_location.first()` in fulfil (`orders/[id]/actions`) and in return restock (`lib/returns.ts`). Multi-location is not modelled in operations even though the schema supports it.
5. **Business logic in route handlers.** Return eligibility lives properly in `lib/returns.ts`, but order action orchestration, refund lookup and inventory adjustment are inline in route files, making them untestable without an HTTP harness. Only 10 test files exist and none of them exercise a route.
6. **`Date.now()` as an idempotency key** (BUG-04) — a semantic error in an otherwise careful design.
7. **Default-owner role fallback** (BUG-03) — a security-relevant default in the authorisation core.
8. **Dead-ish scaffolding.** `apps/*/app/design/page.tsx` (token galleries) ship in production builds; `apps/backend` still exposes the stock Medusa admin in dev.
9. **No event/outbox discipline for emails.** Subscribers call `sendEmail` inline; with no key configured the call is a logged no-op. Acceptable for dev, but there is no retry/queue, so a Resend outage silently drops an order confirmation.
10. **`.audit/` committed inside the workspace** breaks the lint gate and mixes evidence with application code (BUG-02).

**Circular dependencies:** none found — `packages/shared` and `packages/ui` do not import app code; backend `lib/*` imports only modules and Medusa.

**Unused dependencies:** none obvious. `ioredis` is used by `lib/rate-limit.ts`. `zod` is used by `packages/shared` schemas consumed by storefront actions.

## 2. Validation and error handling

- **Input validation:** Zod schemas in `packages/shared/src/schemas.ts` (`loginSchema`, `registerSchema`, `addressSchema`, `checkoutContactSchema`, `forgotPasswordSchema`, `resetPasswordSchema`) are used by every storefront auth/checkout action. Backend custom routes validate presence/type/enum manually and return `{ type, message }` with 400/401/403/404/422/429.
- **Money and identity are never taken from the request body** at checkout: `beginRazorpayPaymentAction` computes the amount from the fetched cart (`Math.round(cart.total * 100)`) and the Razorpay order id comes from the provider.
- **Error surface:** storefront actions return `ActionResult { ok, message, fields }` and render field-level errors; admin renders a retryable `ErrorState` on `BackendError`.
- **Gap:** backend custom routes do not use Zod schemas; each handler hand-rolls checks. Consistent enough for the current surface, but it is duplicated logic.

## 3. Configuration management

- Backend: `loadEnv()` in `medusa-config.ts`; every integration is gated by an explicit `isConfigured()` check that fails visibly (`MedusaError`, 501, or a logged "not configured" — never a silent mock).
- Storefront/admin: `process.env.*` read at module scope with localhost defaults.
- **Risk:** defaults are production-unsafe by construction — `jwtSecret`/`cookieSecret` fall back to `"local_dev_*"`, `BACKEND_URL` to localhost, `MEDUSA_URL` to localhost. There is no startup assertion that these are set in production. A misconfigured production deploy would boot with the dev JWT secret.

## 4. Transaction handling and data consistency

- Inventory adjust: transaction, **but no row lock** (BUG-05).
- Return actions: transaction covering status, audit and restock — correct.
- Return request creation: transaction covering RMA + items + audit — correct.
- Shipment update: transaction covering shipment + event with `onConflict().ignore()` — correct and idempotent.
- Payment refund: Medusa workflow, but non-idempotent caller key (BUG-04).
- Order cancel (customer): Medusa workflow + audit; ownership enforced by `where({ id, customer_id })`.

## 5. Technical debt register

| # | Debt | Severity |
|---|---|---|
| TD-01 | Two competing category models (metadata heuristics vs `product_category`) | High |
| TD-02 | Catalogue has no pagination model | High |
| TD-03 | Raw SQL duplicated across admin routes; no repository layer | Medium |
| TD-04 | Business logic in route handlers → low testability | Medium |
| TD-05 | Single-location assumption hardcoded in 3 places | Medium |
| TD-06 | No production config assertions (dev secrets fallback) | High |
| TD-07 | Email/WhatsApp sends are inline and non-retrying | Medium |
| TD-08 | `.audit/` inside the workspace breaks lint/CI | High (blocking) |
| TD-09 | Design-token gallery pages shipped in both apps | Low |
| TD-10 | 40 stale root-level audit reports with contradictory claims, no archive marker | Low (process) |

<!-- ===== END 02_ARCHITECTURE_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 03_STOREFRONT_AUDIT.md ===== -->

# 03 — STOREFRONT AUDIT

**Method:** route inventory from the filesystem (105 files), then live HTTP requests against the running storefront on `:3000` and backend on `:9000`. No browser session was driven; button-level interaction claims from earlier reports are therefore not repeated as facts. Every row states its own evidence level.

## 1. Route-level result

**[LIVE]** Combined route probes:

| Route | Result |
|---|---|
| `/` | `200` |
| `/collections/all` | `200` |
| `/products/air-jordan-1-retro-high-og-chicago` | `200` |
| `/products/does-not-exist` | `404` (honest) |
| `/brands` | `200` |
| `/brands/{nike,jordan,adidas,new-balance,salomon,asics}` | `200`, `200`, `200`, `200`, `200`, `200` |
| `/search` | `200` |
| `/cart` (no cart cookie) | `200` with empty state |
| `/checkout` (no cart) | `307` → `/cart` (correct guard) |
| `/login`, `/register` | `200` |
| `/about`, `/authenticity`, `/fit-studio`, `/sell` | `200` |
| `/policies/privacy` | `200` (CMS-backed) |

## 2. Homepage (`apps/storefront/app/page.tsx`)

Present: hero with badge, headline, three CTAs, a "Quick Shop by Size" bar, an 8-product grid from live Medusa data, a brand pavilion, and a four-card "Physical Inspection Programme" explainer.

| Item | Status | Evidence / note |
|---|---|---|
| Hero + CTAs | Working | **[LIVE]** page renders; links to `/collections/all`, `/sell`, `/fit-studio` |
| Product grid from real data | Working | `fetchProducts({limit: 8})`, `force-dynamic` |
| Price honesty | Good | missing price renders "Price unavailable", not a fabricated figure |
| Empty / error states | Good | explicit `ErrorState` with backend URL; "No products are published yet." |
| **Brand pavilion** | **Hardcoded defect** | literal `BRANDS` array with invented silhouette counts ("Nike · 18 Silhouettes") — **BUG-06** |
| **"In Stock →" label** | **Unsupported claim** | rendered for every card regardless of stock — **BUG-07** |
| Promotional banners from CMS | Not wired | `/store/content/home` exists and returns real banner rows, but the homepage does not consume it |
| Editorial / brand sections | Absent | no editorial module on `/` |
| Mobile responsiveness | **[CODE]** Tailwind responsive classes present throughout; not visually verified |
| Footer | Working | site-wide, includes GSTIN/CIN placeholders, grievance officer, policies |

## 3. Catalogue and search

`/collections/all` = server page + `catalog-client.tsx` (client-side filtering over `initialProducts`).

| Capability | Status | Evidence |
|---|---|---|
| Category tabs with counts | Working (client-side) | `CATEGORIES` from `lib/catalog.ts`; counts computed from loaded page |
| Brand filter | Working (client-side) | options derived only from products present |
| Price buckets | Working (client-side) | `PRICE_BUCKETS`, null prices sorted last |
| Size filter (apparel/shoe/other) | Working (client-side) | includes `?size=` deep link from the homepage |
| Sort (featured / price asc / desc) | Working | "featured" is a no-op comparator (returns 0) |
| Availability filter | **Missing** | no in-stock/out-of-stock facet |
| Pagination / infinite scroll | **Missing** | `fetchProducts` defaults to `limit: 24` — **BUG-10** |
| Empty state | Good | "Nothing in this edit yet" + reset + brands link |
| Invalid filter values | Tolerated | unknown `size`/`category` normalise to empty filter rather than erroring |
| Search (`/search`, overlay, `/api/search`) | Working | **[LIVE]** `GET /store/search/suggest?q=air` returned real products |
| SKU search | Documented as included | backend `suggest` route queries title/handle/SKU **[CODE]** |
| Search relevance | Not tuned | simple `ilike`-style matching; no ranking, no synonyms, no fuzzy |
| Zero-result state | Present in overlay | **[CODE]** |

**Consistency defect:** the catalogue's category tabs come from metadata heuristics, whereas `/collections/[handle]` and the mega-menu use the real `product_category` tree. The same product can therefore appear under different category names depending on entry point.

## 4. Product detail page (`app/products/[handle]/page.tsx`)

| Element | Status |
|---|---|
| Title, brand (from `metadata.brand`), description | Working |
| Price | Working (`calculated_price` via region context; honest fallback) |
| Discount display | **Missing** — no compare-at / strike-through pricing |
| GST treatment | Displayed as "inclusive of all taxes"; the actual split appears only on the invoice page |
| Variant/size selector | Working — `ProductBuyPanel` + `AddToBag`, disabled when unavailable |
| Colour selection | **Not implemented** — variants are size-only in seed and UI |
| Stock availability | Partial — `isVariantAvailable` returns `true` when the store API hides stock (by design), so "sold out" only shows when a count is actually exposed |
| Real-time stock | Implemented via `POST /store/catalog/stock`; **[LIVE]** returns `{stock:{}}` for an empty id list (route works) |
| **Image gallery** | **Missing** — only `product.thumbnail` is rendered, no `images.map` |
| Size guide | Separate `/size-guide` page + Fit Studio widget; not inline per-product |
| Delivery information | Present as static copy ("Dispatched in 2–4 working days") |
| Return information | Present as static copy referencing the 7-day window |
| Wishlist | Working for signed-in customers (`WishlistButton`), sign-in CTA otherwise |
| Add to bag | Working path `addToCart` → Medusa line item |
| Related products | **Missing** |
| Reviews | **Missing entirely** (no model, route or UI) |
| Price index / bids | Implemented (`PriceIndexCard`) from real `resale_ask`/`resale_bid` data |
| 360° inspection | Implemented and conditional on a real `condition_inspection` record |
| SEO metadata | Partial — `generateMetadata` returns only `title`; no description, canonical or OpenGraph |
| Legal Metrology declarations | Present: country of origin, net quantity, MRP, HSN, marketed-by, consumer care |
| Breadcrumb | Present |

Marketing copy on the PDP is honest post-D2: no "100% authentic" badge, explicit "no RFID / no certificate programme" text in the seeded authenticity page.

## 5. Customer account

| Area | Status |
|---|---|
| Registration | Working **[CODE]** — 3-step Medusa flow + DPDP consent checkbox enforced server-side |
| Login / logout | Working; generic failure message avoids account enumeration |
| Email verification (OTP) | Code complete; delivery **BLOCKED** (no Resend key, no OTP provider) |
| Password recovery | Implemented (`reset-password` + `subscriber/auth-password-reset.ts`); email **BLOCKED** |
| Profile edit | Present (`profile-form.tsx`) |
| Saved addresses | Present (`/account/addresses`, create/list) |
| Order history | Present; ownership filtered server-side by customer id |
| Order detail | Present — items, statuses, tracking, bespoke stage, cancel/return/invoice links; ownership mismatch renders `404`, not `403` |
| Order cancellation | Present (pre-dispatch only) |
| GST invoice | Present (`/orders/[id]/invoice`), CGST+SGST vs IGST by state |
| Wishlist | Present |
| Asks / bids | Present (`/account/asks`, `/account/bids`) |
| Returns | Present (`/account/returns`, request form) |
| Data export / account deletion | Present (`download-my-data-button.tsx`, `delete-account` route) |
| Account security (2FA, session list, device history) | **Missing** |

## 6. Cart (`/cart`, `actions/cart.ts`)

| Capability | Status | Note |
|---|---|---|
| Add product | Working | cart id in httpOnly cookie |
| Remove / update quantity | Working | server actions; `quantity<=0` removes |
| Variant validation | Delegated to Medusa | invalid variant id surfaces Medusa's message verbatim |
| **Stock validation at add** | **Absent by design** | Medusa does not check stock on add; enforcement is at cart completion. Recorded as expected behaviour, not a bug |
| Price recalculation | Server-side | line totals from Medusa |
| Discount calculation | Delegated | `discount_total` + promotions list |
| GST calculation | Delegated | `tax_total` from Medusa tax engine (seeded 18% default) |
| Shipping calculation | At checkout | cart shows "Calculated at checkout" |
| Persistence after refresh | Yes | cookie-backed cart id |
| Multi-tab consistency | Partial | same cart id shared, but no live sync between tabs |
| Merge guest cart on login | Yes | `attachCustomerToCart` in add-to-cart and checkout address steps |
| Cart drawer | Present | `cart-drawer.tsx` |

## 7. Checkout (`/checkout`, `actions/checkout.ts`)

Three steps: address → shipping → payment. **[LIVE]** `/checkout` correctly `307`s to `/cart` when empty.

**Address step:** Zod-validated (name, phone, address, city, state, PIN), with a **real pincode serviceability gate** — an invalid PIN blocks checkout; an unreachable directory fails open (documented ADR-02). Address type (home/work) and landmark are captured.

**Shipping step:** real Medusa shipping options. **[LIVE]** DB shows exactly two: `Standard delivery` (flat ₹0) and `Express delivery` (flat ₹199). Two fulfilment modes: `home_delivery` and free `store_pickup` at the Sindhu Bhavan Road boutique; the mode is stored in cart metadata.

**Payment step — blocked.**
- `beginRazorpayPaymentAction` requires `NEXT_PUBLIC_RAZORPAY_KEY_ID`; it is **unset** in this environment, so it returns "Online payment is not configured on this environment."
- The backend has **zero** rows in `region_payment_provider` **[LIVE]**, and `listRegionPaymentProviders` feeds that empty list to the payment form.
- COD is intentionally removed (verified: no COD branch in checkout, `setup-payments.ts` deletes `pp_system_default`).
⇒ **A guest or signed-in customer cannot pay and therefore cannot create an order in this environment.** This is the single most important storefront finding (BUG-01).

**Duplicate submission protection:** order creation happens inside Medusa's complete-cart workflow; there is no separate custom order-creation endpoint that could double-fire. The UI does not, however, disable the pay button across a retry after a network failure. **[CODE]**

**Guest checkout:** supported (email captured at the address step). **[CODE]**

**Confirmation page:** `/checkout/confirmation/[id]` 404s if the order id does not resolve — no fake success. **[CODE]**

## 8. Other storefront surfaces

- `/sell` (consignor hub): ask creation with a live 9.5% fee/payout estimate, links into `/account/asks`. Backend ask/bid routes are auth-guarded **[LIVE]** (401 without a token).
- `/fit-studio`: silhouette fit rules from `silhouette_fit_rule`.
- `/inspection/[serial]` and `/verify/[serial]`: public certificate view driven by `condition_inspection`.
- `/support`: contact form creating a support ticket; deep link from an order pre-fills the reference.
- `/policies/*`, `/about`, `/authenticity`, `/size-guide`, `/[...slug]`: CMS-driven markdown renderer with multi-segment slug support.
- `/design`: internal design-token gallery — shipped to production, should not be public.

## 9. Broken or misleading interactions — consolidated

1. **Checkout cannot complete** (no payment provider) — BUG-01, P0.
2. Homepage brand counts are invented and not editable — BUG-06.
3. Homepage asserts "In Stock" for every product — BUG-07.
4. Catalogue filtering only sees the first page of products — BUG-10.
5. Catalogue categories disagree with the real taxonomy — TD-01.
6. PDP has no image gallery and no related products, so the "Quick View enabled" label and the visual merchandising of a premium boutique are underrepresented.
7. No reviews anywhere.

## 10. Not verified (explicit)

- Visual correctness at any breakpoint — no browser screenshot or interaction was performed in this audit.
- Client-side filter behaviour — read, not clicked.
- Form submissions to real endpoints (register, login, add-to-cart, checkout) — not executed, to avoid mutating the shared development database with new customers/carts.
- Hydration/console cleanliness — not observed.

<!-- ===== END 03_STOREFRONT_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 04_BACKEND_API_AUDIT.md ===== -->

# 04 — BACKEND & API AUDIT

**Surface:** 50 custom route handlers (21 `/admin/*`, 27 `/store/*`, 2 `/webhooks/*`) mounted by the single registry `apps/backend/src/api/middlewares.ts`. Medusa's own core routes (`/store/products`, `/store/carts`, `/store/orders`, `/auth/*`, `/admin/users`, `/admin/products`, …) also exist and are used heavily by both frontends.

## 1. Cross-cutting middleware (read in full)

```ts
// apps/backend/src/api/middlewares.ts
{ matcher: "/auth/customer/emailpass",        methods:["POST"], middlewares:[authRateLimitMiddleware] }
{ matcher: "/auth/user/emailpass",            methods:["POST"], middlewares:[authRateLimitMiddleware] }
{ matcher: "/auth/customer/emailpass/register",methods:["POST"], middlewares:[customerRegistrationMiddleware] }
{ matcher: "/store/wishlist*",      middlewares:[authenticate("customer",["bearer","session"])] }
{ matcher: "/store/returns*",       middlewares:[authenticate("customer",…)] }
{ matcher: "/store/customers/me*",  middlewares:[authenticate("customer",…)] }
{ matcher: "/store/orders/*/cancel",middlewares:[authenticate("customer",…)] }
{ matcher: "/store/resale/bids*" | "/store/resale/asks*" | "/store/fit/profile*", authenticate }
{ matcher: "/webhooks/razorpay", methods:["POST"], bodyParser:{preserveRawBody:true} }
{ matcher: "/admin/promotions*", methods:["POST","PUT"], [authenticate("user"), adminPromotionBodyMiddleware] }
{ matcher: "/admin/returns/*",   methods:["POST"], [authenticate("user"), adminReturnsMiddleware] }
{ matcher: "/admin/*",           [authenticate("user"), adminRbacMiddleware] }
```

`adminRbacMiddleware` (`lib/admin-auth.ts` + middleware):
- Resolves the actor from `req.auth_context.actor_id`, loads `user.metadata.role`.
- `/admin/users/me` is read-only for any admin; non-GET requests carrying `role|roles|permissions|is_owner|owner|is_admin` are rejected with 403 (this closes the previously-found self-escalation).
- Staff/invite paths require `manager` or `owner`; changing a role requires `owner` and forbids self-escalation.
- `readonly` is denied on every other `/admin/*` resource; all non-GET requires `canWrite(role)`.

**Finding SEC-01:** `resolveAdmin` returns `role = metadata.role ?? "owner"`. A staff user with no role metadata is treated as owner by the backend, and `fetchCurrentAdmin` mirrors the same fallback in the admin UI.

## 2. Customer / store endpoints

| # | Method + route | Auth | Validation | DB / side effects | Verified |
|---|---|---|---|---|---|
|1|`GET /store/brands`|public|—|`brand` table|**[LIVE]** real JSON|
|2|`GET /store/brands/:handle`|public|handle param|brand + linked product ids|**[LIVE]** page 200 via PDP/brand page|
|3|`POST /store/catalog/stock`|public|`variant_ids[]`|aggregates `inventory_level` minus reservations|**[LIVE]** `{stock:{}}` for empty input|
|4|`GET /store/categories`|public|—|`product_category` tree + counts|**[LIVE]** real tree|
|5|`GET /store/cms/policies/:slug`|public|slug|`cms_page`|**[CODE]** `/policies/privacy` 200|
|6|`GET /store/cms/:slug`|public|one encoded segment|`cms_page`|**[CODE]**|
|7|`POST /store/concierge/chat`|public|non-empty message|thread + messages, Gemini or template|**[CODE]** — thread not owner-scoped (BUG-09)|
|8|`GET /store/content/home`|public|—|`banner_slot` scheduled by DB clock|**[LIVE]**|
|9|`POST /store/customers/me/delete-account`|customer|token|anonymises/deletes customer|**[CODE]**|
|10|`GET/POST /store/fit/profile`|customer|measurements|`customer_fit_profile`|**[CODE]**|
|11|`POST /store/fit/recommend`|public|measurements|rule lookup|**[CODE]**|
|12|`GET /store/inspections/:unit_serial`|public|serial|`condition_inspection`|**[CODE]**|
|13|`POST /store/orders/:id/cancel`|customer|owner + pre-dispatch|`cancelOrderWorkflow` + audit|**[CODE]**|
|14|`GET /store/orders/:id/shipment`|customer|owner check|`shipment` + `shipment_event`|**[CODE]**|
|15|`POST /store/otp/send`|public|channel, destination, 3/15min|`otp_challenge`, email/SMS|**[CODE]** — 501 when unconfigured|
|16|`POST /store/otp/verify`|public|6 digits, 5 attempts, TTL|consumes challenge|**[CODE]**|
|17|`GET/POST /store/resale/asks`|customer|variant, price|`resale_ask`|**[LIVE]** 401 unauth|
|18|`DELETE /store/resale/asks/:id`|customer|ownership|delist|**[CODE]**|
|19|`GET/POST /store/resale/bids`|customer|variant, price|`resale_bid`|**[LIVE]** 401 unauth|
|20|`DELETE /store/resale/bids/:id`|customer|ownership|cancel bid|**[CODE]**|
|21|`GET /store/resale/products/:handle/index`|public|handle|price history + asks/bids|**[CODE]**|
|22|`GET /store/resale/recent-activity`|public|—|recent order lines|**[LIVE]**|
|23|`GET/POST /store/return-requests`|customer|eligibility, qty ≤ purchased|`return_request`, items, audit, email|**[CODE]**|
|24|`GET /store/search/suggest`|public|q ≥ 2 chars|products + brands|**[LIVE]**|
|25|`POST /store/sight-search`|public|image url/keywords|Gemini or keyword fallback|**[CODE]**|
|26|`POST /store/support/tickets`|public|customer or guest fields|`support_ticket`|**[CODE]**|
|27|`GET/POST/DELETE /store/wishlist`|customer|variant_id|`wishlist_item`|**[LIVE]** 401 unauth|

Medusa core store routes used by the storefront (not custom): `/store/products`, `/store/product-categories` (via custom route), `/store/carts*`, `/store/shipping-options`, `/store/payment-providers`, `/store/orders`, `/store/customers/me*`, `/auth/customer/emailpass*`.

**Ownership:** every customer-scoped route filters by `actorId(req)` / `customer_id`. Claims of IDOR in earlier reports were not reproduced; the code paths read (`cancel`, `shipment`, `return-requests`, `wishlist`) all scope by customer. `GET /store/customers/me` returns **400** rather than 401 when no bearer header is present (BUG-11).

**Rate limits:** only authentication (`/auth/customer/emailpass`, `/auth/user/emailpass`) and OTP send are rate limited. **No rate limit** on `POST /store/support/tickets`, `POST /store/sight-search`, `POST /store/concierge/chat`, `POST /store/resale/bids|asks`, or any `/store/carts` mutation. Medusa core may apply its own limits on some routes, but none is configured in this repo.

## 3. Admin endpoints

All under `authenticate("user")` + `adminRbacMiddleware`, each handler additionally calling `requireRole`.

| Method + route | Minimum role | Operations | Verified |
|---|---|---|---|
|`GET /admin/audit`|support|append-only audit query with filters|**[CODE]**|
|`GET/POST /admin/brands`, `/[id]`|support / operations|brand CRUD + audit|**[CODE]**|
|`GET/POST/PUT /admin/cms`, `/[id]`|support / operations|CMS pages, publish|**[CODE]**|
|`GET /admin/dashboard/summary`|support|orders by status, captured/refunded sums, low-stock count, open returns, pending shipments, recent orders|**[CODE]**|
|`GET/POST /admin/fit-rules`, `/[id]`|support / operations|silhouette rules|**[CODE]**|
|`GET /admin/inspections`, `/inspections/[id]`|support|inspection queue, verdict + audit|**[CODE]**|
|`GET/POST /admin/inventory`|support / operations|levels, low-stock filter, adjustment with reason code|**[CODE]** — lost update (BUG-05)|
|`POST /admin/orders/:id/actions`|operations|capture / fulfil / cancel / refund via Medusa workflows + audit|**[CODE]** — refund key not idempotent (BUG-04)|
|`GET /admin/resale/asks`, `/bids`|support|orderbook|**[CODE]**|
|`GET/POST /admin/returns`, `/returns/[id]`, `/return-requests/[id]`|support / operations|queue, approve/reject/receive/refund, condition grading, restock|**[CODE]**|
|`GET/POST /admin/shipments`, `/[id]`|operations|manual shipment create/update, idempotent events|**[CODE]**|
|`GET/POST /admin/support/tickets`, `/[id]`|support|ticket inbox, status|**[CODE]**|

**Admin auth probe [LIVE]:** `GET /admin/orders` without a token → **401**. `GET /admin/inventory`, `/admin/returns`, `/admin/brands` behave identically by the same middleware.

**Missing admin APIs** (no route exists): suppliers, purchase orders, goods-received notes, credit notes, consignor settlements, product reviews moderation, customer segments, multi-location transfers, refund reconciliation, stock ageing, date-ranged analytics.

## 4. Webhooks

**`POST /webhooks/razorpay`** — reads `RAZORPAY_WEBHOOK_SECRET`; 503 when unset; validates HMAC-SHA256 over `req.rawBody` with `crypto.timingSafeEqual`; 401 on mismatch; logs the verified event. **It does not itself mutate payment/order state** — that is delegated to Medusa's canonical `/hooks/payment/razorpay_razorpay`. **[LIVE]** unsigned request → **503** (environment unconfigured), so the signature path could not be exercised.

**`POST /webhooks/shiprocket`** — shared-token auth (`?token=` or `x-webhook-token`), maps status through `mapProviderStatus`, applies idempotent `applyShipmentUpdate`, reflects `delivered` into `fulfillment.delivered_at`, sends the delivery email, 200s unknown AWBs to stop retries. **[CODE]**, credentials absent.

**Idempotency review:**
- Shipment events: **safe** — `(shipment_id, event_key)` unique + `onConflict().ignore()` + `deduped` flag returned.
- Razorpay: webhook replay safety ultimately depends on Medusa's payment module handling of `session_id`; the custom endpoint is a verified logger, not a state writer. Cannot be verified end-to-end without keys.
- Refunds: **not safe** — `Date.now()` in the idempotency key (BUG-04).
- RMA creation: **collision-prone** display id (BUG-08).
- Cart completion: Medusa workflow; no custom duplicate-order endpoint exists.

## 5. Error handling and response shape

Custom routes return `{ type, message, ...payload }` with:
400 invalid_data · 401 unauthorized · 403 forbidden · 404 not_found · 422 invalid_state/not_eligible/action_failed · 429 rate_limited · 501 not_configured · 503 not_configured.
Personalised responses set `Cache-Control: private, no-store` (verified for wishlist, returns, shipment, dashboard, inventory, returns queue). This is consistent and correct.

## 6. Endpoint-level findings

| Finding | Severity |
|---|---|
| No payment provider linked ⇒ checkout APIs unusable | **Critical** |
| Default-owner role fallback | **High** |
| Refund idempotency key uses `Date.now()` | **High** |
| Inventory adjust without row lock | **Medium** |
| Concierge thread not owner-scoped | **Medium** |
| No rate limits on write-heavy public store routes | **Medium** |
| RMA display id from a count | **Low** |
| `customers/me` returns 400 not 401 | **Low** |
| Shiprocket webhook uses a static query-string token rather than HMAC | **Medium** |
| No Zod validation in backend route handlers (hand-rolled) | **Low** |

<!-- ===== END 04_BACKEND_API_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 05_DATABASE_AND_INVENTORY_AUDIT.md ===== -->

# 05 — DATABASE AND INVENTORY AUDIT

All schema facts below come from live queries against `the_hidden_label` on `127.0.0.1:5437` (read-only `SELECT`s) plus reading the 19 DML models and 8 migrations in `apps/backend/src/modules/thl/`.

## 1. Measured state **[LIVE]**

```
public tables                                    171
product (not deleted)                             18
product_variant (not deleted)                     60
  ├─ manage_inventory = true                      60
  └─ allow_backorder  = true                       0
inventory_level rows                              59
  ├─ stocked_quantity (sum)                      170
  └─ reserved_quantity (sum)                      43
"order" (not deleted)                             55   (54 pending, 1 canceled)
payment                                           55   (9 captured, 1 canceled)
return_request (not deleted)                      28   (21 requested, 7 approved)
shipment                                           8   (6 with AWB)
audit_event                                      256
brand                                             ~38 incl. audit fixtures
```

Append-only enforcement: `pg_trigger` on `audit_event` contains **`audit_event_append_only`**.

Relevant unique indexes verified in `pg_indexes`:
`shipment_event_key_unique` (shipment_id, event_key) · `shipment_provider_shipment_id_unique` · `return_request_display_id_unique` · `otp_challenge_pkey` + `otp_destination_idx` · `resale_ask_*` / `resale_bid_*` variant & seller/buyer indexes.

## 2. Data ownership map

| Cluster | Owner | Tables |
|---|---|---|
| Catalogue & merchandising | Medusa core | `product`, `product_variant`, `product_option`, `product_category`, `product_collection`, `price`, `price_set`, `sales_channel` |
| Inventory | Medusa core | `inventory_item`, `inventory_level`, `reservation_item`, `stock_location`, `product_variant_inventory_item` |
| Cart & checkout | Medusa core | `cart`, `line_item`, `shipping_method`, `shipping_option`, `payment_collection`, `payment_session`, `payment`, `refund` |
| Orders & fulfilment | Medusa core | `order`, `order_item`, `order_line_item`, `order_fulfillment`, `fulfillment`, `order_payment_collection` |
| People & auth | Medusa core | `customer`, `customer_address`, `user` (staff), `provider_identity`, `auth_identity` |
| Promotions & tax | Medusa core | `promotion`, `promotion_rule`, `campaign`, `tax_region`, `tax_rate` |
| Project commerce | **ThlModule** | `brand`, `product_brand`, `banner_slot`, `cms_page` |
| Resale / authentication | **ThlModule** | `resale_ask`, `resale_bid`, `price_history_point`, `condition_inspection`, `customer_fit_profile`, `silhouette_fit_rule`, `concierge_thread`, `concierge_message` |
| Service / ops | **ThlModule** | `wishlist_item`, `otp_challenge`, `return_request`, `return_request_item`, `shipment`, `shipment_event`, `support_ticket`, `audit_event` |

Nothing in the project owns customer, order or payment money records directly — those stay Medusa's. This is the right boundary: a custom module cannot corrupt Medusa's order state machine.

## 3. Model review (project tables)

| Table | Purpose | Key fields | Constraints / indexes | Gaps |
|---|---|---|---|---|
|`brand`|Multi-brand boutiques|handle, name, tagline, logo/hero, country, tier, sort_order|unique handle (model), sort index|not sales-channel scoped; 36 audit-fixture rows present|
|`product_brand`|product↔brand link|product_id, brand_id|join table|no FK to Medusa `product` enforced at DB level|
|`banner_slot`|Homepage/CMS banners|placement, image, headline, subhead, CTA, schedule|placement index|storefront homepage does not consume it yet|
|`cms_page`|Policies / editorial|slug, kind, title, body_md, blocks(jsonb), seo_*, published_at|unique slug|no draft/published versioning beyond `is_published`|
|`wishlist_item`|Saved variants|customer_id, variant_id|per-customer query index|no unique (customer,variant) constraint — duplicate prevented in app code only|
|`otp_challenge`|Email/SMS OTP|destination, purpose, code_hash, expires_at, attempts, max_attempts, consumed_at, ip|destination index|no unique active-challenge constraint; app enforces 3 sends/15 min|
|`return_request`|RMA header|display_id, order_id, customer_id, status, reason_code, resolution, refund_amount, approved_at, received_at, condition, restocked_at, awb, courier|**unique display_id**, status index|display id comes from a row count (race); no credit-note link|
|`return_request_item`|RMA lines|return_request_id, order_item_id, quantity|request index|no per-line condition (condition is header-level)|
|`shipment`|Outbound/inbound parcel|order_id, provider, provider_shipment_id, awb, courier, status, label_url, last_synced_at, shipped_at, delivered_at|unique provider_shipment_id, awb idx, status idx|single shipment per order assumed by some UI|
|`shipment_event`|Courier scan log|shipment_id, event_key, status, occurred_at, payload|**unique (shipment_id,event_key)**|payload stores raw provider body — ensure no PII beyond name/address|
|`condition_inspection`|Per-unit authentication|unit_serial, grade, checklist, frames, verdict, inspector|unique unit serial (model)|not linked to a consignment intake/ask|
|`resale_ask` / `resale_bid`|Orderbook|variant_id, seller/buyer, price, status|variant + party indexes|no settlement record; no escrow; no matching/bid-acceptance order creation|
|`price_history_point`|Price index|variant_id, price, captured_at|variant index|seeded demo points (234)|
|`customer_fit_profile`|Foot sizing|measurements, silhouette|per customer|no body-measurement profile or revision history|
|`silhouette_fit_rule`|Fit deltas|silhouette, deltas, guidance|silhouette unique|—|
|`concierge_thread` / `concierge_message`|AI chat|thread, sender, content, recommended ids|customer/session|thread not owner-scoped on write (BUG-09)|
|`support_ticket`|Customer support|subject, body, status, order ref, customer/guest|status index|no SLA fields, no assignment, no category enum|
|`audit_event`|Append-only trail|actor_type, actor_id, action, entity_type/id, summary, changes(jsonb), ip, ua|**append-only trigger**|no retention policy; grows unbounded|

## 4. Migration history

`pnpm db:migrate` runs Medusa's core migrations; the project adds 8 migrations in a documented order:
`20261114090000` (brand/cms/banner/wishlist) → `…091000` (cms blocks) → `…092000` (OTP) → `…093000` (returns/shipments) → `…100000` (resale/inspection/fit/concierge) → `20261117100000` → `20261119100000` (drops COD verification and payout-details tables) → `20261119110000`.
The CI workflow proves the schema builds **from an empty database** (migrations job asserts ≥50 tables). **[CODE — workflow read, not executed here]**

## 5. The ten inventory-consistency questions

| # | Requirement | Result | Reasoning / evidence |
|---|---|---|---|
|1|Stock cannot go negative through concurrent transactions|**LIKELY SAFE (unverified)**|All 60 variants `manage_inventory=true`, `allow_backorder=false`; reservations are Medusa's own (`reservation_item`), which locks inventory at cart completion. No custom code decrements stock outside Medusa workflows. Not exercised.|
|2|Final available inventory reserved atomically|**YES (framework)**|Medusa complete-cart workflow reserves inventory. Custom code never reserves manually.|
|3|Duplicate checkout cannot create duplicate orders|**PARTIAL**|Order creation is exclusively Medusa's complete-cart workflow; there is no custom order-create endpoint. But there is no explicit idempotency guard on the storefront's `confirmRazorpayPaymentAction` — a double-click issues a second `completeCart` call, which Medusa should reject because the cart is already completed. Not tested.|
|4|Payment webhooks cannot process a transaction twice|**PARTIAL / UNVERIFIED**|Shipment webhooks are provably idempotent (unique event key). Razorpay's custom endpoint only logs; state advancement is Medusa's `/hooks/payment/razorpay_razorpay`, whose replay safety could not be exercised without keys.|
|5|Failed payments release/expire reservations correctly|**EXPECTED (framework)** — unverified|No custom reservation release code; relies on Medusa cart expiry/reservation expiry. Not tested.|
|6|Cancelled orders restore inventory correctly|**YES via workflow** — unverified|`cancelOrderWorkflow` used by both admin and customer cancel. No custom stock maths.|
|7|Returned products are not sellable before inspection|**YES — correctly implemented**|`lib/returns.ts`: restock happens **only** on `action="receive"` **and** `condition="resellable"`; `damaged`/`disposed` never touch `inventory_level`. This is the single best-designed inventory rule in the project.|
|8|Inventory movements are traceable|**PARTIAL**|Every admin adjustment writes `audit_event` with before/after/reason in the same transaction; return restock writes `inventory.adjusted` with `reason: return_restock`. But `stock_movement` is not a first-class table — traceability is via the audit log, not a stock ledger. Supplier receipts and transfers therefore have no ledger entry.|
|9|Order and payment records remain consistent|**PARTIAL**|Live data shows 55 orders (54 `pending`, 1 `canceled`) with 55 payments of which only 9 captured. That is consistent with unpaid/abandoned carts being completed as `pending` orders, but it also means the business has **no completed paid order** in this environment to prove the happy path.|
|10|Concurrency tests against production data|**NOT PERFORMED**|Explicitly out of scope; the only concurrency evidence available is the prior round's note that cart *add* never checks stock (expected).|

**Additional inventory findings**

- **Lost update on adjustment** (BUG-05): `GET level → compute next → UPDATE` with no `FOR UPDATE`. Two simultaneous adjustments of +1 and −1 on the same level can leave the wrong value.
- **Single-location assumptions:** `stock_location.first()` in order fulfilment and return restock. If a second location is ever added, returns may be restocked at an arbitrary location.
- **No stock ledger:** without a `stock_movement`/`inventory_transaction` table, stock ageing, supplier receipts, transfers and shrinkage analysis are not possible.
- **43 reserved units** exist with no paid orders behind most of them — abandon-cart reservations that have not expired in this dev database.
- **`return_request` refund_amount is a numeric string** (`toFixed(2)`), while the rest of the project stores integer rupees. It is internally consistent on the RMA side but is a second money representation.

## 6. Data-quality issues in the working database

- 36 brand rows are audit fixtures (`Audit Brand`, `TestBrand`) and appear in the public `/store/brands` response **[LIVE]** — they would render on the brand directory.
- Test products created by the admin audit workflow remain.
- 54 `pending` orders inflate dashboard revenue-at-risk and order counts.
- No seed reset/teardown script exists in `package.json` for clearing fixtures (only `db:seed`, which is idempotent).

## 7. Verdict for this area

**Schema and ownership design: READY.** The project adds tables only where Medusa has no equivalent, keeps money and order state in the framework, and enforces the most safety-critical rule (no restock of damaged returns) correctly.
**Inventory operations: NOT READY for a real warehouse** — no stock ledger, no multi-location operations, no supplier receipts, one known lost-update defect.

<!-- ===== END 05_DATABASE_AND_INVENTORY_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 06_ADMIN_AND_OPERATIONS_AUDIT.md ===== -->

# 06 — ADMIN PANEL AND INTERNAL OPERATIONS AUDIT

**Critical verification limitation:** the admin app was **not running** on `:7001` and **no admin credentials** exist in this environment. Every admin screen/action below is therefore classified from source code and API behaviour, not from a clicked-through session. Where an action could be probed through the backend without a token, that probe is recorded.

**[LIVE] authorisation probes**
- `GET :9000/admin/orders` → `401`
- By the same middleware, `/admin/inventory`, `/admin/returns`, `/admin/brands`, `/admin/customers` are equally unreachable without a staff token.

## 1. Module status matrix

| Module | Screens | Backend | Status | Notes |
|---|---|---|---|---|
| Dashboard | `/` | `GET /admin/dashboard/summary` | **Implemented, untested (UI)** | Real KPIs: orders by status, revenue captured, revenue refunded, low-stock count (available ≤ 3), open returns, pending shipments, recent orders |
| Products | `/products`, `/new`, `/[id]`, media, variants, publish | Medusa core `/admin/products` | **Implemented, untested (UI)** | Create with sizes → variants; edit title/description/thumbnail; per-variant price edit; publish/draft; **bulk** publish/draft/delete; real image upload through Medusa's file module |
| Brands | `/brands` | `/admin/brands` | Implemented, untested | Full CRUD, audit row per mutation |
| Categories | `/categories` | Medusa core | Implemented, untested | Tree editing |
| Inventory | `/inventory` | `/admin/inventory` | Implemented — **defect** | Levels, low-stock filter, adjustment with mandatory reason (`count_correction, stock_count, damaged, lost, return_restock, sample, transfer`), audit in-transaction. **Lost-update race (BUG-05)** |
| Orders | `/orders`, `/[id]` | `/admin/orders/:id/actions` | Implemented, untested | Capture, fulfil (all pending quantities, first stock location), cancel with reason, refund with reason + amount; audit each. **Refund key not idempotent (BUG-04)** |
| Bespoke pipeline | `/orders/[id]` | metadata on order | Implemented, untested | 5-stage stage machine, measurement table (chest/waist/shoulder/sleeve/inseam), fit preference, tailor notes |
| Payments & refunds | `/payments` | Medusa core | Implemented, untested | Payment list, refund reasons taxonomy (`lib/refund-reasons.ts`) |
| Shipments | `/shipments`, `/[id]` | `/admin/shipments` | Implemented, untested | Manual creation and status updates; idempotent event log; shared mapper with the webhook |
| Returns | `/returns`, `/[id]` | `/admin/returns`, `/[id]` | Implemented, untested | Approve / reject / receive with condition / refund; eligibility re-computed at approval; reverse pickup attempt; **restock only when `resellable`** |
| Customers | `/customers`, `/[id]` | Medusa core + notes | Implemented, untested | Profile, order history, internal notes, risk/blacklist flag |
| Support | `/support` | `/admin/support/tickets` | Implemented, untested | Inbox with status transitions |
| Promotions | `/promotions`, `/new`, `/[id]` | Medusa core + shim | Implemented, untested | `usage_limit`→`limit` body shim in middleware |
| Content / CMS | `/content`, `/new`, `/[id]` | `/admin/cms` | Implemented, untested | Markdown pages, publish |
| Reports | `/reports` + 2 CSV routes | reuses dashboard + returns | **Partially implemented** | Sales/refund/orders counters, low-stock count, returns-by-status, products.csv, orders.csv. **No date range, no GST report, no margin, no reconciliation** |
| Inspections | `/inspections` | `/admin/inspections` | Implemented, untested | Condition/AI-03 review queue, approve/reject with audit |
| Resale orderbook | `/resale` | `/admin/resale/asks|bids` | Implemented, untested | Read-only overview of asks and bids |
| Fit rules | `/fit-rules` | `/admin/fit-rules` | Implemented, untested | Silhouette deltas and guidance |
| Settings / staff | `/settings` | Medusa `/admin/users`, `/admin/invites` | Implemented, untested | Owner-only invite/role/remove; readonly lockout honoured server-side |
| Audit log | `/audit` | `/admin/audit` | Implemented, untested | Filter by entity type, action prefix, actor |

## 2. Role and permission model

Five roles with a strict rank: `readonly(1) < support(2) < operations(3) < manager(4) < owner(5)`.

| Operation | Minimum |
|---|---|
| Read operational records (orders, customers, inventory, returns, shipments, audit) | support |
| Stock adjustment, order capture/fulfil/cancel/refund, return actions, shipment create/update, CMS publish, brand edit | operations |
| Staff/invite management | manager |
| Changing any role | owner (self-escalation blocked) |
| Any non-GET as `readonly` | denied |

Enforcement is server-side twice (global middleware + per-handler `requireRole`); the admin nav hides links cosmetically and says so in a comment.

**Defect SEC-01:** absence of `metadata.role` is interpreted as **owner**, in both `apps/backend/src/lib/admin-auth.ts` and `apps/admin/lib/api/auth.ts`. Every staff member invited through Medusa's own invite flow, or created before the role convention existed, silently becomes an owner. This defeats the entire RBAC design and must be fixed before a second staff account exists.

## 3. Audit trail

- `audit_event` is append-only at the database level (`audit_event_append_only` trigger — **[LIVE]** confirmed in `pg_trigger`).
- 256 rows currently.
- Written for: order capture/fulfil/cancel/refund, customer cancellation, inventory adjustment, return requested/approved/rejected/received/refunded, return restock, brand and CMS mutations, inspections, fit rules, staff changes.
- **Not written for:** price changes, product publish/draft, image upload, promotion creation, customer notes/blacklist changes (these need confirming against each action file — price/bulk actions in `products/actions.ts` contain no `writeAudit` call).

## 4. Reporting capability assessment

| Report the business will ask for | Available? |
|---|---|
| Orders by status | Yes (dashboard) |
| Gross captured revenue | Yes (sum of `payment.amount` where captured) |
| Refunded revenue | Yes (sum of `refund.amount`) |
| Net revenue | Derivable (difference), not displayed as such |
| Low stock | Yes (available ≤ 3) |
| Returns by status | Yes |
| Product list export | Yes (CSV) |
| Order list export | Yes (CSV) |
| Sales by date range | **No** |
| GST output report (CGST/SGST/IGST split) | **No** aggregation, only per-invoice display |
| Gross margin / product profitability | **No** — no purchase cost data exists |
| Inventory valuation | **No** — no cost basis |
| Payment gateway reconciliation | **No** |
| Shipping expense report | **No** |
| Customer lifetime value / repeat rate | **No** |

## 5. Admin UX / completeness gaps

1. No product review moderation (feature absent).
2. No supplier, purchase-order, GRN or purchase-cost screen (feature absent).
3. No consignment settlement screen (feature absent).
4. No multi-location transfer or pick/pack screen.
5. No date filters on any report or list.
6. No bulk action on orders (only per-order).
7. No CSV import for products.
8. No image reordering; gallery is append/remove only.
9. No way to view or edit a customer's bespoke measurement history (only what is on the order line).
10. `/design` token gallery ships in the admin build.

## 6. Module classification (as requested)

| Classification | Modules |
|---|---|
| **Complete and tested** (unit-tested logic) | role rank maths (`lib/roles.ts`, 2 tests); return eligibility (`lib/returns.ts`, 7 tests); shipment status mapping + idempotency helper (`lib/shipment-status.ts`, 5 tests) |
| **Implemented, partially tested** | Order actions, inventory adjust, returns actions, brands, CMS, inspections, fit rules (code only; no route tests) |
| **UI only** | Reports (presentation over existing endpoints; CSV exports are thin) |
| **Backend only** | Reverse pickup booking, login-bonus-style internals, resale asks/bids (no admin acceptance/fulfilment action) |
| **Mocked / hardcoded** | *None found in admin.* The admin app has an explicit "no mock or fallback data" rule in `lib/backend.ts` and honours it |
| **Broken** | Inventory adjustment under concurrency; refund idempotency; default-owner role |
| **Missing** | Suppliers/purchasing, settlements, reviews, multi-location ops, date-ranged analytics, credit notes |

<!-- ===== END 06_ADMIN_AND_OPERATIONS_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 07_COMMERCE_AND_CHECKOUT_AUDIT.md ===== -->

# 07 — COMMERCE AND CHECKOUT AUDIT

## 1. The end-to-end path as implemented

```
PDP → addToCart (server action)
    → POST /store/carts (region resolved from INR)         [cookie thl_cart]
    → POST /store/carts/:id/line-items  (+ bespoke metadata)
Cart → POST /store/carts/:id (metadata merge: fulfilment_mode, payment_method, consent)
Checkout address → POST /store/carts/:id (email, shipping_address)  [pincode gate]
Checkout shipping → GET /store/shipping-options → POST /store/carts/:id/shipping-methods
Checkout payment → POST /store/payment-collections
                 → POST /store/payment-collections/:id/payment-sessions {provider_id: pp_razorpay_razorpay}
                 → provider initiatePayment → Razorpay order (amount from cart total, server-side)
Browser Razorpay Checkout → razorpay_order_id / payment_id / signature
confirmRazorpayPaymentAction → POST payment-sessions/:id {data}
                             → POST /store/carts/:id/complete
                             → provider authorizePayment verifies HMAC (order|payment, key secret)
                             → order created, cart cleared
Post-order → subscribers (email/WhatsApp) · admin capture/fulfil · Shiprocket · webhooks · returns
```

## 2. Verified facts

**[LIVE]**
- Only two shipping options exist in the database: `Standard delivery` (flat **₹0**) and `Express delivery` (flat **₹199**).
- `region_payment_provider` is **empty** — no provider is offered at the payment step.
- Unsigned `POST /webhooks/razorpay` → **503** (`RAZORPAY_WEBHOOK_SECRET` unset).
- `/checkout` with an empty cart → **307** to `/cart`.
- 55 payments exist, 9 captured, 1 cancelled — i.e. payment records are being created, but no evidence of a completed paid order in this environment.

**[CODE]**
- Amount is **always** computed server-side: `amountPaise: Math.round((cart.total ?? 0) * 100)` in `beginRazorpayPaymentAction`; the provider's `initiatePayment` receives Medusa's amount. The browser never supplies a price.
- Currency: `input.currency_code.toUpperCase()` from the cart region → `INR`.
- Checkout signature verification: `crypto.createHmac("sha256", key_secret).update(`${orderId}|${paymentId}`)` compared against `razorpay_signature`; mismatch returns `PaymentSessionStatus.ERROR` (order not created).
- Webhook signature verification: HMAC over the **raw** body, `crypto.timingSafeEqual`, 401 on mismatch.
- Refund: `refundPaymentWorkflow` with amount defaulting to the full captured payment, guarded by "no captured payment" → 422 with an honest message about offline settlement.
- Cancel: `cancelOrderWorkflow`, blocked when any fulfilment exists or `fulfillment_status` is `fulfilled|shipped`.
- Stock: all 60 variants `manage_inventory=true`, `allow_backorder=false` → Medusa reserves at completion. **No custom stock decrement exists anywhere.**
- COD: fully removed — no branch in checkout, `pp_system_default` deleted by `setup-payments.ts`, migration drops the COD verification table.

## 3. State-consistency review

| Property | Assessment |
|---|---|
| Order marked paid only after trustworthy verification | **Yes in design** — `authorizePayment` verifies the HMAC before returning `AUTHORIZED`; capture is a separate admin workflow step. Cannot be observed without keys. |
| Duplicate checkout submissions | Depends on Medusa's complete-cart workflow rejecting an already-completed cart. No custom guard. **Unverified.** |
| Retry after failure | `authorizePayment` returns `PENDING` (not an error) when the browser has not completed checkout, so the customer can retry. Reasonable. |
| Payment/order association | Created through Medusa's payment collection ↔ order payment collection links. |
| Refund idempotency | **Broken** — `Date.now()` in the key (BUG-04). |
| Gateway settlement reconciliation | **Absent.** No settlement/UTR/payout import, no reconciliation view. |
| Failure/timeout flow | Provider fetch has `AbortSignal.timeout(15_000)`; errors surface as `MedusaError` with a message. No automatic retry, no dead-letter.

## 4. Checkout blockers, ranked

1. **P0 — no payment provider enabled / no keys.** A real customer reaches "payment" and cannot pay.
2. **P1 — email unconfigured.** Even if paid, no order confirmation is delivered; password reset cannot work either.
3. **P1 — refund idempotency** could double-refund on retry.
4. **P2 — shipping price model is flat only.** ₹0 standard shipping on every order is a business decision that has not been reflected in pricing; there is no weight/value-based rate, no free-shipping threshold rule beyond the flat zero.
5. **P2 — no address validation beyond PIN existence**; no courier serviceability check at the address step (Shiprocket serviceability is not queried).
6. **P2 — single shipping option per mode**; customer cannot choose a courier.

## 5. What a "standard purchase" scenario would do today

| Scenario | Expected | Actual |
|---|---|---|
| Discover → PDP → add to bag → cart | Works | Verified structurally; add-to-cart not executed to avoid mutating shared data |
| Checkout address + shipping | Works | Code path complete; pincode gate real |
| Payment | Should show UPI/cards via Razorpay | **Fails**: no provider, no key → "Online payment is not configured on this environment." |
| Order confirmation | Created by complete-cart | **Never reached** |
| Warehouse processing | Admin capture → fulfil | Unable to test (no admin session) |
| Shipment | Shiprocket AWB | **Blocked** (no credentials) |

**Conclusion: the commerce lifecycle is code-complete but operationally unproven. The single highest-value action in this project is to enable Razorpay in test mode and run one full sandbox purchase.**

<!-- ===== END 07_COMMERCE_AND_CHECKOUT_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 08_INTEGRATION_AUDIT.md ===== -->

# 08 — EXTERNAL INTEGRATION AUDIT

Every integration below is hand-written against the provider's REST API. **No vendor SDK is used anywhere** (no `razorpay` npm package, no `shiprocket` package, no `resend`, no `twilio`), which means there is no SDK-level retry, no typed responses, and no automatic idempotency — behaviour is exactly what the code in this repository does.

Legend for "Configured?": **[LIVE]** from env key enumeration in this environment.

---

## 1. Razorpay (payments)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — a real `AbstractPaymentProvider` implementation: `apps/backend/src/modules/razorpay/service.ts` (~290 lines) |
| Correct API usage? | **Plausibly yes, unverified.** Uses `POST /v1/orders` (`payment_capture: 0`), `POST /v1/payments/:id/capture`, `POST /v1/payments/:id/refund`, `GET /v1/payments/:id`; Basic auth `base64(key_id:key_secret)`. Shapes follow Razorpay's documented v1 API. |
| Credentials configured? | **No.** No `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in `apps/backend/.env`; no `NEXT_PUBLIC_RAZORPAY_KEY_ID` in the storefront env. |
| Sandbox connection successful? | **No — BLOCKED.** Not attempted (no credentials). |
| Error handling? | Good: every network call has a 15 s `AbortSignal.timeout`, non-2xx logs and throws `MedusaError`; provider refuses to operate when unconfigured instead of silently succeeding. |
| Retry handling? | **None.** A transient 5xx from Razorpay surfaces as a failure to the customer with no retry/backoff. |
| Webhook validation? | **Yes, twice over.** (a) `getWebhookActionAndData` verifies HMAC-SHA256 of the raw body against the webhook secret; (b) the dedicated `/webhooks/razorpay` route does the same with `timingSafeEqual`. Both correctly *ignore/refuse* when the secret or signature is missing. |
| Rate limiting? | N/A (outbound). Provider requests are one-per-checkout. |
| Logging? | Signature mismatches logged as warnings with the order id (no card data, no signature echo). |
| Production readiness? | **Not ready** — unconfigured and unexercised. Two concrete concerns: the storefront public key and the backend keys must be set **and** `pnpm db:setup-payments` must run, otherwise the payment step stays empty; and refunds are non-idempotent at the caller. |

**Ambiguity worth noting:** there are two parallel webhook paths — the custom verified logger at `/webhooks/razorpay` and Medusa's canonical `/hooks/payment/razorpay_razorpay`. Only the latter mutates payment state. An operator registering both in the Razorpay dashboard gets one logging endpoint and one state endpoint; registering only the custom one means **payment state never advances from webhooks**. This must be documented for go-live.

---

## 2. Shiprocket (logistics)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — `apps/backend/src/lib/shiprocket.ts`: token auth (9-day cache), `POST /orders/create/adhoc`, `POST /orders/create/return` |
| Correct API usage? | **Documented as unverified inside the file itself**: "this client has not been exercised against their live API … verify field names against a real response." Uses `apiv2.shiprocket.in/v1/external`. |
| Credentials configured? | **No** (`SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_TOKEN`, `SHIPROCKET_PICKUP_LOCATION` all absent) |
| Sandbox connection successful? | **No — BLOCKED** |
| Error handling? | Good: throws on any failure; callers fall back to **manual dispatch** and never invent an AWB (explicit comment and code discipline in both `returns.ts` and the admin shipment route). |
| Retry handling? | **None.** A failed create means the admin arranges a manual pickup. |
| Webhook validation? | **Weak by design:** a static shared token in the query string or `x-webhook-token` header. Shiprocket does not sign with HMAC; the route documents this and recommends verifying against current docs. Risk: token leakage via logs/proxies (SEC-05). |
| Rate limiting? | None needed (low volume). |
| Logging? | Failures logged with provider status and body prefix; unknown AWB logged and 200'd to stop retries. |
| Production readiness? | **Not ready.** No credentials, unverified payload shapes, one hardcoded destination block in the return request (`Ahmedabad / Gujarat / 380054 / phone 9999999999`) that must be corrected before real reverse pickups. |

**Hardcoded values found in the return path:** `shipping_customer_name: "The Hidden Label Returns"`, `shipping_city: "Ahmedabad"`, `shipping_state: "Gujarat"`, `shipping_pincode: "380054"`, `shipping_phone: "9999999999"`. If the boutique address differs, labels print the wrong destination.

---

## 3. Resend (transactional email)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — `lib/email.ts` (`POST https://api.resend.com/emails`), `lib/order-email.ts` templates, subscribers for order placed/cancelled/fulfilled/delivered, password reset, RMA acknowledgement, daily report with base64 attachments |
| Correct API usage? | Yes — documented shape, `from` from `EMAIL_FROM` (default `orders@thehiddenlabel.com`), 10 s timeout |
| Credentials configured? | **No** (`RESEND_API_KEY` absent, `REPORTS_EMAIL` absent) |
| Sandbox connection successful? | **No — BLOCKED** |
| Error handling? | Returns `{ sent, reason }`, logs `[email:not-configured]`, never blocks an order transition. Deliberate and correct. |
| Retry handling? | **None**; a Resend outage silently drops the message (logged only). |
| Webhook validation? | N/A (no inbound email webhooks: no bounce/complaint handling) |
| Rate limiting? | None client-side |
| Logging? | Unconfigured sends are logged with recipient + subject; failures log provider status |
| Production readiness? | **No.** Without a key, **no customer ever receives an order confirmation, password reset, RMA acknowledgement or delivery notice.** There is also no bounce/complaint processing, no unsubscribe/consent handling, and no template management (HTML is inline in code). |

---

## 4. SMS OTP (MSG91 or Twilio)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — `lib/sms.ts` (MSG91 DLT template flow, Twilio alternative), `lib/otp.ts` (HMAC-hashed codes, 5 min TTL, 5 attempts, 3 sends/15 min), `lib/phone.ts` (Indian E.164 normalisation) |
| Correct API usage? | Plausible; not exercised |
| Credentials configured? | **No** — `OTP_PROVIDER`, `OTP_API_KEY`, `OTP_TEMPLATE_ID`, `OTP_SENDER_ID`, `TWILIO_*` all absent. `OTP_DEV_ECHO=true` is set for development only. |
| Sandbox connection successful? | **No — BLOCKED** |
| Error handling? | **Excellent:** unconfigured SMS returns **501** with an explicit message rather than pretending to send; the storefront falls back to email OTP and says so. |
| Retry handling? | None; customer requests a new code (rate-limited) |
| Webhook validation? | N/A |
| Rate limiting? | Yes — 3 sends per destination/purpose per 15 minutes, plus 5 verification attempts |
| Logging? | Logs a SHA-256 prefix reference of the destination, never the number |
| Production readiness? | **No.** DLT registration and an approved template are prerequisites in India; neither is present. `OTP_DEV_ECHO` must be off. |

---

## 5. WhatsApp (MSG91)

| Question | Answer |
|---|---|
| Code exists? | Yes — `lib/whatsapp.ts`, invoked from order subscribers |
| Correct API usage? | Plausible MSG91 WhatsApp template call with numbered params |
| Credentials configured? | **No** (`MSG91_WHATSAPP_AUTH_KEY`, integrated number, four template names) |
| Sandbox connection | **No — BLOCKED** |
| Error handling | Non-blocking, logged |
| Retry | None |
| Webhook | N/A (no inbound message handling → WhatsApp is **not** a support channel, only an outbound notification) |
| Production readiness | No — templates must be pre-approved; never sent |

---

## 6. Gemini (AI layer)

| Question | Answer |
|---|---|
| Code exists? | Yes — `lib/gemini.ts`, used by `/store/sight-search` (visual/keyword search) and `/store/concierge/chat` |
| Correct API usage? | REST call to Gemini with a grounded catalogue prompt; 9 unit tests cover prompt building and fallbacks with mocked `fetch` |
| Credentials configured? | **Key name present** in `apps/backend/.env`; validity not tested |
| Sandbox connection | **NOT VERIFIED** — no live call was made (cost + third-party side effect) |
| Error handling | Good: on failure the concierge falls back to a deterministic keyword/template reply and logs a warning |
| Retry | None |
| Webhook | N/A |
| Rate limiting | **None** on `/store/concierge/chat` or `/store/sight-search` → an unauthenticated caller can drive paid API usage |
| Logging | Failure warnings only |
| Production readiness | **Conditional.** Works as a *conservative* feature (falls back honestly, makes no authentication claims), but needs a per-session/IP quota before the AI flag is switched on. |

---

## 7. Image storage

- No S3 credentials (`S3_ENDPOINT/BUCKET/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY` absent).
- Medusa therefore uses its **local file provider**; uploads land in `uploads/` (gitignored).
- Admin upload works through `POST /admin/uploads` (`apps/admin/lib/api/uploads.ts` → `uploadFile`).
- **Production blocker:** local disk is not durable or shareable across replicas. Object storage is required before deploy. The storefront also accepts `images.remotePatterns` of `**` over http/https, which is permissive.

## 8. PostgreSQL / Redis

- PostgreSQL 18 is real and healthy **[LIVE]**. Pool configured (`min 2 / max 20`).
- **Redis is not configured** (`REDIS_URL` absent) → Medusa uses in-memory event bus/workflow engine, so **background jobs and subscriber delivery do not survive a restart and are not shared across replicas**. The auth rate limiter falls back to in-process memory, which is per-replica.
- `docker-compose.yml` provides both, but the app is currently running without Redis.

## 9. Analytics / monitoring / CDN

| Integration | Status |
|---|---|
| Error monitoring (Sentry) | **Configured? No.** `SENTRY_DSN` absent; no Sentry SDK in any `package.json`. Logs go to stdout/`.dev/*.log`. |
| Log aggregation | None (only `LOG_LEVEL=info`) |
| Product analytics / funnel events | **None** — no GA4, no PostHog, no server-side event pipeline |
| CDN | None configured; Next serves images directly |
| Search service | None — Medusa/Postgres `ilike` queries only |

## 10. Integration readiness summary

| Integration | Code | Credentials | Verified | Readiness |
|---|---|---|---|---|
| Razorpay | ✅ real | ❌ | ❌ | **NOT READY** (P0) |
| Shiprocket | ✅ real | ❌ | ❌ | **NOT READY** |
| Resend | ✅ real | ❌ | ❌ | **NOT READY** |
| MSG91/Twilio SMS | ✅ real | ❌ | ❌ | **NOT READY** |
| MSG91 WhatsApp | ✅ real | ❌ | ❌ | **NOT READY** |
| Gemini | ✅ real | ⚠️ key present | ❌ | **CONDITIONALLY READY** |
| S3 storage | ⚠️ config-only | ❌ | ❌ | **NOT READY** |
| PostgreSQL | ✅ | ✅ | ✅ | **READY** (local only) |
| Redis | ✅ config | ❌ | ❌ | **NOT READY** (dev runs in-memory) |
| Sentry/analytics | ❌ | ❌ | ❌ | **MISSING** |

<!-- ===== END 08_INTEGRATION_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 09_SECURITY_AND_COMPLIANCE_AUDIT.md ===== -->

# 09 — SECURITY AND COMPLIANCE AUDIT

**Scope:** defensive review only. No penetration testing, no destructive probing, no attempt to access real customer data. Probes were limited to unauthenticated `GET`/`POST` on public or protected endpoints, with no payloads that create records.

## 1. Authentication

| Control | Status | Evidence |
|---|---|---|
| Customer auth | Medusa `emailpass` via `/auth/customer/emailpass` (+`/register`) | `lib/medusa.ts` |
| Password minimum | 8 characters, enforced in middleware **and** Zod schema | `middlewares.ts` `customerRegistrationMiddleware` |
| Registration enumeration protection | Generic failure copy when the email exists | same file |
| Login enumeration protection | Single generic message on failure | `app/actions/auth.ts` |
| Session storage | httpOnly `thl_auth` cookie, `sameSite=lax`, `secure` in production, 30-day max age | `lib/auth-cookie.ts` |
| Admin session storage | httpOnly `thl_admin_token`, `sameSite=lax`, 24h | `apps/admin/lib/session.ts` |
| Tokens in browser storage | **None** — never `localStorage` | verified by grep/read |
| Brute-force protection | IP+email keyed limiter, 10 attempts / 15-min block, Redis when available, in-memory fallback | `lib/rate-limit.ts`, `middlewares.ts` |
| Password reset | Tokenised link, email delivery, subscriber | `subscribers/auth-password-reset.ts` |
| MFA for staff | **Missing** | — |
| Session revocation list | **Missing** — logout deletes the cookie; the JWT remains valid until expiry | — |

## 2. Authorisation

| Control | Status |
|---|---|
| Server-side RBAC on every `/admin/*` | **Yes** — global middleware + per-handler `requireRole` |
| UI-only gating | Explicitly documented as cosmetic |
| Self-escalation via `/admin/users/me` | **Blocked** — privileged metadata keys rejected on non-GET |
| Owner-only role changes, no self-role change | Yes |
| Readonly role | Fully denied on operational resources and all writes |
| Customer object ownership (orders, returns, shipment, wishlist) | **Yes**, all scoped by `customer_id`/`actorId`; mismatched order renders 404 not 403 |
| **Default role fallback** | **`owner` when `metadata.role` is missing — HIGH RISK (SEC-01)** |
| Staff invite flow | Medusa core `/admin/invites`, owner/manager guarded |

**SEC-01 detail.** `apps/backend/src/lib/admin-auth.ts`:
```ts
const role = typeof metadata.role === "string" ? (metadata.role as AdminRole) : "owner";
```
and `apps/admin/lib/api/auth.ts` mirrors it. Impact: any staff account created through Medusa's native invite/admin UI — which does not set `metadata.role` — is granted owner rights: full refunds, stock, staff management and role changes. This is the most serious finding in the audit. Severity **High**, effort to fix **minutes** (default to `null` + 403 "no role assigned").

## 3. Transport and browser hardening

`apps/storefront/next.config.ts` **[CODE]**:
- `Content-Security-Policy` restricting `default-src 'self'`, allowing Razorpay script/frame/connect, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`.
- `Strict-Transport-Security` (production only).
- `poweredByHeader: false`.
- `unsafe-inline` (and `unsafe-eval` in dev) remain in `script-src` for Next's bootstrap — a known, common trade-off.

**Gap:** the **admin app has no equivalent security headers** (no CSP, no HSTS, no frame-deny configured in `apps/admin/next.config.ts`). Given the admin handles refunds and customer PII this should match the storefront.

**Gap:** `images.remotePatterns` allows `http://**` and `https://**` — an unrestricted image proxy.

## 4. Input handling

| Class | Assessment |
|---|---|
| SQL injection | **No exposure found.** Raw knex queries inspected use bound parameters; identifiers are static. The only dynamic SQL is whitelisted column selection. |
| XSS | React escapes by default; the CMS markdown renderer is a hand-written renderer (`cms-page-renderer.tsx`) — it should be re-reviewed for raw HTML passthrough before letting non-owner staff publish, but no `dangerouslySetInnerHTML` sink was found in the storefront pages read. |
| CSRF | Server Actions carry Next's built-in origin checks; cookies are `SameSite=Lax`; no custom cookie-authenticated state-changing `GET` was found. No explicit CSRF token scheme. |
| SSRF | The only user-influenced outbound fetch is the sight-search image URL → Gemini. It is sent to Google, not fetched by this server. No general URL fetcher exists. |
| Path traversal | No file-serving route accepts a user path; uploads go through Medusa's file module. |
| File upload validation | Admin-only, through Medusa's upload endpoint; no explicit MIME/size allowlist was found in `apps/admin/lib/api/uploads.ts`. |
| Mass assignment | Storefront actions whitelist fields; order/return routes whitelist columns. |
| Webhook authenticity | Razorpay: HMAC over raw body, constant-time compare (**good**). Shiprocket: static shared token (**weak — SEC-05**). |

## 5. Rate limiting coverage

| Endpoint | Limited? |
|---|---|
| `/auth/customer/emailpass` | Yes |
| `/auth/user/emailpass` | Yes |
| `/store/otp/send` | Yes (3/15 min per destination) |
| `/store/otp/verify` | Yes (5 attempts per challenge) |
| `/store/support/tickets` | **No** |
| `/store/concierge/chat`, `/store/sight-search` | **No** — paid third-party calls reachable unauthenticated |
| `/store/resale/bids|asks` | **No** |
| `/store/carts*` mutations | **No** (Medusa defaults only) |

## 6. Secrets management

- Only `.env.example` and `apps/admin/.env.example` are tracked **[LIVE]** `git ls-files`.
- Local `.env` / `.env.local` are correctly gitignored and untracked.
- No secret, key or token appears in any `.md` report, test fixture or log examined.
- **Weakness:** dev secrets are *defaults in code* (`jwtSecret ?? "local_dev_jwt_secret"`, `cookieSecret ?? "local_dev_cookie_secret"`, OTP secret falling back to the JWT secret). A production process that loses its env file boots successfully with a publicly known signing key. There is no startup assertion.
- **Weakness:** `OTP_DEV_ECHO=true` exists in the local backend env; the route gates it on `NODE_ENV !== "production"`, which is correct, but the variable should not be present in any production manifest.

## 7. Data protection (DPDP Act 2023 / privacy)

| Requirement | Status |
|---|---|
| Lawful-basis consent captured | **Yes** — affirmative checkbox on registration and at payment, with `privacy_consent_at` + `privacy_policy_version` stored on the customer and cart |
| Privacy policy published | Yes — CMS page `/policies/privacy`, linked in the footer |
| Grievance officer published | Yes — footer + dedicated page, driven by `GRIEVANCE_OFFICER_*` env (**currently all unset → placeholders rendered**) |
| Data export (right to access) | Yes — `download-my-data-button.tsx` → account export |
| Account deletion (right to erase) | Yes — `POST /store/customers/me/delete-account` |
| Data minimisation in logs | Good — OTP destinations logged as a hash prefix; audit `changes` explicitly excludes secrets |
| PII in third-party payloads | Shiprocket receives name/address/phone/email (necessary for shipping); Gemini receives catalogue titles and, for sight search, an image URL/keywords |
| Retention policy | **None defined**; `audit_event` grows unbounded |
| Cookie consent banner | **None** (only strictly necessary cookies are set, so this is defensible — but it must be confirmed with counsel) |

## 8. Consumer-protection / Indian ecommerce compliance

| Requirement | Status |
|---|---|
| Legal Metrology declarations (country of origin, net qty, MRP, marketer, consumer care) | **Implemented on the PDP** |
| GSTIN / CIN displayed | Layout present, **values unset** (`GSTIN: —`) |
| GST invoice with CGST/SGST vs IGST | **Implemented** (state-code comparison in `packages/shared/src/gst.ts`) |
| Return/refund policy | Published; 7-day window implemented **in code** (`RETURN_WINDOW_DAYS = 7`) — policy text and code must be kept aligned |
| Grievance officer name/contact/SLA | Page and footer exist; values are placeholders; SLA copy says 48h/30 days |
| Country of origin accuracy | Defaults to "India" when metadata is absent — a **compliance risk** for imported goods |
| HSN codes | Derived from title/gender heuristics with metadata override — a real invoice needs the true HSN per product |
| Terms of service | CMS page; **not reviewed by counsel** |

**Matters requiring professional legal/accounting confirmation:** GST treatment of consignment/resale margin, whether the resale marketplace makes the platform a "marketplace e-commerce entity" under the Consumer Protection (E-Commerce) Rules, invoice/credit-note format, DLT template registration, and the DPDP consent notice wording. Nothing in the repository substitutes for that advice.

## 9. Dependency and supply-chain

- No `pnpm audit` in CI; no Dependabot/Renovate config found.
- Lockfile is committed; `pnpm install --frozen-lockfile` is used in CI.
- `.github/workflows/ci.yml` pins actions by major tag (`@v4`), not by commit SHA — acceptable but weaker than SHA pinning.
- No SBOM, no image scanning (no images).

## 10. Security findings summary

| ID | Severity | Finding |
|---|---|---|
| SEC-01 | **High** | Missing role metadata ⇒ `owner` |
| SEC-02 | High | Refund idempotency key uses `Date.now()` |
| SEC-03 | Medium | Inventory adjustment lost-update |
| SEC-04 | Medium | Concierge thread not owner-scoped; trusts client `session_token` |
| SEC-05 | Medium | Shiprocket webhook uses a static query-string token |
| SEC-06 | Medium | No rate limit on AI/support/resale write endpoints |
| SEC-07 | Medium | Dev secrets as code defaults with no production assertion |
| SEC-08 | Medium | Admin app lacks CSP/HSTS/frame-deny |
| SEC-09 | Low | No staff MFA, no session revocation |
| SEC-10 | Low | `images.remotePatterns` allows any https host |
| SEC-11 | Low | No dependency vulnerability scanning |
| SEC-12 | Low | Country of origin defaults to "India" |
| SEC-13 | Info | `OTP_DEV_ECHO=true` present locally (correctly gated) |

<!-- ===== END 09_SECURITY_AND_COMPLIANCE_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 10_PERFORMANCE_AND_DEVOPS_AUDIT.md ===== -->

# 10 — PERFORMANCE, BUILD AND DEVOPS AUDIT

## 1. Build, typecheck, lint, tests — measured

| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | **PASS** — exit 0, 6/6 packages (`@thl/shared`, `ui`, `config` n/a, `backend`, `storefront`, `admin`) |
| Unit tests | `pnpm test` | **PASS** — exit 0, **70/70** (shared 23, backend 45, admin 2) |
| Lint | `pnpm lint` | **FAIL** — exit 1, **15 errors, 0 warnings** |
| Production build (storefront) | — | **NOT RUN** — see note below |
| Production build (admin / backend) | — | **NOT RUN** |

**Lint failures (all 15 in committed audit scripts, none in application code):**
`.audit/analyze-tests.mjs`, `.audit/independent-workflow-gate.mjs`, `.audit/inspect-env-keys.mjs`, `.audit/test-all-roles-rbac.mjs`, `.audit/test-cod-forgery.mjs`, `.audit/test-inventory-gate.mjs`, `.audit/test-promo-rbac.mjs`, `.audit/test-users-me.mjs`.
Rules violated: `@typescript-eslint/no-unused-vars` (unused `path`/`fs` imports) and `no-empty` (empty `catch` blocks).

**Impact:** `.github/workflows/ci.yml` runs `pnpm lint` as a required step, so **CI is red on this commit**. `docs/BUILD_LOG.md` claims "repo-wide `pnpm typecheck` and `pnpm lint` are 100% clean" — that claim is **contradicted by measurement** as of this audit.

**Why the production build was not run:** the storefront dev server is live on `:3000` and shares the `.next` directory. Running `next build` in the same working tree would overwrite the dev server's build artifacts and can break the running environment, which the audit brief forbids ("preserve existing development state"). The CI workflow already defines the build command (`pnpm --filter @thl/storefront build`) and the correct place to verify it is CI or a separate worktree. **Storefront buildability is therefore NOT VERIFIED in this audit.**

## 2. Measured response times (local development, warm)

**Method:** `curl -w %{time_total}` against the running services. These are **development-mode** numbers (Turbopack dev server, no CDN, single process, local Postgres) and must not be read as production performance.

| Endpoint | Samples (s) | Observation |
|---|---|---|
| `GET :9000/store/products?limit=8` (with publishable key) | 0.402, 0.021, 0.021, 0.024, 0.020 | ~21 ms warm; first call 0.40 s (connection/plan warm-up) |
| `GET :3000/` | 1.816, 0.303, 0.291, 0.276, 0.318 | ~0.28–0.32 s warm; 1.8 s cold |
| `GET :3000/collections/all` | 0.368, 0.178, 0.146 | ~0.15–0.37 s |

No load test, no Lighthouse run, no database query plan analysis was performed, so **no performance score is reported**. The one prior measurement in the repo (`CURRENT_PROJECT_STATUS.md`: p50 2580 ms → 1542 ms for `/store/products` under 40 concurrent requests after raising the pool to 20) was **not** reproduced here.

## 3. Caching

| Layer | Status |
|---|---|
| Catalogue fetches | `cache: "no-store"` for mutations; `next: { revalidate: 0 }` for GETs → **effectively uncached**, by design ("stale product id after an admin edit produces confusing cart errors") |
| Regions | Intentionally cached 300 s in-process (`resolveRegionId`) |
| Categories / CMS / banners / activity | `revalidate: 60` / `30` |
| Redis | **Not configured** → no shared cache; each replica would cache independently |
| CDN / edge | None |
| Admin backend calls | `cache: "no-store"` everywhere |

**Assessment:** correctness-first caching is a defensible choice at this stage, but the storefront will hit the backend on every request. Before launch, catalogue reads need at least a short shared cache (or Redis/ISR) or the backend becomes the bottleneck.

## 4. Database performance

- Pool: `min 2 / max 20`, configurable via `DB_POOL_*`.
- Indexes present on all high-traffic paths reviewed: order `deleted_at`/status, inventory level, shipment order/status/AWB, return status, resale variant/seller/buyer, OTP destination, audit entity.
- **Unbounded `audit_event`** — no retention/partitioning; at 256 rows today this is irrelevant, but it will need archiving.
- Dashboard summary runs six aggregate queries per load (counts, sums, recent orders) — fine at current volume, will need materialised views or a reporting table at scale.

## 5. Error monitoring and observability

| Capability | Status |
|---|---|
| Structured logging | **Partial** — Medusa logger to stdout; `LOG_LEVEL=info` |
| Error tracking | **MISSING** — no Sentry/OpenTelemetry; `SENTRY_DSN` unset and no SDK installed |
| Request tracing | **MISSING** |
| Health endpoints | **Present** — `GET :9000/health` and `GET :3000/api/health` (the latter reports backend reachability + latency) |
| Uptime/alerting | **MISSING** |
| Log aggregation | **MISSING** — dev logs go to `.dev/*.log` and `backend-dev.log` |

This is the weakest engineering area after payments: a production incident would be diagnosed from whatever happens to be on stdout.

## 6. Backup and recovery

- **No backup configuration exists** for local or any hosted database.
- No restore procedure, no documented RPO/RTO, no dump script in `package.json`.
- `docker-compose.yml` uses a named volume (`thl-pgdata`) but no backup sidecar.
- The portable Postgres cluster lives in `.dev/pgdata` (gitignored) — a disk failure loses everything.

## 7. CI/CD and deployment

**What exists** — `.github/workflows/ci.yml`:
- Job `checks`: ubuntu, Node 22.22.0, pnpm 10.32.1, `install --frozen-lockfile` → typecheck → lint → unit tests → storefront build.
- Job `migrations`: Postgres 18 service, runs `medusa db:migrate` from empty and asserts ≥50 tables.

**What is missing:**
- **No deploy job, no environment promotion, no rollback strategy.**
- **No Dockerfile** for backend/storefront/admin.
- **No IaC** (Terraform/Pulumi), no manifests, no hosting config.
- **No secret management** integration for CI.
- No smoke test after deploy.
- No dependency or container vulnerability scanning.
- **As of this commit the `checks` job would fail at the lint step** (BUG-02).

## 8. Environment separation

- Single `.env` / `.env.local` per app; no `.env.production` template, no documented per-environment variable matrix beyond `.env.example`.
- No staging environment exists.
- `apps/admin` has **no** env file at all, relying on hardcoded localhost defaults.

## 9. Windows/dev-experience notes (relevant to reliability)

- `scripts/dev-db.mjs` deliberately sanitises the environment because an MSYS/Git Bash environment makes Postgres die with `0xC0000142`. This is a real, documented constraint and should be preserved.
- `.bat` launchers exist for start/stop; they are the documented entry point for non-technical operators.
- `apps/admin` must run with `--webpack` because Turbopack does not link the compiled `globals.css` chunk (documented in `docs/BUILD_LOG.md`). This is a workaround, and any Next upgrade must re-test it.

## 10. DevOps findings summary

| ID | Finding | Severity |
|---|---|---|
| DEV-01 | Lint gate fails ⇒ CI red | **P0 for release process** |
| DEV-02 | No deployment pipeline, no Dockerfile, no hosting | **P0 for launch** |
| DEV-03 | No error monitoring or alerting | **P1** |
| DEV-04 | No backup or restore procedure | **P0 for launch** |
| DEV-05 | Redis absent ⇒ in-memory queues/events, per-replica rate limits | **P1** |
| DEV-06 | No staging environment | **P1** |
| DEV-07 | Production build not verified in this audit | **P1 (unverified)** |
| DEV-08 | Local file storage for uploads | **P1** |
| DEV-09 | No dependency/vulnerability scanning | **P2** |
| DEV-10 | Catalogue effectively uncached | **P2** |

<!-- ===== END 10_PERFORMANCE_AND_DEVOPS_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 11_ECOMMERCE_BUSINESS_OPERATIONS_AUDIT.md ===== -->

# 11 — REAL-WORLD ECOMMERCE BUSINESS OPERATIONS AUDIT

The question here is **not** "is the code good" but "can this application run a premium Indian retail business with a bespoke atelier and a resale/authentication arm". Each capability is marked:

`IMPLEMENTED+VERIFIED` · `IMPLEMENTED (unverified)` · `PARTIAL` · `MISSING` · `NOT REQUIRED YET`

---

## A. Premium retail operations

| Capability | State | Evidence / note |
|---|---|---|
| Supplier records | **MISSING** | no supplier table, route or UI anywhere |
| Supplier purchase orders | **MISSING** | — |
| Purchase cost | **MISSING** | product and variant have no cost field; no margin is computable |
| Goods-received notes | **MISSING** | stock arrives only through `db:seed` or a manual `+delta` adjustment |
| Quality inspection on receipt | **MISSING** (inbound) | `condition_inspection` is per-unit authentication for resale, not supplier QC |
| SKU generation | **PARTIAL** | Medusa `inventory_item.sku` and variant SKU exist and are searchable; admin product creation does not generate them |
| Inventory locations | **PARTIAL** | `stock_location` exists; admin operations assume `stock_location.first()` |
| Warehouse operations (pick/pack) | **MISSING** | fulfilment is a single click that fulfils all pending quantities |
| Product margin | **MISSING** | no cost basis |
| Reordering / reorder points | **PARTIAL** | low-stock threshold is a hardcoded `≤ 3` in two queries, not a per-product reorder point |
| Stock ageing | **MISSING** | no `stock_movement` ledger to age |
| Supplier invoices | **MISSING** | — |
| Supplier payment tracking | **MISSING** | — |
| Multi-brand merchandising | **IMPLEMENTED (unverified)** | `brand` module + `product_brand`, `/brands` storefront, admin CRUD |
| Category taxonomy | **IMPLEMENTED (unverified)** | real `product_category` tree, seeded, rendered as mega-menu |
| Promotions / discount codes | **IMPLEMENTED (unverified)** | Medusa promotions + admin UI + cart promo input |
| CMS / editorial | **IMPLEMENTED+VERIFIED (read)** | `cms_page`, `/policies/*`, `/about`, multi-segment slugs |
| Store pickup ("click & collect") | **IMPLEMENTED (unverified)** | `store_pickup` fulfilment mode with the Sindhu Bhavan Road address, free shipping option |
| GST invoicing | **IMPLEMENTED (unverified)** | per-order invoice page, CGST+SGST vs IGST by state |
| Returns | **IMPLEMENTED (unverified)** | 7-day window, eligibility, grading, restock |

**Readiness: retail browse/sell path is close; the back office that buys, costs and replenishes the goods is absent.**

---

## B. Bespoke tailoring

| Capability | State | Evidence |
|---|---|---|
| Consultation booking | **MISSING** | no booking model or screen |
| Customer measurement profiles | **PARTIAL** | per-line `metadata.custom_measurements` (chest, waist, shoulder, sleeve, inseam, fit preference, notes) and `customer_fit_profile` for foot sizing; no persistent body-measurement profile on the customer |
| Measurement revisions | **MISSING** | each order line is a snapshot with no history |
| Fabric catalogue | **MISSING** | no fabric entity, no swatches, no selection |
| Customisation options | **PARTIAL** | free-text notes + fit preference; no structured option set (lapel, lining, monogram) |
| Design approvals | **MISSING** | — |
| Quotations | **MISSING** | bespoke is priced as a normal variant |
| Customer approvals | **MISSING** | — |
| Production job cards | **PARTIAL** | the admin order page renders a "master tailor sheet" from the line metadata — a printable view, not a job entity |
| Tailor assignments | **MISSING** | — |
| Production milestones | **IMPLEMENTED (unverified)** | 5-stage `bespoke_stage` metadata (`measurements_verified → fabric_cutting → stitching → qc_passed → ready_for_pickup`) shown to customer and admin |
| Fittings | **MISSING** | — |
| Alterations | **MISSING** | — |
| Quality inspection (garment) | **PARTIAL** | `qc_passed` is a stage flag, not an inspection record |
| Final delivery | **PARTIAL** | handled by the generic shipment flow |

**Readiness: the customer can specify measurements and watch a stage tracker; the atelier cannot run a real made-to-measure workflow in this system.**

---

## C. Resale and authentication

| Capability | State | Evidence |
|---|---|---|
| Resale intake | **MISSING** | no intake entity, no "receive item" action |
| Item ownership declaration | **MISSING** | no declaration or T&C acceptance record for consignors |
| Intake references | **MISSING** | — |
| Product condition grading | **IMPLEMENTED (unverified)** | `condition_inspection` with grade, checklist JSON, turntable frames, verdict, inspector |
| Authentication checklist | **IMPLEMENTED (unverified)** | checklist stored per inspection; admin review queue |
| Inspector records | **PARTIAL** | `inspector` field on the inspection; no inspector identity/role entity |
| Authentication decisions | **IMPLEMENTED (unverified)** | verdict approve/reject with audit |
| Evidence records | **IMPLEMENTED (unverified)** | frames + public certificate page `/inspection/[serial]`, `/verify/[serial]` |
| Pricing | **PARTIAL** | consignor sets an ask with a live 9.5% fee estimate; no algorithmic or admin price guidance |
| Consignment terms | **MISSING** | no terms record, no acceptance timestamp |
| Seller settlements | **MISSING** | payout is *displayed* (`ask × 0.905`) and `calculateConsignorPayout()` exists in `lib/resale.ts`, but **no settlement row, no payout status, no bank details** — Bank transfer is mentioned in copy only |
| Authentication disputes | **MISSING** | — |
| Resale-specific returns | **PARTIAL** | the generic RMA flow applies; no resale-specific policy |
| Bidding / asks orderbook | **IMPLEMENTED (unverified)** | `resale_ask`, `resale_bid`, price index, `/account/asks`, `/account/bids`, admin orderbook |
| Bid → order conversion | **MISSING** | accepting a bid does not create an order; no matching engine |

**Readiness: the *authentication* half is genuinely real and DB-backed. The *consignment commerce* half (intake → settlement) is not built. A consignor can list a price today and never be paid by the system.**

---

## D. Customer relationship management

| Capability | State |
|---|---|
| Customer profiles | **IMPLEMENTED (unverified)** — customers list/detail, internal notes |
| Purchase history | **IMPLEMENTED+VERIFIED (read)** — orders filter by customer id |
| Customer segmentation | **MISSING** |
| Support tickets | **IMPLEMENTED (unverified)** — customer form → `support_ticket` → admin inbox |
| Complaint tracking | **PARTIAL** — ticket status only; no SLA, no escalation, no linkage to order/return |
| Customer preferences | **PARTIAL** — fit preference, wishlist, addresses |
| Loyalty / membership | **MISSING** |
| Marketing consent | **PARTIAL** — privacy consent is captured; **marketing** consent is not |
| Communication history | **MISSING** — no log of emails/WhatsApp sent per customer |
| Risk indicators | **IMPLEMENTED (unverified)** — risk/blacklist flag on customer, refund reasons taxonomy |

---

## E. Finance and accounting

| Capability | State |
|---|---|
| Sales reporting | **PARTIAL** — captured/refunded totals and order counts, no date range |
| GST computation | **IMPLEMENTED+VERIFIED (read code, prior round claims live)** — 5/12/18/28 slabs seeded, 18% default, intra vs inter-state split |
| GST return/export | **MISSING** |
| Credit notes | **MISSING** — refunds update `return_request`/`payment`, no credit-note document |
| Refunds | **IMPLEMENTED (unverified)** — admin refund workflow + provider refund; offline message for non-captured payments |
| Gateway reconciliation | **MISSING** |
| Shipping expenses | **MISSING** — courier cost is not recorded, only charged ₹199 or ₹0 |
| Purchase costs | **MISSING** |
| Supplier balances | **MISSING** |
| Gross margin | **MISSING** (no cost data) |
| Inventory valuation | **MISSING** (no cost data) |
| Daily reconciliation | **MISSING** |

---

## F. Compliance (Indian ecommerce)

| Area | Assessment |
|---|---|
| GST registration display | Layout present, **value unset** |
| GST invoice format | Implemented with CGST/SGST/IGST split and HSN — needs accountant review |
| Legal Metrology declarations | Implemented on PDP; **country of origin defaults to "India"** which is wrong for imported labels |
| Consumer Protection (E-Commerce) Rules | Grievance officer page + footer exist; **names/contacts are placeholders**; SLA copy present |
| Return/refund policy disclosure | Present, consistent with the coded 7-day window |
| DPDP Act 2023 | Consent capture, export and deletion implemented; no retention policy; no consent-manager integration |
| DLT (SMS) | Not registered — blocks SMS OTP |
| Invoice/credit-note numbering | No credit notes at all |
| Product declarations (material/care) | Free-text description only |

**Everything in section F requires professional legal/accounting confirmation. This report makes no legal determination.**

---

## G. Business-model decision still open

`CURRENT_PROJECT_STATUS.md` records an unresolved product decision: whether the platform is a **StockX-style bid/ask orderbook** (which is what is built) or a **CultureCircle-style fixed-price catalogue with price comparison** (which the referenced competitor actually is). The code, copy and navigation all assume the former. This is a business decision that changes the roadmap materially — it is not an engineering gap.

---

## H. Operating-readiness verdict by business function

| Function | Verdict |
|---|---|
| Selling a ready-to-wear item end-to-end | **NOT READY** (payment disabled, email disabled) |
| Fulfilling an order | **CONDITIONALLY READY** (manual only; no AWB without Shiprocket) |
| Handling a return | **CONDITIONALLY READY** (logic complete, unexercised) |
| Buying and replenishing stock | **NOT READY** (no purchasing module) |
| Running a bespoke atelier | **NOT READY** (no consultation/quote/job-card/fitting workflow) |
| Running a consignment business | **NOT READY** (no intake, no settlement) |
| Authenticating product | **CONDITIONALLY READY** (real records, manual process) |
| Financial control and reporting | **NOT READY** (no cost, margin, reconciliation or GST report) |
| Customer support | **CONDITIONALLY READY** (inbox exists, no SLA/assignment) |
| Compliance posture | **CONDITIONALLY READY** (structures exist, values/legal review missing) |

<!-- ===== END 11_ECOMMERCE_BUSINESS_OPERATIONS_AUDIT.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 12_TEST_RESULTS_AND_EVIDENCE.md ===== -->

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

<!-- ===== END 12_TEST_RESULTS_AND_EVIDENCE.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 13_MISSING_FEATURES_AND_GAP_REGISTER.md ===== -->

# 13 — MASTER GAP REGISTER

**Priority definitions**
`P0` release blocker / critical business risk · `P1` essential to operate the business · `P2` growth, experience, efficiency · `P3` optional future enhancement.

**State vocabulary**
`VERIFIED` (executed this session) · `IMPLEMENTED` (code complete, unverified) · `PARTIAL` · `MISSING` · `BLOCKED` (code exists, credentials/infrastructure absent) · `DEFECT`

---

## A. Commerce critical path

| ID | Module | Feature | Current state | Evidence | Business impact | Priority | Dependency | Recommended action |
|---|---|---|---|---|---|---|---|---|
| GAP-001 | Payments | Razorpay enabled on the INR region | **BLOCKED** | `region_payment_provider` = 0 rows **[LIVE]** | Cannot take money at all | **P0** | Test-mode Razorpay keys | Set keys, run `pnpm db:setup-payments`, verify `/store/payment-providers` lists razorpay |
| GAP-002 | Payments | End-to-end sandbox purchase | **BLOCKED** | no keys, no provider | No proof the money path works | **P0** | GAP-001 | One complete sandbox purchase with a recorded order id |
| GAP-003 | Payments | Webhook replay safety in practice | **PARTIAL** | custom route only logs; state via Medusa hook | Double-processing risk unknown | **P0** | GAP-001 | Replay the same event twice; assert one payment event |
| GAP-004 | Payments | Stable refund idempotency key | **DEFECT** | `idempotency_key: ...-${Date.now()}` in `admin/orders/[id]/actions` | Double refund | **P1** | — | Derive key from `(orderId, paymentId, amount, reason)` |
| GAP-005 | Checkout | Alternative payment rails (COD/EMI) | **MISSING (deliberate)** | removed in code + migration | Lower conversion in India | **P3** | business decision | Do not re-add COD without a forgery-proof verification design |
| GAP-006 | Checkout | Duplicate-submit guard on pay button | **PARTIAL** | relies on Medusa cart completion | Double-click could double-call complete | **P2** | GAP-001 | Disable button + idempotency key on `completeCart` |
| GAP-007 | Checkout | Courier serviceability check at address step | **MISSING** | only PIN existence is checked | Delivered-to-unserviceable risk | **P2** | Shiprocket | Query serviceability API after PIN validation |
| GAP-008 | Checkout | Weight/value-based shipping rates | **MISSING** | only flat ₹0 and ₹199 options | Margin leakage | **P2** | business pricing | Add Medusa shipping options/rules |

## B. Storefront experience

| ID | Module | Feature | Current state | Evidence | Impact | Priority | Dependency | Action |
|---|---|---|---|---|---|---|---|---|
| GAP-010 | Catalogue | Server-side pagination / infinite scroll | **MISSING** | `fetchProducts` default `limit: 24`; filters run client-side | Catalogue beyond page 1 is invisible to filters | **P1** | — | Move filtering/sorting/paging to a paginated store API query |
| GAP-011 | Catalogue | Unified category model | **PARTIAL** | `lib/catalog.ts` metadata heuristics vs real `product_category` | Same product in different categories by entry point | **P1** | — | Drive tabs from `/store/categories` everywhere |
| GAP-012 | Catalogue | Availability (in-stock) filter | **MISSING** | no facet exists; stock hidden by store API | Cannot shop "available only" | **P2** | stock route | Add facet using `POST /store/catalog/stock` |
| GAP-013 | Homepage | CMS-driven brand pavilion | **DEFECT** | hardcoded `BRANDS` with invented counts in `app/page.tsx` | Ops cannot change it; published numbers unverifiable | **P1** | — | Fetch `/store/brands` + real counts |
| GAP-014 | Homepage | Honest stock label | **DEFECT** | "In Stock →" rendered for every card | Misleading availability claim | **P2** | stock route | Render only when known available |
| GAP-015 | Homepage | Banner slots consumed | **PARTIAL** | `/store/content/home` works; homepage ignores it | Banners seeded but unused | **P2** | — | Render `BannerSlot` data |
| GAP-016 | PDP | Multi-image gallery | **MISSING** | only `product.thumbnail` rendered | Premium perception; can't show detail | **P1** | seed data | Render `product.images`; seed multiple photos |
| GAP-017 | PDP | Related products | **MISSING** | none | AOV loss | **P2** | — | Same-category/brand recommendations |
| GAP-018 | PDP | Product reviews & ratings | **MISSING** | no model/route/UI | Trust & conversion | **P1** | new model | Verified-purchase-only reviews with moderation |
| GAP-019 | PDP | Colour/variant beyond size | **MISSING** | size-only options | Can't sell colourways | **P2** | catalogue model | Add colour option + images |
| GAP-020 | PDP | Discount / compare-at display | **MISSING** | no strike-through price | Promotions invisible on PDP | **P2** | — | Surface Medusa price lists |
| GAP-021 | PDP | SEO metadata (description, OG, canonical) | **PARTIAL** | `generateMetadata` returns title only | Search/social visibility | **P2** | — | Add description/OG/canonical + JSON-LD |
| GAP-022 | Catalogue | Size guide inline on PDP | **PARTIAL** | separate `/size-guide` + fit widget | Friction | **P3** | — | Inline link per product |
| GAP-023 | Storefront | Design-token gallery route `/design` public | **DEFECT (minor)** | exists in both apps | Unintended public surface | **P3** | — | Remove from production build or gate it |

## C. Account & identity

| ID | Module | Feature | Current state | Impact | Priority | Dependency | Action |
|---|---|---|---|---|---|---|---|
| GAP-030 | Auth | Email delivery for verification/reset | **BLOCKED** | No OTP/reset emails reach customers | **P0** | Resend key | Configure Resend + verified sending domain |
| GAP-031 | Auth | SMS OTP | **BLOCKED** | Indian mobile verification unavailable | **P1** | DLT + MSG91/Twilio | Register DLT template, set provider keys |
| GAP-032 | Auth | Staff MFA | **MISSING** | Admin compromise risk | **P1** | — | TOTP for owner/manager roles |
| GAP-033 | Auth | Session revocation / active session list | **MISSING** | Logout leaves JWT valid until expiry | **P2** | — | Add token denylist or short TTL + refresh |
| GAP-034 | Account | Order/address/return self-service | **IMPLEMENTED** | — | — | — | Verify with a real account |
| GAP-035 | Account | Loyalty / membership | **MISSING** | Retention | **P3** | new models | Defer |

## D. Admin, RBAC, operations

| ID | Module | Feature | Current state | Evidence | Impact | Priority | Action |
|---|---|---|---|---|---|---|---|
| GAP-040 | RBAC | Default role fallback | **DEFECT (High)** | `metadata.role ?? "owner"` in backend + admin | Any role-less staff becomes owner | **P0** | Default to no-role → 403; require explicit assignment |
| GAP-041 | Inventory | Atomic stock adjustment | **DEFECT** | read-then-write in `admin/inventory` | Silent stock drift | **P1** | `SELECT … FOR UPDATE` inside the transaction |
| GAP-042 | Inventory | Multi-location operations | **PARTIAL** | `stock_location.first()` in fulfil + restock | Wrong-location fulfilment/restock | **P2** | Choose/assign location per shipment |
| GAP-043 | Inventory | Stock movement ledger | **MISSING** | audit log only | No ageing/reconciliation/transfers | **P1** | New `stock_movement` table written by every mutation |
| GAP-044 | Inventory | Per-product reorder points | **PARTIAL** | hardcoded `available ≤ 3` | Wrong low-stock alerts | **P2** | Store threshold per variant |
| GAP-045 | Orders | Bulk actions | **MISSING** | per-order only | Ops inefficiency at volume | **P2** | Batch capture/fulfil |
| GAP-046 | Admin | Date filters on lists & reports | **MISSING** | fixed ranges | No period reporting | **P1** | Add range params to admin queries |
| GAP-047 | Admin | Audit coverage for price/publish/promotion/media/customer-flag | **PARTIAL** | no `writeAudit` in those actions | Weak accountability | **P2** | Add audit rows |
| GAP-048 | Admin | Admin app security headers | **MISSING** | only storefront has CSP/HSTS | Admin XSS exposure | **P1** | Mirror storefront headers |
| GAP-049 | Admin | Admin UI verified end-to-end | **NOT VERIFIED** | server not running, no credentials | Unknown state | **P1** | Run a staff-role walkthrough with test accounts |

## E. Returns, refunds, after-sales

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-050 | Returns | Full RMA lifecycle exercised | **PARTIAL** | Unknown reliability | **P1** | Sandbox run: request→approve→receive→refund |
| GAP-051 | Returns | Reverse pickup | **BLOCKED** | No pickup booked | **P1** | Shiprocket credentials + correct pickup address |
| GAP-052 | Returns | Credit note document | **MISSING** | GST/accounting gap | **P1** | Generate GST credit note on refund |
| GAP-053 | Returns | Exchange flow | **MISSING** | Customer friction | **P2** | Exchange as replacement order |
| GAP-054 | Returns | Unique RMA numbering | **DEFECT (Low)** | diff --count collision | **P2** | Use a Postgres sequence |
| GAP-055 | Returns | Retry on RMA collision | **MISSING** | 500 on race | **P3** | Retry/backoff |

## F. Logistics

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-060 | Shipping | Shiprocket credentials + live AWB | **BLOCKED** | No tracking possible | **P0** | Set credentials, create a sandbox shipment |
| GAP-061 | Shipping | Correct return-destination block | **DEFECT** | hardcoded Ahmedabad/380054/9999999999 in `shiprocket.ts` | Wrong pickup destination | **P1** | Make it env/config driven |
| GAP-062 | Shipping | Shiprocket webhook HMAC or IP allowlist | **PARTIAL** | static query token | Webhook spoofing | **P1** | Add IP allowlist or HMAC per provider docs |
| GAP-063 | Shipping | Label/pickup scheduling from admin | **PARTIAL** | label_url stored, not generated on demand | Manual work | **P2** | Add label + pickup endpoints |
| GAP-064 | Shipping | RTO and failed-delivery handling | **PARTIAL** | status `rto` mapped; no workflow | Stock/refund ambiguity | **P2** | Define RTO disposition |
| GAP-065 | Shipping | Courier cost capture | **MISSING** | no expense data | No shipping P&L | **P2** | Record charged freight per shipment |

## G. Retail back office (missing domain)

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-070 | Purchasing | Supplier records | **MISSING** | Cannot manage vendors | **P1** | New `supplier` model + admin CRUD |
| GAP-071 | Purchasing | Purchase orders & GRN | **MISSING** | No controlled inbound stock | **P1** | PO + GRN + receive-to-inventory |
| GAP-072 | Costing | Purchase/landed cost per variant | **MISSING** | No margin possible | **P1** | Cost field per variant + FX/duty |
| GAP-073 | Finance | Margin & profitability report | **MISSING** | Blind pricing | **P1** | Depends on GAP-072 |
| GAP-074 | Finance | Inventory valuation | **MISSING** | Balance-sheet gap | **P1** | Depends on GAP-072 |
| GAP-075 | Finance | Gateway settlement reconciliation | **MISSING** | Unreconciled cash | **P1** | Import Razorpay settlements, match to payments |
| GAP-076 | Finance | GST output report / GSTR-ready export | **MISSING** | Compliance workload | **P1** | Aggregate tax lines by rate/state |
| GAP-077 | Finance | Daily reconciliation view | **MISSING** | Control gap | **P2** | Sales vs captured vs settled |
| GAP-078 | Compliance | Real GSTIN/CIN/grievance values | **MISSING** | Placeholders on site | **P0** | Set `BUSINESS_*`, `GRIEVANCE_OFFICER_*` |
| GAP-079 | Compliance | Country-of-origin data per product | **PARTIAL** | defaults to "India" | Legal Metrology risk | **P1** | Require the field on product create |

## H. Bespoke tailoring

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-080 | Bespoke | Consultation booking | **MISSING** | No lead capture for MTM | **P1** | Booking model + slots |
| GAP-081 | Bespoke | Persistent measurement profile + revisions | **PARTIAL** | per-line snapshots only | Repeat-customer friction | **P1** | Customer-level profile with version history |
| GAP-082 | Bespoke | Fabric catalogue | **MISSING** | Cannot sell fabric choice | **P1** | Fabric entity + swatches + availability |
| GAP-083 | Bespoke | Quote → customer approval | **MISSING** | No priced bespoke offer | **P1** | Quote entity + approval state |
| GAP-084 | Bespoke | Production job card & tailor assignment | **PARTIAL** | printable sheet + 5 stages | Atelier can't be scheduled | **P2** | Job card entity, assignee, due date |
| GAP-085 | Bespoke | Fittings & alterations | **MISSING** | Core MTM service step | **P2** | Appointment + alteration records |
| GAP-086 | Bespoke | Garment QC record | **PARTIAL** | `qc_passed` flag only | No evidence trail | **P2** | QC checklist entity |

## I. Resale & authentication

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-090 | Resale | Consignment intake workflow | **MISSING** | Items cannot be received | **P1** | Intake entity + status machine |
| GAP-091 | Resale | Ownership declaration & terms acceptance | **MISSING** | Legal exposure | **P1** | Signed declaration record |
| GAP-092 | Resale | Authentication tied to intake/ask | **PARTIAL** | inspections exist but not linked to an ask | Cannot prove this listed item was inspected | **P1** | FK inspection → ask/intake |
| GAP-093 | Resale | Consignor settlement ledger | **MISSING** | Sellers are never paid by the system | **P1** | Settlement entity + payout status |
| GAP-094 | Resale | Bank/payout details (DPDP-safe) | **MISSING** | Cannot transfer money | **P1** | Tokenised payout account |
| GAP-095 | Resale | Bid → order conversion | **MISSING** | Bids never become sales | **P2** | Accept-bid workflow creating an order |
| GAP-096 | Resale | Authentication dispute flow | **MISSING** | Trust failure handling | **P2** | Dispute case + resolution |
| GAP-097 | Resale | Resale-specific return policy | **PARTIAL** | generic RMA | Policy ambiguity | **P2** | Rules per item type |

## J. CRM, support, marketing

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-100 | Support | SLA, assignment, categories | **PARTIAL** | Inbox without ownership | **P2** | Assignee + SLA timer |
| GAP-101 | CRM | Marketing consent & unsubscribe | **MISSING** | Non-compliant outreach | **P1** | Consent records + unsubscribe |
| GAP-102 | CRM | Communication history | **MISSING** | Support can't see what was sent | **P2** | Log email/WhatsApp per customer |
| GAP-103 | CRM | Segmentation | **MISSING** | No targeting | **P3** | Defer |
| GAP-104 | CRM | Customer risk surface | **PARTIAL** | flag exists, limited display | **P3** | Extend |

## K. Platform, security, DevOps

| ID | Module | Feature | Current state | Evidence | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-110 | Build | Lint gate green | **DEFECT** | 15 errors in `.audit/*.mjs` | **P0** | Add ignore for `.audit/` |
| GAP-111 | Deploy | Hosting, domain, TLS, secrets | **MISSING** | no Dockerfile/IaC/deploy job | **P0** | Choose host; containerise; secret store |
| GAP-112 | Deploy | Backups & restore drill | **MISSING** | none | **P0** | Automated dumps + tested restore |
| GAP-113 | Observability | Error monitoring & alerting | **MISSING** | no Sentry, no alerts | **P1** | Sentry + uptime checks |
| GAP-114 | Infra | Redis for queues/events/limits | **MISSING (config exists)** | in-memory modules | **P1** | Provision Redis, set `REDIS_URL` |
| GAP-115 | Infra | Durable object storage for uploads | **PARTIAL** | local `uploads/` | **P1** | S3-compatible bucket |
| GAP-116 | Security | Production secret assertions | **MISSING** | dev defaults in code | **P1** | Fail-fast on missing prod secrets |
| GAP-117 | Security | Rate limits on AI/support/resale writes | **MISSING** | only auth+OTP limited | **P2** | Add limiter |
| GAP-118 | Security | Dependency vulnerability scanning | **MISSING** | no audit step | **P1** | `pnpm audit` + Dependabot |
| GAP-119 | Data | Remove audit fixtures from dev/staging DBs | **DEFECT** | 36 `Audit Brand` rows | **P2** | Cleanup script + fresh seed |
| GAP-120 | Analytics | Product/funnel analytics | **MISSING** | none | **P2** | Add event pipeline |
| GAP-121 | Tooling | Production build verified | **NOT VERIFIED** | not run in this audit | **P1** | Run in CI/worktree |
| GAP-122 | Process | Archive stale root audit reports | **DEFECT (process)** | 40 contradictory `.md` files | **P3** | Move to `docs/archive/` |

<!-- ===== END 13_MISSING_FEATURES_AND_GAP_REGISTER.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 14_FINAL_PRODUCTION_READINESS.md ===== -->

# 14 — FINAL PRODUCTION READINESS

## 1. Readiness ratings

Scale: **READY** · **CONDITIONALLY READY** · **NOT READY** · **NOT VERIFIED** · **NOT APPLICABLE**.

| Area | Rating | Basis |
|---|---|---|
| **Storefront** | **CONDITIONALLY READY** | 14 routes return 200, real data, honest error/404 states, polished PDP with legal declarations. Blocked by checkout and by missing gallery/reviews/pagination. |
| **Backend (API)** | **CONDITIONALLY READY** | 50 custom routes + Medusa core; consistent error shapes; server-side auth on every protected path (401 verified). One high-severity RBAC default, one refund idempotency defect, no route-level tests. |
| **Database** | **READY (design) / PARTIAL (operations)** | 171 tables, correct ownership boundary, append-only audit trigger, unique constraints on the idempotency-critical tables. Not ready for warehouse ops (no stock ledger, no cost basis). |
| **Admin** | **NOT VERIFIED** | Complete set of 19 modules exists in code; the app was not running and no staff credentials exist. Cannot be called ready without a single walked-through session. |
| **Payments** | **NOT READY** | No provider linked to the region; no keys; checkout cannot complete. |
| **Inventory** | **CONDITIONALLY READY** | Framework-managed reservations correct by configuration; adjustment race, single-location assumptions, no ledger. |
| **Logistics** | **NOT READY** | No credentials; a real client exists but has never been validated against the provider; hardcoded return destination. |
| **Customer experience** | **CONDITIONALLY READY** | Broad, coherent account area (orders, returns, invoices, wishlist, bids, asks, data export/deletion). Missing reviews, gallery, and any post-purchase notification that actually sends. |
| **Security** | **CONDITIONALLY READY** | Strong foundations (httpOnly cookies, CSP, server RBAC, timing-safe webhooks, rate limits, append-only audit). Defeated in practice by the default-owner fallback until fixed. |
| **Infrastructure** | **NOT READY** | No hosting, no CI/CD deploy, no backups, no monitoring, no Redis, no object storage. |
| **Retail operations** | **NOT READY** | Selling is nearly there; buying, costing and replenishing do not exist. |
| **Tailoring** | **NOT READY** | Capture + stage tracker + tailor sheet exist; consultation, quoting, fabric, approvals, job cards, fittings, alterations do not. |
| **Resale & authentication** | **NOT READY** | Authentication records are real; intake, settlement and dispute handling are absent. |
| **Overall production readiness** | **NOT READY** | Payments, logistics, email and infrastructure are all off. |

## 2. Direct answers to the sixteen questions

**1. What exactly has been built?**
A three-application monorepo: a Medusa 2.22.7 commerce backend with 19 project-owned tables and 50 custom routes; a Next.js 16 storefront with the full browse→account→cart→checkout→returns surface; a custom Next.js admin with 19 operational modules; two shared packages; a design system; CI definitions; and an extensive specification pack.

**2. What actually works?**
Verified this session: catalogue reads, categories, brands, search suggestions, banner content, resale activity, stock endpoint, PDP rendering, static/CMS pages, service health, typecheck, and all 70 unit tests. Server-side authorisation refuses unauthenticated admin/store access (401).

**3. What works only partially?**
Returns lifecycle, admin reporting, search, catalogue filtering, product media (admin can upload, PDP shows one image), support, promotions, RSVP-style resale (orderbook works, settlement does not), and the entire preview of the admin UI.

**4. What is present but untested?**
Razorpay provider, Shiprocket client, Resend/SMS/WhatsApp senders, reverse pickup, refunds, order capture/fulfil/cancel, inspection approvals, bulk product actions, CSV exports, the daily report job, Gemini concierge.

**5. What is mocked or hardcoded?**
No mocked backend and no fabricated prices in the product path — genuinely. Hardcoded: homepage brand cards and counts, "In Stock" label, return-destination block in Shiprocket, low-stock threshold `3`, 9.5% consignment fee, GST slab table (seeded, legitimate), design-token pages.

**6. What is completely missing?**
Payments enablement, email/SMS/WhatsApp delivery, Shiprocket connectivity, product reviews, image gallery, related products, pagination, suppliers/purchase orders/costs, consignment intake & settlement, measurement profiles, fabric catalogue, quotations, fittings, credit notes, GST reports, reconciliation, backups, monitoring, deployment.

**7. What is broken?**
`pnpm lint` gate; default-owner RBAC; refund idempotency; inventory adjustment race; RMA numbering race; concierge thread ownership; homepage brand claims; “In Stock” claim; catalogue page-cap.

**8. What security risks exist?**
Default-owner role (High); refund double-processing (High); inventory lost update (Medium); unowned concierge threads (Medium); static-token shipping webhook (Medium); unthrottled AI/support/resale writes (Medium); dev-secret defaults (Medium); admin app without security headers (Medium); missing staff MFA (Low/Medium); no dependency scanning (Low).

**9. What prevents production launch?**
In order: payment provider not enabled; no hosting/backups/monitoring; no email; no logistics; lint gate red; RBAC default; missing legal entity values (GSTIN/grievance officer).

**10. What is needed to operate a real business?**
A tested payment + logistics + email path; purchasing and cost data for margin; GST reporting and credit notes; a real RMA and reconciliation routine; consignment settlement if resale is in scope; legal review of policies and declarations; a staff runbook.

**11. Which features should not be built yet?**
Loyalty/membership, segmentation, marketplace payouts for third-party sellers, bidding if the business model settles on fixed-price, a mobile app, advanced AI features, and any "guarantee/escrow/KYC" claim before the enforcement exists.

**12. What should be fixed first?**
(1) Enable Razorpay in test mode and prove one purchase; (2) fix the lint gate; (3) fix the default-owner fallback; (4) fix refund idempotency and the inventory race; (5) configure Resend.

**13. What can safely wait?**
Reviews, gallery, related products, SEO depth, analytics, loyalty, exchanges, multi-location, RTO workflow, design-token page removal, report polish.

**14. What should the next development phase contain?**
"Prove the money path, then close the operational loop": payments + email + logistics in sandbox, full RMA, a staff walkthrough of admin, then purchasing/costing so margin exists. See `15_RECOMMENDED_IMPLEMENTATION_ROADMAP.md`.

## 3. Competitor capability benchmark

Mapping against the five named models. Classification: 1 implemented+verified · 2 implemented unverified · 3 partial · 4 missing · 5 not required by this model · 6 future.

| Capability | vs Culture Circle | vs StockX | vs FARFETCH | vs The RealReal | vs Tata CLiQ Luxury | Class |
|---|---|---|---|---|---|---|
| Multi-brand luxury discovery | core | core | core | core | core | **2** — brands, categories, CMS, PDP |
| Fixed-price catalogue | core | — | core | core | core | **1** |
| Size-specific pricing | core | core | — | — | — | **3** (per-variant prices, no market pricing display beyond ask) |
| Price comparison vs other retailers | core claim | — | — | — | — | **4** — deliberately removed after a fabricated-price incident, correctly |
| Bid/ask orderbook | not offered | core | — | — | — | **2** — implemented, bidding not StockX-grade (no matching, no expiry engine, no seller fulfilment SLA) |
| Authentication / verification | core | core | — | core | — | **2** — real records + public certificates, not tied to intake |
| Consignment intake & grading | core | seller ships | — | core | — | **4** intake · **2** grading |
| Seller settlement | core | core | — | core | — | **4** |
| Boutique/partner fulfilment | — | — | core | — | partial | **5** not required (single retailer) |
| White-glove customer service | core | — | core | core | core | **3** — support inbox without SLA |
| Express domestic delivery with tracking | core | core | core | core | core | **3** — code complete, provider unconfigured |
| Returns & exchanges | core | limited | core | core | core | **3** returns · **4** exchanges |
| Editorial / content commerce | partial | — | core | — | — | **3** — CMS exists, homepage not CMS-driven |
| Mobile app | core | core | core | core | core | **4 / 6** |
| Loyalty & membership | partial | — | core | — | core | **4 / 6** |
| Bespoke / made-to-measure | — | — | — | — | — | **3** — differentiator, partially built |

**Business-value notes (why each missing capability matters):**
- **Price comparison** was removed because the previous implementation invented competitor prices. Rebuilding it requires a real data source; without one, its absence is *correct*.
- **Seller settlement** is the single capability that turns the resale module from a demo into a business. Without it, consignors list and are never paid.
- **Reviews** are the cheapest trust lever available and currently absent entirely.
- **Boutique partner fulfilment** (FARFETCH) is not required: this is a single retailer, not a marketplace of boutiques.
- **Mobile app** should not be started before the web path is proven.

## 4. Contradictions with prior reports

| Prior claim | Location | Measured reality |
|---|---|---|
| "typecheck and lint are 100% clean" | `docs/BUILD_LOG.md` | typecheck clean; **lint fails (15 errors)** |
| "51 tests passing" / "70/70" | `docs/BUILD_LOG.md`, `CURRENT_PROJECT_STATUS.md` | 70/70 confirmed — both counts appear in the docs at different times |
| "storefront verified end-to-end" | `docs/BUILD_LOG.md` | browse paths verified; **checkout cannot complete here** |
| "P7 edge cases: race conditions and stock reservation protection confirmed" | `docs/BUILD_LOG.md` | **not reproduced**; oversell scenario not run; two real concurrency defects found instead |
| "Razorpay HMAC verified" | several | HMAC *unit* tests exist; no live or sandbox transaction ever completed in this environment |
| "Phase 9 production deployment — not started" | `docs/BUILD_LOG.md` | **accurate** |

<!-- ===== END 14_FINAL_PRODUCTION_READINESS.md ===== -->

<div style="page-break-after: always;"></div>

---

<!-- ===== BEGIN 15_RECOMMENDED_IMPLEMENTATION_ROADMAP.md ===== -->

# 15 — RECOMMENDED IMPLEMENTATION ROADMAP

**Constraint for this document:** the roadmap is a recommendation only. Nothing in it has been implemented; the audit changed no source files, no schema, no dependency and no configuration.

**Sequencing principle:** *prove money moves, then make operations real, then make merchandising better.* Do not start new feature domains (loyalty, marketplace, mobile) until a paid order has been fulfilled, returned and refunded end-to-end.

---

## Phase A — Unblock and stabilise (should already have been done; ~1 week)

Goal: a green release gate and no known high-severity defects.

| # | Task | Files | Done when |
|---|---|---|---|
| A1 | Enable Razorpay in **test mode** and link it to the INR region | `apps/backend/.env`, `apps/storefront/.env.local`, `pnpm db:setup-payments` | `GET /store/payment-providers?region_id=<inr>` lists `pp_razorpay_razorpay` |
| A2 | Fix the lint gate | `eslint.config.mjs` (ignore `.audit/**`, or move scripts out of lint scope) | `pnpm lint` exits 0 |
| A3 | Fix default-owner role | `apps/backend/src/lib/admin-auth.ts`, `apps/admin/lib/api/auth.ts` | A user without `metadata.role` gets 403, never owner |
| A4 | Stable refund idempotency key | `apps/backend/src/api/admin/orders/[id]/actions/route.ts` | Same refund request twice ⇒ one refund |
| A5 | Atomic inventory adjustment | `apps/backend/src/api/admin/inventory/route.ts` | Concurrent +1/−1 leaves a correct level |
| A6 | RMA numbering via sequence | new migration + `store/return-requests/route.ts` | No collision under concurrency |
| A7 | Concierge thread ownership check | `store/concierge/chat/route.ts` | A different session cannot append to a thread |
| A8 | Deterministic verification: run one sandbox purchase | — | A recorded order id, a captured payment, and an order confirmation email (A9) |
| A9 | Configure Resend + verified sender domain | `apps/backend/.env` | Verification, reset, order and RMA emails actually arrive |

**Exit criteria:** `typecheck`, `lint`, `test` green; one complete sandbox purchase; no High finding open.

---

## Phase B — Close the commerce loop (2–4 weeks)

Goal: a real customer can buy, receive, track, and return — with every step evidenced.

| # | Task | Depends on |
|---|---|---|
| B1 | Shiprocket credentials + one sandbox AWB + webhook transition to `delivered` | A8 |
| B2 | Replace hardcoded return destination in `lib/shiprocket.ts` with env config | B1 |
| B3 | Harden the Shiprocket webhook (IP allowlist or HMAC per current docs) | B1 |
| B4 | Full RMA run: request → approve(with reverse pickup) → receive(condition) → refund → credit note | B1 |
| B5 | GST credit-note document + numbering | B4 |
| B6 | Refund reconciliation view (payment ↔ refund ↔ settlement CSV import) | A8 |
| B7 | Courier cost capture per shipment | B1 |
| B8 | Duplicate-submit guard on the pay button | A1 |
| B9 | Staff walkthrough of every admin module with four role accounts (owner/manager/operations/support + readonly denial) | A3 |
| B10 | Set `BUSINESS_GSTIN`, `BUSINESS_CIN`, `GRIEVANCE_OFFICER_*`, `SUPPORT_*` | — |

**Exit criteria:** a second sandbox purchase is delivered, tracked, returned and refunded; every step has an audit row; a credit note exists; role boundaries were demonstrated, not asserted.

---

## Phase C — Production infrastructure (2–3 weeks, parallel to B)

| # | Task |
|---|---|
| C1 | Containerise backend/storefront/admin (three Dockerfiles) |
| C2 | Provision managed PostgreSQL + Redis; set `REDIS_URL`, `DB_POOL_*` per replica |
| C3 | Object storage for uploads (S3-compatible) and remove local `uploads/` |
| C4 | Secret store + fail-fast startup assertions (no `local_dev_*` fallback in production) |
| C5 | Error monitoring (Sentry or equivalent) + structured logs + uptime alerting |
| C6 | Automated backups + a **rehearsed** restore |
| C7 | Deploy pipeline with staging and one-command rollback |
| C8 | Admin app security headers to match the storefront |
| C9 | `pnpm audit` + Dependabot in CI; pin Actions by SHA |
| C10 | Staging dataset: fresh seed with **no audit fixtures** |

**Exit criteria:** staging deploys from `main` on merge; a deliberately broken release is rolled back; a backup is restored into a scratch database.

---

## Phase D — Storefront quality that pays for itself (2–3 weeks)

| # | Task | Why first |
|---|---|---|
| D1 | Server-side pagination + filtering | The catalogue silently caps at 24 today |
| D2 | Unify category model (real `product_category` everywhere) | Consistency between menu and catalogue |
| D3 | Product image gallery + multi-image seed | Core premium-retail expectation |
| D4 | Product reviews (verified purchase, moderated) | Cheapest trust lever |
| D5 | CMS-driven homepage (brands, banners) | Removes a deploy to change the homepage |
| D6 | Honest availability labels + in-stock facet | Removes a false claim |
| D7 | PDP SEO: description, OG, canonical, JSON-LD | Discoverability |
| D8 | Related products / complete-the-look | AOV |

---

## Phase E — Retail back office (4–6 weeks)

| # | Task | Why |
|---|---|---|
| E1 | Supplier records | Foundation for purchasing |
| E2 | Purchase orders + goods-received notes | Controlled inbound stock |
| E3 | Purchase/landed cost per variant | Enables margin and valuation |
| E4 | Stock movement ledger | Ageing, transfers, reconciliation |
| E5 | Margin / profitability report | Pricing decisions |
| E6 | Inventory valuation | Balance sheet |
| E7 | GST output report (rate × state) | Compliance workload |
| E8 | Multi-location operations | Only when a second location exists |

---

## Phase F — Bespoke atelier (4–6 weeks)

Consultation booking → measurement profile with revisions → fabric catalogue → structured customisation → quote → customer approval → job card + tailor assignment → production milestones (already partly built) → fitting → alteration → garment QC → delivery.

Sequence: F1 measurement profile → F2 quote/approval → F3 fabric catalogue → F4 job cards → F5 fittings/alterations.

---

## Phase G — Resale & authentication completion (4–6 weeks)

Intake → ownership declaration → intake reference → authentication (already built) linked to the intake → price/terms acceptance → listing → sale → settlement ledger → payout → dispute handling.

Sequence: G1 intake & declaration → G2 link inspections to asks → G3 settlement ledger → G4 payout details (DPDP-compliant) → G5 disputes → G6 bid→order conversion **only if the business model keeps bidding**.

---

## Phase H — Deferred / explicitly not now

Loyalty & membership · customer segmentation · marketplace third-party sellers · mobile app · advanced AI merchandising · price comparison against named retailers (requires a real data source; the previous implementation invented numbers and was correctly removed) · subscription/repeat-purchase programme.

---

## Ordering rationale

1. **Every phase before D produces or protects revenue; every phase after D improves it.**
2. **A and B are sequential** because logistics verification needs a real order, and a real order needs payments.
3. **C runs in parallel with B** and must finish before any public traffic.
4. **E precedes G**: you cannot settle a consignor fairly without knowing cost and margin.
5. **F and G are differentiators** and should not start until the core retail loop is proven — otherwise the project accumulates partially built domains, which is exactly the pattern the previous rounds exhibited.

---

## Definition of "launch ready" (proposed)

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green in CI on `main`
- [ ] One real (test-mode) purchase completed, fulfilled, delivered, returned and refunded with audit rows for each step
- [ ] Duplicate payment webhook proved idempotent
- [ ] No High/Critical security finding open
- [ ] Staging deploy + rollback demonstrated; backup restored
- [ ] All integration credentials configured and one successful call observed per provider
- [ ] Legal values filled (GSTIN, CIN, grievance officer, support contacts) and policies reviewed by counsel
- [ ] Admin walkthrough recorded for all four roles
- [ ] Monitoring and alerting live; on-call contact documented

<!-- ===== END 15_RECOMMENDED_IMPLEMENTATION_ROADMAP.md ===== -->

<div style="page-break-after: always;"></div>

---

_End of combined audit report — 16 sections (00–15), merged 20 November 2026._
