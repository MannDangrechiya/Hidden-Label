# 06 — ADMIN PANEL AND INTERNAL OPERATIONS AUDIT

**Critical verification limitation:** the admin app was **not running** on `:7001` and **no admin credentials** exist in this environment. Every admin screen/action below is therefore classified from source code and API behaviour, not from a clicked-through session. Where an action could be probed through the backend without a token, that probe is recorded.

**[LIVE] authorisation probes**
- `GET :9000/admin/orders` → `401`
- By the same middleware, `/admin/inventory`, `/admin/returns`, `/admin/brands`, `/admin/customers` are equally unreachable without a staff token.

## 1. Module status matrix

| Module | Screens | Backend | Status | Notes |
|---|---|---|---|---|
| Dashboard | `/` | `GET /admin/dashboard/summary` | **Implemented, untested (UI)** | Real KPIs: orders by status, revenue captured, revenue refunded, low-stock count (available ≤ 3), open returns, pending shipments, recent orders |
| Products | `/products`, `/new`, `/[id]`, media, variants, publish | Medusa core `/admin/products` | **Implemented, untested (UI)** | Create with sizes → variants; edit title/description/thumbnail; per-variant price edit; publish/draft; **bulk** publish/draft/delete; real image upload through Medusa's file module |
| Brands | `/brands` | `/admin/brands` | Implemented, untested | Full CRUD, audit row per mutation |
| Categories | `/categories` | Medusa core | Implemented, untested | Tree editing |
| Inventory | `/inventory` | `/admin/inventory` | Implemented — **defect** | Levels, low-stock filter, adjustment with mandatory reason (`count_correction, stock_count, damaged, lost, return_restock, sample, transfer`), audit in-transaction. **Lost-update race (BUG-05)** |
| Orders | `/orders`, `/[id]` | `/admin/orders/:id/actions` | Implemented, untested | Capture, fulfil (all pending quantities, first stock location), cancel with reason, refund with reason + amount; audit each. **Refund key not idempotent (BUG-04)** |
| Bespoke pipeline | `/orders/[id]` | metadata on order | Implemented, untested | 5-stage stage machine, measurement table (chest/waist/shoulder/sleeve/inseam), fit preference, tailor notes |
| Payments & refunds | `/payments` | Medusa core | Implemented, untested | Payment list, refund reasons taxonomy (`lib/refund-reasons.ts`) |
| Shipments | `/shipments`, `/[id]` | `/admin/shipments` | Implemented, untested | Manual creation and status updates; idempotent event log; shared mapper with the webhook |
| Returns | `/returns`, `/[id]` | `/admin/returns`, `/[id]` | Implemented, untested | Approve / reject / receive with condition / refund; eligibility re-computed at approval; reverse pickup attempt; **restock only when `resellable`** |
| Customers | `/customers`, `/[id]` | Medusa core + notes | Implemented, untested | Profile, order history, internal notes, risk/blacklist flag |
| Support | `/support` | `/admin/support/tickets` | Implemented, untested | Inbox with status transitions |
| Promotions | `/promotions`, `/new`, `/[id]` | Medusa core + shim | Implemented, untested | `usage_limit`→`limit` body shim in middleware |
| Content / CMS | `/content`, `/new`, `/[id]` | `/admin/cms` | Implemented, untested | Markdown pages, publish |
| Reports | `/reports` + 2 CSV routes | reuses dashboard + returns | **Partially implemented** | Sales/refund/orders counters, low-stock count, returns-by-status, products.csv, orders.csv. **No date range, no GST report, no margin, no reconciliation** |
| Inspections | `/inspections` | `/admin/inspections` | Implemented, untested | Condition/AI-03 review queue, approve/reject with audit |
| Resale orderbook | `/resale` | `/admin/resale/asks|bids` | Implemented, untested | Read-only overview of asks and bids |
| Fit rules | `/fit-rules` | `/admin/fit-rules` | Implemented, untested | Silhouette deltas and guidance |
| Settings / staff | `/settings` | Medusa `/admin/users`, `/admin/invites` | Implemented, untested | Owner-only invite/role/remove; readonly lockout honoured server-side |
| Audit log | `/audit` | `/admin/audit` | Implemented, untested | Filter by entity type, action prefix, actor |

