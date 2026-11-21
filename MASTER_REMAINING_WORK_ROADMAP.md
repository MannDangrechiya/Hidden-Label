# THE HIDDEN LABEL — MASTER REMAINING WORK ROADMAP
**Authoritative Implementation Sequence, Dependencies, Verification Criteria & Decision Gates**

- **Date:** 2026-11-21
- **Audit Baseline:** `AUDIT_REPORTS/15_RECOMMENDED_IMPLEMENTATION_ROADMAP.md` and `AUDIT_REPORTS/13_MISSING_FEATURES_AND_GAP_REGISTER.md`
- **Core Architecture Constraints:** Medusa 2.22.7, Next.js 16.4.6, PostgreSQL 18, pnpm monorepo.
- **Pillars Preserved:** 
  1. Premium Multi-Brand Retail (Sneakers & Luxury Streetwear)
  2. Bespoke Tailoring Atelier (Made-to-Measure & Alterations)
  3. Resale & Authentication Marketplace (CultureCircle Consignment Model)

---

## 1. Roadmap Architecture & Execution Principles

### 1.1 Sequencing Principle
> **"Prove money moves, then make logistics and operations real, then scale merchandising and secondary business lines."**

No work shall begin on secondary business domains (Bespoke Atelier or Resale Marketplace) until a standard multi-brand order has been **paid, fulfilled via courier, tracked, returned, and refunded with a GST credit note** end-to-end.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 EXECUTION FLOWCHART                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [Phase A: Baseline & Gates]  ───▶  [Phase B: Commerce & Logistics Loop]
             │                                          │
             ▼                                          ▼
  [Phase C: Production Infra]  ───▶  [Phase D: Storefront Merchandising]
             │                                          │
             ▼                                          ▼
  [Phase E: Retail Back Office] ──▶  [Phase F: Bespoke] ──▶ [Phase G: Resale]
