# BACKEND & DATABASE AUDIT — The Hidden Label

**Date:** 23 November 2026 · **Backend:** Medusa 2.22.7, Node ≥ 22.22, `:9000` · **DB:** PostgreSQL 18.6, `127.0.0.1:5437`
**Method:** source review of 63 API routes, 32 custom models, 12 migrations, 8 business-logic libraries; live health checks; read-only SQL counts. No writes to application data were performed.

---

## 1. Runtime evidence

| Check | Result |
|---|---|
| `/health` | `OK` |
| `/healthz` | 200 |
| Frontend health proxy | backend `up`, 14 ms |
| DB status | PostgreSQL 18.6 running |
| Public tables | **187** |
| Migrations applied (project) | 12 (`Migration20261114…` → `Migration20261122110000`) |
| Orders | 72 (71 pending, 1 canceled) |
| Payments | 64 (55 `pp_system_default` legacy COD, 9 `pp_razorpay_razorpay`) |
| Customers | 91 rows, 68 non-audit patterns |
| Products | 31 published, 1 draft |
| Inventory levels at/below 3 | 25 |
| Returns | 34 (21 requested, 8 approved, 4 received, 1 pickup scheduled) |
| Shipments | 18 (9 delivered, 6 in transit, 2 created, 1 picked up) |
| Credit notes | 2 |
| Webhook events | 17 |
| Audit events | 299 |
| Promotions | 21 |
| Product reviews / support tickets / purchase orders / fit profiles | 0 / 0 / 0 / 0 |
| Region payment providers | `pp_razorpay_razorpay` only |
| Staff users | 2 (`owner`, `readonly`) |

---

## 2. Architecture

```
Storefront / Admin
      │ REST (x-publishable-key or admin bearer)
      ▼
Medusa HTTP layer
  ├── middlewares.ts       auth, RBAC, rate limits, resale gate, payment idempotency,
  │                        upload guard, return-action interception, promotion body normaliser
  ├── core Medusa routes   carts, products, orders, auth, promotions, fulfilment
  └── custom routes        /store/* (brands, cms, wishlist, otp, returns, cancel, reviews,
                           support, resale, fit, concierge, sight-search, insights)
                           /admin/* (dashboard, brands, cms, inventory, orders actions,
                           purchase-orders, returns, reviews, shipments, stock, suppliers,
                           support, resale, inspections, fit-rules, audit)
                           /webhooks/razorpay, /webhooks/shiprocket
      ▼
src/lib/* business services (returns, refunds, credit notes, shipment ops, RMA,
  stock adjustment/location, GST, email, SMS, rate limits, admin auth, audit)
      ▼
PostgreSQL + (optional) Redis  + external providers
```

Notable: there is **no `src/workflows` or `src/links` directory**. Business logic sits in route handlers and libs; core Medusa workflows are called for state transitions. This is workable but limits composability and makes some flows long and handler-coupled (e.g. order actions route is 342 lines, shipment route 398 lines).

---

## 3. Custom domain model (32 models)

| Group | Models |
|---|---|
| Merchandising | `brand`, `cms_page`, `banner_slot`, `product_review` |
| Customer | `wishlist_item`, `otp_challenge`, `customer_fit_profile`, `support_ticket` |
| Orders / money | `payment_operation`, `refund_operation`*, `credit_note`, `credit_note_item`, `webhook_event`, `audit_event`* |
| Returns | `return_request`, `return_item` |
| Logistics | `shipment`, `shipment_event`, `shipment_operation`, `warehouse_pickup_location` |
| Procurement | `supplier`, `purchase_order`, `purchase_order_item`, `goods_receipt`, `stock_movement` |
| Bespoke | `consultation_booking`, `fabric_swatch` |
| Resale / AI (gated) | `resale_ask`, `resale_bid`, `price_history_point`, `condition_inspection`, `silhouette_fit_rule`, `concierge_thread`, `concierge_message`, `consignor_settlement` |

\* implemented as tables/columns rather than DML models in some cases; verify before renaming.

Core commerce tables (product, variant, price, inventory, cart, order, payment, promotion, customer, region) are Medusa-owned and untouched.

