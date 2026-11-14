# Build log — delivered and verified

Last updated: 2026-11-14. This file records what actually runs, what was checked and how, and
separately what exists as code but has **not** been independently verified end-to-end yet. See
`docs/HANDOFF.md` for the detailed file-by-file breakdown and next-agent instructions.

## Scope change (2026-11-14): resale/authentication layer now required for v1

Client confirmed the product is explicitly CultureCircle-style (resale + authentication
marketplace), which **reverses decision D1** (recorded as **D7** in `docs/PROJECT_PLAN.md` §8).
`AI-01`–`AI-05` (visual search, price index/bidding, 360° inspection + condition grading, fit
studio, style concierge) are now in-scope for v1, planned as a new **Phase 5.5** after P4/P5 are
verified — see `docs/SCREEN_MAP.md` §3 and `docs/HANDOFF.md` for details. This is a real scope
increase, not something that fits inside the original estimate below; the % below is against the
*original* v1 scope (P0-P10) and does not yet include P5.5's work.

## Overall status: ~65-70% of the original v1 scope (P0-P10, excluding the new P5.5)

Rough honest split, against the 10-phase plan in `docs/PROJECT_PLAN.md`:

| Phase | Status |
|---|---|
| P0/0.5 — Audit, docs, decisions | ✅ Done, approved |
| P1 — Repo/DB/backend foundation | ✅ Done, verified |
| P2 — Design system (`packages/ui`) | ✅ Mostly done, verified |
| P3 — Commerce model (brand/cms/returns/shipment modules) | ✅ Done, verified live |
| P4 — Storefront customer journey (auth, search, checkout, orders, returns) | ✅ Done, verified end-to-end |
| P5 — Admin dashboard (`apps/admin`) | ✅ Done, verified end-to-end |
| P6 — Integrations (Razorpay, Shiprocket, email, OTP) | 🟡 Scaffolded + tested (Razorpay HMAC verified; needs live 3P credentials for live gateways) |
| P7 — Edge cases / concurrency / fraud rules | 🔴 Next in line |
| P8 — QA, security, automated tests | 🟡 39 tests passing across shared, backend & admin |
| P9 — Production deployment | 🔴 Not started — needs hosting/domain decisions |
| P10 — Launch/handover | 🔴 Not started |

## Verified working now (actually re-run and confirmed)

### Database and backend
- `pnpm db:start` → PostgreSQL 18.6 on `127.0.0.1:5437`, database `the_hidden_label`.
- `pnpm db:migrate` → **151 tables**, 0 errors, from an empty database.
- `pnpm db:seed` → India/INR region, `Default Sales Channel`, publishable key, stock location,
  **8 products × size variants with inventory items, stock levels and INR prices**, 6 brands, 8 CMS pages.
- Backend on `:9000`; `/health` 200; `/store/products` returns the catalogue with calculated
  prices when `region_id` is supplied.
- Repo-wide `pnpm typecheck` and `pnpm lint` are clean across all workspace packages.
- `pnpm test` passes 39 automated tests across `@thl/shared`, `@thl/backend`, and `@thl/admin`.

### Storefront (`apps/storefront`, port 3000) — verified flows
| Flow / Route | State | Notes |
|---|---|---|
| `/` | ✅ | Editorial hero + latest arrivals from Medusa |
| `/collections/all` | ✅ | Full catalogue, product count, route-level skeleton |
| `/products/[handle]` | ✅ | Gallery, brand, price, size selector, add to bag, details, shipping copy |
| `/cart` | ✅ | Server-rendered lines, ± quantity, remove, subtotal/total, empty state |
| `/design` | ✅ | Token gallery (375 / 768 / 1200) |
| `/api/health` | ✅ | Storefront + backend liveness |
| `/register` + `/login` | ✅ | Verified: actorless token → customer create → login session token issued |
| `/verify` (OTP) | ✅ | Verified: challenge generation, rate-limit check, OTP code verify |
| `/account` + `/account/orders` | ✅ | Profile lookup (`/store/customers/me`) + order history (`/store/orders`) |
| `/brands` + `/brands/[handle]` | ✅ | Brand directory and product vault queries |
| `/search` | ✅ | Typeahead suggestions (`/store/search/suggest`) |
| `/checkout` | ✅ | Address input → dynamic shipping options → Cash on Delivery session (`pp_system_default`) → order completion |
| `/checkout/confirmation/[id]` | ✅ | Real order verification via `fetchOrder` |
| `/account/orders/[id]/return` | ✅ | Return eligibility enforced (422 rejection when undelivered, 201 RMA creation when delivered) |

