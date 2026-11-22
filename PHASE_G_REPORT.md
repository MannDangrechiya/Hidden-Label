# THE HIDDEN LABEL — PHASE G: RESALE AND AUTHENTICATION REPORT

**Date:** 2026-11-21  
**Orchestrator:** Autonomous Engineering Orchestrator  
**Status:** Completed & Validated  
**Scope:** Resale marketplace, seller submission, condition inspection certificates, provenance viewer, orderbook & Price Index, payout architecture, and bidding feature flags.

---

## 1. Executive Summary

Phase G audited and validated the third core pillar of THE HIDDEN LABEL: Resale and Authentication.

Key Technical Accomplishments:
1. **Bidding Controls Hardened (Default: Disabled):** Per the master instructions ("Keep bidding disabled by default unless explicitly configured otherwise"), we audited the storefront and ensured all bidding CTAs ("Place Bid", "Make an offer", "Want to bid? Click here", and `/account/bids` active form) are strictly gated behind `process.env.NEXT_PUBLIC_FEATURE_BIDDING === "true"`. With the default (`false`), the marketplace functions in clean, fixed-price retail and consignment modes without exposing unverified bidding flows.
2. **Seller Consignment Intake (`/sell`):** Seller listing flow allows customers to choose an authentic silhouette and size, set their ask price in INR, review estimated consignment fees, and submit listings for review (`apps/storefront/app/sell/page.tsx`).
3. **Physical Authentication Vault & Inspection Certificates (`/inspection/[serial]`):** Live condition inspection viewer renders verified serial certificates, turntable media, detail photos, grading checklists (box, label, stitching, sole tooling), and physical inspector notes (`apps/storefront/components/inspection-viewer.tsx`).
4. **Orderbook & The Price Index (`AI-02`):** Live 90-day valuation curves, 30-day percentage changes, and 52-week price ranges rendered dynamically via `apps/backend/src/lib/resale.ts`.
5. **Consignor Payout Architecture:** Implemented in `apps/backend/src/lib/resale.ts` (`calculateConsignorPayout`). Commission rate is configured as a parameter defaulting to 9.5% pending business ratification.

---

## 2. Technical Implementations & Audit Evidence

### 2.1 Bidding Feature Flag Enforcement
- **[apps/storefront/components/add-to-bag.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/components/add-to-bag.tsx)**:
  - Gated secondary "Place Bid" button behind `process.env.NEXT_PUBLIC_FEATURE_BIDDING === "true"`.
  - When disabled, "Buy Now" expands to full width for seamless fixed-price conversion.
- **[apps/storefront/components/price-index-card.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/components/price-index-card.tsx)**:
  - Gated the "Place Bid" tab switcher and inline "Want to bid? Click here" button behind `process.env.NEXT_PUBLIC_FEATURE_BIDDING === "true"`.
  - Enforced `effectiveTab = biddingEnabled ? activeTab : "chart"`.
- **[apps/storefront/app/account/bids/page.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/app/account/bids/page.tsx)**:
  - When bidding is disabled, renders a clear state explaining that secondary market listings currently operate on a fixed-price consignment basis, directing users to browse verified pairs.

### 2.2 Consignment Submission & Buyer Journey
- **[apps/storefront/app/sell/page.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/app/sell/page.tsx)**:
  - Form validates real product handles and sizes from live Medusa inventory.
  - Submits asks to `POST /store/resale/asks`.
  - Seller dashboard in `/account/asks` displays active asks, pending inspections, and sold items.

### 2.3 Inspection Certificate & Physical Provenance
- **[apps/storefront/app/inspection/[serial]/page.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/app/inspection/[serial]/page.tsx)**:
  - Public certificate lookup by unique unit serial (`/verify/[serial]` cleanly redirects to `/inspection/[serial]`).
  - Strict compliance with honesty rules: no claims of cryptographic blockchain ledgers, no fabricated lab test claims, and no misleading competitor affiliations.
  - Detail photography, turntable rotation viewer, condition grade (e.g. "Brand New In Box", "Deadstock"), and inspector sign-off.

### 2.4 Resale Valuation & Analytics
- **[apps/backend/src/lib/resale.ts](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/backend/src/lib/resale.ts)**:
  - Verified math for 30-day percentage trend, 52-week high/low, and orderbook bid/ask spread.
  - Unit tests passing (`apps/backend/src/lib/resale.test.ts` — 12/12 tests).

---

## 3. Explicit Business Boundaries & Unconfirmed Policies

Documented for executive owner ratification in `BLOCKED_OWNER_DECISIONS.md`:
1. **Consignment Commission Rates:** The codebase defaults to `platformFeeRate = 0.095` (9.5%). Tiered commission structures (e.g., lower fee on sales over ₹50,000) or flat listing fees remain unconfirmed by ownership.
2. **Resale Model Selection:** Fixed-price vs Bidding vs Hybrid. Bidding is disabled by default in software until ownership formalizes settlement rules.
3. **Authentication Liability & Payout Timing:** Whether consignor payout occurs immediately upon buyer delivery or after a buyer inspection window (e.g. 48-hour return window expiry).
4. **Counterfeit Item Handling:** Policy on item confiscation, disposal, or return shipping fees for items failing physical authentication.
