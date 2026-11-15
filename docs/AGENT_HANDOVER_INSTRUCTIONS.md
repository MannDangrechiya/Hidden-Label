# The Hidden Label — Autonomous Agent Handover & Execution Specification

> **MANDATE FOR THE EXECUTING AGENT**:
> **DO NOT ASK THE USER ANY QUESTIONS.** 
> You have 100% of the context, requirements, architectural decisions, and constraints in this document and in the repository. Make all design and implementation choices autonomously following the specifications below. Execute the entire scope end-to-end, verify all builds and tests pass cleanly, and present the completed summary.

---

## 1. Business Context & Identity
* **Client / Brand**: **The Hidden Label** (by Harvi Fashion).
* **Physical Store Location**: Steller, 205, 2nd Floor, Sindhu Bhawan Road, Bodakdev, Ahmedabad, Gujarat 380059.
* **Instagram**: [@thehiddenlabel.official](https://www.instagram.com/thehiddenlabel.official)
* **Business Model**: Omnichannel high-end luxury fashion house & multi-brand streetwear boutique.
* **Core Product Portfolio**:
  1. **Custom Bespoke Apparel (Men & Women)**: Custom tailored shirts, trousers, suits, blazers, luxury co-ord sets, ethnic fusion, made-to-measure.
  2. **Curated Multi-Brand Luxury Streetwear**: Imported premium brands (Fear of God, Represent, Essentials, Palm Angels, Off-White, Balenciaga), designer labels, and in-house Harvi Fashion creations (sizes XS–XXL).
  3. **Limited-Edition Footwear & Sneakers**: High-demand Jordan, Nike, Yeezy, and New Balance pairs.
  4. **Luxury Accessories**: Designer eyewear, fragrances, jewelry, and bags.
* **Primary Objective**: Allow clients across India (and Ahmedabad boutique visitors) to browse, customize, and buy 24/7 with native Indian payment options (UPI Intent/QR, Cards, COD with OTP, In-Store Pickup).

---

## 2. Core Non-Negotiable Technical Rules
1. **Monorepo Structure**:
   * `apps/storefront` (Next.js 15 App Router on `http://localhost:3000`)
   * `apps/admin` (Next.js 15 App Router on `http://localhost:7001`)
   * `apps/backend` (Medusa 2.0 Headless Commerce on `http://localhost:9000`)
   * `packages/ui` (Design tokens, Tailwind v4, `@thl/ui`)
   * `packages/shared` (Schemas, types, money utilities `@thl/shared`)
2. **Currency & Money Rule**:
   * ALL money amounts are stored and manipulated as **plain rupee integers** (e.g. `21999` = ₹21,999).
   * **NEVER divide or multiply by 100**. Use `moneyFromRupees(val)` and `formatINR(...)` from `@thl/shared`.
3. **Design Tokens & Aesthetic**:
   * Strict brutalist luxury rules: **0px border-radius everywhere** (no rounded buttons or cards; only circles for color swatches).
   * Fonts: `Syne` (display), `Hanken Grotesk` (body sans), `JetBrains Mono` (specs & tabular money).
   * Colors: Canvas `#f8f7f4`, Surface `#faf9f6`, Ink `#111111`, Accent `#c5a880` (gold), Line `#e4e4e7`.
4. **Compliance (D2 Rules)**:
   * Do not make false competitor claims or fake guarantees.
   * Real inspection records on units that have them; honest 7-day return policy on items that do not.
5. **Quality Gates**:
   * Before finishing, you must run and ensure clean exit codes for:
     * `pnpm typecheck` (all 6 workspaces clean)
     * `pnpm lint` (zero errors/warnings)
     * `pnpm test` (all 70+ vitest tests pass)
     * `node scripts/walkthrough-verify.mjs` (all 7 verification phases pass)

---

## 3. Work Scope & Implementation Tasks

### Task 1: Product Model Pivot & Custom Made-to-Measure Studio
1. **Fix Broken Place Bid Modal on PDP**:
   * In `apps/storefront/components/add-to-bag.tsx`, the "Place Bid" button calls `onOpenBidModal`.
   * In `apps/storefront/app/products/[handle]/page.tsx`, wire a native modal dialog so clicking "Place Bid" allows the user to input a bid price, select expiry, and submit to `POST /store/resale/bids`.
2. **Custom Bespoke Apparel Measurement Drawer**:
   * On apparel PDPs (shirts, suits, trousers, dresses), provide an interactive **"Custom Made-to-Measure"** toggle.
   * Drawer allows customer to input:
     * Fit Preference (`Slim`, `Regular`, `Relaxed/Oversized`)
     * Measurements in inches (`Chest`, `Waist`, `Shoulder`, `Arm Length`, `Trouser Length / Inseam`)
     * Special Customization / Monogram Notes
   * When added to bag, save these measurements in `line_item.metadata.custom_measurements`.
3. **Apparel Standard Sizing Support**:
   * Support clothing sizes `XS`, `S`, `M`, `L`, `XL`, `XXL` alongside footwear `UK 6`–`UK 12`.
4. **Mobile Sticky Action Bar**:
   * On mobile viewports (`< 768px`), when the user scrolls past the primary CTA, slide up a fixed bottom bar with selected size, current price, and "Buy Now".

### Task 2: Storefront Catalog & Category Navigation Upgrade
1. **Multi-Category Tabs & Filter Drawer (`apps/storefront/app/collections/all/catalog-client.tsx`)**:
   * Add high-level category pills: `All`, `Custom Bespoke`, `Menswear`, `Womenswear`, `Footwear`, `Accessories`.
   * Add Price Range filter (Under ₹10k, ₹10k–₹25k, ₹25k–₹50k, ₹50k+).
   * Multi-select size grid (apparel sizes + footwear sizes).
   * Multi-select Brand filter including in-house `The Hidden Label / Harvi Fashion` and luxury labels (`Represent`, `Fear of God`, `Off-White`, `Nike`, `Jordan`).

### Task 3: Checkout, Indian Payment Rails & Store Pickup
1. **In-Store Pickup Option (`apps/storefront/app/checkout/`)**:
   * Add a delivery toggle:
     * `Standard Home Delivery` (Dispatched via Shiprocket express across India)
     * `In-Store Boutique Pickup`: **"Steller, Sindhu Bhavan Road, Bodakdev, Ahmedabad (Ready in 2–4 hours for in-stock items)"** (Free).
2. **Indian Payment Methods UI**:
   * Provide clean selection between:
     * **UPI (Instant GPay / PhonePe / Paytm / QR)**
     * **Credit / Debit Cards (RuPay, Visa, Mastercard)**
     * **0% Cardless EMI (Snapmint / Simpl financing details)**
     * **Cash on Delivery (Verified via Mobile OTP)**

### Task 4: Admin Custom Order Pipeline & Multi-Brand Manager
1. **Bespoke Order Status Tracker (`apps/admin/app/(dashboard)/orders/`)**:
   * When an order contains `custom_measurements`, display the tailor's measurement sheet in the admin order detail page.
   * Provide state transition buttons:
     `Measurements Verified` → `Fabric Cutting` → `Stitching` → `QC Passed` → `Ready for Dispatch / Pickup`.
2. **Admin Multi-Brand & Product Category Support**:
   * Ensure product creation/edit supports custom bespoke apparel tags and fabric options.

---

## 4. Verification & Validation Protocol
Run these commands in powershell/bash from the repository root:
1. `pnpm typecheck` → Must output `Done` for all workspaces with 0 errors.
2. `pnpm lint` → Must pass cleanly.
3. `pnpm test` → Must pass all test suites.
4. `node scripts/walkthrough-verify.mjs` → All 7 E2E verification phases must output green checks.
