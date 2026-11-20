# 03 — STOREFRONT AUDIT

**Method:** route inventory from the filesystem (105 files), then live HTTP requests against the running storefront on `:3000` and backend on `:9000`. No browser session was driven; button-level interaction claims from earlier reports are therefore not repeated as facts. Every row states its own evidence level.

## 1. Route-level result

**[LIVE]** Combined route probes:

| Route | Result |
|---|---|
| `/` | `200` |
| `/collections/all` | `200` |
| `/products/air-jordan-1-retro-high-og-chicago` | `200` |
| `/products/does-not-exist` | `404` (honest) |
| `/brands` | `200` |
| `/brands/{nike,jordan,adidas,new-balance,salomon,asics}` | `200`, `200`, `200`, `200`, `200`, `200` |
| `/search` | `200` |
| `/cart` (no cart cookie) | `200` with empty state |
| `/checkout` (no cart) | `307` → `/cart` (correct guard) |
| `/login`, `/register` | `200` |
| `/about`, `/authenticity`, `/fit-studio`, `/sell` | `200` |
| `/policies/privacy` | `200` (CMS-backed) |

## 2. Homepage (`apps/storefront/app/page.tsx`)

Present: hero with badge, headline, three CTAs, a "Quick Shop by Size" bar, an 8-product grid from live Medusa data, a brand pavilion, and a four-card "Physical Inspection Programme" explainer.

| Item | Status | Evidence / note |
|---|---|---|
| Hero + CTAs | Working | **[LIVE]** page renders; links to `/collections/all`, `/sell`, `/fit-studio` |
| Product grid from real data | Working | `fetchProducts({limit: 8})`, `force-dynamic` |
| Price honesty | Good | missing price renders "Price unavailable", not a fabricated figure |
| Empty / error states | Good | explicit `ErrorState` with backend URL; "No products are published yet." |
| **Brand pavilion** | **Hardcoded defect** | literal `BRANDS` array with invented silhouette counts ("Nike · 18 Silhouettes") — **BUG-06** |
| **"In Stock →" label** | **Unsupported claim** | rendered for every card regardless of stock — **BUG-07** |
| Promotional banners from CMS | Not wired | `/store/content/home` exists and returns real banner rows, but the homepage does not consume it |
| Editorial / brand sections | Absent | no editorial module on `/` |
| Mobile responsiveness | **[CODE]** Tailwind responsive classes present throughout; not visually verified |
| Footer | Working | site-wide, includes GSTIN/CIN placeholders, grievance officer, policies |

## 3. Catalogue and search

`/collections/all` = server page + `catalog-client.tsx` (client-side filtering over `initialProducts`).

| Capability | Status | Evidence |
|---|---|---|
| Category tabs with counts | Working (client-side) | `CATEGORIES` from `lib/catalog.ts`; counts computed from loaded page |
| Brand filter | Working (client-side) | options derived only from products present |
| Price buckets | Working (client-side) | `PRICE_BUCKETS`, null prices sorted last |
| Size filter (apparel/shoe/other) | Working (client-side) | includes `?size=` deep link from the homepage |
| Sort (featured / price asc / desc) | Working | "featured" is a no-op comparator (returns 0) |
| Availability filter | **Missing** | no in-stock/out-of-stock facet |
| Pagination / infinite scroll | **Missing** | `fetchProducts` defaults to `limit: 24` — **BUG-10** |
| Empty state | Good | "Nothing in this edit yet" + reset + brands link |
| Invalid filter values | Tolerated | unknown `size`/`category` normalise to empty filter rather than erroring |
| Search (`/search`, overlay, `/api/search`) | Working | **[LIVE]** `GET /store/search/suggest?q=air` returned real products |
| SKU search | Documented as included | backend `suggest` route queries title/handle/SKU **[CODE]** |
| Search relevance | Not tuned | simple `ilike`-style matching; no ranking, no synonyms, no fuzzy |
| Zero-result state | Present in overlay | **[CODE]** |

