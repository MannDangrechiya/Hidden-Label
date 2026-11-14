# THE HIDDEN LABEL — Database Plan

Target: PostgreSQL. Two coexisting concerns:

1. **Medusa-owned schema** — carts, orders, payments, fulfilments, prices, customers,
   discounts, inventory. Never hand-edit these tables from application code. All writes go
   through Medusa services/workflows or admin/store APIs.
2. **Project-owned schema** — the custom modules below, created with explicit migrations.

Rule: any change to either is a migration file committed and reviewed. No ad-hoc `ALTER` in a
console, no `synchronize: true`, no schema drift between local and production.

---

## 1. Medusa-owned entities we rely on (reference only)

`product`, `product_variant`, `product_option`, `product_image`, `product_category`,
`price_set` / `price`, `inventory_item` / `inventory_level` / `reservation_item`,
`stock_location`, `cart` / `line_item`, `order` / `order_item`, `customer`, `address`,
`payment` / `payment_collection` / `refund`, `fulfillment` / `fulfillment_item`,
`shipping_option`, `region` / `currency`, `discount` / `discount_rule`, `promotion`,
`tax_region` / `tax_rate`, plus auth (`user`, `invite`, `session`, `api_key`).

Verify the full set against the installed version's migrations before assuming a table exists.

---

## 2. Custom module: brand

Stitch treats brand as a first-class navigational object (`U-03`, `U-04`, mega menu, admin
`A-04`), so it cannot be a tag.

```sql
create table brand (
  id              text primary key,              -- "brd_..."
  handle          text not null unique,          -- "nike"
  name            text not null,                 -- "Nike"
  legal_name      text,
  logo_url        text,
  hero_url        text,
  tagline         text,
  description     text,
  country         text,
  partnership_tier text,                         -- shown on A-04; display only
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  seo_title       text,
  seo_description text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index brand_active_idx on brand (is_active, sort_order) where deleted_at is null;

create table product_brand (
  product_id text not null references product(id) on delete cascade,
  brand_id   text not null references brand(id)  on delete restrict,
  primary key (product_id, brand_id)
);
create index product_brand_brand_idx on product_brand (brand_id);
```

`product_brand` is a link table rather than a column so a collab product can belong to two
brands — the homepage and brand vaults both need this.

---

## 3. Custom module: authentication record (integrity) — **V2, not created in v1**

**Approved D2:** RFID / serialised authentication is deferred until a real physical
serialisation and inspection process is approved. No table in this section is created by the v1
migration chain, and no API, badge or certificate claims it exists. The DDL below is preserved
as the approved starting point for V2 so that decision does not have to be re-litigated.

When built, it backs the authenticity certificate on `U-14` / `U-26` — one record per physical
unit whose provenance is asserted.

```sql
create table authentication_record (
  id              text primary key,              -- "ath_..."
  variant_id      text not null references product_variant(id) on delete restrict,
  serial          text not null unique,          -- printed/attached identifier
  status          text not null default 'pending', -- pending|verified|failed|revoked
  condition_grade text,                          -- e.g. 'DS', '9.5/10'
  inspector       text,
  inspected_at    timestamptz,
  report          jsonb not null default '{}',   -- checklist, photos, notes
  certificate_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index auth_record_variant_idx on authentication_record (variant_id);
create index auth_record_status_idx  on authentication_record (status);
```

Constraint: a variant may have many units but `serial` is globally unique. Status transitions
are append-only via `audit_event`; never overwrite `failed` with `verified` silently.

---

## 4. Custom module: CMS content

Backs `U-01` banners/drops, `U-23`, `U-24`, `U-22` FAQ, and admin `A-14`.

