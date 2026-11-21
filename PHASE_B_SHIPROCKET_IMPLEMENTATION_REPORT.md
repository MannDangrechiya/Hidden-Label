# THE HIDDEN LABEL — PHASE B IMPLEMENTATION REPORT
**Shiprocket Sandbox, Dynamic Logistics, Reverse Pickup (RMA) & GST Credit Notes**

- **Date:** 2026-11-21
- **Author:** Antigravity Autonomous Agent (DeepMind)
- **Local Branch:** `main`
- **Base Commit:** `4c4c51d` (accepted Phase 2 acceptance baseline)
- **Environment:** Node.js 20, Medusa 2.22.7, PostgreSQL 18, Vite-Node, Vitest
- **Network Boundary:** 100% Isolated Local Sandbox Server (`http://127.0.0.1:9095`) — Zero live calls to `apiv2.shiprocket.in`

---

## 1. Executive Summary

Phase B implements the end-to-end logistics, order dispatch, tracking, reverse pickup (RMA), and statutory Indian GST credit note lifecycle for **The Hidden Label**.

In accordance with strict safety mandates:
1. **Zero Live Carrier Impact:** All interactions operate through a decoupled interface (`IShiprocketClient`) backed by an embedded, deterministic HTTP mock server (`ShiprocketSandboxServer`) implementing the verified official Shiprocket API v1 contract.
2. **Production-Grade Implementation:** The client (`ShiprocketClient`) is not a fake mockup; it is a full, production-ready TypeScript SDK featuring automated JWT token caching (7-day TTL), timeout handling via `AbortController`, and exponential backoff retry on 5xx/network errors.
3. **Database Integrity & Idempotency:** Implemented `ShipmentOperation` mutex locking, dynamic warehouse pickup location resolution, webhook anti-regression status ranking, atomic return inspection restocking with row-level locks, and sequential GST credit note allocation via PostgreSQL sequences.
4. **100% Automated Quality Gates:**
   - `pnpm typecheck`: Passed (6 workspace packages, 0 errors).
   - `pnpm lint`: Passed (0 errors, 0 warnings).
   - `pnpm test`: Passed (143 unit tests across 21 test files in backend; 176 total across monorepo).
   - `pnpm test:integration`: Passed (68 integration tests across 15 test files).
   - `pnpm --filter @thl/storefront build`: Next.js 16.4.6 production build passed.
   - `pnpm --filter @thl/admin build`: Next.js 16.4.6 production build passed.
   - `pnpm --filter @thl/backend build`: Medusa backend build passed.
   - `verify-phase-b-sandbox.ts`: 13/13 scenarios passed (100%).

---

## 2. Architecture & Component Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PHASE B ARCHITECTURE OVERVIEW                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   [ Medusa Admin / Operations API ]                                                              │
│        │                                                                                         │
│        ▼                                                                                         │
│   [ POST /admin/orders/:id/shipment ] ──▶ [ Shipment Operation Mutex ]                           │
│        │                                       │ (deriveShipmentIdempotencyKey)                  │
│        ▼                                       ▼ (claimShipmentOperation)                        │
│   [ Warehouse Pickup Resolver ]           [ shipment_operation table ]                           │
│        │ (resolveWarehousePickup)              │ (atomic row claim & duplicate detection)        │
│        ▼                                       │                                                 │
│   [ IShiprocketClient Interface ] ◀────────────┘                                                 │
│        │                                                                                         │
│   ┌────┴───────────────────────────┐                                                             │
│   ▼                                ▼                                                             │
│ [ ShiprocketClient (Production) ] [ ShiprocketSandboxServer (Local Mock) ]                       │
│   - Official API v1 Contract        - Port 9095 Embedded HTTP Server                             │
│   - JWT Token Cache (7-Day TTL)     - Deterministic AWB (`SRMOCK...`, `SRREV...`)                │
│   - Exponential Backoff & Retry     - Simulated Network Latency & Failures                       │
│                                                                                                  │
│ ──────────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                                  │
│   [ Webhook Tracking & Anti-Regression ]                                                         │
│   [ POST /webhooks/shiprocket ] ──▶ [ Constant-Time Token Security (crypto.timingSafeEqual) ]   │
│        │                                                                                         │
│        ▼                                                                                         │
│   [ Webhook Deduplication ] ──────▶ [ webhook_event Table (Payload SHA-256 Hash) ]               │
│        │                                                                                         │
│        ▼                                                                                         │
│   [ Anti-Regression Rank Engine ] ─▶ [ STATUS_RANK: delivered/rto/cancelled > in_transit ]      │
│                                                                                                  │
│ ──────────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                                  │
│   [ Returns, Restocking & GST Credit Notes ]                                                     │
│   [ bookRmaReversePickup ] ───────▶ [ Shiprocket createReturn (`SRREV...`) ]                     │
│        │                                                                                         │
│        ▼                                                                                         │
│   [ receiveAndInspectReturn ] ────▶ [ SELECT ... FOR UPDATE on return_request ]                  │
│        │                                 │                                                       │
│        ▼                                 ▼                                                       │
│   [ Restock Resellable Units ] ────▶ [ restockReturn() Atomic Inventory Level CAS ]              │
│        │                                                                                         │
│        ▼                                                                                         │
│   [ generateCreditNote ] ─────────▶ [ nextval('credit_note_display_seq') ──▶ 'CN-THL-XXXX' ]    │
│                                          │                                                       │
│                                          ▼                                                       │
│                                     [ credit_note & credit_note_item tables ]                    │
│                                     [ GST Intra/Inter-State Tax Calculation (CGST/SGST/IGST) ]   │
│                                     [ Statutory Printable Mock Credit Note Document ]            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Official Shiprocket API v1 Contract Specifications

