# User-Side Flow Audit — Storefront

Executed against the running app (`http://localhost:3000`) with two real test customers and real Medusa data. “Verified” means an HTTP/browser action was performed, not code inspection.

**Accounts used:** `audit_1794726145593.buyer@example.com` (primary) and `audit_1794726145593.other@example.com` (isolation), password `AuditPass123!`. Existing customer data was never touched.

---

## 1. Route coverage

| # | Route | Screen (ref) | Result | Evidence |
|---|---|---|---|---|
| SF-01 | `/` | U-01 Homepage | ✅ PASS | HTTP 200, editorial hero, 8 products, live activity ticker, no console errors, no overflow at 1440 |
| SF-02 | `/collections/all` | U-05 Catalogue | ✅ PASS | 17 products, 6 category tabs, price/size/brand filters |
| SF-03..07 | `/collections/{footwear,menswear,womenswear,bespoke,accessories}` | U-05 | ✅ PASS | all 200, category preselected |
| SF-08 | `/brands` | U-03 | ✅ PASS | directory renders |
| SF-09 | `/brands/[handle]` | U-04 | ✅ PASS | brand vault renders |
| SF-10 | `/search?q=jordan` | U-07 | ✅ PASS | real results |
| SF-11 | `/search?q=zzzznotfound` | U-07 | ✅ PASS | honest zero-result state |
| SF-12 | `/about` | U-23 | ✅ PASS | CMS content renders |
| SF-13 | `/support` | U-22 | ✅ PASS | CMS content renders |
| SF-14 | `/size-guide` | U-25 | ✅ PASS | |
| SF-15..18 | `/policies/{shipping,returns,privacy,terms}` | U-24 | ❌ **FAIL** | all four HTTP 404; footer links point here |
| SF-19 | `/authenticity` | U-26 | ✅ PASS | |
| SF-20 | `/login` | U-15 | ✅ PASS | renders; real login succeeded in browser |
| SF-21 | `/register` | U-16 | ✅ PASS | renders; zod validation present |
| SF-22 | `/forgot-password` | — | ✅ PASS | renders, generic success |
| SF-23 | `/reset-password?token=invalid` | — | ✅ PASS | renders error state |
| SF-24 | `/sell` | Consignor hub | ✅ PASS | |
| SF-25 | `/fit-studio` | AI-04 | ✅ PASS | |
| SF-26 | `/design` | SYS-00 | ✅ PASS | token gallery |
| SF-30 | `/products/air-jordan-1-retro-high-og-chicago` | U-08 | ✅ PASS | hero, size picker, “Buy Now”, price index, 360 viewer, bid |
| SF-31 | `/products/bespoke-charcoal-wool-suit` | U-08 | ✅ PASS | measurement drawer, 4 sizes, bespoke CTA |
| SF-40 | unknown route | SYS | ✅ PASS | branded 404, correct status |

**Missing routes:** `/account/returns` (404), `/account/orders/:id/cancel` (404), `/account/orders/:id/invoice` (404), quick-view modal (U-09) not present.

---

## 2. Authentication and session

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| AUT-02 | Register → login (API) | customer + JWT | customer created, JWT issued | ✅ |
| AUT-04 | Wrong password | 4xx | 401 | ✅ |
| AUT-05 | Duplicate registration | reject | 401 rejected | ✅ |
| AUT-05B | Duplicate registration message | generic | `"Identity with email already exists"` — enumerates accounts | ❌ Medium |
| AUT-06 | `/store/customers/me` without token | 401 | 401 | ✅ |
| AUT-07 | OTP send | challenge | 201 + challenge, dev code available | ✅ |
| AUT-08 | Wrong OTP | reject | 4xx | ✅ |
| AUT-09 | Correct OTP | verified | `verified=true` | ✅ |
| AUT-10 | OTP rate limit | 4th send 429 | 429 | ✅ |
| AUT-11 | Password reset for known vs unknown email | identical response | identical 201 | ✅ |
| AUT-12 | Re-login → session persists | account renders | `/account` 200 with customer name | ✅ |
| AUT-13 | Invalid session cookie | treated as guest | 307 → `/login` | ✅ |
| AUT-14 | Guest on account pages | redirect `/login` | all 7 pages redirect | ✅ |
| — | Browser login at `/login` | navigate to `/account` | succeeded; no console errors | ✅ |
| AUT-01 | Registration API with `email="not-an-email", password="123"` | 400/422 | **200 + token issued** (UI zod blocks it) | ❌ Medium |

