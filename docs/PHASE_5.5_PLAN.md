# PHASE 5.5 — Resale, Bidding & Authentication Layer Plan

**Status:** Architecture & Data Model Proposal  
**Approved Context:** Decision D7 (2026-11-14) in `docs/PROJECT_PLAN.md` §8 reversed D1 and brought the CultureCircle-style resale marketplace and AI retention layer (`AI-01` through `AI-05`) into scope for v1.  
**Design Authority:** Google Stitch project `10766877595551018159` (`SCREEN_MAP.md` §3).

---

## 1. Product Vision & Marketplace Mechanics

The Hidden Label is an authenticated multi-brand streetwear and sneaker resale marketplace modeled on **CultureCircle** (and secondary platforms like StockX / GOAT). 

Unlike a pure retail catalog with a static manufacturer price:
1. **Asks and Bids**: Multiple sellers/consignors list pairs per size variant with asking prices and box conditions. Buyers can buy immediately at the lowest ask, or place a bid.
2. **The Price Index (`AI-02`)**: Historical trades and valuation curves per size variant show price trends over 30d, 90d, 1y, and all-time.
3. **Truthful Condition Grading & 360° Inspection (`AI-03`)**: Every pre-owned or consignment unit goes through a physical inspection workflow. A real `condition_inspection` record with turntable photos, detailed wear notes, and an assigned condition grade (e.g. *Deadstock*, *VNDS 9.5/10*, *Lightly Worn*) backs any "Verified" badge. Per decision D2, **no badge or claim renders without a backing record**.
4. **Fit Studio (`AI-04`)**: Real millimeter/centimeter foot measurement conversions and silhouette-specific fit advice (e.g. "Air Jordan 1 runs TTS; order half size down from Yeezy 350"), generating customer fit recommendations.
5. **Search by Sight (`AI-01`)**: Visual image similarity search matching user-uploaded photos against catalog silhouettes.
6. **Style Concierge Aura-7 (`AI-05`)**: Conversational AI assistant grounded in store catalog data, assembling shoppable outfits.

---

## 2. Database Schema (PostgreSQL DDL)

These tables extend the custom `thl` module and will be placed in a dedicated migration `Migration20261114100000.ts`.

### 2.1 Resale Orderbook: Asks & Bids

```sql
-- Seller/consignor asks per variant
create table resale_ask (
  id              text primary key,                     -- "ask_..."
  variant_id      text not null references product_variant(id) on delete restrict,
  seller_id       text not null references customer(id) on delete restrict,
  ask_price       numeric(12,2) not null,               -- in INR rupees (paise-consistent in API)
  condition_grade text not null default 'deadstock',    -- deadstock|vnds|excellent|good
  box_condition   text not null default 'perfect',      -- perfect|damaged|missing_lid|replacement_box
  status          text not null default 'active',       -- active|matched|cancelled|expired|sold
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index resale_ask_variant_idx on resale_ask (variant_id, status, ask_price asc);
create index resale_ask_seller_idx  on resale_ask (seller_id, status);

-- Buyer bids per variant
create table resale_bid (
  id              text primary key,                     -- "bid_..."
  variant_id      text not null references product_variant(id) on delete restrict,
  buyer_id        text not null references customer(id) on delete restrict,
  bid_price       numeric(12,2) not null,
  status          text not null default 'active',       -- active|matched|cancelled|expired
  payment_intent  text,                                 -- optional pre-authorized payment token
  expires_at      timestamptz not null default (now() + interval '30 days'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index resale_bid_variant_idx on resale_bid (variant_id, status, bid_price desc);
create index resale_bid_buyer_idx   on resale_bid (buyer_id, status);
```

### 2.2 Historical Price Index (`AI-02`)

```sql
create table price_history_point (
  id              text primary key,                     -- "php_..."
  variant_id      text not null references product_variant(id) on delete cascade,
  price_rupees    numeric(12,2) not null,
  condition_grade text not null default 'deadstock',
  source          text not null default 'marketplace',  -- marketplace|external_index|retail
  recorded_at     timestamptz not null default now()
);
create index price_history_variant_date_idx on price_history_point (variant_id, recorded_at desc);
```

### 2.3 Condition Inspection & Verification (`AI-03`)

Backs the 360° Inspection Viewer and authenticates physical units before fulfillment or listing.

```sql
create table condition_inspection (
  id              text primary key,                     -- "ins_..."
  variant_id      text not null references product_variant(id) on delete restrict,
  unit_serial     text unique,                          -- unique barcode/SKU per physical unit
  inspector_id    text references "user"(id) on delete set null,
  status          text not null default 'pending',      -- pending|in_review|approved|rejected
  condition_grade text not null,                        -- 'DS' (10/10), 'VNDS' (9.5/10), '9.0/10', etc.
  box_condition   text not null default 'perfect',
  turntable_media jsonb not null default '[]',          -- array of 8/16/36 image URLs around 360°
  detail_photos   jsonb not null default '[]',          -- close-ups: toe box, outsole, size tag, stitching
  checklist       jsonb not null default '{}',          -- verified checks: stitching, font, scent, uv_light
  notes           text,
  inspected_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index inspection_variant_idx on condition_inspection (variant_id, status);
create index inspection_serial_idx  on condition_inspection (unit_serial);
```

### 2.4 Fit Studio Engine (`AI-04`)

Silhouette sizing conversion charts and personalized sizing recommendation profiles.

