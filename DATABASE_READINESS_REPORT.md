# THE HIDDEN LABEL — DATABASE READINESS & INTEGRITY REPORT

**Date:** 2026-11-22  
**Scope:** PostgreSQL Schema Integrity, Migrations, Constraints, Idempotency & Disaster Recovery  
**Auditor:** Database Administrator & Backend Architect  

---

## 1. Migration History & Schema Ledger

The custom business schema is managed through MikroORM migrations under `apps/backend/src/modules/thl/migrations/`. All 12 migrations have been verified against PostgreSQL 18 in isolated ephemeral test environments:

| Migration File | Primary Tables & Sequences Created | Key Constraints & Integrity Controls |
|---|---|---|
| `Migration20261114090000.ts` | `brand`, `wishlist` | Primary key `id`, handle unique constraint, timestamps |
| `Migration20261114091000.ts` | `cms_page`, `cms_section` | Slug unique constraint, status checks (`draft`, `published`) |
| `Migration20261114092000.ts` | `customer_otp` | Phone/email index, expiry timestamptz, attempt limit check |
| `Migration20261114093000.ts` | `return_request`, `shipment` | Status checks, foreign key relationships, sequential IDs |
| `Migration20261114100000.ts` | `audit_event`, `return_request_display_seq` | Append-only audit trail; PostgreSQL sequence for RMA numbers |
| `Migration20261117100000.ts` | `webhook_event` | Webhook deduplication table; unique constraint on `(source, event_id)` |
| `Migration20261119100000.ts` | `refund_operation` | Unique index on `idempotency_key` (SHA-256 of intent) |
| `Migration20261119110000.ts` | `payment_operation` | Unique index on `cart_id`; status check (`pending`, `completed`, `failed`) |
| `Migration20261120100000.ts` | `warehouse_pickup_location` | Active warehouse flag; postal code index; operational validation |
| `Migration20261121100000.ts` | `credit_note_display_seq`, `credit_note` | Sequence for GST credit notes (`CN-THL-XXXX`); unique `rma_id` |
| `Migration20261121150000.ts` | `resale_ask`, `price_index`, `bespoke_pipeline` | Status checks (`active`, `authenticated`, `sold`, `settled`) |
| `Migration20261122110000.ts` | `product_review`, `supplier`, `purchase_order`, `goods_receipt`, `stock_movement`, `consignor_settlement`, `consultation_booking`, `fabric_swatch` | PO display sequence, GRN display sequence, rating check (1–5), hold_until timestamptz, immutable stock movement ledger |

---

## 2. Relational Integrity & Key Constraints

### A. Foreign Keys & Cascading Rules
- `purchase_order.supplier_id` → `supplier.id` (`ON DELETE RESTRICT`): Prevents deleting suppliers that have active or historical purchase orders.
- `purchase_order_item.purchase_order_id` → `purchase_order.id` (`ON DELETE CASCADE`): Line items are bound to their parent PO lifecycle.
- `goods_receipt.purchase_order_id` → `purchase_order.id` (`ON DELETE RESTRICT`): Completed goods receipts cannot be orphaned.

### B. Unique Constraints & Sequence Numbering
- `purchase_order.display_id` (`UNIQUE`): Generated from `purchase_order_display_seq` starting at 1001 (`PO-THL-XXXX`).
- `goods_receipt.display_id` (`UNIQUE`): Generated from `goods_receipt_display_seq` starting at 1001 (`GRN-THL-XXXX`).
- `consignor_settlement.ask_id` (`UNIQUE`): Enforces a strict 1-to-1 relationship between a resale consignment item and its financial settlement record. Duplicate settlement generation is impossible at the database level.
- `webhook_event (source, event_id)` (`UNIQUE`): Prevents duplicate execution of incoming Razorpay and Shiprocket webhooks.

### C. Check Constraints
- `product_review.rating`: `CHECK ("rating" BETWEEN 1 AND 5)`.
- `product_review.status`: `CHECK ("status" IN ('pending', 'approved', 'rejected'))`.
- `purchase_order_item.quantity`: `CHECK ("quantity" > 0)`.
- `purchase_order_item.received_quantity`: `CHECK ("received_quantity" >= 0)`.
- `purchase_order_item.unit_cost_rupees`: `CHECK ("unit_cost_rupees" >= 0)`.
- `stock_movement.movement_type`: `CHECK ("movement_type" IN ('po_receipt', 'manual_adjustment', 'order_fulfillment', 'return_restock', 'damage_shrinkage'))`.
- `consignor_settlement.status`: `CHECK ("status" IN ('pending', 'cleared', 'disbursed', 'forfeited'))`.

---

## 3. Transaction Boundaries & Concurrency Protection

### A. Inventory Mutex & Atomic Adjustments (`BUG-05`)
Stock mutations in `apps/backend/src/lib/stock-adjustment.ts` execute within an explicit database transaction with row-level locks:
```sql
SELECT * FROM inventory_level 
WHERE inventory_item_id = ? AND location_id = ? 
FOR UPDATE;
```
Negative stock bounds are re-evaluated under lock before applying the delta, eliminating overselling and concurrency anomalies.

### B. Goods Receiving Atomic Balance Update
In `apps/backend/src/api/admin/purchase-orders/:id/receive/route.ts`:
1. Acquires a row lock on the purchase order record (`FOR UPDATE`).
2. Validates that `quantity_to_receive + received_quantity <= quantity`.
3. Row-locks `inventory_level` and increments stocked quantity.
4. Creates an immutable `stock_movement` log entry.
5. If any single step fails, the entire transaction rolls back cleanly.

### C. Consignor Settlement Clearance Hold
In `apps/backend/src/api/admin/resale/asks/:id/settle/route.ts`:
- Checks `now() >= hold_until` (7 days post-delivery).
- If hold has not elapsed, transaction aborts with HTTP 400.
- If cleared, updates status to `cleared` with audit trail recording.

---

## 4. Database Disaster Recovery & Maintenance

### A. Production Backup Script (`scripts/db-backup.sh`)
- Uses `pg_dump` with custom compression format (`-Fc`).
- Validates the dump file's header using `pg_restore -l` before marking successful.
- Automatically manages retention (prunes backups older than 14 days).
- Emits exit code 1 if backup integrity check fails.

### B. Production Restore Script (`scripts/db-restore.sh`)
- Interactive safety prompt requiring manual confirmation before overwriting database.
- Uses `pg_restore --clean --if-exists --no-owner` to restore cleanly without schema collisions.
- Validates restored database connectivity with `SELECT count(*) FROM brand;`.

### C. Test Fixture Purging (`scripts/clean-test-fixtures.ts`)
- Scans for development test fixtures (e.g., 14 `Audit Brand` records).
- Runs in dry-run mode by default; applies changes only when passed `--commit`.
- Wrapped in a transaction that rolls back automatically if any query fails.