**Browser note:** the login form submits correctly; the first automated click missed the button, a DOM `click()`/Enter submitted normally and navigated to `/account`. No defect.

---

## 3. Catalogue, PDP and search

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| DAT-01 | `/store/products` | catalogue | 18 products / 60 variants | ✅ |
| API/store/products?limit=3 | list | 200 | 200 in 76 ms | ✅ |
| API/product-by-handle | PDP data | 200 | 200 in 54 ms | ✅ |
| API/search-suggest | typeahead | 200 | 200 in 9 ms | ✅ |
| API/AI-02 price index | market curve | 200 | 200 in 13 ms | ✅ |
| API/AI-05 concierge | reply | 200 | **28,528 ms**, then template fallback | ❌ latency Medium |
| API/AI-01 sight search | honest matches | 200, `mode=keyword_tag_matching_fallback` | ✅ honest label |
| API/AI-04 fit | recommendation | UK 8.5 for 27.2 cm | ✅ |
| API/fit empty input | 400 | 400 | ✅ |
| — | PDP add-to-bag / bid / 360 viewer present | Yes | “Buy Now”, “Place Bid”, turntable, macro gallery | ✅ |
| MISS-QV | Quick view (U-09) | present | absent | ❌ Low |
| SEC-12 | Search query `<script>alert(1)</script>` | escaped | escaped, no raw script | ✅ |

---

## 4. Wishlist, bids and consignments

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| SEC-01 | Wishlist without auth | 401 | 401 | ✅ |
| WL-01 | Save variant | saved + listed | 201, GET shows 1 | ✅ |
| WL-02 | Wishlist page | item visible | `/account/wishlist` 200 | ✅ |
| WL-03 | Remove | removed | DELETE 200, 0 left | ✅ |
| BID-01 | Place bid ₹12,000 | 201 | 201 | ✅ |
| BID-02 | Bid ₹-5 | 400 | 400 | ✅ |
| BID-03 | Bid appears in “My bids” | listed | 1 bid | ✅ |
| SEC-02 | Customer B sees A’s bid? | no | A 1 / B 0 | ✅ |
| BID-04 | Cancel own bid | 200 | 200 | ✅ |
| ASK-01 | Create ask ₹15,000 | 201 | 201 | ✅ |
| ASK-02 | Ask appears in consignments | listed | 1 ask | ✅ |
| ASK-03 | Delist ask | gone from list | DELETE 200 but ask still listed as `cancelled` | ❌ **High** |
| — | `/account/bids`, `/account/asks` pages | 200 | 200 | ✅ |

**Root cause (ASK-03):** `DELETE /store/resale/asks/:id` sets `status='cancelled'`; `GET /store/resale/asks` does not filter by status, so a cancelled listing looks active forever.

---

## 5. Cart and checkout

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| SF-50 | Empty cart | empty state | 200 “Your bag” | ✅ |
| SF-51 | `/checkout` without cart | redirect `/cart` | 307 → `/cart` | ✅ |
| CART-01 | Add bespoke line (metadata) | 200 + line | 200, ₹38,990 | ✅ |
| CART-02 | Attach address | 200 | 200 | ✅ |
| CART-03 | Shipping options | ≥1 | 2 options | ✅ |
| CART-04 | Cart page renders line | product visible | 200 | ✅ |
| EDGE-01 | Add `available+50` | rejected | 400 `insufficient_inventory` | ✅ |
| VAL-01 | Invalid region id | 4xx | 404 | ✅ |
| SEC-03 | Complete COD cart without phone OTP | rejected | **200, order created** | ❌ **High** |
| — | COD OTP enforcement in storefront action | present | present in `placeOrderAction` | ✅ (UI only) |
| — | Order confirmation page | real order | `/checkout/confirmation/order_…` 200 | ✅ |
| MISS-PROMO | Promo code entry | present | absent from cart/checkout | ❌ **High** |

