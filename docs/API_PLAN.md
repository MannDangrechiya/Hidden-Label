# THE HIDDEN LABEL — API Plan

Base: Medusa's store and admin APIs for everything commerce-standard, plus project routes for
the custom modules. The storefront and admin apps talk to the backend **only** through these
routes — no direct database access from any Next.js app, ever.

---

## 1. Conventions

| Concern | Rule |
|---|---|
| Versioning | `/store/*` and `/admin/*` as provided by Medusa; custom routes live under the same prefixes with a distinct segment (`/store/brands`, `/admin/brands`) |
| Auth (storefront) | session cookie (httpOnly, secure, sameSite=lax) issued by the backend. Never a token in localStorage |
| Auth (admin) | separate session scope; admin middleware rejects customer sessions and vice versa |
| Authorisation | per-route server-side role check (`owner`, `manager`, `operations`, `support`, `readonly`). UI hiding is cosmetic only |
| Validation | zod schema per route, shared from `packages/shared`; the same schema validates on the client for UX |
| Errors | `{ "type": "invalid_data", "message": "<human sentence>", "code": "<stable_code>", "fields"?: {...} }` |
| Status codes | 400 validation · 401 no session · 403 authenticated but not allowed · 404 missing **or not owned** (never 403 for another user's order — that leaks existence) · 409 conflict/stock · 422 business rule · 429 rate limit · 5xx unexpected |
| Pagination | `?limit=&offset=` returning `{ items, count, offset, limit }` |
| Idempotency | `Idempotency-Key` required on `POST /store/checkout/*` and any refund/cancel mutation; stored 24h |
| Caching | catalog reads `public, s-maxage=60, stale-while-revalidate=300`; cart/checkout/account `private, no-store` |
| Rate limits | OTP send 3/15min per destination; login 10/15min per IP+identity; search 60/min per IP |
| CSRF | same-origin check on all cookie-authenticated mutations |
| Logging | structured JSON, request id propagated, secrets and card data never logged |

### Feature-flagged (deferred V2) routes

Approved D1 defers `AI-01`–`AI-05`, bidding, price index and resale. Their endpoints
(`/store/sight-search`, `/store/price-index`, `/store/concierge`, `/store/fit-studio`,
`/store/inspection/*`, `/admin/authentication-records`) are **not registered while the
corresponding flag is off** — requests 404. There are no mock endpoints, no sample payloads and
no "coming soon" JSON in v1.

---

## 2. Storefront endpoints

### Catalog (public, cacheable)

```
GET  /store/brands                       list + A–Z index + product counts
GET  /store/brands/:handle               brand + hero + facets
GET  /store/products?brand=&category=&collection=&size=&min_price=&max_price=&sort=&limit=&offset=
GET  /store/products/:handle             product, variants, size×stock, auth summary, gallery
GET  /store/collections/:handle
GET  /store/categories                   tree for nav + mega menu
GET  /store/search?q=&type=              products | brands | suggestions
GET  /store/search/suggest?q=            typeahead, ≤8 results, ≤80ms target
GET  /store/cms/:slug                    policy/faq/about page
GET  /store/content/home                 banners, drops, curated rails (scheduled server-side)
GET  /store/size-guides/:key
```

Stable-sorted pagination is mandatory (`sort` has a deterministic tiebreaker) or product grids
will duplicate items across pages.

### Cart (session or customer)

```
POST   /store/carts                      create (returns cart id + token)
GET    /store/carts/:id
POST   /store/carts/:id/items            { variant_id, quantity } → validates stock, returns line
PATCH  /store/carts/:id/items/:item_id   { quantity } (0 removes)
DELETE /store/carts/:id/items/:item_id
POST   /store/carts/:id/promotions       { code } → revalidated, returns adjustment breakdown
DELETE /store/carts/:id/promotions/:code
POST   /store/carts/:id/shipping-options { address } → priced options for the address
GET    /store/carts/:id/totals           authoritative subtotal/discount/shipping/tax/total
```

Every response includes a `revalidated` array so the UI can show "size no longer available"
before checkout rather than after.

### Checkout & orders

```
POST /store/checkout/address      create/select address (Idempotency-Key)
POST /store/checkout/shipping     select option → recalculates total server-side
POST /store/checkout/payment      create payment intent; returns provider payload + order id
POST /store/checkout/verify       server-side verification probe (used after redirect)
GET  /store/orders/:id            order detail (owner or guest token)
GET  /store/orders?status=&limit= order history (customer)
POST /store/orders/:id/cancel     customer cancellation, if state allows (Idempotency-Key)
GET  /store/orders/:id/invoice    printable invoice (PDF or print-optimised HTML)
```

**`POST /store/checkout/verify` is the only thing that may unlock the confirmation screen.**
It returns `{ status: "paid" | "pending" | "failed" }` and never a success purely because a
redirect happened.

### Account

```
POST /store/auth/register | login | logout | refresh
POST /store/auth/password/forgot | reset
POST /store/otp/send      { destination, purpose }  (rate-limited)
POST /store/otp/verify    { challenge_id, code }    → marks phone/email verified
GET  /store/customers/me
PATCH /store/customers/me
GET  /store/customers/me/addresses        POST/PATCH/DELETE
GET  /store/customers/me/wishlist         POST/DELETE :variant_id
GET  /store/customers/me/returns          POST (create return request)
GET  /store/orders/:id/shipment           tracking timeline
POST /store/support/tickets               contact form → email + record
```

Ownership is enforced by joining on `customer_id` from the session — a route that accepts an
`order_id` from the client must verify the order belongs to the session before returning data.

### Webhooks

```
POST /store/webhooks/razorpay    signature verified, idempotent, 200 on duplicate
POST /store/webhooks/shiprocket  signature/token verified, idempotent per event id
```

Webhooks are exempt from session auth but never from signature verification, and they are
rate-limited by source with alerts on abnormal volume.

---

## 3. Admin endpoints

```
GET   /admin/dashboard/summary            KPIs, revenue velocity, feeds
GET   /admin/products                     list, filters, stock telemetry
POST  /admin/products                     create (draft)
PATCH /admin/products/:id                 update
POST  /admin/products/:id/publish|unpublish
POST  /admin/products/:id/variants        bulk variant upsert (size matrix)
GET   /admin/brands / POST / PATCH / DELETE
GET   /admin/categories / POST / PATCH / DELETE     (tree ops)
GET   /admin/inventory?low=true
POST  /admin/inventory/:variant_id/adjust { delta, reason }   (reason required, audited)
GET   /admin/orders?status=&q=&from=&to=
GET   /admin/orders/:id
POST  /admin/orders/:id/capture | fulfil | cancel        (Idempotency-Key)
POST  /admin/orders/:id/refund { amount, reason }        (Idempotency-Key)
GET   /admin/customers / GET :id / PATCH :id (notes, tier)
GET   /admin/payments / GET :id
POST  /admin/shipments { order_id, courier }  |  POST /admin/shipments/:id/label|manifest|sync
GET   /admin/returns / POST /:id/approve|reject|receive|refund
GET   /admin/promotions / POST / PATCH / DELETE
GET   /admin/content / POST / PATCH / DELETE  (pages, banners, drops)
GET   /admin/reports/sales?range= | /inventory | /returns     (+ CSV export)
GET   /admin/users / POST / PATCH   GET /admin/roles / PATCH /admin/roles/:id/permissions
GET    /admin/audit?entity=&actor=&action=&from=&to=
GET    /admin/audit/:id
```

Admin rules:

- Every mutation writes an `audit_event` **in the same transaction** as the change. A change
  that succeeds without an audit row is a bug.
- Stock adjustments require a reason code from a fixed list; free-text alone is not acceptable.
- Deleting a product or brand that has orders is refused (archive instead) — order history must
  remain intact.
- `GET /admin/*` responses are always `no-store`.

---

## 4. Payload examples (contract anchors)

```jsonc
// GET /store/products/:handle
{
  "product": {
    "id": "prod_01H...",
    "handle": "air-jordan-1-retro-high-og-chicago",
    "title": "Air Jordan 1 Retro High OG 'Chicago'",
    "brand": { "handle": "nike", "name": "Nike" },
    "price": { "amount": 3899000, "currency": "inr", "display": "₹38,990" },
    "variants": [
      { "id": "variant_01H...", "size": "UK 8.0", "sku": "DZ5485-612-8",
        "available": true, "quantity": 2 }
    ],
    // Per decision D2, v1 exposes no authenticity/verification field and no "verified" badge.
    // Only truthful, data-backed badges are allowed here (e.g. "low_stock" with real quantity).
    "badges": [],
    "media": [{ "url": "...", "alt": "..." }]
  }
}
```

```jsonc
// POST /store/checkout/verify  →
{ "status": "paid", "order": { "id": "order_01H...", "display_id": "THL-2481" } }
// or
{ "status": "pending", "retry_after_ms": 2000 }
```

Amounts are integers in paise everywhere in JSON. Formatting happens in the UI only.

---

## 5. Route-to-screen traceability

Every storefront route in `SCREEN_MAP.md` maps to at least one endpoint above, and every admin
screen to a `/admin/*` group. A screen with no endpoint is a design decision to argue; an
endpoint with no screen is scope creep. Phase 0's map is the checklist for both directions.
