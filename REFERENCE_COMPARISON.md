# Reference vs Our Website — Comparison

## 0. Reference source and limitation

**No live reference website URL or credentials were provided.** The reference available in this workspace is:

- **Google Stitch project `10766877595551018159`** — “The Hidden Label Design System”, 50 declared screen artefacts (49 wired), desktop-only frames at 1280/2560, design tokens verified through the Stitch API (Syne / Hanken Grotesk / JetBrains Mono, canvas `#f8f7f4`, ink `#111111`, accent `#c5a880`, 0px radius).
- **`docs/SCREEN_MAP.md`** — canonical screen codes `U-01…U-26`, `A-01…A-17`, `AI-01…AI-05`, `SYS-00/01`, routes, data requirements, missing states.
- **`docs/OMNICHANNEL_MASTER_ARCHITECTURE.md`** — the real-business reference model: CultureCircle (resale/price index/bidding), Crepdogcrew (multi-brand + Indian payment rails + stores), Farfetch/Kith (bespoke, editorial, white-glove). This document defines the *behavioural* reference the client asked us to match.

Because no live reference could be executed, every “Reference behaviour” row below is sourced from those documents, not from a live site. Rows marked **UNVERIFIED** could not be compared to a running reference.

---

## 1. Screen-level matrix

| Feature | Reference behaviour (source) | Our implementation | Test result | Gap |
|---|---|---|---|---|
| Homepage (U-01) | Editorial hero, drops, brands, CMS banners, activity | Editorial hero, 8 latest products, live resale ticker, concierge | ✅ SF-01 | CMS banners/drops not driven by CMS blocks (static editorial) |
| Mega menu (U-02) | Category tree + brand list overlay | Header links + catalogue category pills | ⚠️ Partial | No mega-menu overlay |
| Brand directory (U-03) | A–Z index, item counts | `/brands` directory, 34 brands | ✅ SF-08 | A–Z/counts not evident |
| Brand vault (U-04) | Brand + faceted products | `/brands/[handle]` | ✅ SF-09 | — |
| Catalogue (U-05) | Facets, sort, pagination, stock state, skeleton/empty | 17 products, 6 category pills, price/size/brand, sort | ✅ SF-02..07 | No pagination (48-item cap); skeletons removed |
| Search overlay (U-06) | Typeahead, keyboard nav, SKUs | Header search overlay + `/api/search` | ✅ SF-10/11 | SKU search not verified |
| Search results (U-07) | Count + zero-result fallback | Real results + honest empty state | ✅ | — |
| PDP (U-08) | Variant stock grid, gallery, auth record, size guide | Sizes, Buy Now, price index, 360 viewer, fit, bespoke drawer | ✅ SF-30/31 | No gallery zoom; duplicate sticky CTA |
| Quick view (U-09) | Desktop modal + mobile sheet | **Absent** | ❌ MISS-QV | Missing |
| Wishlist (U-10) | Stored items, move-to-bag, empty state | Save/remove/list; page renders | ✅ WL-01..03 | No “move to bag” |
| Cart drawer (U-11) | Slide-in cart | **No drawer**; header links to `/cart` | ⚠️ Partial | Missing quick-access drawer |
| Cart page (U-12) | Recalculation, promo, stock revalidation | Server cart, ±, remove, totals, empty | ✅ CART-04 | No promo engine in UI |
| Checkout (U-13) | Address, shipping, Razorpay/UPI/EMI/COD | 3-step checkout, 2 shipping options, COD + OTP, pickup | ⚠️ Partial | Only COD live; UPI/QR/cards/EMI are UI labels, no gateway keys |
| Order confirmed (U-14) | Verified order, milestones, no fake RFID | Server-verified confirmation page | ✅ | Milestone tracker limited |
| Login (U-15) | Split editorial auth | Split layout, working login | ✅ | — |
| Register (U-16) | Account + OTP dispatch | 3-step Medusa registration + OTP | ✅ | API accepts malformed email/password |
| OTP (U-17) | 6-digit, resend, rate limit | `/verify`, 3/15min limit, 5 attempts | ✅ | Email delivery is dev-echo only |
| Dashboard (U-18) | Profile, tier, recent orders | Profile, recent orders, nav | ✅ | No collector tier shown |
| Order history (U-19) | Orders, filters, pagination | List + detail | ✅ | No status filters/pagination |
| Order detail (U-20) | Tracking timeline, reverse action | Items, address, shipment/AWB timeline | ⚠️ | No fulfilment status; no cancel |
| Return request (U-21) | Eligibility, 3-step stepper, AWB | Eligibility enforced (422 before delivery), one form | ⚠️ | No stepper/AWB; no post-submit tracking page |
| FAQ/support (U-22) | Knowledge base + ticket intake | CMS support page | ⚠️ | No ticket intake |
| About/contact (U-23) | CMS + salon info | CMS page with store address | ✅ | No contact form |
| Policies (U-24) | Privacy/terms/shipping/returns | **All 4 routes 404** | ❌ SF-15..18 | Broken integration |
| Size guide (U-25) | Charts + measurement | Static + Fit Studio | ✅ | — |
| Authenticity (U-26) | Protocol content only, no fake badges | Content + real inspection records | ✅ | Honest: no blanket “verified” badge |
| AI-01 Search by sight | Vision similarity | Keyword/tag fallback, honestly labelled | ⚠️ | No real vision analysis in the tested config |
| AI-02 Price index | Per-size history, asks/bids | 234 points, asks/bids, 30d trend | ✅ | — |
| AI-03 360 inspection | Turntable, grade, checklist | 26 inspections, public certificate, admin queue | ✅ | Admin verdict updates public record |
| AI-04 Fit studio | Sizing engine | Metric → UK size, silhouette rules | ✅ | Admin rules read-only |
| AI-05 Concierge | LLM chat, shoppable outfits | Gemini attempt + honest fallback | ⚠️ | 28.5s latency on fallback path |
| Admin dashboard (A-01) | KPIs, feeds | KPIs, status counts, recent orders | ✅ | — |
| Products (A-02/03) | List, batch actions, variant matrix, publish | List, create, publish, variants, price edit, delete | ✅ | No batch actions/media upload |
| Brands (A-04) | CRUD + tier | Full CRUD + audit | ✅ | — |
| Categories (A-05) | Taxonomy tree + banner | Category list/create | ⚠️ | No tree |
| Inventory (A-06) | Locations, low stock, adjustments | List, low filter, adjust + audit | ✅ | — |
| Orders (A-07/08) | Filters, action bar, capture/fulfil/refund/cancel | List/detail, capture/refund work; **fulfil broken** | ❌ | Critical |
| Customers (A-09) | Profiles, tier, notes, risk | List/detail, notes/tier | ✅ | No risk flag |
| Payments (A-10) | Transactions, refunds, gateway state | Payments/refund views | ✅ | No live gateway state |
| Shipping (A-11) | AWB, dispatch, courier sync | Create/update shipment, AWB, timeline | ✅ | Manual only (no Shiprocket keys) |
| Returns (A-12) | Reverse inspection, restock | List/detail; **approve/reject broken** | ❌ | Critical |
| Promotions (A-13) | Rules, expiry, usage limits | List/new; **create always fails** | ❌ | High |
| CMS (A-14) | Banners, drops, editorial | List/create/edit/publish; single-segment only | ⚠️ | Multi-segment slugs 404 |
| Reports (A-15) | Sales, cohorts, exports | Dashboard reports + CSV export | ⚠️ | Exports not executed in this audit |
| Settings (A-16) | Users, roles, permissions | Users, invites, roles | ❌ | Role enforcement broken |
| Audit log (A-17) | Append-only stream | 76 events, filters | ✅ | No chain verification (per D2, plain log) |
| A-18..20 | Inspections, resale orderbook, fit rules | All render; inspection write works | ✅/⚠️ | Fit rules read-only |

