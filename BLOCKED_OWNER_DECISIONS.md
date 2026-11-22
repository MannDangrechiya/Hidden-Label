# THE HIDDEN LABEL — BLOCKED OWNER DECISIONS & BUSINESS BOUNDARIES

**Date:** 2026-11-22  
**Status:** Pre-Launch Executive Ratification Required  
**Author:** Production Engineering & Compliance Auditor  

This document details all commercial policies, statutory declarations, and live production credentials that **cannot and must not be autonomously invented or assumed by engineering agents**.

Every item listed below requires formal sign-off or credential provisioning by the business owner / executive authority before public launch.

---

## 1. The Six Required Owner Decisions (D1 – D6)

### Decision D1: Resale Consignment Commission Rate & Payout Policy
- **Category:** Commercial & Financial Model
- **Current Implementation Default:** 
  - Code default in `apps/backend/src/lib/resale.ts`: `platformFeeRate = 0.095` (9.5% commission).
  - Bidding / two-sided stockbook offers are gated and disabled (`NEXT_PUBLIC_FEATURE_BIDDING=false`). Secondary market operates as curated fixed-price consignment.
- **Impact if Launched with Default:** 
  - All consigned luxury goods will deduct exactly 9.5% platform fee upon sale. If the business intends a 12% or tiered rate (e.g. 12% standard, 8% above ₹50,000), revenue will be lower than budgeted.
- **Steps Owner Must Take to Resolve:**
  1. Determine final consignment commission rate structure (flat percentage or tiered schedule).
  2. Decide consignor payout hold period: instant release upon delivery vs. 48-hour return/inspection hold.
- **Code / Config Changes Needed:**
  - Set `THL_RESALE_COMMISSION_RATE` in `apps/backend/.env.production` (e.g. `0.12`).
  - If tiered rates or custom hold rules are required, approve the tier schedule for engineering to set in `apps/backend/src/lib/resale.ts`.

---

### Decision D2: Shipping Pricing Policy & Free Shipping Threshold
- **Category:** Logistics & Pricing
- **Current Implementation Default:**
  - Flat shipping fee of ₹250 applies to orders below ₹5,000.
  - Free insured express shipping on orders of ₹5,000 and above.
- **Impact if Launched with Default:**
  - Orders under ₹5,000 will be billed ₹250 shipping; orders over ₹5,000 will receive complimentary luxury insured shipping. If courier costs exceed ₹250 on inter-state heavy parcels, margins will be impacted.
- **Steps Owner Must Take to Resolve:**
  1. Review Shiprocket courier rate cards for Ahmedabad HQ origin to Pan-India zones.
  2. Confirm whether ₹5,000 is the approved free-shipping threshold or if it should be ₹10,000+.
  3. Confirm COD (Cash on Delivery) availability and COD handling fee (currently prepaid-only recommended for high-ticket luxury).
- **Code / Config Changes Needed:**
  - Update shipping options and thresholds in Medusa admin / database setup (`apps/backend/src/scripts/setup-shipping.ts` or via Admin Dashboard > Settings > Regions > India > Shipping Options).

---

### Decision D3: Customer Return, Exchange Window & Fee Policy
- **Category:** Customer Service & Reverse Logistics
- **Current Implementation Default:**
  - 7-day return window from delivery date for unworn products with intact luxury security tags.
  - Bespoke / Made-to-Measure (MTM) garments become non-cancellable and non-returnable once cutting begins (`fabric_cutting` stage).
  - Reverse logistics shipping fee: ₹300 deducted from refund unless return is due to authenticity dispute or transit defect.
- **Impact if Launched with Default:**
  - Customers requesting returns within 7 days get automated RMA authorization with ₹300 reverse shipping deduction. If owner intended a "final sale / no returns on luxury sneakers" or 14-day window, policy mismatch will occur.
- **Steps Owner Must Take to Resolve:**
  1. Formalize the return policy: 3 days, 7 days, or exchange-only for footwear and bespoke goods.
  2. Decide whether return shipping is free or deducted from refund.
  3. Approve the customer-facing return policy copy for `/policies/returns`.
- **Code / Config Changes Needed:**
  - Update `apps/storefront/app/policies/returns/page.tsx` with finalized legal text.
  - Configure RMA return window constant in `apps/backend/src/modules/rma/service.ts`.

---

### Decision D4: Statutory Business Entity Credentials & Tax Identity
- **Category:** Legal & Statutory Compliance (India E-Commerce Rules)
- **Current Implementation Default:**
  - Legal Entity: *The Hidden Label Luxury Retail Pvt Ltd*
  - GSTIN Placeholder: `24AABCT0000A1Z5` (Gujarat State Code 24)
  - CIN Placeholder: `U52100GJ2024PTC123456`
  - Registered Address: *Steller, 205, 2nd Floor, Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380059*
- **Impact if Launched with Default:**
  - **ILLEGAL IN PRODUCTION.** Generating B2C Tax Invoices with a dummy or unverified GSTIN violates the Central Goods & Services Tax (CGST) Act, 2017. Publishing placeholder CIN on website violates Companies Act, 2013.
- **Steps Owner Must Take to Resolve:**
  1. Provide the registered MCA Certificate of Incorporation with exact registered entity name and CIN.
  2. Provide the verified Gujarat GSTIN certificate and principal place of business address.
  3. Provide official bank account details linked to GSTIN for invoice generation.
