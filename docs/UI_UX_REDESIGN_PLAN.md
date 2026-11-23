# UI/UX REDESIGN PLAN — The Hidden Label

**Date:** 23 November 2026
**Scope:** design direction, information architecture, screen-level plans, and a component/token system for the customer storefront and the staff admin. This is a plan; no application code was changed.

---

## 1. Design principles

1. **Product first, chrome last.** Photography, fit, and price get the space; tickers, badges and floating widgets do not.
2. **Quiet luxury, not wireframe.** Keep the 0-radius brutalist identity as an accent, but introduce air, scale and a single warm accent. Borders should mean something.
3. **One flag, one layer.** A customer must never see a control that the backend will refuse. Deferred features are not "hidden with CSS"; they are not rendered.
4. **Mobile is the primary storefront.** Design at 390 px first; desktop is the expanded composition.
5. **Every claim is backed by a record.** No "authenticated", no "verified", no invented urgency, no fabricated comparisons.
6. **Admin is a workshop, not a catalogue of endpoints.** Organise by the work an operator does in a day.

---

## 2. Competitor patterns worth adopting (IA, not copying)

| Reference | Pattern to adopt |
|---|---|
| Farfetch / SSENSE | Editorial PDP with multiple large images, brand story, size guide beside size selector, delivery estimate near CTA |
| MR PORTER | Calm nav with few top-level items, strong photography, "New in" merchandising, clear care/details accordions |
| END. | Dense but scannable catalogue filters, sticky filter bar on mobile, size availability surfaced on cards |
| Shopify storefronts (Dawn-tier) | Predictable cart drawer, free-shipping threshold, trust row (returns, delivery, support), accessible forms |
| Indian fashion commerce | Prepaid clarity, pincode/COD expectations, GST-inclusive pricing, exchange-first returns, WhatsApp support |
| Shopify Admin | Grouped left nav, needs-attention home, saved views, bulk actions, inline editing |
| Stripe Dashboard | Dense tables with right-aligned numbers, filters as chips, drill-down detail with timeline |
| Modern OMS | One order cockpit: payment, fulfilment, shipment, return, notes in one place |

Avoid: copying Farfetch's scale of imagery without a photography budget; copying CultureCircle's resale vocabulary into a retail launch.

---

## 3. Customer design direction

### 3.1 Brand expression
- **Palette:** bone `#F8F7F4` canvas, ink `#111111`, warm line `#E4E4E7`, champagne `#C5A880` accent, semantic success/warning/error tokens (replace raw emerald/rose classes).
- **Type:** Syne for display only (hero, collection titles, PDP title), Hanken Grotesk for body at 16 px mobile / 15–16 px desktop, JetBrains Mono for labels, prices, order numbers. Never set body copy in 11 px mono.
- **Shape:** 0 radius retained for buttons/cards; photography carries softness. One shadow token, used only for drawers/modals.
- **Motion:** 150–200 ms opacity/translate; image cross-fade on hover; respect `prefers-reduced-motion`.

### 3.2 Page composition
- **Grid:** 12 columns, 1680 max, 56 px desktop margins, 32 px tablet, 16 px mobile. Sections separated by 64–96 px, not by full-width rules everywhere.
- **Hero:** full-bleed or 8/4 split with a real campaign image, one headline, one CTA, and a secondary text link. No size-chip wall.
- **Home section order:** hero → new in (4 products) → category tiles (Footwear / Apparel / Accessories / Bespoke) → featured collection → brand strip → atelier story → service row (delivery, returns, support).
- **Catalogue:** sticky compact filter bar (desktop sidebar 240 px, mobile bottom sheet), 4-up grid desktop / 2-up mobile, 3:4 images, brand + name + price + availability, "Load more" or numbered pagination.
- **PDP:** gallery (5–7 images) 60 % width; right column: brand, title, price incl. taxes, size grid with availability, size guide link, add-to-bag, delivery estimate, returns summary, accordions (Details, Fabric & care, Origin & declarations, Shipping & returns).
- **Cart:** single column mobile, 2-column desktop; free-shipping progress; clear tax line; one primary CTA.
- **Checkout:** 3 steps with progress indicator, saved addresses, editable summary, payment methods with logos, sticky total on mobile.
- **Account:** left sidebar (Orders, Returns, Addresses, Wishlist, Profile), mobile tab row; order detail with tracking timeline and invoice button.

### 3.3 Mobile
- Header: wordmark, hamburger, search, bag. Drawer with category accordions and brand list.
- PDP: sticky bottom bar (price + Buy), gallery swipe, accordions.
- Catalogue: sticky "Filter & Sort" bar opening a full-height sheet with Apply/Reset and live count.
- No floating concierge; support is a footer/account link.
- Test at 360/390/414/768; zero horizontal scroll is an acceptance criterion.

### 3.4 Content requirements
Each product needs: 4+ images (front/back/detail/side/lifestyle), brand, composition, care, country of origin, HSN/MRP where applicable, fit notes, size chart, returnability. Photography must be shot on a consistent background/exposure. Until then, use a neutral placeholder with "Image coming soon", never a mismatched product.