The integration adheres strictly to the official Shiprocket API v1 specifications, defined in `apps/backend/src/modules/shiprocket/types.ts`:

### 3.1 Authentication & Token Lifecycle
- **Endpoint:** `POST /v1/external/auth/login`
- **Request Body:** `{ email: string, password: string }`
- **Response Shape:**
  ```json
  {
    "id": 12345,
    "first_name": "Operations",
    "last_name": "THL",
    "email": "operations@thehiddenlabel.com",
    "company_id": 98765,
    "created_at": "2026-11-21 14:00:00",
    "token": "mock_jwt_token_..."
  }
  ```
- **Lifecycle Rules:** Tokens are valid for up to 10 days. `ShiprocketClient` caches the token in-memory with a 7-day TTL (or 1-hour minimum buffer) and automatically re-authenticates upon expiry or HTTP 401 response.

### 3.2 Serviceability & Courier Selection
- **Endpoint:** `GET /v1/external/courier/serviceability`
- **Query Params:** `pickup_postcode`, `delivery_postcode`, `weight`, `cod` (0 or 1).
- **Response Shape:** Includes `available_courier_companies` array with `courier_company_id`, `courier_name`, `rate`, `etd`, `estimated_delivery_days`, and `recommended_courier_company_id`.

### 3.3 Adhoc Forward Order Creation
- **Endpoint:** `POST /v1/external/orders/create/adhoc`
- **Payload:** Strict adherence to Indian GST and delivery requirements:
  - `order_id`: Medusa display ID or custom order reference.
  - `order_date`: `YYYY-MM-DD HH:mm`.
  - `pickup_location`: Nickname matching an active Shiprocket pickup warehouse.
  - `billing_customer_name`, `billing_address`, `billing_city`, `billing_pincode`, `billing_state`, `billing_country`.
  - `shipping_is_billing`: boolean.
  - `order_items`: Array of `{ name, sku, units, selling_price, hsn }`.
  - `payment_method`: `"Prepaid"` (COD explicitly avoided).
  - `sub_total`, `length`, `breadth`, `height`, `weight`.
- **Response:** `{ order_id, shipment_id, status, status_code }`.

### 3.4 AWB Assignment & Courier Dispatch
- **Endpoint:** `POST /v1/external/courier/assign/awb`
- **Payload:** `{ shipment_id: number, courier_id?: number }`.
- **Response:** `{ response: { data: { awb_code: string, courier_company_id: number, courier_name: string } } }`.

### 3.5 Shipping Label Generation
- **Endpoint:** `POST /v1/external/generate/label`
- **Payload:** `{ shipment_id: number[] }`.
- **Response:** `{ label_created: 1, label_url: string, response: string }`.

### 3.6 Tracking Information
- **Endpoint:** `GET /v1/external/courier/track/awb/:awb_code`
- **Response:** `{ tracking_data: { track_status: number, shipment_status: number, shipment_track: [...], shipment_track_activities: [...] } }`.

### 3.7 Reverse Order Creation (RMA)
- **Endpoint:** `POST /v1/external/orders/create/return`
- **Payload:** Includes `pickup_customer_name`, `pickup_address`, `pickup_pincode`, `pickup_phone`, `order_items`, and warehouse delivery destination.
- **Response:** `{ order_id, shipment_id, status, awb_code: "SRREV..." }`.

---

## 4. Key Engineering Modules Implemented

