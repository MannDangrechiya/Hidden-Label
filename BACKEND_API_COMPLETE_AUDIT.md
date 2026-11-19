# THE HIDDEN LABEL — BACKEND API COMPLETE AUDIT
**Detailed Technical Specification & Vulnerability Analysis of Every Backend Route**

---

## 1. Storefront API Endpoints (`/store/*`)

### 1.1. `POST /store/otp/send`
- **File:** `apps/backend/src/api/store/otp/send/route.ts`
- **Auth Guard:** None (Public, Rate-limited).
- **Parameters:**
  - Body: `{ destination: string, channel: "email" | "sms", purpose?: string }`
- **Validation:**
  - Email format validated via regex `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`.
  - Phone format validated via E.164 regex `/^\+[1-9]\d{7,14}$/`.
  - Rate limiting: Max 3 requests per 15-minute window per `(destination, purpose)`.
- **Database Tables:** `otp_challenge` (Queries recent challenges, inserts new challenge with HMAC-SHA256 hashed code).
- **External Calls:** `sendEmail()` (Resend) if `channel === "email"`. **Zero SMS calls** if `channel === "sms"`.
- **Response:** HTTP 201 Created with `{ challenge_id, expires_at, channel, delivered, dev_code? }` or HTTP 429 Rate Limited.
- **Defects & Limitations:**
  - Returns HTTP 501 if `OTP_PROVIDER` is unset.
  - If `OTP_PROVIDER` is set, there is **no code** calling an SMS gateway (MSG91/Twilio); it silently returns `delivered: false`.
  - Leaks `dev_code` in plaintext response when `OTP_DEV_ECHO=true` in non-production.
- **Audit Status:** **B. Implemented and working with limitations**

### 1.2. `POST /store/otp/verify`
- **File:** `apps/backend/src/api/store/otp/verify/route.ts`
- **Auth Guard:** None (Public).
- **Parameters:**
  - Body: `{ challenge_id: string, code: string }`
- **Validation:** Enforces 6-digit code format (`/^\d{6}$/`), 5-minute expiry, max 5 attempts, single-use `consumed_at` check. Uses `timingSafeEqual` HMAC comparison.
- **Database Tables:** `otp_challenge` (Reads by ID, increments `attempts` on failure, writes `consumed_at` timestamp on success).
- **External Calls:** None.
- **Response:** HTTP 200 OK with `{ verified: true, destination, purpose }` or HTTP 400/429.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.3. `POST /store/carts/:id/complete` (Intercepted via Middleware)
- **File:** `apps/backend/src/api/middlewares.ts` (`codOtpVerificationMiddleware`) -> Medusa Core Complete Cart Workflow.
- **Auth Guard:** None (Public store endpoint).
- **Parameters:**
  - URL Param: `id` (Cart ID).
- **Validation:** Middleware checks if payment session provider is `pp_system_default` (COD). If yes, checks if `cart.metadata.cod_otp_verified_at` exists and is within 15 minutes.
- **Database Tables:** `cart`, `payment_session`, `order`, `inventory_level`.
- **Security Vulnerability (SEC-CRIT-02):**
  - **CRITICAL DEFECT:** In Medusa Store API, `POST /store/carts/:id` is an unauthenticated endpoint accepting arbitrary `metadata`. Any attacker can execute `POST /store/carts/:id` with `{ metadata: { cod_otp_verified_at: new Date().toISOString() } }` and immediately invoke `/complete` to place COD orders with zero OTP verification.
- **Audit Status:** **C. Implemented but broken / Critically Vulnerable**

### 1.4. `POST /store/orders/:id/cancel`
- **File:** `apps/backend/src/api/store/orders/[id]/cancel/route.ts`
- **Auth Guard:** Customer Authenticated (`authenticate("customer", ["bearer", "session"])`).
- **Parameters:**
  - URL Param: `id` (Order ID).
  - Body: `{ reason?: string }`
