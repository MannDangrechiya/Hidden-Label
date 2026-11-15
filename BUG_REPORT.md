# Bug Report — THE HIDDEN LABEL (Post-Remediation Verification)

**Document Status:** ALL DEFECTS RESOLVED & VERIFIED  
**Audit Date:** 15 November 2026  
**Verification Date:** 15 November 2026  
**Auditor / Remediation Lead:** QA & Core Engineering  
**Harness Test Reference:** `scripts/audit-e2e.mjs` (189/189 PASS) & `scripts/audit-admin.mjs` (37/37 PASS)  

**Summary of Defects:**  
Total: 22 distinct defects | **22 Resolved** | **0 Unresolved**  
- Critical: 4 / 4 Resolved  
- High: 8 / 8 Resolved  
- Medium: 8 / 8 Resolved  
- Low: 2 / 2 Resolved  

---

## CRITICAL DEFECTS (4 / 4 RESOLVED)

### BUG-001 — Any admin user, including `readonly`, can read every order and the entire admin user directory
- **Severity:** Critical
- **Feature/Page:** A-07 Orders, A-16 Settings — Medusa core admin API
- **Initial Finding:** Readonly staff account was able to list all customer orders (`GET /admin/orders`) and all admin staff (`GET /admin/users`).
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Medusa v2 core admin endpoints lacked custom role metadata validation middleware.
- **Files Modified:** `apps/backend/src/api/middlewares.ts`
- **Implementation:** Added universal `adminRbacMiddleware` mounted over `/admin/*`. Reads `user.metadata.role` (default `readonly`), enforces rank rules, and returns HTTP 403 Forbidden for unauthorized resources.
- **Verification Evidence:** `audit-e2e.mjs` checks `RBAC-01..04` return HTTP 403. `audit-admin.mjs` `W-RBAC-01..02` pass.

### BUG-002 — A `readonly` admin can promote itself to `owner`
- **Severity:** Critical
- **Feature/Page:** Settings / Medusa core `/admin/users/:id`
- **Initial Finding:** A readonly admin could submit `POST /admin/users/:id` with `{"metadata":{"role":"owner"}}` and successfully self-elevate permissions.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** No validation asserting that the actor cannot elevate their own role metadata.
- **Files Modified:** `apps/backend/src/api/middlewares.ts`
- **Implementation:** Added explicit self-escalation guard (`targetId === actor.id` attempting role modification is blocked with 403), and required `owner` role to modify user metadata roles.
- **Verification Evidence:** `audit-e2e.mjs` `RBAC-05` returns HTTP 403.

### BUG-003 — Admin cannot fulfil an order; every attempt returns a generic 422
- **Severity:** Critical
- **Feature/Page:** A-08 Order detail → “FULFIL REMAINING ITEMS”
- **Initial Finding:** Clicking Fulfil in the admin order detail returned `422 {"message":"The action failed."}`.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** `apps/backend/src/api/admin/orders/[id]/actions/route.ts` passed `order_item.id` (`orditem_...`) to `createOrderFulfillmentWorkflow` instead of the order line-item id (`order_item.item_id`, `ordli_...`).
- **Files Modified:** `apps/backend/src/api/admin/orders/[id]/actions/route.ts`
- **Implementation:** Selected `oi.item_id AS line_item_id` and mapped fulfillment items to `id: item.line_item_id`.
- **Verification Evidence:** `audit-e2e.mjs` `E2E-01` returns HTTP 200, creates fulfillment record, and order transitions to `pending` with status updated. `audit-admin.mjs` `W-FUL-01` passes.

### BUG-004 — Admin cannot approve, reject, receive or refund a return
- **Severity:** Critical
- **Feature/Page:** A-12 Returns → return detail actions
- **Initial Finding:** Calling return actions returned `400 "Invalid request: Unrecognized fields: 'action'"`.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Route collision with Medusa core `/admin/returns/:id` and its strict Zod validator.
- **Files Modified:**
  - `apps/backend/src/lib/returns.ts`
  - `apps/backend/src/api/admin/return-requests/[id]/route.ts`
  - `apps/backend/src/api/middlewares.ts`
  - `apps/admin/lib/api/returns.ts`
- **Implementation:** Intercepted `/admin/returns/*` in `middlewares.ts` before core validation; created dedicated non-colliding endpoint `/admin/return-requests/:id`; updated admin client API.
- **Verification Evidence:** `audit-e2e.mjs` `E2E-03` returns HTTP 200 (`status=approved`). `audit-admin.mjs` `W-RET-01..05` pass 100%.

---

## HIGH DEFECTS (8 / 8 RESOLVED)

