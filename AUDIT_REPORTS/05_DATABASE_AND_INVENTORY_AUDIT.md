# 05 — DATABASE AND INVENTORY AUDIT

All schema facts below come from live queries against `the_hidden_label` on `127.0.0.1:5437` (read-only `SELECT`s) plus reading the 19 DML models and 8 migrations in `apps/backend/src/modules/thl/`.

## 1. Measured state **[LIVE]**

```
public tables                                    171
product (not deleted)                             18
product_variant (not deleted)                     60
  ├─ manage_inventory = true                      60
  └─ allow_backorder  = true                       0
inventory_level rows                              59
  ├─ stocked_quantity (sum)                      170
  └─ reserved_quantity (sum)                      43
"order" (not deleted)                             55   (54 pending, 1 canceled)
payment                                           55   (9 captured, 1 canceled)
return_request (not deleted)                      28   (21 requested, 7 approved)
shipment                                           8   (6 with AWB)
audit_event                                      256
brand                                             ~38 incl. audit fixtures
```

Append-only enforcement: `pg_trigger` on `audit_event` contains **`audit_event_append_only`**.

Relevant unique indexes verified in `pg_indexes`:
`shipment_event_key_unique` (shipment_id, event_key) · `shipment_provider_shipment_id_unique` · `return_request_display_id_unique` · `otp_challenge_pkey` + `otp_destination_idx` · `resale_ask_*` / `resale_bid_*` variant & seller/buyer indexes.

## 2. Data ownership map

| Cluster | Owner | Tables |
|---|---|---|
| Catalogue & merchandising | Medusa core | `product`, `product_variant`, `product_option`, `product_category`, `product_collection`, `price`, `price_set`, `sales_channel` |
| Inventory | Medusa core | `inventory_item`, `inventory_level`, `reservation_item`, `stock_location`, `product_variant_inventory_item` |
| Cart & checkout | Medusa core | `cart`, `line_item`, `shipping_method`, `shipping_option`, `payment_collection`, `payment_session`, `payment`, `refund` |
| Orders & fulfilment | Medusa core | `order`, `order_item`, `order_line_item`, `order_fulfillment`, `fulfillment`, `order_payment_collection` |
| People & auth | Medusa core | `customer`, `customer_address`, `user` (staff), `provider_identity`, `auth_identity` |
| Promotions & tax | Medusa core | `promotion`, `promotion_rule`, `campaign`, `tax_region`, `tax_rate` |
| Project commerce | **ThlModule** | `brand`, `product_brand`, `banner_slot`, `cms_page` |
| Resale / authentication | **ThlModule** | `resale_ask`, `resale_bid`, `price_history_point`, `condition_inspection`, `customer_fit_profile`, `silhouette_fit_rule`, `concierge_thread`, `concierge_message` |
| Service / ops | **ThlModule** | `wishlist_item`, `otp_challenge`, `return_request`, `return_request_item`, `shipment`, `shipment_event`, `support_ticket`, `audit_event` |

Nothing in the project owns customer, order or payment money records directly — those stay Medusa's. This is the right boundary: a custom module cannot corrupt Medusa's order state machine.

## 3. Model review (project tables)

| Table | Purpose | Key fields | Constraints / indexes | Gaps |
|---|---|---|---|---|
|`brand`|Multi-brand boutiques|handle, name, tagline, logo/hero, country, tier, sort_order|unique handle (model), sort index|not sales-channel scoped; 36 audit-fixture rows present|
|`product_brand`|product↔brand link|product_id, brand_id|join table|no FK to Medusa `product` enforced at DB level|
|`banner_slot`|Homepage/CMS banners|placement, image, headline, subhead, CTA, schedule|placement index|storefront homepage does not consume it yet|
|`cms_page`|Policies / editorial|slug, kind, title, body_md, blocks(jsonb), seo_*, published_at|unique slug|no draft/published versioning beyond `is_published`|
|`wishlist_item`|Saved variants|customer_id, variant_id|per-customer query index|no unique (customer,variant) constraint — duplicate prevented in app code only|
|`otp_challenge`|Email/SMS OTP|destination, purpose, code_hash, expires_at, attempts, max_attempts, consumed_at, ip|destination index|no unique active-challenge constraint; app enforces 3 sends/15 min|
|`return_request`|RMA header|display_id, order_id, customer_id, status, reason_code, resolution, refund_amount, approved_at, received_at, condition, restocked_at, awb, courier|**unique display_id**, status index|display id comes from a row count (race); no credit-note link|
|`return_request_item`|RMA lines|return_request_id, order_item_id, quantity|request index|no per-line condition (condition is header-level)|
|`shipment`|Outbound/inbound parcel|order_id, provider, provider_shipment_id, awb, courier, status, label_url, last_synced_at, shipped_at, delivered_at|unique provider_shipment_id, awb idx, status idx|single shipment per order assumed by some UI|
|`shipment_event`|Courier scan log|shipment_id, event_key, status, occurred_at, payload|**unique (shipment_id,event_key)**|payload stores raw provider body — ensure no PII beyond name/address|
|`condition_inspection`|Per-unit authentication|unit_serial, grade, checklist, frames, verdict, inspector|unique unit serial (model)|not linked to a consignment intake/ask|
|`resale_ask` / `resale_bid`|Orderbook|variant_id, seller/buyer, price, status|variant + party indexes|no settlement record; no escrow; no matching/bid-acceptance order creation|
|`price_history_point`|Price index|variant_id, price, captured_at|variant index|seeded demo points (234)|
|`customer_fit_profile`|Foot sizing|measurements, silhouette|per customer|no body-measurement profile or revision history|
|`silhouette_fit_rule`|Fit deltas|silhouette, deltas, guidance|silhouette unique|—|
|`concierge_thread` / `concierge_message`|AI chat|thread, sender, content, recommended ids|customer/session|thread not owner-scoped on write (BUG-09)|
|`support_ticket`|Customer support|subject, body, status, order ref, customer/guest|status index|no SLA fields, no assignment, no category enum|
|`audit_event`|Append-only trail|actor_type, actor_id, action, entity_type/id, summary, changes(jsonb), ip, ua|**append-only trigger**|no retention policy; grows unbounded|

