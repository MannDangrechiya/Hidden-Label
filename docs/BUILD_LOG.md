# Build log — delivered and verified

Last updated: 2026-11-14. This file records what actually runs, what was checked and how, and
separately what exists as code but has **not** been independently verified end-to-end yet. See
`docs/HANDOFF.md` for the detailed file-by-file breakdown and next-agent instructions.

## Scope change (2026-11-14): resale/authentication layer now required for v1

Client confirmed the product is explicitly CultureCircle-style (resale + authentication
marketplace), which **reversed decision D1** (recorded as **D7** in `docs/PROJECT_PLAN.md` §8).
`AI-01`–`AI-05` (visual search, price index/bidding, 360° inspection + condition grading, fit
studio, style concierge) are now in-scope for v1 as **Phase 5.5** — designed in `docs/PHASE_5.5_PLAN.md`
and fully implemented, migrated, seeded, and verified end-to-end.

## Overall status: ~85% of total v1 scope (including the new Phase 5.5)

| Phase | Status |
|---|---|
| P0/0.5 — Audit, docs, decisions | ✅ Done, approved |
| P1 — Repo/DB/backend foundation | ✅ Done, verified |
| P2 — Design system (`packages/ui`) | ✅ Mostly done, verified |
| P3 — Commerce model (brand/cms/returns/shipment modules) | ✅ Done, verified live |
| P4 — Storefront customer journey (auth, search, checkout, orders, returns) | ✅ Done, verified end-to-end |
| P5 — Admin dashboard (`apps/admin`) | ✅ Done, verified end-to-end |
| P5.5 — Resale, Bidding & AI Layer (CultureCircle mechanics) | ✅ Done, verified end-to-end |
| P6 — Integrations (Razorpay, Shiprocket, email, OTP) | 🟡 Scaffolded + tested (Razorpay HMAC verified; needs live 3P credentials for live gateways) |
| P7 — Edge cases / concurrency / fraud rules | 🟡 In progress |
| P8 — QA, security, automated tests | ✅ 48 tests passing across shared, backend & admin |
| P9 — Production deployment | 🔴 Not started — needs hosting/domain decisions |
| P10 — Launch/handover | 🔴 Not started |

## Verified working now (actually re-run and confirmed)

### Database and backend
- `pnpm db:start` → PostgreSQL 18.6 on `127.0.0.1:5437`, database `the_hidden_label`.
- `pnpm db:migrate` → **159 tables** (151 core/custom + 8 Phase 5.5 tables: `resale_ask`, `resale_bid`, `price_history_point`, `condition_inspection`, `silhouette_fit_rule`, `customer_fit_profile`, `concierge_thread`, `concierge_message`).
- `pnpm db:seed` → India/INR region, publishable key, stock location, 8 products with inventory items and INR prices, 6 brands, 8 CMS pages.
- `seed-phase5-5.ts` → **234 price history points** (AI-02), **52 resale asks**, **52 resale bids**, **26 condition inspections** with turntable frames (AI-03), and **8 silhouette fit rules** (AI-04).
- Backend on `:9000`; `/health` 200.
- Repo-wide `pnpm typecheck` and `pnpm lint` are 100% clean across all 6 workspace packages with zero errors.
- `pnpm test` passes **48 automated tests** across `@thl/shared`, `@thl/backend`, and `@thl/admin`.

### Storefront (`apps/storefront`, port 3000) — verified flows
| Flow / Route | State | Notes |
|---|---|---|
| `/` | ✅ | Editorial hero + latest arrivals from Medusa + floating Aura-7 Concierge (AI-05) |
| `/collections/all` | ✅ | Full catalogue, product count, route-level skeleton |
| `/products/[handle]` | ✅ | Gallery, brand, price, size selector, add to bag, **The Price Index** (AI-02 size-specific trade curves, asks, bids, 30d trend, place-bid CTA), **360° Inspection Viewer** (AI-03 turntable spinner, macro photos, verification matrix), **Fit Studio Widget** (AI-04 metric sizing assistant) |
| `/inspection/[serial]` | ✅ | Permanent Certificate of Authenticity (AI-03) with verifiable serial, condition grade, 360° turntable, and full lab checklist |
| `/fit-studio` | ✅ | Standalone precision sizing studio (AI-04) for all footwear silhouettes |
| Search Overlay | ✅ | Typeahead suggestions + **Search by Sight (AI-01)** visual photo matcher with similarity scoring |
| Floating Aura-7 Concierge | ✅ | Conversational stylist (AI-05) recommending catalog silhouettes with interactive outfit links |
| `/cart` | ✅ | Server-rendered lines, ± quantity, remove, subtotal/total, empty state |
| `/checkout` | ✅ | Address input → dynamic shipping options → Cash on Delivery session (`pp_system_default`) → order completion |
| `/account/orders/[id]/return` | ✅ | Return eligibility enforced (422 rejection when undelivered, 201 RMA creation when delivered) |

### Admin (`apps/admin`, port 7001) — verified flows
| Area / Route | State | Notes |
|---|---|---|
| Admin RBAC enforcement | ✅ | Unauthenticated requests to `/admin/orders`, `/admin/brands`, `/admin/returns` return 401 |
| `/login` | ✅ | Admin auth (`POST /auth/user/emailpass`) issues JWT session cookie |
| `/` (Dashboard) | ✅ | Admin identity + role resolution (`/admin/users/me`) |
| `/inspections` (A-18) | ✅ | Physical condition inspection queue (AI-03): review photos/checklists, approve/reject verdicts with server-side audit |
| `/resale` (A-19) | ✅ | Orderbook overview: live consignor asks and buyer bids across variants |
| `/fit-rules` (A-20) | ✅ | Silhouette fit rules manager: sizing deltas, width profiles, guidance text |
| `/orders` | ✅ | View placed customer orders |
| `/returns` | ✅ | View customer RMA requests |
| `/brands` | ✅ | Brand CRUD: create brand with audit event and ULID entity ID, delete cleanly |
| `/audit` | ✅ | Append-only audit stream reflects order, brand, return, inspection, and fit rule mutations |

## Bugs found and fixed in this verification pass

1. **Brand/CMS/Shipment entity ID in raw knex inserts** — Fixed by generating entity IDs using `generateEntityId`.
2. **Ambiguous `fulfillment_status` column on `"order"`** — Derived fulfillment status from `order_fulfillment` join.
3. **Seed script crash on re-run with reservations** — Made seed idempotent by checking existing product handles without cascading deletes on reserved inventory.
4. **Dev database daemon lifecycle on Windows** — Resolved `execFileSync` pipe hangs with `{ stdio: "ignore" }` and connection readiness retries.
5. **Phase 5.5 DML chaining** — Medusa DML requires `.unique().nullable()`, not `.nullable().unique()`.
6. **Audit event property naming** — Fixed `actorId` / `entityType` camelCase in admin inspection & fit-rule handlers.

## Known gaps (next work, in order)

1. Real Razorpay / Shiprocket / email (Resend) / SMS-OTP provider credentials — needed from the client before live payment/shipping APIs can be switched from simulated/dev mode.
2. Redis is absent locally; Medusa runs its fake redis. Real Redis is required for worker queue scaling.
3. P7 edge cases (stock revalidation at order placement, concurrent-purchase handling, coupon abuse, duplicate-webhook safety).
4. P9 production deployment — hosting, domain, DNS/HTTPS, secrets, backups.
