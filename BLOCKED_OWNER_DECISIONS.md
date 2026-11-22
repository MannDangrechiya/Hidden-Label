# THE HIDDEN LABEL — BLOCKED OWNER DECISIONS & BUSINESS BOUNDARIES

**Date:** 2026-11-21  
**Status:** Awaiting Executive Ratification  
**Author:** Autonomous Project Orchestrator

This document records all strategic business decisions, statutory declarations, commercial policies, and production service credentials that **cannot and must not be autonomously invented by engineering agents**. 

All technical implementations have been prepared with safe, secure defaults (e.g., bidding disabled by default, test fixtures quarantined, 0 unauthorized disbursements), pending owner sign-off.

---

## 1. Strategic Commercial Decisions

### Decision 1: Resale Platform Model (BD-1)
- **Context:** THE HIDDEN LABEL resale pillar supports both fixed-price consignment listings and two-sided stockbook bidding (offers & asks).
- **Engineering State:** Bidding UI elements and actions have been **strictly disabled by default** (`NEXT_PUBLIC_FEATURE_BIDDING=false`). The secondary marketplace operates exclusively in fixed-price consignment mode.
- **Owner Action Required:** Confirm whether to:
  - **Option A (Recommended for Luxury Positioning):** Launch with Fixed-Price Verified Consignment only. Maintains curated exclusivity, avoids penny-bidding, and simplifies financial operations.
  - **Option B:** Launch Two-Sided StockX-style Bidding with automated order matching.
  - **Option C:** Hybrid model where bidding is enabled only for select archival/collector sneaker releases.

### Decision 2: Consignment Commission Rates & Settlement Schedule (BD-3)
- **Context:** When a consignor's pair sells, the platform retains a commission before disbursing the payout.
- **Engineering State:** `apps/backend/src/lib/resale.ts` contains a default calculation parameter `platformFeeRate = 0.095` (9.5%).
- **Owner Action Required:** Specify:
  1. Standard platform commission percentage (e.g., 9.5%, 12%, or 15%).
  2. Tiered commission schedule (e.g., reduced commission on items priced over ₹50,000).
  3. Payout hold window: Immediate upon courier delivery vs 48-hour post-delivery inspection window.

### Decision 3: Bespoke Tailoring Surcharges & Cancellation Milestones
- **Context:** Made-to-Measure (MTM) garments are currently priced at the product's catalog retail price with ₹0 custom cutting surcharge.
- **Owner Action Required:** Specify:
  1. Made-to-measure pattern modification fee (flat fee or percentage).
  2. Statutory non-cancellation milestone: Formalize in customer terms that bespoke garments become strictly non-refundable once the master tailor advances the order to `fabric_cutting`.

---

## 2. Statutory Legal & Regulatory Disclosures

Under the **Consumer Protection (E-Commerce) Rules, 2020** and the **Legal Metrology (Packaged Commodities) Rules, 2011**, Indian e-commerce entities must publish registered corporate identity parameters.

The following values currently use development placeholders and must be supplied by the legal entity owner:

| Declaration Field | Statutory Mandate | Current Placeholder in Code | Required Real Value |
|---|---|---|---|
| **Business Legal Entity Name** | Ministry of Corporate Affairs | `The Hidden Label Luxury Retail Pvt Ltd` | Official MCA Certificate Name |
| **GSTIN** | Central Goods & Services Tax Act | `24AAACT0000A1Z5` (Template) | Real 15-character Gujarat GSTIN |
| **CIN** | Companies Act, 2013 | `U74999GJ2026PTC000000` | 21-character Corporate Identity No. |
| **Registered Office Address** | Consumer Protection Act | Sindhu Bhavan Road, Ahmedabad | Complete registered address |
| **Grievance Officer Name** | Rule 5(3)(b) Consumer Protection | "Grievance Officer" | Designated executive's full name |
| **Grievance Officer Contact** | Rule 5(3)(b) Consumer Protection | `grievance@thehiddenlabel.com` | Official email & direct phone |

---

## 3. Production Service Credentials & Infrastructure Provisioning

The monorepo contains production templates ([.env.production.example](file:///c:/Users/ASUS/Documents/Hidden%20Label/.env.production.example)) and multi-stage Docker containerization. Live production deployment requires provisioning the following external service accounts:

### 3.1 Payment Processing (Razorpay)
- `RAZORPAY_KEY_ID`: Live key from Razorpay Dashboard (Format: `rzp_live_...`).
- `RAZORPAY_KEY_SECRET`: Live secret key.
- `RAZORPAY_WEBHOOK_SECRET`: Secret configured in Razorpay Webhook settings for event URL `https://api.thehiddenlabel.com/webhooks/razorpay`.

### 3.2 Logistics & Reverse Logistics (Shiprocket)
- `SHIPROCKET_EMAIL`: Registered Shiprocket merchant account email.
- `SHIPROCKET_PASSWORD`: Merchant account password.
- `SHIPROCKET_WEBHOOK_TOKEN`: Pre-shared secret header configured in Shiprocket webhook settings for `https://api.thehiddenlabel.com/webhooks/shiprocket`.
- **Default Warehouse ID:** Registered warehouse pickup location ID in Shiprocket dashboard.

### 3.3 Transactional Communications (Resend & SMS)
- `RESEND_API_KEY`: API key with domain verification for `orders@thehiddenlabel.com`.
- **DLT Registration (India SMS):** If SMS OTP is activated, DLT-registered Entity ID and Sender ID from MSG91 or Twilio.

### 3.4 Cloud Object Storage (S3 / Cloudflare R2)
- `S3_BUCKET`: Private or public media bucket.
- `S3_ENDPOINT`: Storage API endpoint.
- `S3_KEY` & `S3_SECRET`: Read/write IAM access credentials.

### 3.5 Monitoring & Intelligence
- `SENTRY_DSN`: Production project DSN for backend and Next.js applications.
- `GEMINI_API_KEY`: Google AI Studio API key for Aura-7 Style Concierge LLM replies.

---

## 4. Summary Table of Actionable Next Steps

| # | Action Item | Owner / Department | Status | Technical Readiness |
|---|---|---|---|---|
| 1 | Ratify Resale Model (Fixed-price vs Bidding) | Founder / CEO | Awaiting Sign-off | Code implemented; bidding gated behind env flag |
| 2 | Supply Legal Disclosures (GSTIN, CIN, Grievance Officer) | Legal / Compliance | Awaiting Data | Admin & Storefront templates ready |
| 3 | Confirm Consignment Fee Rate & Hold Periods | Finance | Awaiting Policy | Resale math parameterized |
| 4 | Supply Live Razorpay & Shiprocket Credentials | Operations / DevOps | Awaiting Provisioning | Emulators & sandbox suites verified |
| 5 | Provision Production Cloud Infrastructure (PostgreSQL 16+, Redis 7, Nginx) | DevOps | Awaiting Cloud Account | Docker, Nginx, and Compose ready |