- **Code / Config Changes Needed:**
  - Set `BUSINESS_LEGAL_NAME`, `BUSINESS_GSTIN`, `BUSINESS_CIN`, `BUSINESS_ADDRESS`, `BUSINESS_STATE_CODE=24` in `apps/backend/.env.production` and `apps/storefront/.env.production`.
  - Re-run invoice template test to confirm valid tax breakdown (CGST+SGST for Gujarat, IGST for outside Gujarat).

---

### Decision D5: Grievance Officer Statutory Designation (Consumer Protection Act)
- **Category:** Statutory Consumer Protection & DPDP Compliance
- **Current Implementation Default:**
  - Officer Name: *Grievance Officer* (Generic placeholder)
  - Email: `grievance@thehiddenlabel.com`
  - Phone: `+917900000000` (Placeholder)
  - Working Hours: *Monday to Saturday, 10:00–19:00 IST*
  - Address: *Steller, 205, 2nd Floor, Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380059*
- **Impact if Launched with Default:**
  - Violation of Rule 5(3)(b) of the *Consumer Protection (E-Commerce) Rules, 2020* and the *Digital Personal Data Protection (DPDP) Act, 2023*, which require publication of a real designated natural person's name, direct phone number, and physical office address.
- **Steps Owner Must Take to Resolve:**
  1. Officially designate an executive or customer care head as the Grievance Officer.
  2. Allocate a monitored corporate email (`grievance@thehiddenlabel.com`) and phone line.
- **Code / Config Changes Needed:**
  - Set `GRIEVANCE_OFFICER_NAME`, `GRIEVANCE_OFFICER_EMAIL`, `GRIEVANCE_OFFICER_PHONE`, `GRIEVANCE_OFFICER_ADDRESS`, `GRIEVANCE_OFFICER_HOURS` in `apps/storefront/.env.production`.

---

### Decision D6: Live Payment, Logistics & Communications Accounts
- **Category:** Production Credentials & Third-Party Gateways
- **Current Implementation Default:**
  - Razorpay: Emulated sandbox test mode (`rzp_test_*`). Live keys are strictly blocked from test/staging environments.
  - Shiprocket: Mock logistics adapter.
  - Resend: Development console logger fallback.
  - SMS OTP: Mock echo mode (`OTP_DEV_ECHO=false` on production, pending real keys).
- **Impact if Launched with Default:**
  - Platform cannot process real customer credit cards, debit cards, UPI, or netbanking payments. No couriers can be booked; no real shipping labels can be printed; no transactional emails or SMS OTPs will be delivered to customers.
- **Steps Owner Must Take to Resolve:**
  1. **Razorpay Live Activation:** Complete merchant KYC on https://dashboard.razorpay.com, activate international & UPI rails, generate Live Key ID (`rzp_live_*`) and Key Secret, and configure webhook endpoint `https://api.thehiddenlabel.com/webhooks/razorpay`.
  2. **Shiprocket Live Account:** Complete KYC, add wallet recharge balance, configure Ahmedabad HQ pickup location, and configure tracking webhook for `https://api.thehiddenlabel.com/webhooks/shiprocket`.
  3. **Resend Live Account:** Add domain `thehiddenlabel.com`, configure DNS SPF, DKIM, and DMARC records on Cloudflare/Route53, and generate Live API Key (`re_*`).
  4. **DLT SMS Registration (India):** Complete DLT telemarketer registration (e.g. Jio/Airtel/Vil DLT portal), register Entity ID, Sender ID (`THLBL`), and approved SMS OTP templates with MSG91.
- **Code / Config Changes Needed:**
  - Populate production values in `apps/backend/.env.production` on the production server (never in git repository).

---

## 2. Statutory Placeholder Protection Mechanism

To prevent accidental publication of placeholder values as real claims:
1. `apps/storefront/components/site-footer.tsx` checks environment variables and falls back to `"—"` rather than displaying hardcoded mock numbers if unset.
2. `apps/backend/src/lib/env-guard.ts` verifies that template placeholder strings (`PROD_STRONG_PASSWORD`, `PROD_KEY_ID`, `rzp_live_PROD_KEY_ID`, etc.) cause backend initialization to abort immediately with exit code 1 when `NODE_ENV=production`.
3. In `apps/backend/src/modules/razorpay/service.ts`, `validateOptions` prevents `rzp_test_*` keys in production and prevents `rzp_live_*` keys in staging/dev.
4. Database fixture cleaner (`scripts/clean-test-fixtures.ts`) strictly rejects execution in `NODE_ENV=production` and requires exact `--confirm-environment` match.

---

## 3. Summary Sign-Off Status

| Decision ID | Description | Responsible Party | Status | Technical Readiness |
|---|---|---|---|---|
| **D1** | Resale Commission Rate (9.5% vs 12%) | Founder / CFO | **Awaiting Decision** | Code implemented; param in backend env |
| **D2** | Shipping Thresholds (₹5,000 free shipping) | Operations / CEO | **Awaiting Decision** | Configurable in Medusa admin / DB |
| **D3** | Return & Exchange Policy (7-day window) | Customer Support Head | **Awaiting Decision** | Policy page and RMA engine ready |
| **D4** | Real GSTIN, CIN & Registered Address | Legal & Compliance | **Awaiting Data** | Invoice generator and footers ready |
| **D5** | Grievance Officer Designation | HR & Compliance | **Awaiting Data** | Grievance page and footer ready |
| **D6** | Live Razorpay, Shiprocket & MSG91 Accounts | Operations & DevOps | **Awaiting Provisioning** | Integration services ready & tested |
