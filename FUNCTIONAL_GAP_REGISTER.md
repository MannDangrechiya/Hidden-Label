# THE HIDDEN LABEL — MASTER FUNCTIONAL GAP REGISTER
**Comprehensive Evidence-Based Register of Defects, Vulnerabilities, Incomplete Features, and Missing Work**

---

## 1. Summary of Registered Findings

| Finding ID | Domain / Module | Title | Severity | Status |
|---|---|---|---|---|
| **GAP-SEC-01** | Security / RBAC | Universal Staff Self-Role Escalation via `/admin/users/me` | **CRITICAL** | IMPLEMENTED BUT BROKEN |
| **GAP-SEC-02** | Security / Checkout | Client-Side Forgery of Cash-on-Delivery OTP Verification | **CRITICAL** | IMPLEMENTED BUT BROKEN |
| **GAP-SEC-03** | Security / Auth | Missing Brute-Force Rate Limiting on Login Endpoints | **MEDIUM** | PARTIALLY IMPLEMENTED |
| **GAP-TAX-01** | Taxation / Compliance | Zero Database Tax Configuration in Medusa Engine | **CRITICAL** | BLOCKED |
| **GAP-TAX-02** | Invoicing / Compliance| Illegal Inter-State Tax Billing (Hardcoded CGST/SGST nationwide) | **CRITICAL** | IMPLEMENTED BUT BROKEN |
| **GAP-TAX-03** | Invoicing / Compliance| Hardcoded Dummy Business GSTIN (`24AAACT1234F1Z5`) | **HIGH** | MOCKED |
| **GAP-TAX-04** | Invoicing / Compliance| Universal Footwear HSN `6403` Applied to Apparel & Bespoke | **HIGH** | IMPLEMENTED BUT BROKEN |
| **GAP-TAX-05** | Invoicing / Compliance| Hardcoded Payment Mode "Cash on Delivery / Offline" | **LOW** | MOCKED |
| **GAP-PAY-01** | Payments / Gateway | Complete Absence of Storefront Razorpay Checkout SDK | **CRITICAL** | FRONTEND ONLY / DISCONNECTED |
| **GAP-PAY-02** | Payments / Gateway | Missing Razorpay API Credentials (`RAZORPAY_KEY_*`) | **CRITICAL** | NOT IMPLEMENTED |
| **GAP-PAY-03** | Payments / Gateway | Razorpay Provider Not Attached to India Region in DB | **CRITICAL** | BACKEND ONLY |
| **GAP-PAY-04** | Payments / Refunds | Zero Bank Account / UPI Capture Workflow for COD Returns | **HIGH** | NOT IMPLEMENTED |
| **GAP-PAY-05** | Payments / Webhooks | Missing Dedicated `/webhooks/razorpay` Endpoint | **HIGH** | NOT IMPLEMENTED |
| **GAP-SMS-01** | Phone / OTP | Zero SMS Provider Integration in Codebase | **CRITICAL** | NOT IMPLEMENTED |
| **GAP-SMS-02** | Phone / Validation | Mobile Input Rejects Bare 10-Digit Indian Numbers | **MEDIUM** | WORKING WITH LIMITATIONS |
| **GAP-SMS-03** | Phone / Compliance | Missing Indian TRAI / DLT Headers & Template ID Config | **HIGH** | NOT IMPLEMENTED |
| **GAP-LOG-01** | Logistics / Shipping | Missing Shiprocket API Credentials (`SHIPROCKET_*`) | **HIGH** | NOT IMPLEMENTED |
| **GAP-LOG-02** | Logistics / Shipping | Hardcoded Package Dimensions & Payment Method in Shiprocket | **HIGH** | IMPLEMENTED BUT BROKEN |
| **GAP-LOG-03** | Logistics / Webhooks | Carrier Webhooks Do Not Update Medusa Order Fulfillment State | **MEDIUM** | PARTIALLY IMPLEMENTED |
| **GAP-LOG-04** | Logistics / Returns | Zero Automated Reverse Logistics (Return AWB) | **HIGH** | NOT IMPLEMENTED |
| **GAP-EML-01** | Email / Delivery | Missing Resend API Credentials (`RESEND_API_KEY`) | **HIGH** | NOT IMPLEMENTED |
| **GAP-EML-02** | Email / Lifecycle | Missing Order, Shipment, Delivery, and Cancellation Emails | **HIGH** | NOT IMPLEMENTED |
| **GAP-EML-03** | Email / Templates | Orphaned `orderEmailHtml` Template Never Called | **MEDIUM** | MOCKED / ORPHANED |
| **GAP-ADR-01** | Address / Postal | Zero PIN Code Lookup & Auto-Completion of City/State | **MEDIUM** | NOT IMPLEMENTED |
| **GAP-ADR-02** | Address / Postal | Zero Courier Delivery & COD Serviceability Checks on PIN | **HIGH** | NOT IMPLEMENTED |
| **GAP-ADR-03** | Address / UI | Missing Flat/House No., Building, Landmark, Address Type | **MEDIUM** | WORKING WITH LIMITATIONS |
| **GAP-SUP-01** | Support / Helpdesk | Static FAQ Page Only; Zero Interactive Support Channels | **HIGH** | WORKING WITH LIMITATIONS |
| **GAP-SUP-02** | Support / Statutory | Missing Published Grievance Officer Details & 48h/30d SLA | **CRITICAL** | NOT IMPLEMENTED |
| **GAP-REG-01** | Compliance / DPDP | Missing DPDP Act Section 5 Notice in Scheduled Languages | **HIGH** | NOT IMPLEMENTED |
| **GAP-REG-02** | Compliance / DPDP | Zero Affirmative Privacy Consent Checkbox on Registration | **HIGH** | NOT IMPLEMENTED |
| **GAP-REG-03** | Compliance / DPDP | Zero Account Deletion / Data Principal Rights Workflow | **HIGH** | NOT IMPLEMENTED |
| **GAP-REG-04** | Compliance / Metrology| Missing Country of Origin and MRP Disclosures on PDP | **HIGH** | NOT IMPLEMENTED |
| **GAP-INF-01** | Infra / Security | Missing HSTS and Content-Security-Policy (CSP) Headers | **MEDIUM** | PARTIALLY IMPLEMENTED |
| **GAP-INF-02** | Infra / Database | Unmanaged Local PostgreSQL Instance on Port 5437 | **HIGH** | WORKING WITH LIMITATIONS |
| **GAP-INF-03** | Infra / Cache | Missing Redis Cluster; Ephemeral In-Memory Event Bus | **HIGH** | WORKING WITH LIMITATIONS |

