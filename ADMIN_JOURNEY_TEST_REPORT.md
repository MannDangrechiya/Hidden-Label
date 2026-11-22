# THE HIDDEN LABEL — ADMIN JOURNEY TEST REPORT

**Date:** 2026-11-22  
**Scope:** Complete Operations Console & Administrative Workflow Verification  
**Auditor:** Project Architect & Senior Backend Engineer  
**Status:** All 20 Admin Console Modules Tested & Verified  

---

## 1. Admin Module Verification Matrix

| Step # | Admin Console Module | Admin Route & Components | Backend API Routes Involved | Verification Result |
|---|---|---|---|---|
| **1** | **Admin Authentication** | `apps/admin/app/login/page.tsx` | `POST /auth/user/emailpass` | **PASS** — 24-hour HttpOnly JWT cookie session |
| **2** | **Role-Based Access (RBAC)** | `apps/admin/app/(dashboard)/layout.tsx` | `apps/backend/src/lib/admin-auth.ts` | **PASS** — Denies unassigned roles (HTTP 403 `no_role_assigned`) |
| **3** | **Executive Dashboard** | `apps/admin/app/(dashboard)/page.tsx` | `GET /admin/orders`, `GET /admin/inventory` | **PASS** — Real-time revenue, order volume, pending RMAs |
| **4** | **Product Management** | `apps/admin/app/(dashboard)/products/page.tsx`, `new/page.tsx`, `[id]/page.tsx` | `POST /admin/products`, `POST /admin/products/:id` | **PASS** — Enforces mandatory Country of Origin, HSN, Brand |
| **5** | **Collection Management** | `apps/admin/app/(dashboard)/categories/page.tsx` | `GET /admin/collections`, `POST /admin/collections` | **PASS** — Visual hierarchy & merchandising flags |
| **6** | **Inventory Management** | `apps/admin/app/(dashboard)/inventory/page.tsx` | `GET /admin/inventory`, `POST /admin/inventory/:id/adjustment` | **PASS** — `SELECT ... FOR UPDATE` row-locked stock adjustments |
| **7** | **Supplier Profiles** | `apps/admin/app/(dashboard)/purchasing/page.tsx` | `GET /admin/suppliers`, `POST /admin/suppliers` | **PASS** — Luxury vendor profiles with GSTIN tracking |
| **8** | **Purchase Orders (PO)** | `apps/admin/app/(dashboard)/purchasing/page.tsx` | `GET /admin/purchase-orders`, `POST /admin/purchase-orders` | **PASS** — Sequential display IDs (`PO-THL-XXXX`) |
| **9** | **Goods Receipts (GRN)** | `apps/admin/app/(dashboard)/purchasing/page.tsx` | `POST /admin/purchase-orders/:id/receive` | **PASS** — Over-receipt guard, auto-generates `GRN-THL-XXXX` |
| **10** | **Stock Movements Ledger** | `apps/admin/app/(dashboard)/purchasing/page.tsx` | `GET /admin/stock-movements` | **PASS** — Immutable audit trail of every stock change |
| **11** | **Order Processing** | `apps/admin/app/(dashboard)/orders/page.tsx`, `[id]/page.tsx` | `GET /admin/orders/:id`, `POST /admin/orders/:id/fulfill` | **PASS** — Packing, dispatch, and Shiprocket AWB generation |
| **12** | **Refund Management** | `apps/admin/app/(dashboard)/orders/[id]/page.tsx` | `POST /admin/orders/:id/refund` | **PASS** — Deterministic SHA-256 idempotency key prevents double refunds |
| **13** | **Return / RMA Processing** | `apps/admin/app/(dashboard)/returns/page.tsx`, `[id]/page.tsx` | `POST /admin/returns/:id/receive` | **PASS** — Restocks only when condition is marked resellable |
| **14** | **Review Moderation** | `apps/admin/app/(dashboard)/reviews/page.tsx`, `review-card.tsx` | `POST /admin/reviews/:id/action` | **PASS** — Approve/Reject actions with audit logging |
| **15** | **Resale Authentication** | `apps/admin/app/(dashboard)/resale/page.tsx` | `POST /admin/resale/asks/:id` | **PASS** — Transitions: `intake_received` → `authenticated` |
| **16** | **Consignor Settlement** | `apps/admin/app/(dashboard)/resale/page.tsx` | `POST /admin/resale/asks/:id/settle` | **PASS** — Enforces 7-day post-delivery clearance hold |
| **17** | **Consignment Inventory Bridge**| `apps/admin/app/(dashboard)/resale/page.tsx` | `POST /admin/resale/asks/:id/publish-inventory` | **PASS** — Bridges verified consignment into sellable stock |
| **18** | **Bespoke Consultations** | `apps/admin/app/(dashboard)/bespoke/page.tsx` | `GET /admin/bespoke/consultations` | **PASS** — Client styling appointment schedule |
| **19** | **Fabric Library Management** | `apps/admin/app/(dashboard)/bespoke/page.tsx` | `GET /admin/bespoke/fabrics`, `POST /admin/bespoke/fabrics` | **PASS** — Fabric composition, mill provenance & surcharges |
| **20** | **GST Tax Reporting** | `apps/admin/app/(dashboard)/reports/export/gst/route.ts` | GSTR-1 CSV schedule generation | **PASS** — B2C & B2B breakdown (CGST, SGST, IGST) |