```sql
create table silhouette_fit_rule (
  id               text primary key,                    -- "fit_..."
  brand_id         text references brand(id) on delete cascade,
  silhouette_name  text not null,                       -- e.g. "Air Jordan 1", "Yeezy Boost 350", "Samba OG"
  fit_tendency     text not null default 'true_to_size',-- true_to_size|runs_small|runs_large|runs_narrow
  recommended_size_delta numeric(3,1) not null default 0.0, -- e.g. +0.5 for runs small, -0.5 for runs large
  width_profile    text not null default 'regular',     -- narrow|regular|wide
  guidance_text    text not null,                       -- "We recommend sizing up by a half size if you have wide feet."
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index silhouette_fit_idx on silhouette_fit_rule (silhouette_name);

create table customer_fit_profile (
  customer_id     text primary key references customer(id) on delete cascade,
  foot_length_cm  numeric(4,1),                        -- e.g. 26.5 cm
  foot_width      text default 'regular',               -- narrow|regular|wide
  standard_uk_size numeric(3,1),                       -- baseline size, e.g. 8.0
  notes           text,
  updated_at      timestamptz not null default now()
);
```

### 2.5 Style Concierge (`AI-05`)

```sql
create table concierge_thread (
  id              text primary key,                     -- "cth_..."
  customer_id     text references customer(id) on delete set null,
  session_token   text not null,                        -- supports guest or authenticated chat
  title           text default 'Personal Styling Session',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index concierge_thread_session_idx on concierge_thread (session_token);

create table concierge_message (
  id              text primary key,                     -- "cmsg_..."
  thread_id       text not null references concierge_thread(id) on delete cascade,
  sender          text not null,                        -- user|assistant
  content         text not null,
  recommended_product_ids text[] default '{}',          -- links to shoppable items
  created_at      timestamptz not null default now()
);
create index concierge_message_thread_idx on concierge_message (thread_id, created_at asc);
```

---

## 3. API Surface for Phase 5.5

### 3.1 Storefront Endpoints (`/store/resale/*` & `/store/ai/*`)

- `GET /store/resale/products/:handle/index` — Lowest ask, highest bid, price history time-series, volatility stats for `AI-02`.
- `POST /store/resale/bids` — Place a bid on a variant (authenticated).
- `DELETE /store/resale/bids/:id` — Cancel an active bid.
- `GET /store/resale/my-bids` — Customer bid management.
- `GET /store/inspections/:unit_serial` — Detailed graded condition inspection report + 360° turntable asset URLs (`AI-03`).
- `POST /store/fit/recommend` — Input foot length in CM or baseline brand size; returns recommended size for a specific sneaker silhouette (`AI-04`).
- `POST /store/concierge/chat` — Post message to Aura-7 concierge; returns streaming or generated reply with catalog item cards (`AI-05`).
- `POST /store/sight-search` — Upload/post image payload; returns matching catalog products (`AI-01`).

### 3.2 Admin Endpoints (`/admin/resale/*` & `/admin/inspections/*`)

- `GET /admin/resale/asks` & `GET /admin/resale/bids` — Marketplace orderbook overview.
- `GET /admin/inspections` — Inspection review queue for physical inventory.
- `POST /admin/inspections` — Record an inspection: upload detail photos/turntables, assign grade, checklist results.
- `PATCH /admin/inspections/:id` — Update status (`approved`/`rejected`).
- `GET /admin/fit-rules` / `POST /admin/fit-rules` — Admin silhouette fit guidance manager.

---

## 4. Third-Party Provider Strategy & Fallbacks

Per standing rules, we keep external credentials cleanly separated:

1. **`AI-01` Search by Sight**:
   - *Production*: Google Cloud Vision API or Vertex AI Multimodal Embedding.
   - *Offline / Zero-Credential Dev Fallback*: Perceptual color & tag extraction / text embedding fallback with honest metadata matching so dev and QA work without paid API keys.
2. **`AI-05` Style Concierge**:
   - *Production*: Gemini API (using official `@google/genai` SDK or Google GenAI CLI) with function calling grounded in `/store/products`.
   - *Offline / Zero-Credential Dev Fallback*: Deterministic styling rule engine recommending complementary silhouettes and collections when `GEMINI_API_KEY` is not set.
3. **Rollout Gates**:
   - `NEXT_PUBLIC_FEATURE_AI_LAYER` (Controls AI-01, AI-02, AI-05)
   - `NEXT_PUBLIC_FEATURE_INSPECTION` (Controls AI-03 360° Viewer)
   - `NEXT_PUBLIC_FEATURE_FIT_STUDIO` (Controls AI-04 Sizing recommendations)
   - `NEXT_PUBLIC_FEATURE_BIDDING` (Controls Ask / Bid CTAs on PDP & Cart)

---

## 5. Implementation Roadmap (Phase 5.5 Waves)

- **Wave 1 (Database & Migrations)**:
  Create `Migration20261114100000.ts` with all 7 tables above and indexes. Run migration and verify zero errors.
- **Wave 2 (Resale & Pricing Backend Module)**:
  Implement services and API routes for asks, bids, price history points, and inspection grading queue.
- **Wave 3 (AI Services & Grounding)**:
  Implement Fit recommendation engine and Style Concierge with catalog grounding.
- **Wave 4 (Storefront UI & Feature Gate Integration)**:
  Implement `AI-01` through `AI-05` screens in `apps/storefront` matching Stitch specifications and responsive tokens.
- **Wave 5 (Admin Inspection & Resale Console)**:
  Implement inspection review and grading forms in `apps/admin`.