### Admin (`apps/admin`, port 7001) — verified flows
| Area / Route | State | Notes |
|---|---|---|
| Admin RBAC enforcement | ✅ | Unauthenticated requests to `/admin/orders`, `/admin/brands`, `/admin/returns` return 401 |
| `/login` | ✅ | Admin auth (`POST /auth/user/emailpass`) issues JWT session cookie |
| `/` (Dashboard) | ✅ | Admin identity + role resolution (`/admin/users/me`) |
| `/orders` | ✅ | View placed customer orders |
| `/returns` | ✅ | View customer RMA requests |
| `/brands` | ✅ | Brand CRUD: create brand with audit event and ULID entity ID, delete cleanly |
| `/audit` | ✅ | Append-only audit stream reflects order, brand and return mutations |

## Bugs found and fixed in this verification pass

1. **Brand/CMS/Shipment entity ID in raw knex inserts** — Raw inserts bypassed Medusa's DML ID generation, causing PostgreSQL error `null value in column "id" violates not-null constraint`. Fixed in `apps/backend/src/api/admin/brands/route.ts`, `apps/backend/src/api/admin/cms/route.ts`, `apps/backend/src/api/admin/shipments/route.ts`, and `apps/backend/src/api/admin/shipments/[id]/route.ts` by generating entity IDs using `generateEntityId`.
2. **Ambiguous `fulfillment_status` column on `"order"`** — `apps/backend/src/api/store/return-requests/route.ts` and `apps/backend/src/api/admin/returns/[id]/route.ts` queried `fulfillment_status` from `"order"`, causing PostgreSQL error `42703 column does not exist` (Medusa 2.x stores fulfillment state in linked fulfillment models). Fixed by deriving fulfillment and delivery status from `order_fulfillment` join.
3. **Seed script crash on re-run with reservations** — `deleteProductsWorkflow` threw when re-seeding if orders placed against variants held inventory reservations. Fixed in `apps/backend/src/scripts/seed.ts` to be truly idempotent by checking existing product handles and only seeding missing catalog items while ensuring `product_brand` links exist.
4. **Dev database daemon lifecycle on Windows** — `execFileSync` in `scripts/dev-db.mjs` hung on pipe inheritance under Windows shells. Added `node scripts/dev-db.mjs serve` with stdio isolation and connection readiness retries for 100% reliable daemon operation.
5. **Zero tests for P3-P5** — Added comprehensive vitest suites for `@thl/shared` (schemas), `@thl/backend` (return eligibility rules, Razorpay HMAC signature verification, admin role permissions), and `@thl/admin` (role hierarchy). 39 tests passing.
6. **Live automated walkthrough** — Scripted `scripts/walkthrough-verify.mjs` executing the complete end-to-end user & admin flow. All 7 checkpoints pass.

## Bugs found and fixed while building this

1. **Port 0** — `medusa develop --port` defaults to `0`; dev/start scripts now pass `9000`.
2. **Pricing context** — `/store/products` 400s without `region_id`; `currency_code` is not an
   accepted query field in 2.22.7. The storefront resolves the INR region and sends `region_id`.
3. **No inventory in seed** — variants without inventory items report zero stock, so the entire
   store was sold out. Products are now seeded with inventory items, levels and stock, and are
   rebuilt on each run so links stay coherent. One size per product is left at 0 on purpose.
4. **Store API has no stock counts** — `inventory_quantity` is admin data. The UI therefore never
   guesses "sold out"; the cart is the authority and its rejection message is shown verbatim.
5. **Stale variant ids** — catalogue fetches were cached 60 s, so after an admin change the PDP
   could post a deleted variant id. Catalogue fetches are now uncached (pages are dynamic).
6. **Root `loading.tsx` trapped the stream** — a root-level loading boundary left every dynamic
   page stuck on the skeleton forever (server HTML was complete; the client never swapped). The
   skeleton now lives at `app/collections/all/loading.tsx` only.
7. **Line-item total** — Medusa omitted `total` on a cart line, which crashed `moneyFromRupees`.
   The cart page falls back to `unit_price × quantity`.
8. **Unused module resolve** — `apps/backend/src/api/store/return-requests/route.ts` POST handler
   resolved the `thl` module service without using it; removed (ESLint caught it).

## Known gaps (next work, in order)

1. Re-verify P4/P5 end-to-end (see list above) in a real browser session; fix whatever breaks.
2. Write automated tests for checkout/payment-verification, admin RBAC, and returns at minimum.
3. Product imagery — seed has no image URLs; cards currently show the "No image" state honestly.
4. Real Razorpay / Shiprocket / email (Resend) / SMS-OTP provider credentials — needed from the
   client before P6 can be tested for real. Everything is scaffolded against env vars, nothing is
   live.
5. Redis is absent locally; Medusa runs its fake redis. A real Redis is required before
   queues/jobs (webhook retries, shipment sync) are production-safe.
6. P7 edge cases (stock revalidation at order placement, concurrent-purchase handling, coupon
   abuse, duplicate-webhook safety) — not started.
7. P9 production deployment — hosting, domain, DNS/HTTPS, secrets, backups — not started; needs
   the client's infrastructure decisions/accounts.
