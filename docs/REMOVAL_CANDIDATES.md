# REMOVAL CANDIDATES — The Hidden Label

**Date:** 23 November 2026
**Purpose:** a separate, conservative inventory of features that are redundant, unreachable, out of scope, or confusing. Nothing was removed by this audit. Every entry states what would be affected, whether data is at risk, and a safe strategy.

**Classification:** KEEP · SIMPLIFY · HIDE · DEFER · REMOVE.

> **Rule:** a hidden feature is not necessarily unused, and an unused component is not necessarily safe to delete. Database models and migration history are never deleted as part of UI cleanup.

---

## 1. Summary table

| # | Candidate | Class | Data risk | Effort |
|---|---|---|---|---|
| R1 | Resale orderbook (asks/bids/settle) | DEFER (hide) | None if code kept | Low |
| R2 | Price index (AI-02) | DEFER | None | Low |
| R3 | Inspection certificates (AI-03) | DEFER | None | Low |
| R4 | Sell/consign hub | DEFER | None | Low |
| R5 | AI search by sight (AI-01) | DEFER | None | Low |
| R6 | AI concierge (AI-05) | DEFER | None | Low |
| R7 | Fit Studio (AI-04) | DEFER / OPTIONAL | None | Low |
| R8 | `/verify` and `/verify/[serial]` | REMOVE from UI | None | Low |
| R9 | Admin `/purchasing` (POs/suppliers/ledger) | HIDE until used | PO table is empty | Low |
| R10 | Admin `/reviews` | KEEP + wire into nav | 0 rows | Low |
| R11 | Admin `/payments` as top-level nav | SIMPLIFY | None | Low |
| R12 | Market ticker | SIMPLIFY | None | Low |
| R13 | Duplicate/incorrect policy copy | SIMPLIFY | None | Low |
| R14 | Invoice authenticity sentence | REMOVE | None | Trivial |
| R15 | "Aura-7" branding / floating tab | REMOVE (with AI defer) | None | Low |
| R16 | Fake/placeholder statutory values | REMOVE before launch | None | Low |
| R17 | Unused dependency surface / docs claims | SIMPLIFY | None | Low |

---

## R1 — Resale orderbook (asks, bids, settlement)

- **Files:** `apps/backend/src/api/store/resale/**`, `api/admin/resale/**`, `src/lib/resale.ts`, `modules/thl/models/resale-ask.ts`, `resale-bid.ts`, `consignor-settlement.ts`; storefront `app/sell`, `app/account/bids`, `app/account/asks`, `components/bid-modal.tsx`, `components/price-index-card.tsx`; admin `app/(dashboard)/resale/**`.
- **Dependencies:** `ENABLE_RESALE` / `NEXT_PUBLIC_ENABLE_RESALE`, `NEXT_PUBLIC_FEATURE_BIDDING`.
- **Data:** `resale_ask` (65 rows), `resale_bid`, `consignor_settlement`. No customer money is held.
- **Indirect use:** storefront account menu, PDP, footer, admin nav.
- **Recommendation:** **DEFER**. Server gate already returns 404 when disabled. Finish the job: ensure *all* storefront CTAs (including "Place Bid" on PDP when `FEATURE_BIDDING=true`) are gated by the same flag, and delete no models or migrations.
- **Safe strategy:** keep code and tables; remove entry points; consolidate feature flags into one `ENABLE_RESALE` that also controls bidding UI.

## R2 — Price index

- **Files:** `components/price-index-card.tsx`, `lib/resale.ts`, `api/store/resale/products/[handle]/index`, `price_history_point` (234+ seeded points).
- **Recommendation:** **DEFER** with R1. Do not show valuations in a retail store.

## R3 — Inspection / authentication certificates

- **Files:** storefront `app/inspection/**`, `components/inspection-viewer.tsx`, backend `api/store/inspections/**`, `api/admin/inspections/**`, `condition-inspection` (29 rows).
- **Data risk:** records exist, but are seed/demo; none are attached to a real fulfilment rule.
- **Recommendation:** **DEFER**. Also audit every remaining "authenticated/verified" sentence (invoice, authenticity page, PDP return copy) and remove claims that no enforced process backs.
- **Safe strategy:** keep models; hide routes and nav; rewrite `/authenticity` as a description of the quality-check process *only if* that process is real.

## R4 — Sell / consign hub

- **Files:** `app/sell/**`, `api/store/resale/asks/**`.
- **Recommendation:** **DEFER**. Not part of a retail launch.

## R5 — Search by sight (AI-01)

- **Files:** `components/search-by-sight.tsx`, `api/store/sight-search`, `lib/gemini.ts`.
- **Behaviour:** without a Gemini key it runs keyword/tag matching and labels itself as such; with a key it extracts keywords, not product identity.
- **Recommendation:** **DEFER**. Remove the visual-search control from the search overlay until a provider is funded and evaluated.

## R6 — Style concierge (AI-05)

- **Files:** `components/style-concierge.tsx`, `lib/concierge-session.ts`, `api/store/concierge/chat`, `concierge_thread/message` models.
- **Recommendation:** **DEFER**. Remove the floating tab (it currently overlaps content and is branded "Aura-7", which has no meaning to customers). Reintroduce later as a support assistant with a clear label, not a luxury persona.

## R7 — Fit Studio (AI-04)