---

## 2. Behavioural gaps versus the omnichannel blueprint

| Reference capability | Blueprint requirement | Our state | Gap |
|---|---|---|---|
| Bespoke measurement studio | Chest, waist, shoulder, sleeve, inseam, fit, monogram; stored on line item | Drawer works, validation 26–64in, stores `metadata.custom_measurements` | ✅ |
| Tailor pipeline | Measurements Verified → Cutting → Stitching → QC → Ready | Admin UI + `order.metadata.bespoke_stage`; **storefront has no tracker** | ⚠️ Customer cannot see tailoring stage |
| Indian payment stack | UPI intent/QR, cards, 0% EMI, COD+OTP | COD only; others are presentation text | ❌ No gateway integration |
| Partial COD token | ₹500–1,000 UPI deposit | Absent | ❌ |
| Store pickup | Free pickup, 2–4h ready | Present in checkout + order metadata | ✅ |
| Unified inventory | Store + web single ledger | Single Medusa stock ledger; admin adjust works | ✅ |
| WhatsApp/SMS notifications | Order + concierge notifications | Email stub only, no provider | ❌ |
| Resale bidding | Ask/bid/price history | 55 asks, 55 bids, index, bid/ask creation & cancel | ⚠️ Cancelled asks still visible |
| Authentication/inspection | Real unit grading, admin queue | 26 inspections, public serial page, admin verdict | ✅ |
| White-glove/editorial | Lookbooks, luxury packaging | Editorial styling exists; no lookbook CMS | ⚠️ |

---

## 3. Compliance / honesty (D2) check

| Claim class | Requirement | Result |
|---|---|---|
| “Verified/authentic” badges | Only when a real inspection record exists | ✅ No unconditional badge found on catalogue/PDP; inspection status shown per unit |
| Fabricated fallback prices | Never | ✅ No ₹15,000 fallback observed; missing prices render honestly |
| Competitor price comparison | Not without real quotes | ✅ Removed / not present |
| “Live activity” ticker | Must be real data | ✅ Backed by `/store/resale/recent-activity`; audit order appeared in it |
| AI claims | Must not overstate vision/LLM | ✅ API labels `keyword_tag_matching_fallback`; concierge copy avoids authenticity claims |

---

## 4. Parity verdict

- **Working parity:** catalogue, PDP, cart, COD checkout, auth/OTP, wishlist, bids, asks, price index, 360 inspection, fit studio, all admin reads, brand/product/CMS/inventory/shipment/settings writes, audit stream.
- **Partial parity:** payments (COD only), notifications, quick view, cart drawer, custom tailoring visibility, promotions, CMS page rendering, admin fit rules.
- **Broken parity:** admin fulfilment, admin returns, order detail header, policy pages, mobile header.
- **Missing parity:** live gateway rails, invoices, cancellation, customer returns history, promo redemption, generic CMS pages, mega menu, ticket intake, WhatsApp.

**Reference feature parity: 68 / 100.** Of the 50 declared reference screens, 34 have a working route/behaviour; 9 are partial; 7 are absent or broken (U-09, U-11 drawer, U-21 stepper, U-24, A-08 action, A-12 action, A-13 create).