**Consistency defect:** the catalogue's category tabs come from metadata heuristics, whereas `/collections/[handle]` and the mega-menu use the real `product_category` tree. The same product can therefore appear under different category names depending on entry point.

## 4. Product detail page (`app/products/[handle]/page.tsx`)

| Element | Status |
|---|---|
| Title, brand (from `metadata.brand`), description | Working |
| Price | Working (`calculated_price` via region context; honest fallback) |
| Discount display | **Missing** — no compare-at / strike-through pricing |
| GST treatment | Displayed as "inclusive of all taxes"; the actual split appears only on the invoice page |
| Variant/size selector | Working — `ProductBuyPanel` + `AddToBag`, disabled when unavailable |
| Colour selection | **Not implemented** — variants are size-only in seed and UI |
| Stock availability | Partial — `isVariantAvailable` returns `true` when the store API hides stock (by design), so "sold out" only shows when a count is actually exposed |
| Real-time stock | Implemented via `POST /store/catalog/stock`; **[LIVE]** returns `{stock:{}}` for an empty id list (route works) |
| **Image gallery** | **Missing** — only `product.thumbnail` is rendered, no `images.map` |
| Size guide | Separate `/size-guide` page + Fit Studio widget; not inline per-product |
| Delivery information | Present as static copy ("Dispatched in 2–4 working days") |
| Return information | Present as static copy referencing the 7-day window |
| Wishlist | Working for signed-in customers (`WishlistButton`), sign-in CTA otherwise |
| Add to bag | Working path `addToCart` → Medusa line item |
| Related products | **Missing** |
| Reviews | **Missing entirely** (no model, route or UI) |
| Price index / bids | Implemented (`PriceIndexCard`) from real `resale_ask`/`resale_bid` data |
| 360° inspection | Implemented and conditional on a real `condition_inspection` record |
| SEO metadata | Partial — `generateMetadata` returns only `title`; no description, canonical or OpenGraph |
| Legal Metrology declarations | Present: country of origin, net quantity, MRP, HSN, marketed-by, consumer care |
| Breadcrumb | Present |

Marketing copy on the PDP is honest post-D2: no "100% authentic" badge, explicit "no RFID / no certificate programme" text in the seeded authenticity page.

## 5. Customer account

| Area | Status |
|---|---|
| Registration | Working **[CODE]** — 3-step Medusa flow + DPDP consent checkbox enforced server-side |
| Login / logout | Working; generic failure message avoids account enumeration |
| Email verification (OTP) | Code complete; delivery **BLOCKED** (no Resend key, no OTP provider) |
| Password recovery | Implemented (`reset-password` + `subscriber/auth-password-reset.ts`); email **BLOCKED** |
| Profile edit | Present (`profile-form.tsx`) |
| Saved addresses | Present (`/account/addresses`, create/list) |
| Order history | Present; ownership filtered server-side by customer id |
| Order detail | Present — items, statuses, tracking, bespoke stage, cancel/return/invoice links; ownership mismatch renders `404`, not `403` |
| Order cancellation | Present (pre-dispatch only) |
| GST invoice | Present (`/orders/[id]/invoice`), CGST+SGST vs IGST by state |
| Wishlist | Present |
| Asks / bids | Present (`/account/asks`, `/account/bids`) |
| Returns | Present (`/account/returns`, request form) |
| Data export / account deletion | Present (`download-my-data-button.tsx`, `delete-account` route) |
| Account security (2FA, session list, device history) | **Missing** |

## 6. Cart (`/cart`, `actions/cart.ts`)

