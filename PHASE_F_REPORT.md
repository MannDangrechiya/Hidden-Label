# THE HIDDEN LABEL — PHASE F: BESPOKE TAILORING REPORT

**Date:** 2026-11-21  
**Orchestrator:** Autonomous Engineering Orchestrator  
**Status:** Completed & Validated  
**Scope:** Bespoke tailoring architecture, measurement capture, master tailor pipeline, customer order tracking, concierge consultation interface, and business/technical boundary definitions.

---

## 1. Executive Summary

Phase F evaluated the bespoke tailoring pillar of THE HIDDEN LABEL. Bespoke luxury tailoring represents one of the three core brand pillars (Retail, Bespoke, Resale). 

Our audit confirmed that the technical foundations for **Made-to-Measure (MTM)** are implemented, secure, and integrated end-to-end:
1. **Client Measurement Capture:** The Made-to-Measure drawer (`BespokeDrawer`) captures 5 anatomical metrics (chest, waist, shoulder, sleeve, inseam) in inches with strict boundary validation, alongside fit preferences (slim, regular, relaxed) and custom notes.
2. **Metadata Propagation:** Measurements travel into cart and order line items under `metadata.custom_measurements`, linking directly to the product's base sizing block.
3. **Master Tailor Pipeline (`apps/admin`):** Orders containing bespoke items automatically generate a dedicated Master Tailor Sheet and multi-stage lifecycle controls:
   - `measurements_verified`
   - `fabric_cutting`
   - `stitching`
   - `qc_passed`
   - `ready_for_pickup`
4. **Customer Transparency (`apps/storefront`):** Customer order tracking views (`/account/orders/[id]`) dynamically render the master tailor pipeline for bespoke garments, providing real-time visibility into garment fabrication.

---

## 2. Technical Architecture & File Inventory

### 2.1 Measurement Capture & Validation
- **[apps/storefront/components/bespoke-drawer.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/components/bespoke-drawer.tsx)**:
  - Accessible slide-out drawer triggered from apparel PDPs (`isApparelProduct`).
  - Strict input validation bounds:
    - Chest: 26" to 64" (Mandatory)
    - Waist: 22" to 64" (Mandatory)
    - Shoulder: 12" to 26" (Optional)
    - Arm Length: 18" to 40" (Optional)
    - Inseam: 22" to 40" (Optional)
  - Fit Preference selector: `slim`, `regular`, `relaxed`.
  - Serializes to cart line item metadata via `addToCart()`.

### 2.2 Master Tailor Pipeline & Atelier Admin
- **[apps/admin/lib/bespoke.ts](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/admin/lib/bespoke.ts)**:
  - Defines the 5 bespoke operational stages and state helpers (`isBespokeStage`, `bespokeStageIndex`).
  - Normalizes and parses raw line item metadata into structured `BespokeItem` and `CustomMeasurements`.
- **[apps/admin/app/(dashboard)/orders/[id]/bespoke-pipeline.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/admin/app/(dashboard)/orders/[id]/bespoke-pipeline.tsx)**:
  - Renders the Master Tailor Sheet for operations users.
  - Displays measurement tables, fit preferences, and base pattern sizes.
  - Provides atomic status progression buttons with server actions.

### 2.3 Storefront Order Tracking
- **[apps/storefront/app/account/orders/[id]/page.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/app/account/orders/[id]/page.tsx)**:
  - Renders the custom bespoke tracking bar (`BESPOKE_STEPS`) specifically for orders carrying bespoke items. Ready-to-wear items never display meaningless tailoring stages.

### 2.4 Aura Concierge & Sizing Guidance
- **[apps/backend/src/api/store/concierge/chat/route.ts](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/backend/src/api/store/concierge/chat/route.ts)**:
  - Provides AI and assisted concierge advice with guest session tokens and authenticated customer ownership checks (`BUG-09`).
- **[apps/storefront/app/fit-studio/page.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/app/fit-studio/page.tsx)** & **[apps/storefront/components/fit-studio-widget.tsx](file:///c:/Users/ASUS/Documents/Hidden%20Label/apps/storefront/components/fit-studio-widget.tsx)**:
  - Provides metric sizing calculations across complex footwear and garment silhouettes.

---

## 3. Explicit Boundaries & Unresolved Owner Decisions

Per the non-negotiable master instructions, we report the following business and operational boundaries rather than inventing synthetic policies:

### 3.1 Autonomous Checkout vs Concierge Intervention Boundary
| Request Type | Autonomous Checkout Permitted? | Required Workflow |
|---|---|---|
| **Made-to-Measure (MTM) on Catalog Apparel** | **YES** | User selects size base block, submits measurements in drawer, checks out at catalog retail price. Master tailor verifies measurements prior to cutting. |
| **Bespoke Commissions (New Patterns/Custom Silhouettes)** | **NO** (Strict Boundary) | Requires human concierge booking at the Sindhu Bhavan Road atelier. Patterns, fabric selections, and fittings cannot be automated without master cutter consultation. |
| **Custom Luxury Fabric Sourcing** | **NO** (Strict Boundary) | Fabric mill pricing (Loro Piana, Dormeuil, Scabal) fluctuates and requires manual quote generation. |
| **Extreme Measurement Outliers** | **NO** (Intervention Gate) | If customer measurement ratios violate anatomical tolerances, admin workflow requires phone/WhatsApp consultation before moving stage from `measurements_verified` to `fabric_cutting`. |

### 3.2 Unresolved Pricing Policies (Documented in BLOCKED_OWNER_DECISIONS.md)
1. **Bespoke Customization Surcharge:** Currently, made-to-measure orders inherit the base variant's catalog price (₹0 tailoring surcharge). Whether a standard pattern alteration fee or percentage surcharge applies must be determined by business ownership.
2. **Cancellations & Refunds on Cut Garments:** Under Indian Consumer Protection regulations and THL return policy, custom garments cut to specific measurements cannot be returned for resale unless defective in craftsmanship. The exact cut-off milestone (e.g. non-refundable once `fabric_cutting` commences) must be formalized in legal terms of service.