- **Validation:** Customer must own the order (`order.customer_id === req.auth_context.actor_id`). Order status cannot be already `canceled`. Fulfillment status must be `not_fulfilled` or unfulfilled.
- **Database Tables:** `order` (Updates `status = 'canceled'`).
- **External Calls:** None (Does not issue payment refund via gateway if paid online).
- **Response:** HTTP 200 OK with `{ canceled: true, order_id }`.
- **Audit Status:** **B. Implemented and working with limitations** (Does not trigger gateway refund).

### 1.5. `GET /store/orders/:id/shipment`
- **File:** `apps/backend/src/api/store/orders/[id]/shipment/route.ts`
- **Auth Guard:** None (Checks order association).
- **Parameters:** URL Param: `id` (Order ID).
- **Database Tables:** `shipment`, `shipment_event`.
- **Response:** HTTP 200 OK with `{ shipment, events, customer_status, is_stale }`.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.6. `GET & POST /store/return-requests`
- **File:** `apps/backend/src/api/store/return-requests/route.ts`
- **Auth Guard:** Customer Authenticated.
- **Parameters:**
  - POST Body: `{ order_id: string, reason_code: string, note?: string, items: [{ order_item_id: string, quantity: number }] }`
- **Validation:** Order must belong to authenticated customer. Order fulfillment must be `delivered` or `fulfilled`. Return window enforced (7 days).
- **Database Tables:** `return_request`, `return_item`, `order`.
- **External Calls:** `sendEmail()` to customer acknowledging return request.
- **Response:** HTTP 201 Created with `{ return_request }`.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.7. `GET, POST & DELETE /store/wishlist`
- **File:** `apps/backend/src/api/store/wishlist/route.ts`
- **Auth Guard:** Customer Authenticated.
- **Parameters:** POST Body: `{ product_id: string }`. DELETE Body: `{ product_id: string }`.
- **Database Tables:** `wishlist_item`, `product`.
- **Response:** HTTP 200 OK / HTTP 201 Created with wishlist item array.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.8. `GET & POST /store/resale/asks` and `DELETE /store/resale/asks/:id`
- **File:** `apps/backend/src/api/store/resale/asks/route.ts` & `[id]/route.ts`
- **Auth Guard:** Public GET; Customer Authenticated POST and DELETE.
- **Parameters:** POST Body: `{ product_handle: string, size: string, ask_price: number, unit_serial?: string }`.
- **Validation:** Minimum price bounds, size format.
- **Database Tables:** `resale_ask` (Soft-cancels on DELETE with `status = 'cancelled'`).
- **Response:** HTTP 200 / 201 with ask record.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.9. `GET & POST /store/resale/bids` and `DELETE /store/resale/bids/:id`
- **File:** `apps/backend/src/api/store/resale/bids/route.ts` & `[id]/route.ts`
- **Auth Guard:** Public GET; Customer Authenticated POST and DELETE.
- **Parameters:** POST Body: `{ product_handle: string, size: string, bid_price: number }`.
- **Database Tables:** `resale_bid`.
- **Response:** HTTP 200 / 201 with bid record.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.10. `GET /store/resale/products/:handle/index`
- **File:** `apps/backend/src/api/store/resale/products/[handle]/index/route.ts`
- **Auth Guard:** None.
- **Parameters:** URL Param: `handle` (Product handle).
- **Database Tables:** `resale_ask`, `resale_bid`, `price_history_point`.
- **Response:** Lowest ask, highest bid, last sale price, and price trend points grouped by size.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.11. `GET /store/inspections/:unit_serial`
- **File:** `apps/backend/src/api/store/inspections/[unit_serial]/route.ts`
- **Auth Guard:** None (Public verification).
- **Parameters:** URL Param: `unit_serial` (e.g. `UNIT-THL-00123`).
- **Database Tables:** `condition_inspection`.
- **Response:** Inspection certificate, grade, inspection timestamp, high-res photos, verified inspector ID.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.12. `GET & POST /store/fit/profile`
- **File:** `apps/backend/src/api/store/fit/profile/route.ts`
- **Auth Guard:** Customer Authenticated.
- **Parameters:** POST Body: `{ height_cm, weight_kg, chest_cm, waist_cm, hips_cm, preferred_fit }`.
- **Database Tables:** `customer_fit_profile`.
- **Response:** Customer fit measurements.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.13. `POST /store/fit/recommend`
- **File:** `apps/backend/src/api/store/fit/recommend/route.ts`
- **Auth Guard:** None.
- **Parameters:** POST Body: `{ brand_handle: string, category: string, chest_cm?: number, waist_cm?: number }`.
- **Database Tables:** `silhouette_fit_rule`.
- **Response:** Recommended size (e.g. `M`), ease commentary, silhouette guidance.
- **Audit Status:** **A. Fully implemented and verified working**