## 2. Role and permission model

Five roles with a strict rank: `readonly(1) < support(2) < operations(3) < manager(4) < owner(5)`.

| Operation | Minimum |
|---|---|
| Read operational records (orders, customers, inventory, returns, shipments, audit) | support |
| Stock adjustment, order capture/fulfil/cancel/refund, return actions, shipment create/update, CMS publish, brand edit | operations |
| Staff/invite management | manager |
| Changing any role | owner (self-escalation blocked) |
| Any non-GET as `readonly` | denied |

Enforcement is server-side twice (global middleware + per-handler `requireRole`); the admin nav hides links cosmetically and says so in a comment.

**Defect SEC-01:** absence of `metadata.role` is interpreted as **owner**, in both `apps/backend/src/lib/admin-auth.ts` and `apps/admin/lib/api/auth.ts`. Every staff member invited through Medusa's own invite flow, or created before the role convention existed, silently becomes an owner. This defeats the entire RBAC design and must be fixed before a second staff account exists.

## 3. Audit trail

- `audit_event` is append-only at the database level (`audit_event_append_only` trigger — **[LIVE]** confirmed in `pg_trigger`).
- 256 rows currently.
- Written for: order capture/fulfil/cancel/refund, customer cancellation, inventory adjustment, return requested/approved/rejected/received/refunded, return restock, brand and CMS mutations, inspections, fit rules, staff changes.
- **Not written for:** price changes, product publish/draft, image upload, promotion creation, customer notes/blacklist changes (these need confirming against each action file — price/bulk actions in `products/actions.ts` contain no `writeAudit` call).

## 4. Reporting capability assessment

| Report the business will ask for | Available? |
|---|---|
| Orders by status | Yes (dashboard) |
| Gross captured revenue | Yes (sum of `payment.amount` where captured) |
| Refunded revenue | Yes (sum of `refund.amount`) |
| Net revenue | Derivable (difference), not displayed as such |
| Low stock | Yes (available ≤ 3) |
| Returns by status | Yes |
| Product list export | Yes (CSV) |
| Order list export | Yes (CSV) |
| Sales by date range | **No** |
| GST output report (CGST/SGST/IGST split) | **No** aggregation, only per-invoice display |
| Gross margin / product profitability | **No** — no purchase cost data exists |
| Inventory valuation | **No** — no cost basis |
| Payment gateway reconciliation | **No** |
| Shipping expense report | **No** |
| Customer lifetime value / repeat rate | **No** |

## 5. Admin UX / completeness gaps

1. No product review moderation (feature absent).
2. No supplier, purchase-order, GRN or purchase-cost screen (feature absent).
3. No consignment settlement screen (feature absent).
4. No multi-location transfer or pick/pack screen.
5. No date filters on any report or list.
6. No bulk action on orders (only per-order).
7. No CSV import for products.
8. No image reordering; gallery is append/remove only.
9. No way to view or edit a customer's bespoke measurement history (only what is on the order line).
10. `/design` token gallery ships in the admin build.

## 6. Module classification (as requested)

| Classification | Modules |
|---|---|
| **Complete and tested** (unit-tested logic) | role rank maths (`lib/roles.ts`, 2 tests); return eligibility (`lib/returns.ts`, 7 tests); shipment status mapping + idempotency helper (`lib/shipment-status.ts`, 5 tests) |
| **Implemented, partially tested** | Order actions, inventory adjust, returns actions, brands, CMS, inspections, fit rules (code only; no route tests) |
| **UI only** | Reports (presentation over existing endpoints; CSV exports are thin) |
| **Backend only** | Reverse pickup booking, login-bonus-style internals, resale asks/bids (no admin acceptance/fulfilment action) |
| **Mocked / hardcoded** | *None found in admin.* The admin app has an explicit "no mock or fallback data" rule in `lib/backend.ts` and honours it |
| **Broken** | Inventory adjustment under concurrency; refund idempotency; default-owner role |
| **Missing** | Suppliers/purchasing, settlements, reviews, multi-location ops, date-ranged analytics, credit notes |