### Data-model observations
- Money is stored as **rupee integers** in custom tables (`*_paise` columns in credit notes/refund ops use paise — mixed conventions exist). This is the root of the checkout display inconsistency and needs a single written convention plus boundary conversion.
- `order.metadata` is used for `fulfilment_mode`, `bespoke_stage`, `privacy_consent_at`, `payment_method`. Metadata is appropriate for low-cardinality flags but not for reporting; fulfilment mode should become a real column if it affects operations.
- `return_request.status` includes `pickup_scheduled`, which is not in the admin UI's status list (`requested/approved/in_transit/received/inspecting/refunded/rejected/closed`) — an order can be in a state the UI cannot filter.
- `shipment.status` includes `picked_up`, also not in every UI tone map.
- Test/seed customers and orders are mixed with real-looking rows; no `is_test` marker.
- 25 inventory levels at ≤ 3 means the low-stock KPI is meaningful; it is not a bug.

---

## 4. API surface

63 route files. Grouped counts: admin ~31, store ~28, webhooks 2, health 1.

**Strengths**
- Consistent `{type, message}` error bodies.
- Role checks through `requireRole`/`adminAccess` rather than ad-hoc.
- Audit events written on mutations.
- Input validation with Zod in shared schemas where used (address, contact, phone).
- Rate limits for OTP, support, concierge, sight search, resale, account deletion, auth.

**Weaknesses**
- Validation is inconsistent: some routes use Zod, some manual coercion, some trust body shape.
- No OpenAPI/contract tests; frontend types are hand-written in `lib/medusa.ts` (1,136 lines), so drift is possible.
- Several routes contain large SQL blocks with string table names and manual joins; a schema rename becomes a runtime failure.
- Pagination conventions differ (`offset/limit` vs. page); admin UI assumes offsets.
- Admin CORS allows the storefront origin (`adminCors: ADMIN_ORIGIN,STOREFRONT_ORIGIN`).
- No request IDs in responses or logs, no structured logger.

---

## 5. Money, orders and refunds

**Payment path**
1. `POST /store/payment-collections` (Medusa) → collection.
2. `POST /store/payment-collections/:id/payment-sessions` with `pp_razorpay_razorpay`.
3. Razorpay provider creates a provider order (`razorpay_order_id`) using configured keys.
4. Browser opens checkout; handler posts signature fields to the server action.
5. Server action updates the session and calls `POST /store/carts/:id/complete`.
6. Middleware `cartCompletePaymentOperationMiddleware` claims an idempotency record, returns an existing order for duplicates, polls on concurrent completion, 409 on conflict, marks completed/failed by wrapping `res.json`.
7. Provider verifies the HMAC signature; failure creates no order.

This design is genuinely good. Its weakness is operational: **it has never been run against a real (or even sandbox-keyed) Razorpay** in this environment; only 9 historical Razorpay payment rows exist, with no captured prepaid order in `completed` state.

**Refunds**
- `refundCapturedPayment` clamps to captured amount, claims a stable-key `refund_operation`, calls `refundPaymentWorkflow` with the same key, issues a GST credit note, returns an explicit outcome, writes audit.
- Cancellation uses the same path; the earlier bug where cancellation was a status-only update is fixed in code.
- Remaining risk: no end-to-end proof against the provider; failed-refund retry requires an operator `retry: true` and its UI affordance is only partially tested.

**Order state**
- `order.status` mixes Medusa semantics; `fulfilment_status` is derived by joins in admin reads. The DB has no `fulfilment_status` column (confirmed by SQL error), so any code assuming one fails.
- Customer-facing order status maps are separate from admin maps and can disagree (`pending` everywhere).

---

## 6. Returns

- Eligibility is computed from fulfillment delivery date and the configurable window (`RETURN_WINDOW_DAYS` / `NEXT_PUBLIC_RETURN_WINDOW_DAYS`), with final-sale and bespoke exclusions and returned-quantity accounting.
- On approval it re-checks delivery, then creates an RMA; reverse pickup via Shiprocket when configured, otherwise an honest "not configured" outcome.
- Receipt requires a condition (`resellable/damaged/disposed`) before restocking; restock is idempotent.
- Refund issues a credit note and provider refund.
- Gaps: reverse-pickup tracking is not surfaced to the customer; no exchange flow; no partial-line UI beyond quantity; status vocabulary mismatch noted above.

