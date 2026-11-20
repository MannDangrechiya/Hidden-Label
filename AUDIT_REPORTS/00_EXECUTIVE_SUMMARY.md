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