| Capability | Status | Note |
|---|---|---|
| Add product | Working | cart id in httpOnly cookie |
| Remove / update quantity | Working | server actions; `quantity<=0` removes |
| Variant validation | Delegated to Medusa | invalid variant id surfaces Medusa's message verbatim |
| **Stock validation at add** | **Absent by design** | Medusa does not check stock on add; enforcement is at cart completion. Recorded as expected behaviour, not a bug |
| Price recalculation | Server-side | line totals from Medusa |
| Discount calculation | Delegated | `discount_total` + promotions list |
| GST calculation | Delegated | `tax_total` from Medusa tax engine (seeded 18% default) |
| Shipping calculation | At checkout | cart shows "Calculated at checkout" |
| Persistence after refresh | Yes | cookie-backed cart id |
| Multi-tab consistency | Partial | same cart id shared, but no live sync between tabs |
| Merge guest cart on login | Yes | `attachCustomerToCart` in add-to-cart and checkout address steps |
| Cart drawer | Present | `cart-drawer.tsx` |

## 7. Checkout (`/checkout`, `actions/checkout.ts`)

Three steps: address → shipping → payment. **[LIVE]** `/checkout` correctly `307`s to `/cart` when empty.

**Address step:** Zod-validated (name, phone, address, city, state, PIN), with a **real pincode serviceability gate** — an invalid PIN blocks checkout; an unreachable directory fails open (documented ADR-02). Address type (home/work) and landmark are captured.

**Shipping step:** real Medusa shipping options. **[LIVE]** DB shows exactly two: `Standard delivery` (flat ₹0) and `Express delivery` (flat ₹199). Two fulfilment modes: `home_delivery` and free `store_pickup` at the Sindhu Bhavan Road boutique; the mode is stored in cart metadata.

**Payment step — blocked.**
- `beginRazorpayPaymentAction` requires `NEXT_PUBLIC_RAZORPAY_KEY_ID`; it is **unset** in this environment, so it returns "Online payment is not configured on this environment."
- The backend has **zero** rows in `region_payment_provider` **[LIVE]**, and `listRegionPaymentProviders` feeds that empty list to the payment form.
- COD is intentionally removed (verified: no COD branch in checkout, `setup-payments.ts` deletes `pp_system_default`).
⇒ **A guest or signed-in customer cannot pay and therefore cannot create an order in this environment.** This is the single most important storefront finding (BUG-01).

**Duplicate submission protection:** order creation happens inside Medusa's complete-cart workflow; there is no separate custom order-creation endpoint that could double-fire. The UI does not, however, disable the pay button across a retry after a network failure. **[CODE]**

**Guest checkout:** supported (email captured at the address step). **[CODE]**

**Confirmation page:** `/checkout/confirmation/[id]` 404s if the order id does not resolve — no fake success. **[CODE]**

## 8. Other storefront surfaces

- `/sell` (consignor hub): ask creation with a live 9.5% fee/payout estimate, links into `/account/asks`. Backend ask/bid routes are auth-guarded **[LIVE]** (401 without a token).
- `/fit-studio`: silhouette fit rules from `silhouette_fit_rule`.
- `/inspection/[serial]` and `/verify/[serial]`: public certificate view driven by `condition_inspection`.
- `/support`: contact form creating a support ticket; deep link from an order pre-fills the reference.
- `/policies/*`, `/about`, `/authenticity`, `/size-guide`, `/[...slug]`: CMS-driven markdown renderer with multi-segment slug support.
- `/design`: internal design-token gallery — shipped to production, should not be public.

## 9. Broken or misleading interactions — consolidated

1. **Checkout cannot complete** (no payment provider) — BUG-01, P0.
2. Homepage brand counts are invented and not editable — BUG-06.
3. Homepage asserts "In Stock" for every product — BUG-07.
4. Catalogue filtering only sees the first page of products — BUG-10.
5. Catalogue categories disagree with the real taxonomy — TD-01.
6. PDP has no image gallery and no related products, so the "Quick View enabled" label and the visual merchandising of a premium boutique are underrepresented.
7. No reviews anywhere.

## 10. Not verified (explicit)

- Visual correctness at any breakpoint — no browser screenshot or interaction was performed in this audit.
- Client-side filter behaviour — read, not clicked.
- Form submissions to real endpoints (register, login, add-to-cart, checkout) — not executed, to avoid mutating the shared development database with new customers/carts.
- Hydration/console cleanliness — not observed.