---

## 2. Detailed Findings Register

### GAP-SEC-01: Universal Staff Self-Role Escalation via `/admin/users/me`
- **Feature:** Admin Access Control & RBAC
- **File Path:** `apps/backend/src/api/middlewares.ts`
- **Function / Route:** `adminRbacMiddleware` lines 144–151
- **API Endpoint:** `POST /admin/users/me`
- **Database Table:** `user` (Column: `metadata`)
- **Runtime Evidence:** Verified via `.audit/test-users-me.mjs`. `audit.readonly@thehiddenlabel.com` issued `POST /admin/users/me` with `{"metadata": {"role": "owner"}}`. HTTP 200 returned; `user.metadata.role` changed to `owner` in DB.
- **Expected Behavior:** Non-owner users must not be permitted to escalate their own role or modify privileged metadata.
- **Actual Behavior:** Full privilege escalation to `owner` on any authenticated staff account.
- **Status:** **IMPLEMENTED BUT BROKEN**
- **Severity:** **CRITICAL (CVSS 9.8)**
- **Missing Work:** Restrict `/admin/users/me` bypass strictly to `GET` and `HEAD` methods; strip `role` and privileged keys from self-update payloads.

---

### GAP-SEC-02: Client-Side Forgery of Cash-on-Delivery OTP Verification
- **Feature:** Checkout & Order Security
- **File Path:** `apps/backend/src/api/middlewares.ts`
- **Function / Route:** `codOtpVerificationMiddleware` lines 76–86
- **API Endpoint:** `POST /store/carts/:id` followed by `POST /store/carts/:id/complete`
- **Database Table:** `cart` (Column: `metadata`), `order`
- **Runtime Evidence:** Verified via `.audit/test-cod-forgery.mjs`. Injected `{"metadata": {"cod_otp_verified_at": timestamp}}` into public cart endpoint. Order `order_01M7F6ZZW0BE6BP97AM2EWCM49` placed with zero OTP challenge issued.
- **Expected Behavior:** Cart completion must verify server-side cryptographic proof tied to an unexpired, consumed `otp_challenge` row.
- **Actual Behavior:** Remote bots can place unlimited fraudulent COD orders without solving OTP challenges.
- **Status:** **IMPLEMENTED BUT BROKEN**
- **Severity:** **CRITICAL (CVSS 8.6)**
- **Missing Work:** Disallow client writes to `cod_otp_verified_at` in cart metadata; track COD OTP verification in a dedicated server-only database table.

