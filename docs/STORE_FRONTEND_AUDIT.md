# STOREFRONT AUDIT — The Hidden Label

**Date:** 23 November 2026 · **State:** running locally on `:3000`, backend `:9000`
**Method:** source inspection + live browser at 1440×900 and 390×844. Screenshots in `docs/screenshots/`:
`audit-home-desktop.png`, `audit-home-mobile.png`, `audit-catalog-desktop.png`, `audit-pdp-desktop.png`, `audit-checkout-desktop.png`. Earlier captures: `audit-mobile-account.png`, `audit-mobile-catalogue.png`.

---

## 1. Overall impression

The storefront has a coherent visual identity (brutalist luxury: 0 radius, Syne display, Hanken body, JetBrains mono, bone canvas, black ink) and real data behind it. What it lacks is **retail craft**: photography, editorial hierarchy, merchandising, mobile ergonomics, and honest product content. It currently reads as an engineering demo styled as a fashion site rather than a fashion site.

Three systemic problems:

1. **Layout does not fit the viewport.** Mobile overflows horizontally; desktop leaves huge empty areas and lets secondary chrome (ticker, dev badge, floating concierge) compete with the product.
2. **Content is thin or wrong.** Single product image (sometimes the wrong product), no brand on cards, no fabric/care/origin, placeholder declarations, policy copy that references features that are off.
3. **The add-on layer leaks.** Fit Studio and "Place Bid" appear because of local env flags while the resale backend is disabled.

---

## 2. Screen-by-screen findings

### 2.1 Homepage (`/`)

**What works:** real products and stock; dynamic brand list with counts; size shortcuts; clear primary CTA; consistent type.

**Problems:**
- Hero occupies ~500 px of vertical space with no image and ~60 % empty horizontal space at 1440 px. The wordmark and one sentence are the only content.
- "FIT STUDIO" secondary CTA is visible when the flag is on, which is an optional add-on, not a core shopping action.
- Size chips (UK 6–11) are presented as the second-most important thing on the page; they filter the catalogue but the resulting page then filters again client-side.
- Product grid imagery is visually inconsistent (grey studio, pastel, saturated red, black).
- Product cards show brand, price, stock, but the brand is inconsistently present (metadata-dependent) and the title is forced to one line with truncation.
- Mobile: document is **~497 px wide in a 390 px viewport** (horizontal scroll); "TRENDING VAULT DROPS" is clipped and collides with "VIEW ALL"; no navigation at all (Shop/Brands/Bespoke are hidden below `sm` with no hamburger); the floating "A7" concierge and Next.js dev badge overlay content.
- The ticker at the top shows a real recent activity line, but the "ACTIVITY" treatment is visually louder than the brand.

### 2.2 Catalogue (`/collections/all`, `/collections/[handle]`)

**What works:** server-rendered products, category tabs, price/size/brand facets, sort, quick view, pagination, thoughtful empty state, real loading/error states.

**Problems:**
- **Facet counts are computed from the 24 loaded products**, not the full catalogue. The live page says "17 pieces" and "Menswear 7" while 31 products are published. Moving to page 2 changes counts.
- **Brand facet is empty**: the list payload lacks `metadata.brand`, so `brandOptions` is empty and the panel shows "BRANDS (ALL)" with no controls.
- Filter tabs are client-side but pagination is server-side; combining them is confusing (filters reset on page change).
- `/collections/[handle]` resolves the category label but fetches **all** products and then filters client-side, so page 2 of "Footwear" is whatever products fall on that page.
- The entire filter slab sits above the product grid and is visually heavier than the products.
- Cards lack brand, hover image, and sold-out indicator; all cards are identical height with no editorial variation.
- Sorting "Featured order" is a no-op (returns 0 for every comparison).
- Header/mega-menu styling is minimal: a text list with counts, no imagery, no featured collection.

### 2.3 Product detail (`/products/[handle]`)

**What works:** strong title hierarchy, clear price, size-by-size availability with low-stock signal, disabled sold-out sizes, buy CTA, wishlist, delivery checker, reviews section, structured declarations, JSON-LD for ratings.