### 4.1 Dynamic Warehouse Pickup Management (B-02)
- **Module:** `apps/backend/src/lib/warehouse-pickup.ts`
- **Model:** `WarehousePickupLocation` in `apps/backend/src/modules/thl/models/warehouse-pickup-location.ts`
- **Database Table:** `warehouse_pickup_location`
- **Capabilities:**
  - Full PIN code validation for 6-digit Indian PINs (`/^[1-9][0-9]{5}$/`).
  - Resolution waterfall: Order stock location ID → Order fulfillment item location → Single default active warehouse fallback → Safe 422 failure if ambiguous or unconfigured.

### 4.2 Shipment Operation Mutex & Idempotency (B-03)
- **Module:** `apps/backend/src/lib/shipment-operations.ts`
- **Model:** `ShipmentOperation` in `apps/backend/src/modules/thl/models/shipment-operation.ts`
- **Database Table:** `shipment_operation`
- **Mechanism:**
  - Idempotency Key: `ship_op_<sha256(orderId:fulfillmentId:action)>`.
  - Atomic Claim: Database unique constraint on `idempotency_key`. Concurrent claims receive `{ state: "in_progress" }`.
  - Duplicate Resolution: Completed operations return `{ state: "duplicate", shipmentId, awb, courier }`.
  - Stale-Lock Recovery: Claims older than 45 seconds stuck in `pending` status are reclaimed safely with audit tracking.

### 4.3 Dispatch Route & Order Fulfillment Workflow (B-03)
- **Route:** `POST /admin/orders/[id]/shipment` in `apps/backend/src/api/admin/orders/[id]/shipment/route.ts`
- **Capabilities:**
  - Role-protected: Requires `operations` or higher role (`requireRole`).
  - Validates delivery postal code serviceability with Shiprocket.
  - Resolves dynamic pickup warehouse.
  - Claims operation mutex to prevent concurrent double-booking.
  - Creates Shiprocket order, assigns AWB, and generates PDF shipping label.
  - Inserts authoritative record into `shipment` and initial status event into `shipment_event`.
  - Emits immutable `audit_event` record (`admin.order.shipment_dispatched`).

### 4.4 Webhook Hardening & Anti-Regression Status Protection (B-03 & SEC-05)
- **Route:** `POST /webhooks/shiprocket` in `apps/backend/src/api/webhooks/shiprocket/route.ts`
- **Status Engine:** `apps/backend/src/lib/shipment-status.ts`
- **Security Hardening (SEC-05):**
  - Authenticates `x-webhook-token` header (with query parameter fallback for backward compatibility) using constant-time comparison (`crypto.timingSafeEqual`).
  - Deduplicates replayed webhook events via `recordWebhookEvent()` in `webhook_event` using SHA-256 payload digests.
- **Anti-Regression Status Engine:**
  - Strictly prevents out-of-order webhook delivery from rolling back terminal shipment states.
  - State hierarchy: `created(1) -> pickup_scheduled(2) -> picked_up(3) -> in_transit(4) -> out_for_delivery(5) -> delivered(6)`.
  - Terminal states: `delivered`, `rto`, `cancelled`.
  - When an out-of-order update arrives (e.g. `in_transit` delivered after `delivered`), the `shipment` status is preserved, and a `shipment_event` is appended with `{ regressed: true, note: "Ignored regressive status update..." }`.

### 4.5 Reverse Pickup (RMA) & Atomic Restocking (B-04)
- **Module:** `apps/backend/src/lib/rma-reverse-pickup.ts`
- **Capabilities:**
  - `bookRmaReversePickup`: Validates approved RMA, prevents duplicate bookings, resolves destination warehouse, books return order with Shiprocket, and assigns reverse AWB (`SRREV...`).
  - `receiveAndInspectReturn`: Acquires row-level transaction lock (`SELECT ... FOR UPDATE`) on `return_request`. Evaluates physical inspection condition (`resellable`, `damaged`, `counterfeit`).
  - Restocking CAS: If `resellable`, invokes `restockReturn()` to atomically adjust stocked inventory and set `restocked_at`. If condition is `damaged` or `counterfeit`, restocking is strictly blocked.

### 4.6 Statutory Indian GST Credit Notes (B-05)
- **Modules:** `apps/backend/src/lib/credit-notes.ts` and `apps/backend/src/lib/gst.ts`
- **Models:** `CreditNote` and `CreditNoteItem` in `apps/backend/src/modules/thl/models/`
- **Sequence:** PostgreSQL sequence `credit_note_display_seq`
- **Capabilities:**
  - Atomic consecutive document numbering: `CN-THL-1001`, `CN-THL-1002`, etc.
  - Statutory Tax Calculations:
    - Intra-state supply (same state code): 9% CGST + 9% SGST.
    - Inter-state supply (different state codes): 18% IGST.
    - Exact integer paise arithmetic (`computeInclusiveGst()`).
  - Idempotency: Duplicate credit note generation for the same RMA returns the existing document without incrementing the sequence.
  - Document Renderer: Produces complete printable credit note JSON structure with statutory warning banner: `"SANDBOX TEST DOCUMENT — NOT A LEGAL TAX DOCUMENT (MOCK GSTIN)"`.