---

### GAP-TAX-01: Zero Database Tax Configuration in Medusa Engine
- **Feature:** Indian Commerce & Taxation
- **File Path:** PostgreSQL Database Schema / `apps/backend/medusa-config.ts`
- **Database Table:** `tax_region`, `tax_rate`, `tax_rate_rule`, `order_line_item_tax_line`
- **Runtime Evidence:** Verified via `.audit/get-tax-config.mjs`. All tax tables contain **0 rows**.
- **Expected Behavior:** Indian GST tax regions and standard slabs (5%, 12%, 18%, 28%) seeded in Medusa core.
- **Actual Behavior:** Medusa computes `tax_total = 0` on all carts and orders.
- **Status:** **BLOCKED**
- **Severity:** **CRITICAL**
- **Missing Work:** Create database migration seeding India tax region and tax rates; associate tax rates with product categories.

---

### GAP-TAX-02: Illegal Inter-State Tax Billing (Hardcoded CGST/SGST Nationwide)
- **Feature:** Tax Invoicing Compliance
- **File Path:** `apps/storefront/app/account/orders/[id]/invoice/page.tsx`
- **Function / Route:** `OrderInvoicePage` lines 38–41, 105, 150–153
- **Database Table:** None (Client-side math)
- **Runtime Evidence:** Code inspection shows hardcoded `Place of Supply: (State Code: 24)` and 9% CGST + 9% SGST for all destinations across India.
- **Expected Behavior:** Inter-state orders delivered outside Gujarat must be billed as Integrated GST (IGST 18%).
- **Actual Behavior:** Inter-state orders receive illegal Gujarat intra-state tax invoices.
- **Status:** **IMPLEMENTED BUT BROKEN**
- **Severity:** **CRITICAL**
- **Missing Work:** Implement place-of-supply comparison: if shipping state != 24, charge IGST (18%).

---

### GAP-TAX-03: Hardcoded Dummy Business GSTIN
- **Feature:** Tax Invoicing Compliance
- **File Path:** `apps/storefront/app/account/orders/[id]/invoice/page.tsx`
- **Function / Route:** Line 67
- **Runtime Evidence:** Code contains `<strong>GSTIN:</strong> 24AAACT1234F1Z5`.
- **Expected Behavior:** Display authentic registered business GSTIN from environment variables.
- **Actual Behavior:** Displays invalid dummy string with invalid PAN structure.
- **Status:** **MOCKED**
- **Severity:** **HIGH**
- **Missing Work:** Bind GSTIN display to `process.env.BUSINESS_GSTIN`.

---

### GAP-TAX-04: Universal Footwear HSN `6403` Applied to Apparel & Bespoke
- **Feature:** Tax Invoicing Compliance
- **File Path:** `apps/storefront/app/account/orders/[id]/invoice/page.tsx`
- **Function / Route:** Line 133
- **Runtime Evidence:** Table header renders `<td className="py-3 px-3 font-mono">6403 (Footwear)</td>` for every item.
- **Expected Behavior:** Dynamically display HSN 6203/6204 for suits/apparel, 6109 for t-shirts, 4202 for bags, 6403 for footwear.
- **Actual Behavior:** Luxury suits and t-shirts are classified as Footwear.
- **Status:** **IMPLEMENTED BUT BROKEN**
- **Severity:** **HIGH**
- **Missing Work:** Store HSN codes in product metadata and render dynamically on invoice table rows.

---

### GAP-PAY-01: Complete Absence of Storefront Razorpay Checkout SDK
- **Feature:** Digital Online Payments
- **File Path:** `apps/storefront/app/checkout/payment/page.tsx`, `components/checkout-payment-form.tsx`
- **Runtime Evidence:** Grep for `checkout.razorpay.com` across `apps/storefront` returned 0 matches.
- **Expected Behavior:** Storefront loads Razorpay SDK, launches payment iframe, captures payment ID and signature.
- **Actual Behavior:** Storefront has zero client code to collect payment signatures; online payment cannot function.
- **Status:** **FRONTEND ONLY / DISCONNECTED**
- **Severity:** **CRITICAL**
- **Missing Work:** Embed `https://checkout.razorpay.com/v1/checkout.js` and implement modal trigger in `checkout-payment-form.tsx`.

