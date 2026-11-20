# 11 — REAL-WORLD ECOMMERCE BUSINESS OPERATIONS AUDIT

The question here is **not** "is the code good" but "can this application run a premium Indian retail business with a bespoke atelier and a resale/authentication arm". Each capability is marked:

`IMPLEMENTED+VERIFIED` · `IMPLEMENTED (unverified)` · `PARTIAL` · `MISSING` · `NOT REQUIRED YET`

---

## A. Premium retail operations

| Capability | State | Evidence / note |
|---|---|---|
| Supplier records | **MISSING** | no supplier table, route or UI anywhere |
| Supplier purchase orders | **MISSING** | — |
| Purchase cost | **MISSING** | product and variant have no cost field; no margin is computable |
| Goods-received notes | **MISSING** | stock arrives only through `db:seed` or a manual `+delta` adjustment |
| Quality inspection on receipt | **MISSING** (inbound) | `condition_inspection` is per-unit authentication for resale, not supplier QC |
| SKU generation | **PARTIAL** | Medusa `inventory_item.sku` and variant SKU exist and are searchable; admin product creation does not generate them |
| Inventory locations | **PARTIAL** | `stock_location` exists; admin operations assume `stock_location.first()` |
| Warehouse operations (pick/pack) | **MISSING** | fulfilment is a single click that fulfils all pending quantities |
| Product margin | **MISSING** | no cost basis |
| Reordering / reorder points | **PARTIAL** | low-stock threshold is a hardcoded `≤ 3` in two queries, not a per-product reorder point |
| Stock ageing | **MISSING** | no `stock_movement` ledger to age |
| Supplier invoices | **MISSING** | — |
| Supplier payment tracking | **MISSING** | — |
| Multi-brand merchandising | **IMPLEMENTED (unverified)** | `brand` module + `product_brand`, `/brands` storefront, admin CRUD |
| Category taxonomy | **IMPLEMENTED (unverified)** | real `product_category` tree, seeded, rendered as mega-menu |
| Promotions / discount codes | **IMPLEMENTED (unverified)** | Medusa promotions + admin UI + cart promo input |
| CMS / editorial | **IMPLEMENTED+VERIFIED (read)** | `cms_page`, `/policies/*`, `/about`, multi-segment slugs |
| Store pickup ("click & collect") | **IMPLEMENTED (unverified)** | `store_pickup` fulfilment mode with the Sindhu Bhavan Road address, free shipping option |
| GST invoicing | **IMPLEMENTED (unverified)** | per-order invoice page, CGST+SGST vs IGST by state |
| Returns | **IMPLEMENTED (unverified)** | 7-day window, eligibility, grading, restock |

**Readiness: retail browse/sell path is close; the back office that buys, costs and replenishes the goods is absent.**

---

## B. Bespoke tailoring

| Capability | State | Evidence |
|---|---|---|
| Consultation booking | **MISSING** | no booking model or screen |
| Customer measurement profiles | **PARTIAL** | per-line `metadata.custom_measurements` (chest, waist, shoulder, sleeve, inseam, fit preference, notes) and `customer_fit_profile` for foot sizing; no persistent body-measurement profile on the customer |
| Measurement revisions | **MISSING** | each order line is a snapshot with no history |
| Fabric catalogue | **MISSING** | no fabric entity, no swatches, no selection |
| Customisation options | **PARTIAL** | free-text notes + fit preference; no structured option set (lapel, lining, monogram) |
| Design approvals | **MISSING** | — |
| Quotations | **MISSING** | bespoke is priced as a normal variant |
| Customer approvals | **MISSING** | — |
| Production job cards | **PARTIAL** | the admin order page renders a "master tailor sheet" from the line metadata — a printable view, not a job entity |
| Tailor assignments | **MISSING** | — |
| Production milestones | **IMPLEMENTED (unverified)** | 5-stage `bespoke_stage` metadata (`measurements_verified → fabric_cutting → stitching → qc_passed → ready_for_pickup`) shown to customer and admin |
| Fittings | **MISSING** | — |
| Alterations | **MISSING** | — |
| Quality inspection (garment) | **PARTIAL** | `qc_passed` is a stage flag, not an inspection record |
| Final delivery | **PARTIAL** | handled by the generic shipment flow |

**Readiness: the customer can specify measurements and watch a stage tracker; the atelier cannot run a real made-to-measure workflow in this system.**

---

## C. Resale and authentication

