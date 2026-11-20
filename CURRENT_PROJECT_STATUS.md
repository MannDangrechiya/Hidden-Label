# The Hidden Label — Real Project Status (handoff reference)

**Written:** 2026-11-20. **Purpose:** a single, accurate source of truth to hand to another AI
tool or engineer picking this up. The repo root also has 29 older audit `.md` files
(`AUDIT_REPORT.md`, `QA_REPORT.md`, `MASTER_AUDIT_SUMMARY.md`, etc.) — **do not trust those at
face value.** This project has a documented history of a round claiming "100% fixed, production
ready" and a later independent re-check proving it false (`FINAL_RELEASE_READINESS.md` caught
`REMEDIATION_REPORT.md` lying). Everything in this file was verified by one of two methods,
marked explicitly: **(live)** = an actual HTTP request/browser action was run and its result
observed; **(code)** = read and reasoned through, typechecked/linted, but not executed. Treat
"(code)" items with appropriately less confidence than "(live)" ones.

**What this project is:** an Indian omnichannel luxury platform — multi-brand boutique +
in-house bespoke tailoring + resale/authentication marketplace, one retailer, not a seller
marketplace. Monorepo: `apps/backend` (Medusa 2.22.7), `apps/storefront` + `apps/admin`
(Next.js), `packages/shared`/`packages/ui`. Latest commit as of writing: `1772fce`.

---

## 0. Two open product decisions — resolve these before more feature work

1. **The resale bidding/ask/price-index system.** It exists because of one project decision
   (`D7`, `docs/PROJECT_PLAN.md`) that said *"the product vision is explicitly modelled on
   CultureCircle... bidding/ask mechanics are required."* I independently browsed the live
   CultureCircle site this session: **it has no bid/ask orderbook.** It's a fixed-price catalogue
   with size-specific pricing and a price-comparison pitch ("Skyscanner for luxury products").
   An *earlier* doc in this same project (`docs/OMNICHANNEL_MASTER_ARCHITECTURE.md`) had already
   researched this correctly, and D7 overrode that correct research with a mistaken assumption.
   **Decision needed:** keep the StockX-style bidding system as built, or simplify it toward
   what CultureCircle actually does (fixed price + price comparison, no live bids)?