**Checkout UI is three steps** (address → shipping → payment) with real server-side totals, store-pickup option and COD OTP. The step route is `/checkout?step=…`, not `/checkout/payment`; that is a valid design, not a defect.

---

## 6. Account area and order lifecycle

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| SYNC-03 | New order in account | visible | `/account/orders/:id` 200 | ✅ |
| SEC-05 | Customer B opens A’s order | 404 | 404 | ✅ |
| SEC-06 | Customer B returns A’s order | 404 | 404 | ✅ |
| RET-01 | Return before delivery | 422 | 422 “Returns open once the order has been delivered.” | ✅ |
| W-FUL-02 | Fulfilment status on customer order | visible | page only shows `order.status`; no fulfilment state | ❌ **High** |
| W-SHIP-03/04 | Shipment AWB visible | visible | store API + order page show “Audit Express · AUDIT123456” | ✅ |
| W-RET-01 | Return after delivery | 201 | RMA-1022 | ✅ |
| W-RET-05 | Customer can see return status | page | **404 `/account/returns`** | ❌ **High** |
| SYNC-08 | Profile update persists | updated | `AuditUpdated BuyerX` after re-login | ✅ |
| ADDR-01..03 | Address create/update/delete | CRUD | all 200 and persisted | ✅ |
| MISS | Order cancellation | route/action | absent | ❌ Medium |
| MISS | Printable invoice | route | absent | ❌ Medium |

**User↔admin break:** admin fulfilment is broken (see admin audit), and even if shipment exists the customer’s order page never renders a fulfilment status. Returns are created and stored correctly, but the admin cannot action them and the customer has no page to read them.

---

## 7. Edge cases and errors

| Case | Result |
|---|---|
| Invalid/expired session | treated as guest, redirect to login ✅ |
| Out-of-stock variant | rejected by Medusa `insufficient_inventory` ✅ |
| Oversell quantity | rejected ✅ |
| Zero results | honest empty state ✅ |
| XSS in search echo | escaped ✅ |
| 404 route | branded 404 ✅ |
| Direct API order completion | bypasses COD OTP ❌ |
| Missing product | storefront 404, API 404 without stack trace ✅ |

---

## 8. Mobile (375×812, Chromium emulation)

| Page | Document overflow | Finding |
|---|---|---|
| `/account` | none (374 ≤ 375) | **Header clips**: nav + account name + bag exceed header width (scrollWidth 373 vs client 358); bag label cut to “B”. Fixed AURA-7 pill overlaps the profile form. |
| `/collections/all` | none | Filter pills scroll horizontally inside a strip with a visible scrollbar; footer/concierge overlap bottom controls. Header clip repeats. |
| `/products/bespoke-charcoal-wool-suit` | none | All CTAs present, “Buy Now” duplicated (sticky + inline), no overflow. |

Screenshots: `docs/screenshots/audit-mobile-account.png`, `docs/screenshots/audit-mobile-catalogue.png`.

**Not tested:** real iOS/Android browsers, touch gestures, safe-area insets, 320 px width, landscape.

---

## 9. User-side summary

- Works: browse → PDP → bag → COD order; auth; wishlist; bids; asks creation; address book; profile; shipment tracking; 360 inspection; fit studio.
- Broken: policy pages; consignment delisting; COD OTP at the API boundary; fulfilment status display; returns visibility.
- Missing: returns history, order cancellation, invoice, quick view, promo redemption.