### 3.5 Empty/error/loading
- Skeletons matching final layout (card, PDP, table).
- Empty states with a route out (reset filters, browse all, contact).
- Errors in plain language with a retry; never expose backend URLs.

---

## 4. Admin design direction

### 4.1 Layout
- Grouped rail (7 groups), 240 px expanded / 64 px icon rail, collapsible with persisted state.
- Top bar: global search (`⌘K`), environment badge, role, account menu.
- Content: 24 px padding, max-width none, dense tables, sticky table headers.
- Mobile: top bar + drawer nav; tables become cards; actions in a fixed bottom bar.

### 4.2 Dashboard as an action board
```
Needs attention                     Today
──────────────                      ─────
3 orders unfulfilled >24h           Orders 12 · Revenue ₹1,84,000 · AOV ₹15,333
2 returns awaiting approval         14-day sparkline
5 products low stock
1 failed webhook                    Recent orders (5)
1 refund failed
```
Every line links to a filtered view.

### 4.3 Tables
- Right-aligned money/numerics, mono for IDs, status chips with semantic tones.
- Filters as chips + saved views; sortable headers; page size; export current view.
- Row hover reveals primary action (Open, Fulfil, Approve).
- Empty state names the filter that produced zero rows.

### 4.4 Order cockpit
Tabs: Summary · Items · Payment · Shipment · Returns · Notes. Sticky action bar contextual to state. Destructive actions require a typed confirmation and show backend error text on failure.

### 4.5 Forms
- Two-column where fields are related; one-column on narrow.
- Required markers, inline validation on blur, summary at top on submit failure.
- Never lose entered data on a server error.
- Destructive settings (roles, deletion) require explicit confirmation and are audit-logged.

---

## 5. Screen-by-screen backlog

### Storefront
| Screen | Change |
|---|---|
| Home | Full rebuild: editorial hero, category tiles, new-in, brand strip, atelier, service row; remove size-chip wall and floating widgets |
| Header | Two-row desktop (utility + primary), mobile drawer; remove "Wishlist" text link in favour of account menu icon |
| Mega menu | Image tile + 3 columns; keyboard accessible; close on route change |
| Catalogue | Server facets, true counts, brand data, sold-out badge, filter sheet on mobile, sticky bar |
| PDP | Gallery, brand, size guide, delivery estimate, accordions, remove gated add-ons, correct declarations |
| Cart | Reconcile totals, free-shipping progress, bespoke quantity cap, delivery estimate |
| Checkout | Progress indicator, saved addresses, editable review, payment logos, GST breakdown, mobile sticky total |
| Account | Sidebar/tab IA, tracking timeline, invoice download, exchange CTA |
| Auth | Keep structure; link OTP verification; add inline success/error states; password visibility toggle |
| Support | Ticket history, SLA status, WhatsApp/phone options |
| Policies | Owner-approved copy; last-updated date; table of contents |

### Admin
| Screen | Change |
|---|---|
| Global | Grouped nav, command palette, responsive rail, consistent error surfaces |
| Dashboard | Needs-attention board + today metrics + recent orders |
| Orders | Tabs/queues, date range, bulk fulfil, saved views, age column |
| Order detail | Cockpit with tabs and sticky actions; surface backend errors |
| Products | Stock/category columns, inline publish, media-first edit, SEO fields |
| Inventory | Ledger + low-stock + reorder |
| Returns | SLA, value, inline approve/reject, reverse pickup status |
| Customers | 360 with LTV/orders/returns/tickets |
| Support | SLA inbox with assignment |
| Reports | Date ranges, GST exports moved here, scheduled email |
| Settings | Store profile (statutory), staff MFA, integrations status |

---

## 6. Design-system deliverables

1. Token audit: replace raw Tailwind colours (`emerald-*`, `rose-*`) with semantic tokens (`success`, `warning`, `danger`, `info`).
2. Spacing audit: standardise on `sp-1..sp-5` plus section tokens; remove ad-hoc `py-16`, `mb-8`, `gap-6`.
3. Typography: add `body` at 16 px, `label` at 12 px minimum, define responsive display steps.
4. Components to add: ProductGallery, SizeSelector, Accordion, FilterSheet, ProgressSteps, AddressCard, TrackingTimeline, DataTable (sort/filter/saved views), ConfirmDialog, CommandPalette, EmptyState variants, FormField with hint/error/summary, Toast.
5. Accessibility acceptance: WCAG 2.1 AA contrast, keyboard operability, focus trap, 44 px targets, visible focus, alt text on all product images, reduced motion.
6. Documentation: a living page at `/design` in each app showing tokens and components in real states (already exists; expand).

---

## 7. What not to do

- Do not add new features during the redesign (no resale revival, no AI, no loyalty).
- Do not copy the current docs' screen codes into the new IA; they describe a pre-launch inventory, not the target product.
- Do not preserve a screen merely because it exists. `/verify`, `/authenticity`, `/inspection`, `/sell` should not be in the launch nav.