---

## 7. GST and invoicing

- `packages/shared/src/gst.ts` implements inclusive GST, HSN heuristics, state codes and intra/inter-state split; unit-tested.
- Invoices are rendered from order data (no PDF service, no sequential invoice register). Invoice number is derived as `INV-THL-<display_id>` — acceptable for a small retailer but **not a statutory invoice series** in the strict sense.
- Seller GSTIN/CIN/legal name/address come from env; currently blank, so invoices print "Registration not configured".
- Credit notes are stored with seller/buyer state, tax split, original invoice reference and `is_mock` flag; 2 exist.
- The invoice contains an unsubstantiated authenticity sentence (see master audit §6).
- GST export route exists and produces CSV, but is not linked from Reports.

---

## 8. Integrations (backend detail)

| Provider | Code state | Verified |
|---|---|---|
| Razorpay | provider module, signature verify, webhook, refund via core workflow; local sandbox server | No keys, no live call |
| Shiprocket | typed client, auth token cache, create shipment/AWB/label, reverse pickup, webhook, status mapping, sandbox | Sandbox process on `:9099` answers; no end-to-end AWB |
| Resend | email lib + templates + order/auth subscribers | No key; logs only |
| MSG91/Twilio | SMS lib, OTP send/verify, dev echo | No key; dev echo only |
| WhatsApp (MSG91) | notification lib with approved-template names | No key/templates |
| Gemini | text + vision libs, catalogue grounding, fallbacks | Mocked unit tests only |
| S3 | env vars only | Not implemented as a provider; uploads are local |

---

## 9. Security boundaries

Verified good: RBAC on all `/admin/*`, customer auth on private store routes, signature verification, idempotency, audit, env guard, upload guards, CSP/HSTS, no default admin role, no email enumeration.

Watch:
1. Admin CORS includes storefront.
2. No MFA; no staff session revocation; invite acceptance path unverified.
3. `authenticate("user", ["bearer","session"])` on all admin routes — confirm cookie flags (`Secure`, `SameSite`) in production.
4. Rate limiter depends on Redis; in-memory fallback is per-process and resets on restart.
5. No WAF/bot protection on public write endpoints (OTP, support, search).
6. Webhook endpoints bypass auth by design but must remain signature-verified; confirm Shiprocket token check.
7. Logs may contain PII; no redaction policy.
8. No dependency policy beyond `pnpm audit` in CI (6 moderate, 0 high).

---

## 10. Performance and reliability

- Pool configured via `DB_POOL_MIN/MAX` (default 2/20), documented against replica count.
- Redis optional; Local Event Bus is used in dev ("not recommended for production"), so production must set `REDIS_URL` and run workers.
- No job queue verification: daily emailed report job exists; no evidence it has run.
- Heavy dynamic rendering and N+1-ish admin joins; fine at boutique scale, needs measurement before campaign traffic.
- No caching layer, no CDN config in repo beyond nginx.
- No health check for DB/Redis separately; `/healthz` is a route, not a readiness probe with dependencies.

---

## 11. Database operational recommendations

1. Publish a one-page money convention: **whole rupees at rest and at the API boundary**, paise only inside provider adapters. Enforce with a shared formatter and tests.
2. Separate seed/test data from production: add `is_test` flags or a dedicated seed DB, and purge synthetic customers/orders before launch.
3. Align status vocabularies across DB, API and both UIs (`pickup_scheduled`, `picked_up`).
4. Replace `order.metadata.fulfilment_mode` with a column if it drives operations/reporting.
5. Add missing indexes discovered under real query plans (admin order search by email/display_id, product search by SKU, return status+requested_at).
6. Move invoice numbering into a sequence table with financial-year prefix and gap-free issuance.
7. Add a migration checklist and a tested rollback procedure; never edit applied migrations.
8. Add DB backup schedule + restore drill (scripts exist but are manual).
9. Introduce structured logging with request IDs and redaction.
10. Keep resale/AI tables; they are inert when flags are off. Do not delete them — they hold no launch-critical data but deleting migrations is risky.
