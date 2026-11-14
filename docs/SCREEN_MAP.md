# THE HIDDEN LABEL — Screen Inventory & Feature Map

Derived from the Stitch project's own **"Prototype Specification & Link Manifest"** screen
(code `SPEC-00`, title *Prototype Specification & Link Manifest*), cross-checked against the
project's screen instances.

- Declared wired screens: **49** · artefacts in the coded manifest: **50**
- Every screen is a **desktop** frame (1280 or 2560 wide). No mobile frames exist → mobile is derived (`DESIGN_TOKENS.md` §7).
- Screen codes below (`U-*`, `A-*`, `AI-*`, `SYS-*`) are the canonical references used in all
  commits, PR descriptions, tickets and QA reports. Quote the code, not the title.

---

## 1. Storefront (26 screens + design system)

| Code | Screen | Route (proposed) | Data / actions it requires | Notes |
|---|---|---|---|---|
| SYS-00 | Design System Foundation | `/design` (dev-only) | none — tokens | Reference build target for G1 |
| U-01 | Homepage | `/` | curated collections, drops, CMS banners, featured brands | editorial hero |
| U-02 | Mega Menu Experience | component | category tree, brand list | overlay, not a route |
| U-03 | Brand Directory | `/brands` | brands, A–Z index, item counts | anchor matrix |
| U-04 | Nike Brand Vault | `/brands/[handle]` | brand, faceted product query | template for any brand vault |
| U-05 | Sneakers Catalog | `/collections/[handle]` | facets, sort, pagination, stock state | **has skeletons + empty state designed** |
| U-06 | Search Overlay | component | typeahead across products/brands/SKUs | keyboard-navigable |
| U-07 | Search Results ("JORDAN") | `/search?q=` | result count, zero-result fallback | "23 matched pairs" copy |
| U-08 | Product Detail (AJ1 Retro High OG) | `/products/[handle]` | variants, size×stock grid, gallery, auth record, size guide link | richest screen; variant state is the core |
| U-09 | Quick View Modal (Samba OG) | component | variant stock, add-to-bag | desktop modal + mobile sheet |
| U-10 | Wishlist (Saved Collection) | `/account/wishlist` | stored items, move-to-bag, empty state | requires auth |
| U-11 | Cart Drawer (Your Bag) | component | cart, subtotal, promo, shipping estimate | slide-in |
| U-12 | Cart Page (full) | `/cart` | recalculation, promo engine, stock revalidation | 2-column |
| U-13 | Checkout (Payment & Settlement) | `/checkout` | address, shipping options, payment intent | **see ORDER_STATE_MACHINE.md** |
| U-14 | Order Confirmed (#THL-2481) | `/checkout/confirmation/[id]` | verified order, milestone tracker | must not render on browser return alone; **no RFID certificate in v1** (D2) |
| U-15 | Login (Specimen Vault Auth) | `/login` | session, field errors | split editorial layout |
| U-16 | Register (Create Vault Account) | `/register` | account create, OTP dispatch | "KYC flags" copy → Q4 |
| U-17 | OTP Verification | `/verify` | 6-digit code, resend, rate limit | phone-based |
| U-18 | Customer Dashboard | `/account` | profile, tier, recent orders | "collector tiers" |
| U-19 | Order History (My Acquisitions) | `/account/orders` | orders, status filters, pagination | |
| U-20 | Customer Order Detail | `/account/orders/[id]` | tracking timeline, line items, reverse action | |
| U-21 | Return Request (#THL-2476) | `/account/orders/[id]/return` | eligibility rules, 3-step stepper, AWB | |
| U-22 | FAQ & Support Hub | `/support` | knowledge base, ticket intake | |
| U-23 | About & Contact | `/about` | CMS content, salon/store info | |
| U-24 | Policies & Terms Hub | `/policies/[slug]` | privacy, terms, shipping, cancellation, returns | legal copy needed → Q5 |
| U-25 | Size Guide (Find Your Fit) | `/size-guide` | size charts, foot measurement | |
| U-26 | Authenticity Guarantee Protocol | `/authenticity` | protocol **content page only** in v1 | no RFID, no verification record, no "verified" badge on products (D2) |

---

## 2. Admin (17 screens + design system)

Separate app, separate auth, separate deploy. Every route enforces RBAC server-side.

| Code | Screen | Route | Data / actions |
|---|---|---|---|
| SYS-01 | Admin Design System | `/design` (dev-only) | dark ops palette, status chips |
| A-01 | Admin Dashboard Overview | `/` | KPIs, revenue velocity, recent orders/returns feeds |
| A-02 | Product Management List | `/products` | list, batch actions, stock telemetry, sort/filter |
| A-03 | Add Product Flow | `/products/new` | variant matrix, media, publish checklist |
| A-04 | Brand Management | `/brands` | brand CRUD, partnership tier |
| A-05 | Category Management | `/categories` | taxonomy tree, banner config |
| A-06 | Inventory Management | `/inventory` | location allocation, low-stock flags, adjustments |
| A-07 | Order Management | `/orders` | list, fulfillment status, filters |
| A-08 | Admin Order Detail | `/orders/[id]` | line items, action bar (capture, fulfil, refund, cancel) |
| A-09 | Customer Management | `/customers` | profiles, tier, order history, risk flag |
| A-10 | Payments & Refunds Console | `/payments` | transactions, refund initiation, gateway state |
| A-11 | Shipping Management | `/shipments` | AWB, dispatch, courier, tracking sync |
| A-12 | Returns Management | `/returns` | reverse inspection, restock decision |
| A-13 | Coupons & Promotions | `/promotions` | discount rules, expiry, usage limits |
| A-14 | Content / CMS Management | `/content` | homepage banners, drops, editorial pages |
| A-15 | Reports & Analytics | `/reports` | sales, cohorts, exports |
| A-16 | Settings & Governance | `/settings` | admin users, roles, permissions, store config |
| A-17 | Audit Log & Activity Stream | `/audit` | append-only event stream, filters |

---

## 3. AI / resale layer — **IN SCOPE for v1, as Phase 5.5** (D1 reversed by D7, 2026-11-14)

**Status changed.** D1 (2026-11-14) originally deferred this to V2. D7 (2026-11-14) reversed
that: the client confirmed the product is explicitly a CultureCircle-style resale/authentication
marketplace, so these screens are required for v1, not optional polish. They are still built as
their **own planned phase (P5.5)**, after the core storefront/admin (P4/P5) are verified — not
retrofitted ad hoc into pages that assume a single sell price.

| Code | Screen | Implied capability | Flag (rollout gate, default off until built) | v1 target behaviour |
|---|---|---|---|---|
| AI-01 | Search by Sight | vision model + visual similarity index | `NEXT_PUBLIC_FEATURE_AI_LAYER` | real visual search once a vision API/model is chosen |
| AI-02 | The Price Index | per-size price history, asks/valuation feed | `NEXT_PUBLIC_FEATURE_AI_LAYER` | real ask/bid price history per variant |
| AI-03 | 360° Inspection Viewer | turntable media + graded condition report | `NEXT_PUBLIC_FEATURE_INSPECTION` | real condition-grading workflow + photos, per D2 |
| AI-04 | Fit Studio | sizing recommendation engine | `NEXT_PUBLIC_FEATURE_FIT_STUDIO` | real sizing recommendation, not a static chart |
| AI-05 | Style Concierge (Aura-7) | LLM chat + shoppable outfits | `NEXT_PUBLIC_FEATURE_AI_LAYER` | real chat backed by catalogue data |

Bid / ask / valuation CTAs inside `U-02`, `U-04`, `U-08` and `U-13` are gated by
`NEXT_PUBLIC_FEATURE_BIDDING`. Each flag flips on only once its backing data model and workflow
are actually built and tested — never render the UI ahead of the real data (D2 still applies in
full: no "verified"/"deadstock"/authentication claim without a real backend record behind it).

### Phase 5.5 scope (new data model required, not frontend-only)

- Resale mechanics: **asks, bids**, per-size/variant **price history**, valuation feed
- **Condition grading**: a real authentication/inspection workflow + photo capture, admin review
  queue, grade stored per unit — this is what AI-03's "360° Inspection" and any "verified" badge
  must be backed by
- `AI-01` Search by Sight: a visual-similarity/image-search capability (third-party vision
  API or a trained index) — needs a provider decision and cost estimate, same category as
  Razorpay/Shiprocket (external credential needed before it can go live)
- `AI-05` Style Concierge: an LLM-backed chat with real catalogue grounding — needs an LLM
  provider/API key decision
- RFID / physical serialisation authentication stays **deferred** per D2 until a real
  serialisation process is approved — condition grading does not require RFID to start

Each of the above needs its own mini design pass (data model, admin workflow, third-party
cost/provider) before implementation — treat P5.5 as its own `docs/`-style plan, not a quick
add-on, same rigor as P3's commerce model.

---

## 4. Resolved Stitch screen resource IDs

Use `projects/10766877595551018159/screens/{id}/fileEntries/html` for markup and
`.../fileEntries/screenshot` for the PNG.

| Code | Stitch id |
|---|---|
| SYS-00 | `02cc6eae22694ecb9bc9e1285202fce9` |
| SPEC-00 | `4feaaf3fb51d4db4a19e7d244a244f68` |
| U-02 | `8525c7cc930a446a8a362021b5b47238` |
| U-03 | `0e68bf5592df4c499f3e86591a9bc0b3` |
| U-04 | `1e8f079016d141eb9861448e1fc6c292` |
| U-07 | `2fdd836745c944aabc8b720a564e01b6` |
| U-09 | `70213cdcb0574ed1a14f9cda9c35b390` |
| U-10 | `922d37bbf54e4a558fba1f026bc8c1e0` |
| U-11 | `436a9258b8bd4931a903e905db3207eb` |
| U-12 | `12f886c5ebdd46898ee86ca9c542ee94` |
| U-13 | `4c2624d46f2b4b77b5725baeb486cdec` |
| U-14 | `19e0da996dd545c9bec90422a6f9c02b` |
| U-17 | `1a84b5ed84024690be4b3598b049039d` |
| U-20 | `6b67789e0c6b40cdbd503800a8d69cf9` |
| U-21 | `84dc0b39becd4fdd8214265ee24f5bce` |
| U-22 | `37fd4af209e64d1a93b7800d888f68ad` |
| U-23 | `53a972d800c84704ab9cb34855fa824b` |
| U-25 | `5d9ae8079a954594add8d6e13ed24d5a` |
| U-26 | `4043307cd10546bc8f1759a60cb29de6` |
| SYS-01 | `7cacb60d5d694729976f29dd34fbaefd` |
| A-01 | `8c336167f60540e89ab0422242120616` |
| A-02 | `7dec01e21af54e439e0acc667f9ea223` |
| A-03 | `56f01e3faa7844f19ea2aec1ac015c72` |
| A-07 | `20e785f3a3f64e41bbc5d02f615ace8c` |
| A-08 | `962be32bd4ed479ba8a1312f7d24d459` |
| A-09 | `70feae27769b4ed9b21fe4670592a9a7` |
| A-10 | `8334a645b18c4194a826e5d0bcfe644c` |
| A-11 | `9e4c2ec4c16b49c1b88042391815bf6d` |
| A-12 | `0a2c0a07e7de45a3b47549fe5edb94ca` |
| A-16 | `271db4c4a26f468991c7a56e172183d2` |
| A-17 | `7f7320215e0649f7b5560d70af1a8a30` |
| AI-02 | `9fbdc11111f94c82ba022ccc69d55de9` |
| AI-03 | `a2f1792c14ab47be8572cad1624eb321` |
| AI-04 | `8e2d93bc159043deaf25d041ad644da4` |

Unresolved at audit time (Stitch's list API truncates this project; retrieve per screen):
U-01 homepage, U-05, U-06, U-08 PDP, U-15, U-16, U-18, U-19, U-24, A-04, A-05, A-06, A-13,
A-14, A-15, AI-01, AI-05. Resolve these in Phase 1 and append here — do not start page work
without having seen the frame.

---

## 5. Missing screens / states to design or decide (blocking for G3)

Stitch is "complete" for the happy path but these are absent and every one of them is
reachable in a working store:

| Gap | Why it blocks | Suggested resolution |
|---|---|---|
| Address book / add-address | checkout cannot store a second address | derive from U-15 field patterns |
| Forgot password / reset | session recovery | derive; needs email template |
| Email verification result | if email verification is enabled | reuse OTP screen pattern |
| 404 and 500 pages | every real site needs them | typographic page on canvas |
| Invoice / printable order | Indian retail expectation | mono-typography invoice |
| Order cancellation | before-dispatch cancellations exist | action on U-20 with reason modal |
| Search zero-results | U-07 has fallback but no empty route-out copy | extend U-07 |
| Admin: brand create/edit form | A-04 is a directory | derive from A-03 patterns |
| Admin: category create/edit | A-05 is a tree | derive |
| Admin: coupon create/edit | A-13 is a list | derive |
| Admin: roles/permission editor | A-16 is settings landing | derive |
| Mobile frames (all) | no mobile designs exist | derive per `DESIGN_TOKENS.md` §7 |
| Transactional email designs | receipt, shipping, OTP, reset | plain branded templates; approve copy |
| Cookie/consent notice | if analytics is enabled | small, non-modal |
