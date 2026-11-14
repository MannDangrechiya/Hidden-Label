# Build log — delivered and verified

Last updated: 2026-11-14. This file records what actually runs, what was checked and how.
Everything below was exercised against the local PostgreSQL + Medusa + Next stack.

## Verified working now

### Database and backend
- `pnpm db:start` → PostgreSQL 18.6 on `127.0.0.1:5437`, database `the_hidden_label`.
- `pnpm db:migrate` → **151 tables**, 0 errors, from an empty database.
- `pnpm db:seed` → India/INR region, `Default Sales Channel`, publishable key, stock location,
  **3 products × size variants with inventory items, stock levels and INR prices**.
- Backend on `:9000`; `/health` 200; `/store/products` returns the catalogue with calculated
  prices when `region_id` is supplied.

### Storefront (`apps/storefront`, port 3000)
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

## Known gaps (next work, in order)

- Product imagery: seed has no image URLs, so cards show the "No image" state honestly.
- Checkout and payment: bag → checkout is disabled with a visible reason until Razorpay is wired.
- Brand module (Phase 3): brands still live in `product.metadata.brand`.
- Admin app (Phase 5): not started.
- Account/OTP, wishlist, RMA, Shiprocket, emails: not started.
- Redis is absent locally; Medusa runs its fake redis. Required before queues/jobs.
