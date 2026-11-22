# THE HIDDEN LABEL — CUSTOMER JOURNEY TEST REPORT

**Date:** 2026-11-22  
**Scope:** Complete End-to-End Customer Experience Verification  
**Auditor:** Senior Frontend Engineer & QA Engineer  
**Status:** All 22 Customer Journey Stages Tested & Verified  

---

## 1. Journey Stage Verification Matrix

| Step # | Customer Journey Stage | Storefront Route & Components | Backend API Routes Involved | Verification Result |
|---|---|---|---|---|
| **1** | **Homepage & Navigation** | `apps/storefront/app/page.tsx`, `components/nav.tsx`, `components/header.tsx` | `GET /store/products`, `fetchBrands()`, `fetchStock()` | **PASS** — Dynamic brand counts & live stock badges |
| **2** | **Product Catalog** | `apps/storefront/app/collections/all/page.tsx`, `catalog-client.tsx` | `GET /store/products?limit=24&offset=0` | **PASS** — Server-side pagination (`PAGE_SIZE=24`, Page X of Y) |
| **3** | **Collections & Brands** | `apps/storefront/app/collections/[handle]/page.tsx`, `brands/[handle]/page.tsx` | `GET /store/collections`, `GET /store/brands/:handle` | **PASS** — Curated collections & brand pavilions |
| **4** | **Product Details (PDP)** | `apps/storefront/app/products/[handle]/page.tsx` | `GET /store/products?handle=:handle` | **PASS** — Full pricing, Legal Metrology origin, sizing |
| **5** | **Product Images** | `apps/storefront/components/product-gallery.tsx` | Medusa S3 / local static image proxy | **PASS** — Multi-angle zoom, responsive Next.js Image |
| **6** | **Search & Filtering** | `apps/storefront/app/search/page.tsx`, `apps/storefront/app/api/search/route.ts` | `GET /store/products?q=:query` | **PASS** — Instant search with debounce & price filtering |
| **7** | **Customer Registration** | `apps/storefront/app/register/page.tsx`, `components/register-form.tsx` | `POST /auth/customer/emailpass/register`, `POST /store/customers` | **PASS** — DPDP Act affirmative privacy consent enforced |
| **8** | **Customer Login** | `apps/storefront/app/login/page.tsx`, `components/login-form.tsx` | `POST /auth/customer/emailpass` | **PASS** — HttpOnly cookie session management |
| **9** | **Customer Account** | `apps/storefront/app/account/page.tsx`, `account/addresses/page.tsx` | `GET /store/customers/me`, `GET /store/customers/me/addresses` | **PASS** — Order history, saved addresses, password reset |
| **10** | **Shopping Bag / Cart** | `apps/storefront/app/cart/page.tsx`, `components/cart-drawer.tsx` | `GET /store/carts/:id`, `POST /store/carts/:id/line-items` | **PASS** — Real-time price calculation, stock reservation |
| **11** | **Checkout Address** | `apps/storefront/app/checkout/page.tsx` (Step 1) | `POST /store/carts/:id` | **PASS** — PIN code serviceability validation (India Post) |
| **12** | **Checkout Shipping** | `apps/storefront/app/checkout/page.tsx` (Step 2) | `POST /store/carts/:id/shipping-methods` | **PASS** — Shiprocket express delivery selection |
| **13** | **Payment Initiation** | `apps/storefront/app/checkout/payment/page.tsx`, `checkout-payment-form.tsx` | `POST /store/payment-collections`, `POST /store/payment-sessions` | **PASS** — Mutex lock, Razorpay order generation |
| **14** | **Payment Gateway** | Razorpay SDK modal (`checkout.js`) | `https://api.razorpay.com/v1/orders` | **PASS (Sandbox)** — UPI & Credit/Debit Card options |
| **15** | **Webhook Handling** | `apps/backend/src/api/webhooks/razorpay/route.ts` | Razorpay webhook signature verification | **PASS** — Replay deduplication, idempotent completion |
| **16** | **Order Creation** | `apps/storefront/app/actions/checkout.ts` | `POST /store/carts/:id/complete` | **PASS** — Idempotent completion prevents duplicate orders |
| **17** | **Order Confirmation** | `apps/storefront/app/checkout/confirmation/[id]/page.tsx` | `GET /store/orders/:id` | **PASS** — Renders verified order details (404 on invalid ID) |
| **18** | **Shipping & Tracking** | `apps/storefront/app/account/orders/[id]/page.tsx` | `GET /store/customers/me/orders/:id/shipment` | **PASS** — Real-time Shiprocket tracking status & AWB |
| **19** | **Returns & Refunds** | `apps/storefront/app/account/orders/[id]/return/page.tsx` | `POST /store/return-requests` | **PASS** — RMA sequence allocation, return window check |
| **20** | **Product Reviews** | `apps/storefront/components/product-reviews.tsx` | `GET /store/products/:id/reviews`, `POST /store/products/:id/reviews` | **PASS** — Verified buyer badge, schema.org JSON-LD |
| **21** | **Resale Consignment** | `apps/storefront/app/sell/sell-client.tsx`, `account/asks/page.tsx` | `POST /store/resale/asks`, `GET /store/resale/asks` | **PASS** — Fixed-price listing, intake instructions |
| **22** | **Bespoke Atelier** | `apps/storefront/components/bespoke-drawer.tsx`, `app/design/page.tsx` | `POST /store/bespoke/consultations`, `GET /store/bespoke/fabrics` | **PASS** — 8-point measurements, fabric swatches |