### 1.14. `POST /store/concierge/chat`
- **File:** `apps/backend/src/api/store/concierge/chat/route.ts`
- **Auth Guard:** None.
- **Parameters:** Body: `{ message: string, thread_id?: string }`.
- **External Calls:** Gemini API (`gemini-flash-latest`) via `apps/backend/src/lib/gemini.ts`.
- **Database Tables:** `concierge_thread`, `concierge_message`.
- **Response:** AI conversational reply grounded in catalog inventory. Bounded to < 4.5s with keyword fallback on timeout or missing key.
- **Audit Status:** **B. Implemented and working with limitations** (Keyword fallback active if Gemini key fails).

### 1.15. `POST /store/sight-search`
- **File:** `apps/backend/src/api/store/sight-search/route.ts`
- **Auth Guard:** None.
- **Parameters:** Body: `{ image_base64: string }`.
- **External Calls:** Gemini Vision API.
- **Database Tables:** `product`.
- **Response:** Matched product handles based on visual attributes (color, silhouette, brand).
- **Audit Status:** **B. Implemented and working with limitations**

---

## 2. Admin API Endpoints (`/admin/*`)

### 2.1. `POST /admin/users/me` (Medusa Core via RBAC Exemption)
- **File:** `apps/backend/src/api/middlewares.ts` (`adminRbacMiddleware`) -> Medusa Core User Handler.
- **Auth Guard:** Staff Authenticated (Any role: `readonly`, `support`, `operations`, `manager`, `owner`).
- **Parameters:** Body: `{ metadata: { role: string } }`.
- **Security Vulnerability (SEC-CRIT-01):**
  - **CRITICAL DEFECT:** The RBAC middleware unconditionally exempts `/admin/users/me` without checking HTTP method:
    ```typescript
    if (path === "/admin/users/me" || path.endsWith("/users/me")) return next();
    ```
  - Any authenticated staff member (including `readonly`) can execute `POST /admin/users/me` with `{"metadata": {"role": "owner"}}`. Medusa updates the user's metadata in the `"user"` table, instantly giving the attacker full unrestricted owner access.
- **Audit Status:** **C. Implemented but broken / Critically Vulnerable**

### 2.2. `POST /admin/orders/:id/actions`
- **File:** `apps/backend/src/api/admin/orders/[id]/actions/route.ts`
- **Auth Guard:** RBAC: Operations, Manager, Owner (Readonly blocked with 403).
- **Parameters:**
  - URL Param: `id` (Order ID).
  - Body: `{ action: "fulfill" | "cancel" | "capture_payment", items?: [{ item_id: string, quantity: number }] }`
- **Validation:** Enforces valid item mappings against `order_line_item`.
- **Database Tables:** `order`, `fulfillment`, `order_fulfillment`, `payment`.
- **Response:** HTTP 200 OK with action confirmation.
- **Audit Status:** **A. Fully implemented and verified working**

### 2.3. `GET & POST /admin/shipments` and `PUT /admin/shipments/:id`
- **File:** `apps/backend/src/api/admin/shipments/route.ts` & `[id]/route.ts`
- **Auth Guard:** RBAC: Operations, Manager, Owner.
- **Parameters:**
  - POST Body: `{ order_id: string, courier?: string }`
  - PUT Body: `{ status: string, awb?: string, courier?: string, note?: string }`