## 4. Migration history

`pnpm db:migrate` runs Medusa's core migrations; the project adds 8 migrations in a documented order:
`20261114090000` (brand/cms/banner/wishlist) → `…091000` (cms blocks) → `…092000` (OTP) → `…093000` (returns/shipments) → `…100000` (resale/inspection/fit/concierge) → `20261117100000` → `20261119100000` (drops COD verification and payout-details tables) → `20261119110000`.
The CI workflow proves the schema builds **from an empty database** (migrations job asserts ≥50 tables). **[CODE — workflow read, not executed here]**

## 5. The ten inventory-consistency questions

| # | Requirement | Result | Reasoning / evidence |
|---|---|---|---|
|1|Stock cannot go negative through concurrent transactions|**LIKELY SAFE (unverified)**|All 60 variants `manage_inventory=true`, `allow_backorder=false`; reservations are Medusa's own (`reservation_item`), which locks inventory at cart completion. No custom code decrements stock outside Medusa workflows. Not exercised.|
|2|Final available inventory reserved atomically|**YES (framework)**|Medusa complete-cart workflow reserves inventory. Custom code never reserves manually.|
|3|Duplicate checkout cannot create duplicate orders|**PARTIAL**|Order creation is exclusively Medusa's complete-cart workflow; there is no custom order-create endpoint. But there is no explicit idempotency guard on the storefront's `confirmRazorpayPaymentAction` — a double-click issues a second `completeCart` call, which Medusa should reject because the cart is already completed. Not tested.|
|4|Payment webhooks cannot process a transaction twice|**PARTIAL / UNVERIFIED**|Shipment webhooks are provably idempotent (unique event key). Razorpay's custom endpoint only logs; state advancement is Medusa's `/hooks/payment/razorpay_razorpay`, whose replay safety could not be exercised without keys.|
|5|Failed payments release/expire reservations correctly|**EXPECTED (framework)** — unverified|No custom reservation release code; relies on Medusa cart expiry/reservation expiry. Not tested.|
|6|Cancelled orders restore inventory correctly|**YES via workflow** — unverified|`cancelOrderWorkflow` used by both admin and customer cancel. No custom stock maths.|
|7|Returned products are not sellable before inspection|**YES — correctly implemented**|`lib/returns.ts`: restock happens **only** on `action="receive"` **and** `condition="resellable"`; `damaged`/`disposed` never touch `inventory_level`. This is the single best-designed inventory rule in the project.|
|8|Inventory movements are traceable|**PARTIAL**|Every admin adjustment writes `audit_event` with before/after/reason in the same transaction; return restock writes `inventory.adjusted` with `reason: return_restock`. But `stock_movement` is not a first-class table — traceability is via the audit log, not a stock ledger. Supplier receipts and transfers therefore have no ledger entry.|
|9|Order and payment records remain consistent|**PARTIAL**|Live data shows 55 orders (54 `pending`, 1 `canceled`) with 55 payments of which only 9 captured. That is consistent with unpaid/abandoned carts being completed as `pending` orders, but it also means the business has **no completed paid order** in this environment to prove the happy path.|
|10|Concurrency tests against production data|**NOT PERFORMED**|Explicitly out of scope; the only concurrency evidence available is the prior round's note that cart *add* never checks stock (expected).|

**Additional inventory findings**

- **Lost update on adjustment** (BUG-05): `GET level → compute next → UPDATE` with no `FOR UPDATE`. Two simultaneous adjustments of +1 and −1 on the same level can leave the wrong value.
- **Single-location assumptions:** `stock_location.first()` in order fulfilment and return restock. If a second location is ever added, returns may be restocked at an arbitrary location.
- **No stock ledger:** without a `stock_movement`/`inventory_transaction` table, stock ageing, supplier receipts, transfers and shrinkage analysis are not possible.
- **43 reserved units** exist with no paid orders behind most of them — abandon-cart reservations that have not expired in this dev database.
- **`return_request` refund_amount is a numeric string** (`toFixed(2)`), while the rest of the project stores integer rupees. It is internally consistent on the RMA side but is a second money representation.

## 6. Data-quality issues in the working database

- 36 brand rows are audit fixtures (`Audit Brand`, `TestBrand`) and appear in the public `/store/brands` response **[LIVE]** — they would render on the brand directory.
- Test products created by the admin audit workflow remain.
- 54 `pending` orders inflate dashboard revenue-at-risk and order counts.
- No seed reset/teardown script exists in `package.json` for clearing fixtures (only `db:seed`, which is idempotent).

## 7. Verdict for this area

**Schema and ownership design: READY.** The project adds tables only where Medusa has no equivalent, keeps money and order state in the framework, and enforces the most safety-critical rule (no restock of damaged returns) correctly.
**Inventory operations: NOT READY for a real warehouse** — no stock ledger, no multi-location operations, no supplier receipts, one known lost-update defect.