```sql
create table cms_page (
  id          text primary key,
  slug        text not null unique,              -- 'policies/returns'
  kind        text not null,                     -- page|policy|faq|banner|drop
  title       text not null,
  body_md     text,                              -- markdown, rendered server-side
  blocks      jsonb not null default '[]',       -- structured banner/drop blocks
  is_published boolean not null default false,
  published_at timestamptz,
  seo_title   text,
  seo_description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index cms_page_kind_idx on cms_page (kind, is_published);

create table banner_slot (
  id         text primary key,
  placement  text not null,                      -- 'home.hero' | 'home.secondary' | 'nav.promo'
  page_id    text references cms_page(id) on delete set null,
  image_url  text,
  headline   text,
  subhead    text,
  cta_label  text,
  cta_href   text,
  starts_at  timestamptz,
  ends_at    timestamptz,
  is_active  boolean not null default true,
  sort_order integer not null default 0
);
create index banner_slot_placement_idx on banner_slot (placement, is_active, sort_order);
```

Scheduling (`starts_at`/`ends_at`) is evaluated **server-side**; the storefront must never
trust a client clock to decide whether a drop is live.

---

## 5. Custom module: returns (RMA)

```sql
create table return_request (
  id            text primary key,                -- "rma_..."
  display_id    text not null unique,            -- 'RMA-1042'
  order_id      text not null references "order"(id) on delete restrict,
  customer_id   text not null references customer(id) on delete restrict,
  status        text not null default 'requested', -- requested|approved|in_transit|received|inspecting|refunded|rejected|closed
  reason_code   text not null,
  reason_note   text,
  resolution    text not null default 'refund',  -- refund|exchange|store_credit
  awb           text,
  courier       text,
  refund_amount   numeric(12,2),
  refund_payment_id text,
  requested_at  timestamptz not null default now(),
  approved_at   timestamptz,
  received_at   timestamptz,
  closed_at     timestamptz
);
create index return_order_idx  on return_request (order_id);
create index return_status_idx on return_request (status, requested_at desc);

create table return_item (
  id                text primary key,
  return_request_id text not null references return_request(id) on delete cascade,
  order_item_id     text not null references order_item(id) on delete restrict,
  quantity          integer not null check (quantity > 0),
  restock_decision  text,                        -- restock|quarantine|discard
  condition_note    text
);
```

Eligibility (window, final-sale flags, non-returnable categories) is computed at request time
and **re-checked at approval** — never trust the value stored when the customer opened the form.

---

## 6. Custom module: audit event (append-only admin audit log)

Backs `A-17`. **Approved D2:** this is a normal, reliable audit log. There is no hash chain, no
"Merkle ledger", and no tamper-evidence claim anywhere in the UI, API or documentation.

```sql
create table audit_event (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_type  text not null,                     -- admin|customer|system|webhook
  actor_id    text,
  action      text not null,                     -- 'order.refunded', 'product.published'
  entity_type text not null,
  entity_id   text not null,
  summary     text not null,
  changes     jsonb not null default '{}',       -- redacted before/after
  ip          inet,
  user_agent  text
);
create index audit_entity_idx on audit_event (entity_type, entity_id, occurred_at desc);
create index audit_actor_idx  on audit_event (actor_id, occurred_at desc);
create index audit_action_idx on audit_event (action, occurred_at desc);
```

Write path: inserted in the **same transaction** as the mutation it records, so a change cannot
commit without its audit row. UPDATE and DELETE are revoked from the application role — rows
cannot be edited or removed by application code. Retention is a database policy, not a
cryptographic claim.

Secrets are never written into `changes`. Payment payloads are reduced to ids + amounts.

If tamper-evident storage is ever wanted, it is a V2 change with its own migration, verification
tooling and an independently checked claim — not a column added to satisfy screen copy.

---

## 7. Custom module: wishlist

```sql
create table wishlist_item (
  id          text primary key,
  customer_id text not null references customer(id) on delete cascade,
  variant_id  text not null references product_variant(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (customer_id, variant_id)
);
create index wishlist_customer_idx on wishlist_item (customer_id, created_at desc);
```

---

## 8. Custom module: OTP challenge

```sql
create table otp_challenge (
  id          text primary key,
  purpose     text not null,                     -- login|register|order_confirm|phone_verify
  channel     text not null,                     -- sms|email
  destination text not null,                     -- E.164 or email
  code_hash   text not null,                     -- never store the code
  attempts    integer not null default 0,
  max_attempts integer not null default 5,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now(),
  ip          inet
);
create index otp_destination_idx on otp_challenge (destination, purpose, created_at desc);
```