---

## 5. Database Schema & Migrations

Created migration `apps/backend/src/modules/thl/migrations/Migration20261121150000.ts`:

1. **`warehouse_pickup_location`**:
   - `id` (PK, text), `stock_location_id` (nullable, text), `pickup_location_code` (unique, text), `pickup_location_nickname` (text), `company_name`, `contact_person`, `email`, `phone`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `is_default` (boolean), `is_active` (boolean), timestamps.
2. **`shipment_operation`**:
   - `id` (PK, text), `idempotency_key` (unique, text), `order_id` (indexed, text), `fulfillment_id` (nullable, text), `status` (text: `pending`, `completed`, `failed`), `shipment_id` (nullable, text), `provider_order_id`, `provider_shipment_id`, `awb`, `courier`, `error_code`, `error_message`, `locked_at`, `completed_at`, timestamps.
3. **`credit_note`**:
   - `id` (PK, text), `display_id` (unique, text), `order_id` (indexed, text), `return_request_id` (nullable, indexed, text), `original_invoice_number`, `reason`, `currency_code`, `taxable_amount_paise` (bigNumber), `cgst_paise` (bigNumber), `sgst_paise` (bigNumber), `igst_paise` (bigNumber), `total_tax_paise` (bigNumber), `total_amount_paise` (bigNumber), `rate_percent`, `seller_gstin`, `seller_legal_name`, `seller_state_code`, `buyer_state`, `buyer_state_code`, `buyer_gstin`, `is_mock` (boolean), `status`, `metadata` (jsonb), `issued_at`, timestamps.
4. **`credit_note_item`**:
   - `id` (PK, text), `credit_note_id` (FK, indexed, text), `order_item_id` (text), `title`, `hsn`, `quantity` (int), `unit_price_paise` (bigNumber), `taxable_amount_paise` (bigNumber), `tax_amount_paise` (bigNumber), `total_amount_paise` (bigNumber), timestamps.
5. **`credit_note_display_seq`**:
   - PostgreSQL sequence starting at 1001 for sequential display formatting (`CN-THL-${seq}`).

---

## 6. Local Quality Gate Verification Summary

| Gate | Target | Result | Evidence |
|---|---|---|---|
| **TypeScript Typecheck** | All 6 workspace packages | **PASSED (Exit 0)** | Zero type errors across backend, storefront, admin, shared, ui |
| **ESLint Static Analysis** | Monorepo root | **PASSED (Exit 0)** | Zero errors, zero warnings |
| **Backend Unit Tests** | `apps/backend` | **PASSED (143/143)** | 21 test files, 143 tests passed |
| **Shared Unit Tests** | `packages/shared` | **PASSED (23/23)** | 2 test files, 23 tests passed |
| **Admin Unit Tests** | `apps/admin` | **PASSED (10/10)** | 2 test files, 10 tests passed |
| **Backend Integration Tests** | `apps/backend` (PostgreSQL) | **PASSED (68/68)** | 15 test files, 68 database integration tests passed |
| **Storefront Build** | Next.js 16.4.6 | **PASSED (Exit 0)** | 42 static & dynamic routes compiled |
| **Admin Build** | Next.js 16.4.6 | **PASSED (Exit 0)** | 34 static & dynamic routes compiled |
| **Medusa Backend Build** | Medusa 2.22.7 | **PASSED (Exit 0)** | Server & admin bundle compiled |
| **Phase B Sandbox Script** | `verify-phase-b-sandbox.ts` | **PASSED (13/13)** | All 13 lifecycle scenarios verified against mock sandbox |

---

## 7. Git & Source Control Integrity

- **Accepted Commits Preserved (5/5):**
  - `06df83b` — Phase 1 security & engineering fixes
  - `4b3aa6d` — Phase 1 inventory locking & test consolidation
  - `7a68479` — Phase 1 documentation & verification baseline
  - `ffcfcd9` — Phase 2 payment provider, checkout middleware & audit trail
  - `4c4c51d` — Phase 2 acceptance report
- **Phase B Status:**
  - All Phase B source code, models, migrations, unit tests, integration tests, and sandbox verification scripts are fully implemented and verified.
  - **No unapproved Git commits have been made.**
  - **No Git pushes to GitHub have been made.**
  - Ready for atomic commit upon explicit user instruction.