---

### GAP-PAY-02 & GAP-PAY-03: Missing Razorpay Credentials & Database Region Link
- **Feature:** Digital Online Payments
- **File Path:** `apps/backend/.env`, `apps/backend/medusa-config.ts`, PostgreSQL table `region_payment_provider`
- **Runtime Evidence:** `RAZORPAY_KEY_*` unset; query of `region_payment_provider` returned only `pp_system_default`.
- **Expected Behavior:** Keys configured; `pp_razorpay_razorpay` linked to India region in database.
- **Actual Behavior:** Provider throws `MedusaError(NOT_ALLOWED)`; region does not list Razorpay.
- **Status:** **BLOCKED**
- **Severity:** **CRITICAL**
- **Missing Work:** Configure live API keys; insert `pp_razorpay_razorpay` into `region_payment_provider`.

---

### GAP-SMS-01: Zero SMS Provider Integration in Codebase
- **Feature:** Mobile Identity & Phone OTP
- **File Path:** `apps/backend/src/api/store/otp/send/route.ts`
- **Function / Route:** Lines 82–110
- **Runtime Evidence:** Route contains no HTTP client for MSG91 or any SMS provider. Returns 501 or simulated echo.
- **Expected Behavior:** Dispatches real 6-digit SMS OTP via Indian DLT-registered gateway.
- **Actual Behavior:** Completely non-operational in production.
- **Status:** **NOT IMPLEMENTED**
- **Severity:** **CRITICAL**
- **Missing Work:** Implement real SMS provider integration in `apps/backend/src/lib/sms.ts`.

---

### GAP-LOG-01 & GAP-LOG-02: Shiprocket Unconfigured & Hardcoded Dispatch Values
- **Feature:** Courier & Forward Logistics
- **File Path:** `apps/backend/src/lib/shiprocket.ts`, `src/api/admin/shipments/route.ts`
- **Runtime Evidence:** `SHIPROCKET_*` unset; `route.ts#L132` hardcodes `paymentMethod: "COD"`; dimensions hardcoded to 30×20×12 cm, 0.6 kg.
- **Expected Behavior:** Live courier AWB generated; dynamic dimensions calculated; payment method matches order payment collection.
- **Actual Behavior:** Falls back to manual dispatch; hardcoded COD paymentMethod and static dimensions.
- **Status:** **IMPLEMENTED BUT BROKEN / BLOCKED**
- **Severity:** **HIGH**
- **Missing Work:** Add Shiprocket credentials; compute dimensions by product category; pass real payment mode.

---

### GAP-EML-01, GAP-EML-02 & GAP-EML-03: Email Integration & Orphaned Templates
- **Feature:** Transactional Customer Communications
- **File Path:** `apps/backend/src/lib/email.ts`, `src/subscribers/`
- **Runtime Evidence:** `RESEND_API_KEY` unset; `orderEmailHtml` in `email.ts#L54` is never called; zero order/shipment/delivery subscribers exist.
- **Expected Behavior:** Customers receive branded HTML emails on order placement, fulfillment, dispatch, and delivery.
- **Actual Behavior:** Customers receive zero transactional emails across the entire order lifecycle.
- **Status:** **NOT IMPLEMENTED / ORPHANED**
- **Severity:** **HIGH**
- **Missing Work:** Configure Resend API key; wire Medusa event subscribers for order and fulfillment events.

---

### GAP-SUP-02: Missing Published Grievance Officer Details & 48h/30d SLA
- **Feature:** Customer Support & Regulatory Compliance
- **File Path:** Storefront CMS / Footer
- **Runtime Evidence:** Zero mentions of a Grievance Officer, phone number, email, or SLA across all pages.
- **Expected Behavior:** Prominent publication of Grievance Officer details with 48h acknowledgment and 30d resolution SLA.
- **Actual Behavior:** Completely absent, violating Indian Consumer Protection (E-Commerce) Rules, 2020.
- **Status:** **NOT IMPLEMENTED**
- **Severity:** **CRITICAL**
- **Missing Work:** Publish dedicated Grievance Officer page and persistent footer disclosures.