- **Files:** `app/fit-studio`, `components/fit-studio-widget.tsx`, `api/store/fit/**`, `silhouette-fit-rule`, `customer_fit_profile`; admin `fit-rules`.
- **Behaviour:** rules-based sizing deltas, not ML. Useful, but only for footwear and only with reliable brand size data.
- **Recommendation:** **DEFER/OPTIONAL**. Keep the static `/size-guide` for launch. If retained, move it inside the PDP size guide, not as a hero CTA or separate nav item.

## R8 — `/verify` and `/verify/[serial]`

- **Files:** `app/verify/page.tsx`, `app/verify/[serial]/page.tsx`, `components/verify-form.tsx`.
- **Evidence:** **0 inbound links** from anywhere in the app; overlaps `/inspection/[serial]`.
- **Recommendation:** **REMOVE** the routes from the launch product (or redirect to a single verification page if the business keeps inspection). No data risk.

## R9 — Admin purchasing

- **Files:** `app/(dashboard)/purchasing/page.tsx`, `lib/api/purchasing.ts`, backend `api/admin/purchase-orders/**`, `suppliers`, `stock-movements`, models `purchase-order*`, `supplier`, `goods-receipt`, `stock-movement`.
- **Evidence:** **0 nav entries**, **0 purchase orders**, 0 suppliers; stock ledger is only reachable here.
- **Recommendation:** **HIDE** the PO/supplier sections behind a flag, and move the **stock ledger** into Inventory. Do not delete models; procurement may be used later.

## R10 — Admin reviews

- **Files:** `app/(dashboard)/reviews/**`, backend `api/admin/reviews/**`, `product_review` (0 rows).
- **Recommendation:** **KEEP and add to nav under Content** once at least one review exists; until then it is an empty room. Do not show "Reviews" in the dashboard counts until the flow is exercised.

## R11 — Admin payments as a nav item

- **Files:** `app/(dashboard)/payments/page.tsx`.
- **Reason:** read-only cross-order view; refunds live on order detail. As a standalone destination it is a dead end.
- **Recommendation:** **SIMPLIFY**: move under Finance & Insights, or fold into Reports; keep the route.

## R12 — Market ticker

- **Files:** `components/market-ticker.tsx`, `app/api` recent-activity proxy.
- **Behaviour:** now backed by real order lines, with honest empty state (a fabricated version was previously removed).
- **Recommendation:** **SIMPLIFY**: keep only if it shows real, permission-safe data; reduce visual weight, remove the pulsing "live" treatment, and hide when empty. Otherwise remove.

## R13 — Duplicate/incorrect policy copy

- **Surfaces:** PDP return text referencing an authentication report; cart/checkout/prepaid copy repeated three times; footer "Track an Order" and "Return Request" both link to `/account/orders`; homepage fallback brand list.
- **Recommendation:** **SIMPLIFY**: one source of truth for return window, shipping, prepaid policy; link "Track order" to a real lookup or the orders page with correct label.

## R14 — Invoice authenticity sentence

- **File:** `app/account/orders/[id]/invoice/page.tsx`.
- **Text:** "Every luxury good is checked and certified for authenticity prior to shipment."
- **Recommendation:** **REMOVE** immediately; replace with a factual line only if an inspection step is enforced.

## R15 — "Aura-7" persona and floating tab

- **Recommendation:** **REMOVE** with R6. It is an internal codename presented to customers and overlaps CTAs on mobile.

## R16 — Placeholder statutory values

- **Surfaces:** invoice GSTIN "Registration not configured"; grievance officer name/phone placeholders; PDP "Declaration pending verification"; seeded support phone `+91 79 4000 0000`.
- **Recommendation:** **REMOVE before launch**. Invoices must not be issued without a registered GSTIN; support numbers must be real.

## R17 — Documentation and dependency drift

- **Docs:** README resale positioning, HANDOFF's 90 %/51-test/COD claims, BUILD_LOG's COD verification, SCREEN_MAP's stale inventory.
- **Dependencies:** `package.json` root has scripts and devDeps for features some of which may be unused; the remote's latest commit prunes some. Run a dependency review after scope is fixed.
- **Recommendation:** **SIMPLIFY**: rewrite README to the agreed scope; mark old planning docs as historical; keep one status document.

---

## 2. Explicitly NOT recommended for removal

| Item | Why |
|---|---|
| Any migration file | Applied history; deleting breaks environments |
| `payment_operation`, `refund_operation`, `credit_note`, `audit_event`, `webhook_event` | Financial/statutory and audit evidence |
| `return_request`, `return_item`, `shipment`, `shipment_event` | Live operational history |
| Product/variant/inventory/cart/order Medusa tables | Core commerce |
| Audit logging, RBAC middleware, env guard, rate limiting | Security controls |
| GST library and Zod schemas | Reused by invoices and checkout |
| Resale tables and models | Inert when gated; deleting costs future optionality |

## 3. Safe removal sequence (when approved)

1. Decide scope in writing; record it in one document and update README.
2. Convert all add-on flags into a single server-enforced switch; remove every entry point and route that the switch disables.
3. Remove orphaned links/screens (`/verify`, purchasing unless used, duplicate nav items).
4. Fix copy and statutory data.
5. Only then consider deleting dead component files; run typecheck, lint, tests and a full build after each batch.
6. Never drop tables/columns in the same change as UI cleanup.