| Capability | State | Evidence |
|---|---|---|
| Resale intake | **MISSING** | no intake entity, no "receive item" action |
| Item ownership declaration | **MISSING** | no declaration or T&C acceptance record for consignors |
| Intake references | **MISSING** | — |
| Product condition grading | **IMPLEMENTED (unverified)** | `condition_inspection` with grade, checklist JSON, turntable frames, verdict, inspector |
| Authentication checklist | **IMPLEMENTED (unverified)** | checklist stored per inspection; admin review queue |
| Inspector records | **PARTIAL** | `inspector` field on the inspection; no inspector identity/role entity |
| Authentication decisions | **IMPLEMENTED (unverified)** | verdict approve/reject with audit |
| Evidence records | **IMPLEMENTED (unverified)** | frames + public certificate page `/inspection/[serial]`, `/verify/[serial]` |
| Pricing | **PARTIAL** | consignor sets an ask with a live 9.5% fee estimate; no algorithmic or admin price guidance |
| Consignment terms | **MISSING** | no terms record, no acceptance timestamp |
| Seller settlements | **MISSING** | payout is *displayed* (`ask × 0.905`) and `calculateConsignorPayout()` exists in `lib/resale.ts`, but **no settlement row, no payout status, no bank details** — Bank transfer is mentioned in copy only |
| Authentication disputes | **MISSING** | — |
| Resale-specific returns | **PARTIAL** | the generic RMA flow applies; no resale-specific policy |
| Bidding / asks orderbook | **IMPLEMENTED (unverified)** | `resale_ask`, `resale_bid`, price index, `/account/asks`, `/account/bids`, admin orderbook |
| Bid → order conversion | **MISSING** | accepting a bid does not create an order; no matching engine |

**Readiness: the *authentication* half is genuinely real and DB-backed. The *consignment commerce* half (intake → settlement) is not built. A consignor can list a price today and never be paid by the system.**

---

## D. Customer relationship management

| Capability | State |
|---|---|
| Customer profiles | **IMPLEMENTED (unverified)** — customers list/detail, internal notes |
| Purchase history | **IMPLEMENTED+VERIFIED (read)** — orders filter by customer id |
| Customer segmentation | **MISSING** |
| Support tickets | **IMPLEMENTED (unverified)** — customer form → `support_ticket` → admin inbox |
| Complaint tracking | **PARTIAL** — ticket status only; no SLA, no escalation, no linkage to order/return |
| Customer preferences | **PARTIAL** — fit preference, wishlist, addresses |
| Loyalty / membership | **MISSING** |
| Marketing consent | **PARTIAL** — privacy consent is captured; **marketing** consent is not |
| Communication history | **MISSING** — no log of emails/WhatsApp sent per customer |
| Risk indicators | **IMPLEMENTED (unverified)** — risk/blacklist flag on customer, refund reasons taxonomy |

---

## E. Finance and accounting

| Capability | State |
|---|---|
| Sales reporting | **PARTIAL** — captured/refunded totals and order counts, no date range |
| GST computation | **IMPLEMENTED+VERIFIED (read code, prior round claims live)** — 5/12/18/28 slabs seeded, 18% default, intra vs inter-state split |
| GST return/export | **MISSING** |
| Credit notes | **MISSING** — refunds update `return_request`/`payment`, no credit-note document |
| Refunds | **IMPLEMENTED (unverified)** — admin refund workflow + provider refund; offline message for non-captured payments |
| Gateway reconciliation | **MISSING** |
| Shipping expenses | **MISSING** — courier cost is not recorded, only charged ₹199 or ₹0 |
| Purchase costs | **MISSING** |
| Supplier balances | **MISSING** |
| Gross margin | **MISSING** (no cost data) |
| Inventory valuation | **MISSING** (no cost data) |
| Daily reconciliation | **MISSING** |

---

## F. Compliance (Indian ecommerce)

| Area | Assessment |
|---|---|
| GST registration display | Layout present, **value unset** |
| GST invoice format | Implemented with CGST/SGST/IGST split and HSN — needs accountant review |
| Legal Metrology declarations | Implemented on PDP; **country of origin defaults to "India"** which is wrong for imported labels |
| Consumer Protection (E-Commerce) Rules | Grievance officer page + footer exist; **names/contacts are placeholders**; SLA copy present |
| Return/refund policy disclosure | Present, consistent with the coded 7-day window |
| DPDP Act 2023 | Consent capture, export and deletion implemented; no retention policy; no consent-manager integration |
| DLT (SMS) | Not registered — blocks SMS OTP |
| Invoice/credit-note numbering | No credit notes at all |
| Product declarations (material/care) | Free-text description only |

**Everything in section F requires professional legal/accounting confirmation. This report makes no legal determination.**

---

## G. Business-model decision still open

`CURRENT_PROJECT_STATUS.md` records an unresolved product decision: whether the platform is a **StockX-style bid/ask orderbook** (which is what is built) or a **CultureCircle-style fixed-price catalogue with price comparison** (which the referenced competitor actually is). The code, copy and navigation all assume the former. This is a business decision that changes the roadmap materially — it is not an engineering gap.

---

## H. Operating-readiness verdict by business function

| Function | Verdict |
|---|---|
| Selling a ready-to-wear item end-to-end | **NOT READY** (payment disabled, email disabled) |
| Fulfilling an order | **CONDITIONALLY READY** (manual only; no AWB without Shiprocket) |
| Handling a return | **CONDITIONALLY READY** (logic complete, unexercised) |
| Buying and replenishing stock | **NOT READY** (no purchasing module) |
| Running a bespoke atelier | **NOT READY** (no consultation/quote/job-card/fitting workflow) |
| Running a consignment business | **NOT READY** (no intake, no settlement) |
| Authenticating product | **CONDITIONALLY READY** (real records, manual process) |
| Financial control and reporting | **NOT READY** (no cost, margin, reconciliation or GST report) |
| Customer support | **CONDITIONALLY READY** (inbox exists, no SLA/assignment) |
| Compliance posture | **CONDITIONALLY READY** (structures exist, values/legal review missing) |