- **External Calls:** Calls Shiprocket `createShiprocketOrder()` if configured; falls back to `{ provider: "manual" }` when credentials missing.
- **Database Tables:** `shipment`, `shipment_event`, `order_address`, `order_line_item`.
- **Defects & Limitations:**
  - In `shipments/route.ts` line 132, `paymentMethod: "COD"` is hardcoded for all Shiprocket requests.
  - Package dimensions (30x20x12 cm, 0.6 kg) are hardcoded.
- **Audit Status:** **B. Implemented and working with limitations**

### 2.4. `GET & POST /admin/returns/:id`
- **File:** `apps/backend/src/api/admin/returns/[id]/route.ts` & `middlewares.ts` (`adminReturnsMiddleware`).
- **Auth Guard:** RBAC: Operations, Manager, Owner.
- **Parameters:** Body: `{ action: "approve" | "reject", note?: string }`.
- **Database Tables:** `return_request` (Updates status to `approved` or `rejected`).
- **Response:** HTTP 200 OK.
- **Audit Status:** **A. Fully implemented and verified working**

### 2.5. `GET, POST & DELETE /admin/fit-rules` and `[id]`
- **File:** `apps/backend/src/api/admin/fit-rules/route.ts` & `[id]/route.ts`
- **Auth Guard:** RBAC: Operations, Manager, Owner.
- **Parameters:** POST Body: `{ brand_handle, category, silhouette, size, min_chest, max_chest, min_waist, max_waist, guidance }`.
- **Database Tables:** `silhouette_fit_rule` (Supports soft delete via `deleted_at`).
- **Response:** HTTP 200 / 201.
- **Audit Status:** **A. Fully implemented and verified working**

### 2.6. `GET, POST & PUT /admin/inspections` and `[id]`
- **File:** `apps/backend/src/api/admin/inspections/route.ts` & `[id]/route.ts`
- **Auth Guard:** RBAC: Operations, Manager, Owner.
- **Parameters:** POST Body: `{ unit_serial, product_handle, size, grade, defects, photos }`.
- **Database Tables:** `condition_inspection`.
- **Response:** HTTP 200 / 201.
- **Audit Status:** **A. Fully implemented and verified working**

### 2.7. `GET /admin/dashboard/summary`
- **File:** `apps/backend/src/api/admin/dashboard/summary/route.ts`
- **Auth Guard:** RBAC: Support, Operations, Manager, Owner.
- **Database Tables:** `order`, `customer`, `shipment`.
- **Response:** Aggregated gross sales, order count, active shipments, pending returns.
- **Audit Status:** **A. Fully implemented and verified working**

### 2.8. `GET /admin/reports/export/orders` and `products`
- **File:** `apps/admin/app/(dashboard)/reports/export/orders/route.ts` & `products/route.ts`
- **Auth Guard:** Admin Session Cookie.
- **Response:** Streams formatted CSV files (`Content-Type: text/csv`).
- **Audit Status:** **A. Fully implemented and verified working**

---

## 3. Webhook Endpoints

### 3.1. `POST /webhooks/shiprocket`
- **File:** `apps/backend/src/api/webhooks/shiprocket/route.ts`
- **Auth Guard:** Token Authentication via `SHIPROCKET_WEBHOOK_TOKEN` header or query param.
- **Parameters:**
  - Body: `{ awb: string, current_status?: string, shipment_status?: string, scan_date?: string }`
- **Validation:** Rejects requests with missing or invalid token. Validates presence of `awb` and status field.
- **Database Tables:** `shipment`, `shipment_event` (Applies status via `applyShipmentUpdate` with unique constraint idempotency).
- **Defects & Limitations:**
  - Does not update Medusa `order` table fulfillment status.
  - Does not dispatch notification emails, SMS, or WhatsApp to the customer.
- **Audit Status:** **B. Implemented and working with limitations**