2. **Sneaker-centric branding.** The business is premium wear broadly (multi-brand boutique +
   bespoke tailoring + footwear as one category among several — confirmed in
   `MASTER_BUSINESS_ARCHITECTURE.md`'s own four pillars), but the homepage headline
   ("India's Marketplace for Sneakers & Streetwear"), the catalogue page branding ("The Vault
   Catalogue"), and most of the resale-module copy are sneaker/streetwear-first. **Decision
   needed:** rewrite this copy toward general premium wear, or leave it (not yet started either
   way).

Also already decided and done: **COD and EMI are intentionally removed**, even though both were
in the original written requirements (`docs/MASTER_PLAN.md`, `docs/OMNICHANNEL_MASTER_
ARCHITECTURE.md`). COD was removed for a real security reason (forged OTP verification). This is
a deliberate reversal, not a gap — don't "fix" it back without asking.

---

## 1. Verified working end-to-end (live-tested this session)

- **Security**: staff self-escalation to owner via `/admin/users/me` is blocked (live HTTP test,
  403 + role unchanged). COD OTP forgery path no longer exists — the whole COD feature was
  removed from the codebase (models, routes, middleware, invoice/shipment branches), verified by
  grep showing zero remnants outside the drop-migration.
- **GST tax engine**: live cart test — Gujarat and Maharashtra addresses on the same ₹15,999 item
  correctly produced CGST+SGST vs IGST, non-zero `tax_total`, matching 18% GST.
- **Admin module core flows** (verified by a prior session's own live script, 26/26 checks,
  predates this session's additions): staff login, brand/category/product create, inventory
  adjust with reason code, CMS publish, promotion create, order capture→fulfil, manual shipment
  creation, returns approve, staff invite/revoke, audit log entries for all of the above,
  readonly-role privilege-escalation attempt correctly rejected.
- **Storefront header cluster**: cart drawer (add/increment/remove, header badge sync), mega-menu
  (real `product_category` tree with live product counts, not the old flat heuristic tabs),
  category-filtered catalogue browsing, SKU-inclusive search — all clicked through in a real
  browser against the running stack.
- **Generic CMS routing**: a 3-segment slug (`/guides/sizing/footwear`) resolves correctly;
  existing `/policies/*` pages still work — both confirmed live after I found and fixed my own
  percent-encoding bug.
- **Wishlist variant resolution**: confirmed live with a real registered test customer account
  that the `variants.id[]` filter — previously assumed unsupported — correctly resolves products.
- **DB connection pool size**: measured before/after on the actual running (production-mode)
  backend. `/store/products` under 40 concurrent requests: **p50 2580ms → 1542ms** after raising
  the pool from the implicit default of 10 to a configured 20.
- **Auth rate limiter**: still correctly blocks at the 10th attempt (429) after being rewritten to
  support Redis coordination across replicas; in-memory fallback path live-tested.
- **Dev server toggle scripts** (`Hidden Label Dev Servers.bat` etc.): both start and stop paths
  live-tested — start correctly skips already-running services, stop correctly kills only the
  process bound to each port.

## 2. Built and code-correct, but NOT live-verified (no credentials available to this session)

No admin password and no payment/SMS/email/WhatsApp/Shiprocket credentials exist in this
environment, so none of the following has been clicked through or triggered for real, only
read/typechecked/reasoned through carefully:

- Admin: bulk product publish/draft/delete, real image upload via `/admin/uploads`, refund with
  reason-code taxonomy, customer risk/blacklist flag, return reverse-inspection condition grading
  with automatic inventory restock (the restock SQL join chain *was* verified live via direct DB
  query, just not through the admin UI click).
- Razorpay checkout (real signature-verified integration code, committed since before this
  session even started — but a full browse→cart→pay→order-placed journey has never completed,
  because `RAZORPAY_KEY_ID`/`SECRET` are unset).
- SMS OTP delivery (MSG91/Twilio client code is real, gated correctly — returns 501 when
  unconfigured instead of faking success — but no real SMS has ever been sent).
- Transactional email (Resend client is real and gated the same way — logs instead of sending
  when `RESEND_API_KEY` is unset).
- WhatsApp order notifications (built this session, same gated pattern, never sent for real).
- Shiprocket AWB creation / real courier integration (real client, gated, never hit the real API).
- Scheduled daily orders-report email job (registered with Medusa's scheduler, confirmed the
  backend didn't crash with it loaded — never actually fired/observed sending, needs either
  waiting for 07:00 server time or a manual trigger plus `REPORTS_EMAIL`+`RESEND_API_KEY`).

**The one thing most worth testing the moment real credentials exist:** whether two customers
racing to buy the last unit of a variant at actual checkout *completion* both succeed (oversell)
or only one does. I confirmed cart-*add* never checks stock at all (by Medusa's own design,
10/10 concurrent adds succeeded against 1 unit of stock, and a single add of quantity 5 against 1
unit of stock also succeeded) — that's expected, not a bug. The real enforcement point is cart
completion, which needs a working payment session to even reach.

## 3. Confirmed missing — not built, not a credentials issue

- **Product review system.** Zero backend model, zero route, zero storefront UI. Confirmed by
  grep across the whole backend. (Separately: CultureCircle's own "83.1k+ reviews" on its PDP are
  not real reviews of items bought there — every one is tagged "Reviewed on adidas.com" — so
  copying that pattern would mean building something that *looks* like a review system without
  being one. Worth deciding honestly before building.)
- **Multi-image PDP gallery.** The storefront PDP renders only `product.thumbnail` — confirmed in
  `apps/storefront/app/products/[handle]/page.tsx`, no `images.map` anywhere. The seed data
  itself only ever assigns one image per product (`seed.ts: images: [{ url: product.image }]`),
  so even with a gallery component there's nothing to show yet without also seeding more photos.
  The admin-side infrastructure to upload more images per product already exists (built this
  session) — this is a storefront-rendering + seed-data gap, not a missing data model.
- **Managed production infrastructure.** Postgres and Redis are both local/dev only. CORS is
  locked to `localhost`. None of this can be "finished" without real infra accounts — the code
  itself is already env-driven and ready (`DATABASE_URL`, `REDIS_URL`, `STOREFRONT_ORIGIN`,
  `ADMIN_ORIGIN`).
- Remaining UX backlog items not yet touched: mega-menu/cart-drawer were done this session, but
  bulk category tree depth, partial admin polish items, loyalty/tier logic, customer risk display
  in more places, and WhatsApp as a *support channel* (vs. just notifications) are still open.

## 4. On the 29 historical audit docs

They're not worthless — `FINAL_RELEASE_READINESS.md` in particular did real adversarial
verification and caught a previous round's false claims. But most of them are point-in-time
snapshots from earlier rounds, several predate fixes that have since landed, and at least one
round's "100%/production ready" claim was independently disproven. If another AI tool reads them,
it should re-verify any specific claim against actual running code/behavior before trusting it —
exactly the discipline this document tries to model by marking every line (live) or (code).

## 5. How to get the stack running

Double-click `Hidden Label Dev Servers.bat` at the repo root (toggles backend/admin/storefront +
local Postgres on or off, no terminal needed). Or manually: `pnpm db:start`, then
`pnpm dev:backend` / `pnpm dev:admin` / `pnpm dev:storefront`. Full verification commands:
`pnpm typecheck && pnpm lint && pnpm test` (currently: 0 errors, 0 warnings, 70/70 passing).
