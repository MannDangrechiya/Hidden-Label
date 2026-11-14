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

## Overall status: ~40-45% of the original v1 scope (P0-P10, excluding the new P5.5)

Rough honest split, against the 10-phase plan in `docs/PROJECT_PLAN.md`:

| Phase | Status |
|---|---|
| P0/0.5 — Audit, docs, decisions | ✅ Done, approved |
| P1 — Repo/DB/backend foundation | ✅ Done, verified |
| P2 — Design system (`packages/ui`) | ✅ Mostly done, verified |
| P3 — Commerce model (brand/cms/returns/shipment modules) | ✅ Built, verified at API level |
| P4 — Storefront customer journey (auth, search, checkout, orders, returns) | 🟡 Code written, **not yet re-verified end-to-end** |
| P5 — Admin dashboard (`apps/admin`) | 🟡 Code written, **not yet re-verified end-to-end** |
| P6 — Integrations (Razorpay, Shiprocket, email, OTP) | 🔴 Scaffolded only — needs real credentials |
| P7 — Edge cases / concurrency / fraud rules | 🔴 Not started |
| P8 — QA, security, automated tests | 🔴 Not started — zero new tests for P3-P5 work |
| P9 — Production deployment | 🔴 Not started — needs hosting/domain decisions |
| P10 — Launch/handover | 🔴 Not started |

## Verified working now (actually re-run and confirmed)

### Database and backend
- `pnpm db:start` → PostgreSQL 18.6 on `127.0.0.1:5437`, database `the_hidden_label`.
- `pnpm db:migrate` → **151 tables**, 0 errors, from an empty database.
- `pnpm db:seed` → India/INR region, `Default Sales Channel`, publishable key, stock location,
  **3 products × size variants with inventory items, stock levels and INR prices**.
- Backend on `:9000`; `/health` 200; `/store/products` returns the catalogue with calculated
  prices when `region_id` is supplied.
- Repo-wide `pnpm typecheck` and `pnpm lint` are clean across all 7 workspace packages (backend,
  storefront, admin, ui, shared, config, root) as of the latest commit. `pnpm test` passes the
  one existing suite (`packages/shared/src/money.test.ts`, 8 tests) — **no tests exist yet for
  anything in P3-P5** (auth, checkout, payments, admin CRUD, returns).

### Storefront (`apps/storefront`, port 3000) — core pages
| Route | State | Notes |
|---|---|---|
| `/` | ✅ | Editorial hero + latest arrivals from Medusa |
| `/collections/all` | ✅ | Full catalogue, product count, route-level skeleton |
| `/products/[handle]` | ✅ | Gallery, brand, price, size selector, add to bag, details, shipping copy |
| `/cart` | ✅ | Server-rendered lines, ± quantity, remove, subtotal/total, empty state |
| `/design` | ✅ | Token gallery (375 / 768 / 1200) |
| `/api/health` | ✅ | Storefront + backend liveness |

Cart is a **real Medusa cart**: created on first add, id stored in an httpOnly `thl_cart` cookie,
mutations run through server actions, totals come from the backend. Verified end to end in a
browser: add Samba UK 7 → bag (1) → qty + → bag (2), line ₹25,998, total ₹25,998.

Screenshots: `docs/screenshots/g1-live-products.png`, `catalog-live.png`, `cart-live.png`.

## Built but NOT yet independently re-verified (do this before calling it done)

These exist as real code on disk (committed), typecheck/lint clean, but no one has driven them
end-to-end in a browser since they were written. Treat every item below as "probably works,
confirm before shipping":

- **Storefront**: `/login`, `/register`, `/verify` (OTP), `/forgot-password`, `/reset-password`,
  account section (profile, addresses, wishlist, order history, order detail/tracking),
  `/brands` + `/brands/[handle]`, `/search`, full `/checkout` (address → shipping → payment,
  COD path intended to actually complete an order without external credentials), order
  confirmation, return request flow.
- **Admin** (`apps/admin`, new, separate app/auth boundary): login, dashboard, products, brands,
  categories, inventory, orders (+ status actions), customers, payments view, shipments,
  returns, promotions, CMS/banners, reports CSV export, settings/roles, audit log.
- **Backend additions**: Razorpay payment provider module (`src/modules/razorpay/`, dormant
  until real keys are set), password-reset email subscriber, `return-requests` route rename.

**Biggest unverified risk:** whether every `/admin/*` backend route actually rejects a
non-admin/no-token request with 401/403. This must be checked before any admin credential is
shared with a real store manager.

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