**Problems:**
- **Wrong product image.** The AJ1 "Chicago" page shows a white/orange Air-Max-style shoe while copy says "white, black and varsity red". Seed imagery is inconsistent with the catalogue.
- **One image only.** No gallery, no thumbnails, no zoom, no model/lifestyle shot, no video. Unacceptable for premium footwear/apparel.
- Brand is not displayed (metadata missing in the store payload), so the PDP does not say who made the product.
- "PLACE BID" is rendered next to "BUY NOW" because `NEXT_PUBLIC_FEATURE_BIDDING=true` locally, while the resale gate is off → the offer dialog will fail at the API.
- Fit Studio box appears above the buy panel when its flag is on; it competes with size selection.
- Return policy copy says "see the authentication report above (when available)" in a retail-only environment.
- Legal Metrology block prints "Declaration pending verification" for country of origin and "—" for some values.
- No size guide link next to "Select size"; the guide exists only in the footer.
- No delivery estimate until the bottom of the page (the checker is below declarations).
- Mobile: sticky buy bar exists and is a good idea, but page-level horizontal overflow breaks it; the concierge tab overlaps it.

### 2.4 Cart (`/cart`, drawer)

**What works:** server-rendered lines, quantity controls with aria labels, remove, discount row, totals, promo input, clear empty state, prepaid-only messaging.

**Problems:**
- **Totals do not reconcile.** Live checkout shows line item ₹16,980 (2 × ₹8,490) while subtotal/total read ₹20,036.40. Fractional paise in a retail INR UI is wrong and suggests tax lines are being mixed into one total and not the other.
- Drawer and page use different fetches; drawer count can differ from header count until refresh.
- No delivery estimate or free-shipping threshold in the cart.
- Quantity allows 2 units of a made-to-measure garment (business rule should cap bespoke at 1).
- Mobile checkout button is reachable, but page overflow persists.

### 2.5 Checkout (`/checkout`)

**What works:** clear 3-step model, address autofill from PIN, home vs. boutique collection choice, honest "no courier leg" message for pickup, order review, DPDP consent, payment never claims success client-side.

**Problems:**
- **Cannot complete**: no `NEXT_PUBLIC_RAZORPAY_KEY_ID`, so both payment methods are disabled and the button is disabled.
- The step navigation shows "1. Address / 2. Shipping / 3. Payment" as text, not as a progress indicator with completed state.
- No ability to reuse a saved address despite an address book existing in the account.
- No "edit cart" link, no delivery date estimate, no GST breakdown before payment.
- Order review arithmetic inconsistent (see 2.4).
- Address form has 9 fields on one screen with no grouping; first/last name, address line 1/2, landmark, type, city/state/PIN. Usable, not elegant.
- If the backend is unreachable, the page redirects to `/cart` with no explanation.

### 2.6 Auth

**Login/register:** clean split layout, clear field errors, real Medusa auth, password minimum, rate limits.
**OTP:** route exists (`/verify`) but is **not linked from anywhere** (0 inbound links); registration flow sends OTP but the user may never see the verify page.
**Forgot/reset:** pages exist; delivery depends on Resend, which has no key, so the email is only logged.
**Password recovery** cannot be verified without an email provider.

### 2.7 Account

**What works:** dashboard with recent orders, profile edit, address book, wishlist, orders, returns, invoice, account deletion and data export (DPDP), sign out.

**Problems:** all secondary actions are a row of identical bordered buttons; no account sidebar; no saved payment methods; no order tracking timeline; invoices carry invalid statutory fields (see §4); mobile capture shows clipped controls and horizontal scroll.

### 2.8 Support, policies, content

- Support has a real ticket form and an FAQ fallback; SLA copy is clear. No ticket history for the customer, only confirmation.
- Policies are CMS-driven with a markdown renderer; content quality is unknown because legal copy is owner-supplied and placeholders remain.
- Grievance page exists and is linked in the footer; officer name/phone are env placeholders.
- About/authenticity/size guide exist; authenticity copy needs to be rewritten or removed until inspection is real.

### 2.9 Error / empty / loading