---

## 2. Deep Tracing of Critical Operations

### A. Procurement & Stock Receiving Lifecycle
1. **Supplier Creation:** Manager creates luxury vendor profile in `apps/admin/app/(dashboard)/purchasing/page.tsx`.
2. **Purchase Order Issuance:** PO issued with item quantities and unit costs. System generates `display_id` using sequence `purchase_order_display_seq`.
3. **Goods Receiving (`POST /admin/purchase-orders/:id/receive`):** Warehouse technician receives delivery. Backend acquires row locks (`forUpdate()`) on `inventory_level` to prevent race conditions. Over-receipt is rejected with HTTP 400.
4. **GRN Generation:** System generates sequential Goods Receipt Note `GRN-THL-XXXX`.
5. **Stock Movement Ledger:** Automatically appends an immutable record into `stock_movement` capturing `inventory_item_id`, `delta`, `movement_type: po_receipt`, `balance_after`, and `actor_id`.

### B. Order Fulfillment & Reverse Logistics
1. **Fulfillment:** Order fulfillment triggers warehouse pickup resolution via `resolveWarehousePickup()`, selecting the primary regional fulfillment hub.
2. **AWB Creation:** Contacts Shiprocket API to book courier pickup and returns tracking number.
3. **Return Inspection:** On customer return arrival, technician inspects merchandise condition. If marked `damaged`, stock is NOT returned to available inventory. If marked `resellable`, inventory is incremented atomically.
4. **GST Credit Note:** Assigns sequential credit note number `CN-THL-XXXX` via sequence `credit_note_display_seq` to maintain tax reconciliation.

### C. Resale Intake & Settlement Verification
1. **Intake & Verification:** When consigned sneakers/apparel arrive, technician verifies serial numbers, certificates, and condition, advancing ask status from `active` → `intake_received` → `authenticated`.
2. **Catalog Publishing:** Technician clicks "Publish to Boutique Inventory" (`POST /admin/resale/asks/:id/publish-inventory`). This creates sellable inventory in Medusa core.
3. **Settlement Clearance:** When sold, the admin accesses `POST /admin/resale/asks/:id/settle`. The system verifies whether 7 days have passed since delivery. If within 7 days, settlement is rejected with HTTP 400: *"Settlement hold active until <date>. Cannot settle prior to return window expiration."* Once cleared, settlement record is marked `cleared`.

### D. Statutory GST Tax Schedules
1. **GSTR-1 Export (`GET /reports/export/gst`):** Aggregates orders within date range.
2. **Tax Classification:** Parses shipping address province:
   - Gujarat destinations: classified as Intra-State (50% CGST + 50% SGST).
   - Non-Gujarat destinations: classified as Inter-State (100% IGST).
3. **Output:** Downloads audit-ready CSV schedule compatible with ClearTax / GSTN portal upload.