Rate limits: max 3 sends per destination per 15 min, max 5 verify attempts per challenge,
codes expire in 5 minutes. Enforced in the service layer **and** by index-backed queries so a
restart cannot reset the window.

---

## 9. Custom module: shipment tracking (mirror of Shiprocket)

Shiprocket is the source of truth for courier events; we keep a local mirror for fast reads
and for order-page rendering when the provider is slow.

```sql
create table shipment (
  id             text primary key,
  order_id       text not null references "order"(id) on delete restrict,
  fulfillment_id text,
  provider       text not null default 'shiprocket',
  provider_shipment_id text unique,
  awb            text,
  courier        text,
  status         text not null default 'created',  -- created|pickup_scheduled|picked_up|in_transit|out_for_delivery|delivered|rto|cancelled
  label_url      text,
  manifest_url   text,
  shipped_at     timestamptz,
  delivered_at   timestamptz,
  last_synced_at timestamptz,
  raw_last_event jsonb
);
create index shipment_order_idx  on shipment (order_id);
create index shipment_awb_idx    on shipment (awb);
create index shipment_status_idx on shipment (status, last_synced_at);

create table shipment_event (
  id          bigserial primary key,
  shipment_id text not null references shipment(id) on delete cascade,
  event_key   text not null,                     -- provider event id → dedupe
  status      text not null,
  occurred_at timestamptz not null,
  payload     jsonb,
  unique (shipment_id, event_key)
);
```

Customer-facing status is derived from `shipment.status` through one mapper — the same mapper
drives the admin table, so the two can never disagree.

---

## 10. Entity relationships (summary)

```
brand 1─* product_brand *─1 product
product 1─* product_variant 1─* authentication_record   (V2 — not created in v1)
product_variant 1─* inventory_level *─1 stock_location
customer 1─* address
customer 1─* cart 1─* line_item
customer 1─* "order" 1─* order_item
"order" 1─* payment / refund / fulfillment
"order" 1─* shipment 1─* shipment_event
"order" 1─* return_request 1─* return_item *─1 order_item
customer 1─* wishlist_item
admin user 1─* audit_event (actor)
cms_page 1─* banner_slot
```

---

## 11. Migration order

1. Medusa core migrations (vendor-managed)
2. `brand`, `product_brand`
3. `cms_page`, `banner_slot`
4. `wishlist_item`
5. `otp_challenge`
6. `return_request`, `return_item`
7. `shipment`, `shipment_event`
8. `audit_event` + role grants (insert-only)

**V2, not in the v1 chain:** `authentication_record` (§3, preserved as the approved starting
point). No other table in this document waits on a V2 decision.

Each migration must be reversible or explicitly documented as irreversible with a manual
rollback step. There is no "run it and see".

---

## 12. Seed data (development and demo only, never production paths)

- 6 brands, 24 products, ~90 variants across sizes with mixed stock (in stock / low / zero)
- 3 categories, 2 collections
- one customer with orders in each of: pending payment, paid, fulfilled, delivered, return
  requested, refunded
- CMS pages for policies (placeholder text clearly marked as placeholder)
- 1 admin user per role

Seeds are idempotent (`upsert` on handle/slug), and are guarded: the seed script refuses to run
when `NODE_ENV=production`.

---

## 13. Data rules

- Money is `numeric(12,2)` in paise-consistent INR; never `float`. One `Money` value object on
  both client and server.
- All timestamps `timestamptz`.
- Soft delete (`deleted_at`) only where the UI needs history: brand, product, cms_page.
  Orders are never deleted.
- Every custom table has `created_at`; mutable tables add `updated_at` via trigger.
- Order data is denormalised at placement (title, brand, size, price paid) so a later product
  edit cannot rewrite history.
- Backups: daily full + PITR on the managed Postgres; restore test at G8.