### BUG-005 — Cash-on-Delivery OTP is enforced only in the storefront action; the API completes COD orders without it
- **Severity:** High
- **Feature/Page:** Checkout / `POST /store/carts/:id/complete`
- **Initial Finding:** Direct API calls to cart complete bypassed phone OTP verification on COD orders.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Verification check existed only in Next.js server action.
- **Files Modified:** `apps/backend/src/api/middlewares.ts`
- **Implementation:** Added `codOtpVerificationMiddleware` on `POST /store/carts/:id/complete`. Queries DB to verify `metadata.cod_otp_verified_at` was generated within 15 minutes on COD payment sessions.
- **Verification Evidence:** `audit-e2e.mjs` `SEC-03` rejects unverified COD order completion with HTTP 422.

### BUG-006 — All four policy pages 404, including every footer legal link
- **Severity:** High
- **Feature/Page:** U-24 `/policies/shipping|returns|privacy|terms`
- **Initial Finding:** Legal policy links in footer returned HTTP 404.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Route `store/cms/[slug]` only matched single-segment slugs, whereas seeded policy slugs were `policies/shipping`, etc.
- **Files Modified:** `apps/backend/src/api/store/cms/policies/[slug]/route.ts`
- **Implementation:** Created dedicated multi-segment policy route handler querying `policies/${slug}`.
- **Verification Evidence:** `audit-e2e.mjs` `SF-15..18` and `API-/store/cms/policies/*` return HTTP 200.

### BUG-007 — Creating a promotion from the admin always fails
- **Severity:** High
- **Feature/Page:** A-13 Promotions → New promotion
- **Initial Finding:** Promotion creation returned `400 "Invalid request: Unrecognized fields: 'usage_limit'"`.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Form submitted `usage_limit`, while Medusa 2.22.7 core promotion schema expects `limit`.
- **Files Modified:** `apps/admin/lib/api/promotions.ts`, `apps/backend/src/api/middlewares.ts`
- **Implementation:** Mapped `usage_limit` to `limit` in admin client and registered middleware adapter on `POST /admin/promotions*`.
- **Verification Evidence:** `audit-admin.mjs` `W-PROMO-01..04` pass with HTTP 200/201.

### BUG-008 — Customer has no way to see return requests or their status
- **Severity:** High
- **Feature/Page:** Account area
- **Initial Finding:** No page existed to display customer return history; `/account/returns` returned 404.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Missing route in storefront.
- **Files Modified:** `apps/storefront/app/account/returns/page.tsx`, `apps/storefront/app/account/layout.tsx`
- **Implementation:** Built `/account/returns` page consuming `listMyReturns()` with status badges and order links; linked in account navigation.
- **Verification Evidence:** `audit-e2e.mjs` `MISS-/account/returns` returns HTTP 200.

### BUG-009 — Customer order page never shows fulfilment status
- **Severity:** High
- **Feature/Page:** U-20 `/account/orders/[id]`
- **Initial Finding:** Order detail showed `pending` regardless of fulfilment state.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** `fulfillment_status` was not retrieved in `ORDER_FIELDS` or rendered in the template.
- **Files Modified:** `apps/storefront/lib/medusa.ts`, `apps/storefront/app/account/orders/[id]/page.tsx`
- **Implementation:** Added `fulfillment_status` to fields and rendered status badges and progress text.
- **Verification Evidence:** `audit-e2e.mjs` `SYNC-04` and `audit-admin.mjs` `W-FUL-02` pass with status text rendered.

### BUG-010 — Delisted consignments still appear as active
- **Severity:** High
- **Feature/Page:** `/account/asks`, `/sell`
- **Initial Finding:** Delisted asks (`status='cancelled'`) continued to appear in the active asks list.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Query in `store/resale/asks` did not filter by status.
- **Files Modified:** `apps/backend/src/api/store/resale/asks/route.ts`
- **Implementation:** Added `AND a.status = 'active'` filter.
- **Verification Evidence:** `audit-e2e.mjs` `ASK-03` confirms delisted asks are excluded.

### BUG-011 — No security headers on either app
- **Severity:** High
- **Feature/Page:** Storefront and admin responses
- **Initial Finding:** Security headers missing on both apps.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Missing `headers()` configuration in `next.config.ts`.
- **Files Modified:** `apps/storefront/next.config.ts`, `apps/admin/next.config.ts`
- **Implementation:** Configured `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Robots-Tag: noindex, nofollow` on admin.
- **Verification Evidence:** `audit-e2e.mjs` `SEC-07` and `SEC-08` pass.

### BUG-012 — Promotion codes cannot be redeemed by a customer
- **Severity:** High
- **Feature/Page:** Cart / Checkout
- **Initial Finding:** No promo code input or redemption workflow on cart or checkout.
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Missing UI components and server actions in storefront.
- **Files Modified:** `apps/storefront/lib/medusa.ts`, `apps/storefront/app/actions/cart.ts`, `apps/storefront/components/promo-code-input.tsx`, `apps/storefront/app/cart/page.tsx`, `apps/storefront/app/checkout/page.tsx`
- **Implementation:** Created `PromoCodeInput` component, `applyPromotionAction` and `removePromotionAction` server actions, and embedded into `/cart` and `/checkout`.
- **Verification Evidence:** `audit-e2e.mjs` `MISS-PROMO` and `audit-admin.mjs` `W-PROMO-03` pass.

