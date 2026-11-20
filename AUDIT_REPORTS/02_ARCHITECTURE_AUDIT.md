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