- Custom `not-found.tsx` and `error.tsx` exist in both apps.
- Catalogue has a genuine empty state with a reset action.
- No route-level skeletons (one was deliberately removed after causing a reload bug). Data-heavy pages therefore flash empty.
- API failure messages expose the backend URL on the homepage ("backend: http://localhost:9000") — should not ship.

---

## 3. Visual system review

| Element | Assessment |
|---|---|
| Colour | Coherent bone/ink/champagne palette, but champagne is barely used; status greens and reds are raw Tailwind (emerald/rose) outside the token system |
| Typography | Strong pairing; display is overused for body-adjacent headings; mono labels are 9–11 px in places (too small); body 13–15 px is small on mobile |
| Spacing | Token scale exists (`sp-1..sp-5`, gutter/margin); usage inconsistent — some sections use raw `py-16`, `mb-8`, `gap-6` |
| Layout | 1680 px max container with a wide grid; content is left-aligned with large dead space; no editorial 12-col grid |
| Borders | Every element is boxed with 1 px lines; creates a "wireframe" feel and visual noise |
| Imagery | Inconsistent sourcing, aspect ratios and colour temperature; no art direction |
| Motion | Minimal, tasteful (image scale on hover); no page transitions |
| Iconography | Almost none; text-only chrome (Search/Wishlist/Sign in) is clear but visually flat |
| Trust | Legal identifiers, grievance officer, prepaid messaging are present — a genuine strength |

---

## 4. Content-honesty issues (D2)

1. Invoice footnote: "Every luxury good is checked and certified for authenticity prior to shipment." — no enforced inspection-before-fulfilment workflow exists.
2. Legal Metrology declarations: country of origin "pending verification" on a live PDP.
3. PDP return copy references an authentication report that may not exist.
4. Homepage brand fallback lists Jordan/Nike/Adidas/New Balance/Salomon/ASICS with "Vault Series" if the brand API fails — acceptable as a fallback only if those brands are actually stocked.
5. README/marketing continues to describe a resale marketplace the storefront does not run.

---

## 5. Performance and accessibility

**Performance**
- Nearly every commerce route is `force-dynamic`; homepage issues 4+ backend calls per render, PDP up to 6 (product, stock, wishlist, reviews, resale, inspection).
- Raw `<img>` without width/height on cards, PDP, cart, drawer → layout shift and oversized downloads.
- No image CDN or responsive `srcset`; remote images are Unsplash URLs, not owned assets.
- Fonts are self-hosted via `next/font` (good).
- No measured Lighthouse score in this audit; no production build was served for measurement.

**Accessibility**
- Good: landmarks (`header/nav/main/footer`), labelled inputs, `aria-pressed`, `aria-expanded`, `role="alert"` for errors, focus-visible styles in shared components.
- Gaps: no skip link; drawers/modals lack focus trapping and initial focus; floating tab overlaps content and is not dismissible; many icon-only controls rely on text; colour contrast of 9–11 px mono grey on bone is marginal; heading levels inside cards start at `h3` without `h2`.

---

## 6. Redesign priorities (storefront)

**P0 — launch blockers**
1. Fix global horizontal overflow and build a mobile header with drawer navigation.
2. Make checkout completable (test keys) and reconcile cart/checkout totals to whole rupees.
3. Replace incorrect product imagery; enforce one aspect ratio and multiple images per product.
4. Remove/hide gated add-on CTAs from local and production UI; one flag should control the whole layer.
5. Correct invoice statutory fields and remove unsubstantiated claims.
6. Add robots/sitemap and per-page metadata.

**P1 — experience**
7. Rebuild homepage as an editorial layout: full-bleed hero image, one featured collection, new-in grid, brand strip, bespoke story.
8. Rebuild catalogue: server-side facets with true counts, brand on cards, sold-out states, sticky filter bar on mobile, better sort.
9. Rebuild PDP: gallery + thumbnails, brand line, size guide link, delivery estimate near CTA, accordion for details/declarations, remove add-on clutter.
10. Cart/checkout: order summary consistency, saved addresses, delivery estimate, GST breakdown, explicit payment state.

**P2 — polish**
11. Account sidebar + order tracking timeline.
12. Support ticket history.
13. Consent + analytics.
14. Accessibility pass (focus traps, contrast, tap targets).