---

## MEDIUM DEFECTS (8 / 8 RESOLVED)

### BUG-013 — Registration API accepts an invalid email and a 3-character password
- **Severity:** Medium
- **Feature/Page:** `POST /auth/customer/emailpass/register`
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Files Modified:** `apps/backend/src/api/middlewares.ts`
- **Implementation:** Added `customerRegistrationValidationMiddleware` enforcing email regex and password length >= 8.
- **Verification Evidence:** `audit-e2e.mjs` `AUT-01` returns HTTP 400.

### BUG-014 — Duplicate registration discloses that an email has an account
- **Severity:** Medium
- **Feature/Page:** Registration
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Files Modified:** `apps/backend/src/api/middlewares.ts`
- **Implementation:** Error handling prevents account enumeration.
- **Verification Evidence:** `audit-e2e.mjs` `AUT-05` passes.

### BUG-015 — Admin order detail shows a blank order number and “Invalid Date”
- **Severity:** Medium
- **Feature/Page:** A-08 `/orders/[id]`
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** `DETAIL_FIELDS` omitted `display_id` and `created_at`.
- **Files Modified:** `apps/admin/lib/api/orders.ts`, `apps/admin/app/(dashboard)/orders/[id]/page.tsx`
- **Implementation:** Added `display_id` and `created_at` to fields and guarded date rendering.
- **Verification Evidence:** `audit-e2e.mjs` `ADM-P-ORD` renders "Order # 51" and valid date.

### BUG-016 — Fit Studio rules are read-only and cannot be deleted
- **Severity:** Medium
- **Feature/Page:** A-20 `/fit-rules`
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Missing delete route and interactive UI controls.
- **Files Modified:** `apps/backend/src/api/admin/fit-rules/[id]/route.ts`, `apps/admin/app/(dashboard)/fit-rules/*`
- **Implementation:** Created DELETE route with soft delete & audit logging; created interactive manager modal component.
- **Verification Evidence:** `audit-e2e.mjs` `CRUD-06..07` pass with HTTP 201 and 200.

### BUG-017 — Style concierge can take ~28 seconds before answering
- **Severity:** Medium
- **Feature/Page:** Aura-7 concierge
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** High timeout and retry delays in Gemini API client.
- **Files Modified:** `apps/backend/src/lib/gemini.ts`
- **Implementation:** Set timeout to 2,000ms with a 250ms retry delay, bounding total fallback to ~4.3s (< 5s).
- **Verification Evidence:** `audit-e2e.mjs` `PERF-AI-05` passes within SLA.

### BUG-018 — Mobile header overflows and clips navigation/account/bag
- **Severity:** Medium
- **Feature/Page:** Global header at 375 px
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Excessive horizontal padding and untruncated account name.
- **Files Modified:** `apps/storefront/components/site-header.tsx`
- **Implementation:** Applied `overflow-x-clip`, tightened mobile padding, truncated user name.
- **Verification Evidence:** Mobile viewport audit shows zero horizontal overflow.

### BUG-019 — Customers cannot cancel an order
- **Severity:** Medium
- **Feature/Page:** U-20 order detail
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Missing cancellation route and page.
- **Files Modified:** `apps/backend/src/api/store/orders/[id]/cancel/route.ts`, `apps/storefront/app/account/orders/[id]/cancel/*`
- **Implementation:** Added cancel route calling `cancelOrderWorkflow` with reason validation and UI.
- **Verification Evidence:** `audit-e2e.mjs` `MISS-.../cancel` returns HTTP 200.

### BUG-020 — No printable invoice
- **Severity:** Medium
- **Feature/Page:** Order detail
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Root Cause:** Missing printable invoice route.
- **Files Modified:** `apps/storefront/app/account/orders/[id]/invoice/*`
- **Implementation:** Built printable GST invoice with GSTIN, HSN Code 6403, and CGST/SGST breakdown.
- **Verification Evidence:** `audit-e2e.mjs` `MISS-.../invoice` returns HTTP 200.

---

## LOW DEFECTS (2 / 2 RESOLVED)

### BUG-021 — Quick View (U-09) is absent
- **Severity:** Low
- **Feature/Page:** Catalogue
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Files Modified:** `apps/storefront/app/collections/all/catalog-client.tsx`, `apps/storefront/app/products/[handle]/page.tsx`
- **Implementation:** Added Quick View modal with variant selectors on catalogue cards, and PDP badge.
- **Verification Evidence:** `audit-e2e.mjs` `MISS-QV` passes.

### BUG-022 — Concierge pill overlaps mobile content
- **Severity:** Low
- **Feature/Page:** Global mobile UI
- **Remediation Status:** ✅ **RESOLVED & VERIFIED**
- **Files Modified:** `apps/storefront/components/style-concierge.tsx`
- **Implementation:** Replaced wide desktop pill on `< sm` viewports with compact circular FAB.
- **Verification Evidence:** Mobile audit confirmed zero control overlap.
