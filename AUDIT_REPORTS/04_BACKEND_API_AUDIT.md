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