---

## 2. Detailed Journey Traces

### A. Shopping, Bag & Checkout Experience
1. **Browsing:** Customer visits `https://thehiddenlabel.com` → views dynamic brand curation and featured collections.
2. **Product Page:** Variant selection checks inventory availability via `fetchStock()`. Country of Origin is displayed truthfully per Legal Metrology Act, 2009.
3. **Bag Addition:** `AddToCartButton` writes line items to Medusa cart session. For made-to-measure items, the bespoke drawer opens automatically to capture tailor measurements.
4. **Checkout (Address):** Delivery address validated against India Post PIN code directory (`lookupPincode()`). Unserviceable PINs fail closed with a clear explanation before payment.
5. **Checkout (Payment):** Customer selects UPI or Credit Card. Server initializes a payment collection and payment session with provider `razorpay`.
6. **Payment Confirmation:** Razorpay SDK opens modal. On successful payment, the HMAC signature is verified server-side, `completeCart` creates the order, and customer is redirected to `/checkout/confirmation/[id]`.

### B. Customer Account & Post-Purchase Tracking
1. **Order Detail:** `account/orders/[id]` enforces customer ownership (unauthorized IDs render HTTP 404, preventing enumeration attacks).
2. **Courier Tracking:** If dispatched, the order page displays live Shiprocket tracking scans and delivery estimates.
3. **Self-Service Returns:** If status is `delivered` and within the 7-day policy window, the customer can submit an RMA request (`CN-THL-XXXX`).
4. **Bespoke Production Progress:** For custom apparel, the order page tracks the 5-stage tailor timeline (`measurements_verified` → `fabric_cutting` → `stitching` → `qc_passed` → `ready_for_pickup`). Once fabric cutting begins, self-service cancellation is locked.

### C. Reviews & Ratings
1. **Verified Buyer Review:** Customers who purchased the item submit 1–5 star ratings and reviews via PDP.
2. **Moderation Queue:** Submissions default to `pending` and are reviewed in the admin console before publication.
3. **SEO Integration:** Approved reviews update the average rating and render structured JSON-LD `AggregateRating` for search engines.

### D. Resale & Consignment Journey
1. **Submission:** Consignors submit luxury items via `/sell`.
2. **Fee Transparency:** Consignment fees display: *"Consignment Commission: Finalized upon listing review"*, preventing unauthorized fee representations.
3. **Authentication:** Items arrive at depot for multi-point inspection. Digital certificates and 360° turntable scans become visible at `/verify/[serial]`.
4. **Settlement:** Following sale and completion of the 7-day return period, the payout is released via the Consignor Settlement Ledger.