```

### 1.2 Status of Pre-Requisite Phases
- **Phase A (Foundation & Blockers):** **ENGINEERING COMPLETE LOCALLY.** RBAC, inventory locking, refund idempotency, exact INR arithmetic, and lint/typecheck gates are green. Awaiting live Razorpay merchant test keys to close external gateway verification.
- **Phase B (Commerce & Logistics):** **APPROVED NEXT IMPLEMENTATION PHASE.**

---

## 2. Phase-by-Phase Implementation Roadmap

---

### PHASE A — Foundation and Release Blockers (Status: Engineering Complete Locally)
**Goal:** Clean release gates, zero high-severity vulnerabilities, and verified payment authorization.

| Package ID | Task / Work Package | Target Findings | Priority | Depends On | Exit / Verification Criteria |
|---|---|---|---|---|---|
| **A-01** | Git push Phase 1 commits to GitHub `origin/main` | NEW-01 | **P0** | Owner Approval | GitHub `origin/main` matches local commit `7a68479`. |
| **A-02** | Commit and push Phase 2 payment implementation | NEW-02 | **P0** | Owner Approval | Clean working tree (`git status` → 0 entries); GitHub has all Phase 2 code. |
| **A-03** | Live Razorpay gateway verification | BUG-01, GAP-001, GAP-002 | **P0** | Owner: Razorpay test keys | Live HTTP order creation and payment authorization against `api.razorpay.com`. |
| **A-04** | Live webhook endpoint registration | GAP-003, R-08 | **P0** | A-03 | Webhook delivery from Razorpay dashboard successfully verified in `webhook_event`. |
| **A-05** | Wire `claimPaymentOperation` into checkout | NEW-04 | **P1** | — | **VERIFIED COMPLETE LOCALLY.** Intercepts `POST /store/carts/:id/complete` via `cartCompletePaymentOperationMiddleware`, enforcing atomic mutex lock, idempotency, stale recovery, and order completion tracking. |
| **A-06** | Email reliability & notification event tracking | GAP-045, NEW-05 | **P1** | Owner: Resend API key | **VERIFIED COMPLETE LOCALLY.** Tracks `skipped_unconfigured` / `sent` in `order.metadata` and `audit_event`, prevents duplicate sends, logs operationally. Real transmission pending Resend API key. |

---

### PHASE B — Core Commerce and Operational Lifecycle (Approved Next Phase)
**Goal:** Deliver, track, return, refund, and credit-note — a complete order lifecycle proven end-to-end with real logistics integration.

| Package ID | Task / Work Package | Target Findings | Priority | Depends On | Exit / Verification Criteria |
|---|---|---|---|---|---|
| **B-01** | Shiprocket API Integration & Sandbox AWB | GAP-060 | **P0** | Owner: Shiprocket credentials | Generate a real sandbox shipping label & AWB from Medusa fulfillment workflow. |
| **B-02** | Dynamic Warehouse Pickup Address | GAP-061 | **P1** | B-01 | Replace hardcoded Ahmedabad address in `lib/shiprocket.ts` with env/database configuration. |
| **B-03** | Harden Shiprocket Webhook Ingestion | SEC-05, GAP-062 | **P1** | B-01 | Implement IP allowlist or HMAC signature verification; reject unauthenticated calls. |
| **B-04** | Full RMA Reverse Pickup & Restock Workflow | GAP-050, GAP-051 | **P1** | B-01, A-03 | Customer submits return → Admin approves → Reverse pickup booked → Item received → Stock atomically restocked. |
| **B-05** | GST Credit Note Generation & Sequence | GAP-052 | **P1** | B-04 | Legally compliant GST credit note PDF generated with unique consecutive numbering on refund. |
| **B-06** | Payment & Gateway Settlement Reconciliation | GAP-075 | **P1** | A-03 | Import Razorpay settlement CSVs; reconcile captured payments against settled bank amounts. |
| **B-07** | Courier Freight Cost Tracking | GAP-065 | **P2** | B-01 | Record carrier freight charges per shipment to compute net order margins. |
| **B-08** | Weight & Tiered Shipping Rate Calculation | GAP-008 | **P2** | B-01 | Implement weight-based and cart-value-based shipping rules in Medusa. |
| **B-09** | Courier Serviceability Check at Checkout | GAP-007 | **P2** | B-01 | Query Shiprocket serviceability API on pincode entry before payment step. |
| **B-10** | Four-Role Admin Operational Walkthrough | GAP-040 | **P1** | A-01 | Evidence logs of Owner, Manager, Operations, and Support accounts exercising permitted boundaries. |
| **B-11** | Statutory Business Disclosures & Grievance | GAP-033, GAP-078 | **P0** | Owner: Legal business entities | Real GSTIN, CIN, and Grievance Officer details published in storefront footer. |

---

### PHASE C — Production Infrastructure & Reliability (Parallel to B)
**Goal:** Multi-environment cloud hosting, automated deployments, persistent storage, and zero data loss drills.

| Package ID | Task / Work Package | Target Findings | Priority | Depends On | Exit / Verification Criteria |
|---|---|---|---|---|---|
| **C-01** | Docker Containerisation | GAP-111 | **P0** | — | Production Dockerfiles for `apps/backend`, `apps/storefront`, and `apps/admin`. |
| **C-02** | Cloud Object Storage (S3 / R2) | GAP-041, GAP-115 | **P1** | Owner: S3 bucket | Upload product images and inspection photos to S3-compatible storage; remove local `uploads/`. |
| **C-03** | Managed Redis 7 Deployment | GAP-114 | **P1** | Infrastructure | Set `REDIS_URL`; Medusa event bus, queues, and rate limiting run on Redis cluster. |
| **C-04** | Sentry Error Monitoring & Alerting | GAP-113 | **P1** | Owner: Sentry DSN | Real-time crash and error reporting across backend and storefronts. |
| **C-05** | Automated Database Backup & Restore Drill | GAP-112 | **P0** | Infrastructure | Automated daily pg_dump to encrypted storage; documented rehearsal of restoring to scratch DB. |
| **C-06** | CI/CD Pipeline & Staging Environment | GAP-111 | **P1** | Infrastructure | Merging to `main` deploys to staging with automated database migration and one-command rollback. |
| **C-07** | Dependency Vulnerability Scanning | SEC-11, GAP-118 | **P1** | — | Add `pnpm audit --audit-level=high` and Dependabot alerts to CI. |
| **C-08** | Development DB Audit Fixture Purge | BUG-12, GAP-119 | **P2** | — | Clean 36 `Audit Brand` rows and old test reservations from development database. |
| **C-09** | Staff MFA & Session Revocation | SEC-09 | **P2** | Owner: MFA Policy | Implement TOTP two-factor authentication for admin users and database session revocation table. |

---

### PHASE D — Storefront Quality & Merchandising (Parallel to B/C)
**Goal:** High-conversion, premium customer experience with truthful stock visibility and SEO.

| Package ID | Task / Work Package | Target Findings | Priority | Depends On | Exit / Verification Criteria |
|---|---|---|---|---|---|
| **D-01** | Server-Side Pagination & Infinite Scroll | BUG-10, GAP-010 | **P1** | — | Catalogue pagination moves to server query; filters evaluate entire product database. |
| **D-02** | Unified Category Model | GAP-011 | **P1** | — | Storefront navigation and filters driven exclusively by official `product_category` records. |
| **D-03** | Multi-Image Product Gallery & Seed Data | GAP-016 | **P1** | C-02 | PDP renders multi-image gallery with zoom/carousel; seed multi-angle photography. |
| **D-04** | Dynamic CMS-Driven Brand Pavilion | BUG-06, GAP-013 | **P1** | — | Homepage fetches dynamic `/store/brands` with live silhouette counts; removes hardcoded array. |
| **D-05** | Truthful Stock & Availability Badging | BUG-07, GAP-014 | **P2** | — | "In Stock →" badging rendered conditionally; out-of-stock variants disabled or badged. |
| **D-06** | Availability (In-Stock) Facet Filter | GAP-012 | **P2** | D-01 | Catalogue filter allowing customers to shop "Available Only" items. |
| **D-07** | Product Reviews & Rating System | GAP-018 | **P1** | — | Verified-buyer review submission, star ratings, and admin moderation queue. |
| **D-08** | Related Products & Complete-the-Look | GAP-017 | **P2** | — | Product recommendation engine based on brand and category associations. |
| **D-09** | Dynamic Promotional Banners & Slots | GAP-015 | **P2** | — | Homepage consumes active `BannerSlot` content managed from admin CMS. |
| **D-10** | PDP SEO Meta & Structured Data | GAP-022 | **P2** | — | OpenGraph, Twitter cards, canonical tags, and Schema.org Product JSON-LD rendered. |
| **D-11** | Customer Mobile SMS OTP Authentication | GAP-032 | **P1** | Owner: SMS Gateway | Indian DLT-compliant mobile number OTP login and registration. |

---

### PHASE E — Retail Back Office (Purchasing, Costing & Accounting)
**Goal:** Inbound stock control, gross margin reporting, and statutory tax compliance.

| Package ID | Task / Work Package | Target Findings | Priority | Depends On | Exit / Verification Criteria |
|---|---|---|---|---|---|
| **E-01** | Supplier Management Records | GAP-070 | **P1** | — | `supplier` table, vendor terms, contact information, and admin CRUD. |
| **E-02** | Purchase Orders (PO) & Goods Receipt (GRN) | GAP-071 | **P1** | E-01 | PO drafting → vendor issuance → GRN warehouse receipt → inventory stock increment. |
| **E-03** | Landed Purchase Cost per Variant | GAP-072 | **P1** | E-01 | Landed cost field per variant (purchase price + freight + customs duty). |
| **E-04** | Gross Margin & Profitability Reports | GAP-073 | **P1** | E-03 | Sales margin analytics: net selling price minus landed cost per SKU. |
| **E-05** | Inventory Valuation Ledger (FIFO / Average Cost) | GAP-074 | **P1** | E-03 | Live inventory valuation report for corporate balance sheet and audit. |
| **E-06** | GSTR-1 Ready Tax Export | GAP-076 | **P1** | B-05 | Monthly sales and tax export broken down by GST rate (18%, 12%), HSN code, and state. |
| **E-07** | Bulk Inventory Adjustment via CSV | GAP-042 | **P2** | — | Admin CSV upload to adjust stock across multiple SKUs with atomic transaction safety. |
| **E-08** | Configurable Low-Stock Thresholds | GAP-043 | **P2** | — | Per-variant or per-category low-stock threshold alert replacing static `<= 3`. |
| **E-09** | Mandatory Country of Origin Compliance | SEC-12, GAP-079 | **P1** | — | Mandatory Country of Origin selection on product creation per Legal Metrology Act. |

---

### PHASE F — Bespoke Atelier (Made-to-Measure)
**Goal:** Enable bespoke tailoring, client measurement profiling, fabric curation, and artisan scheduling.
*Prerequisite Decision:* **BD-2** (Owner must confirm launch scope includes tailoring).

| Package ID | Task / Work Package | Target Findings | Priority | Depends On | Exit / Verification Criteria |
|---|---|---|---|---|---|
| **F-01** | Atelier Consultation Booking System | GAP-080 | **P1** | BD-2 | Calendar slot booking for physical and virtual styling consultations. |
| **F-02** | Persistent Customer Measurement Profiles | GAP-081 | **P1** | BD-2 | Customer measurement entity supporting versioned alteration history. |
| **F-03** | Fabric Swatch Catalogue & Metre Inventory | GAP-082 | **P1** | BD-2 | Fabric entities, high-res texture photography, and fabric yardage tracking. |
| **F-04** | Custom Quotation & Digital Client Approval | GAP-083 | **P1** | F-02, F-03 | Custom quote generator with digital sign-off and advance payment deposit. |
| **F-05** | Production Job Cards & Tailor Scheduling | GAP-084 | **P2** | F-04 | Job card assignment to specific master tailors with milestone deadlines. |
| **F-06** | Fitting Appointments & Alteration Records | GAP-085 | **P2** | F-05 | First/second fitting scheduling, alteration notation, and garment revision history. |
| **F-07** | Garment Quality Control Checklist | GAP-086 | **P2** | F-05 | Multi-point craftsmanship audit before garment handoff to client. |

---

### PHASE G — Resale & Authentication Marketplace (CultureCircle Model)
**Goal:** Full secondary marketplace lifecycle: intake, authentication, listing, escrow, settlement, and payouts.
*Prerequisite Decisions:* **BD-1** (Fixed price vs Bidding) and **BD-3** (Consignment fee structure).

| Package ID | Task / Work Package | Target Findings | Priority | Depends On | Exit / Verification Criteria |
|---|---|---|---|---|---|
| **G-01** | Consignment Physical Intake Workflow | GAP-090 | **P1** | BD-1 | Physical consignment intake receipt, security tagging, and serial allocation. |
| **G-02** | Seller Legal Declaration & Liability Terms | GAP-091 | **P1** | — | Legally binding counterfeit liability and ownership declaration on submission. |
| **G-03** | Link Physical Inspections to Seller Asks | GAP-092 | **P1** | G-01 | Foreign key relation between `inspection` entity and active consignment `ask`. |
| **G-04** | Consignor Payout Settlement Ledger | GAP-093 | **P1** | BD-3 | Automated ledger computing seller net payout after platform commission. |
| **G-05** | Tokenised Seller Payout Accounts (DPDP Act) | GAP-094 | **P1** | G-04 | Tokenised bank account & UPI ID storage via Razorpay Payouts API. |
| **G-06** | Bid-to-Order Conversion Engine | GAP-095 | **P2** | BD-1 | Automated buyer charge and order creation when seller matches bid (if bidding retained). |
| **G-07** | Authenticity Dispute Resolution System | GAP-096 | **P2** | G-03 | 48-hour buyer challenge window with second-opinion expert arbitration. |
| **G-08** | Resale-Specific Return Policy Gate | GAP-097 | **P2** | G-07 | Systematically restrict returns on verified resale items to authenticity breaches only. |

---

### PHASE H — Deferred Future Enhancements (Explicitly Out of Scope for Launch)
The following capabilities were analyzed and explicitly deferred to post-launch optimization:
1. **Tiered VIP Customer Loyalty Program** (GAP-deferred)
2. **Third-Party Marketplace Merchant Portal** (Direct brand consignment only for v1)
3. **Native iOS & Android Mobile Apps** (Responsive web PWA prioritised)
4. **Subscription / Wardrobe Rental Model**
5. **Real-Time Cross-Retailer Price Scraping** (Invented numbers removed; deferred until licensed data feeds exist)

---

## 3. Decision Register & Required Owner Checkpoints

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CRITICAL OWNER CHECKPOINTS                           │
├───────┬────────────────────────────────────────────┬─────────────────────────────┤
│ ID    │ Decision / Action Required                 │ Blocks Phase                │
├───────┼────────────────────────────────────────────┼─────────────────────────────┤
│ BD-1  │ Resale Pricing Model: Fixed Price vs Bids  │ Phase G (Resale Engine)     │
│ BD-2  │ Atelier Scope: Launch with Bespoke MTM?    │ Phase F (Bespoke Atelier)   │
│ BD-3  │ Consignment Fee & Commission Percentages   │ Phase G (Settlement Ledger) │
│ EXT-1 │ Razorpay Live/Test Credentials Provisioned │ Phase A (Gateway Gate)      │
│ EXT-2 │ Resend API Key & Domain Authentication     │ Phase A (Email Transports)  │
│ EXT-3 │ Shiprocket API Credentials Provisioned     │ Phase B (Logistics)         │
│ EXT-4 │ AWS S3 / Cloudflare R2 Credentials         │ Phase C (Cloud Media)       │
│ EXT-5 │ Registered Business Info (GSTIN/CIN)       │ Phase B (Legal Compliance)  │
└───────┴────────────────────────────────────────────┴─────────────────────────────┘
```

---

## 4. Immediate Next Actions

1. **Owner Approval of Reports:** Review `PHASE_1_PHASE_2_FORENSIC_VERIFICATION_REPORT.md`, `MASTER_PROJECT_COMPLETION_TRACKER.md`, and `MASTER_PROJECT_STATUS_REPORT.md`.
2. **Git Synchronization:** Authorize staging, committing, and pushing Phase 1 and Phase 2 changes to GitHub `origin/main`.
3. **Provision Phase B Prerequisites:** Supply Razorpay test keys, Resend credentials, and Shiprocket credentials to execute **Phase B**.
