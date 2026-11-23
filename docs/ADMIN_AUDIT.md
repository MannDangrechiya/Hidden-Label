# ADMIN AUDIT — The Hidden Label

**Date:** 23 November 2026 · **App:** `apps/admin` (Next.js 16, `:7001`)
**Method:** full source and route inspection; login screen verified live; **interior screens not visually verified** because no staff credentials were available (two accounts exist: `admin@…` owner, `audit.readonly@…` readonly). An existing 15 Nov screenshot of an order page (`docs/screenshots/audit-admin-fulfil-error.png`) is used as secondary visual evidence and flagged as such.

---

## 1. What the admin is today

A server-rendered Next.js console that talks to Medusa's admin API plus custom `/admin/*` routes. Authentication is Medusa user JWT in an httpOnly cookie; every request is re-authorised server-side.

- **Navigation:** one flat list of 19 items in a fixed 240 px dark rail. Every item except Settings is available to `support`; Settings requires `manager`. Resale/Inspections/Fit Rules are filtered out when their flags are off.
- **Layout:** fixed sidebar + header + main. No collapse, no mobile behaviour, no breadcrumb, no global search.
- **Visual language:** same brutalist tokens as the storefront, inverted (dark rail, bone content). Tables are bordered, zebra-striped, horizontally scrollable, sticky first column.
- **Status:** typecheck/build/test clean. Backend endpoints exist for nearly every screen.

---

## 2. Route-by-route assessment

| Route | Real backend? | CRUD? | Notes / problems |
|---|---|---|---|
| `/` Dashboard | `/admin/dashboard/summary` | read | Six KPI cards + orders-by-status + recent orders. No date range, no "needs attention", no revenue trend, no comparison. Weak as daily landing. |
| `/products` | Medusa admin products | read + bulk actions | Search by title/SKU, status filter, offset pagination, bulk table, "Add product". No sort, no category/brand filter, no stock column, no saved views. |
| `/products/new` | admin product API | create | Single long form; variant matrix; no draft/preview; no image upload at creation. |
| `/products/[id]` | admin product API | update | Edit form, variants table, media manager (real local upload). No publish checklist, no SEO fields, no related products. |
| `/brands` | `/admin/brands` | CRUD | Works; brand directory table + form. No logo/media, no partnership tier despite docs. |
| `/categories` | Medusa categories | CRUD | Tree manager; no drag/reorder, no banner config. |
| `/inventory` | `/admin/inventory` | adjust | Location allocation and adjustments; low-stock threshold 3. Strongest operational screen. No stock ledger here. |
| `/orders` | admin orders | read | Search + status filter + offset pagination. Only order/payment/fulfilment statuses; no date filter, no fulfilment queue, no export. |
| `/orders/[id]` | `/admin/orders/[id]/actions` | capture/fulfil/cancel/refund | Items, address, payments/refunds, bespoke pipeline, action bar. Prior screenshot shows "The action failed." with no cause — error surfacing is poor. |
| `/payments` | admin payments | read | Cross-order read view only. As a top-level nav item it is a dead end because refunds live on the order. |
| `/shipments` | `/admin/shipments` | create/track | AWB and status; sandbox only. No bulk create, no label print flow verified. |
| `/returns` | `/admin/returns` | read | Status filter chips; no age/SLA, no value column, no bulk approve. |
| `/returns/[id]` | `/admin/returns/[id]` + action middleware | approve/reject/receive/refund | Real workflow including inspection condition and restock. Good logic, plain UI. |
| `/customers` | admin customers | read | List; no segmentation, no order count/value, no risk filter visible. |
| `/customers/[id]` | admin customers | read + notes | Profile, orders, internal notes. Useful; could be the customer 360. |
| `/promotions` | Medusa promotions | CRUD | List/new/edit; usage limits. No coupon performance, no stacking rules UI. |
| `/content` | `/admin/cms` | CRUD | CMS pages/new/edit; markdown. No banner/drop scheduling UI despite models. |
| `/support` | `/admin/support/tickets` | read + reply/resolve | Ticket list with interactive resolution. Zero tickets exist, so unexercised. |
| `/reports` | dashboard + returns | read | Sales/inventory/returns summary + products/orders CSV. No date range, no GST link. |
| `/reports/export/gst` | order/payment data | export | Real GSTR-1 style CSV, but **only linked from Purchasing**, not Reports. |
| `/purchasing` | `/admin/purchase-orders`, `/suppliers`, `/stock-movements` | read | Full supply-chain page with PO table and stock ledger. **No nav entry, 0 POs.** Invisible in normal use. |
| `/reviews` | `/admin/reviews` | moderate | Review moderation cards. **No nav entry, 0 reviews.** Invisible. |
| `/audit` | `/admin/audit` | read | 299 events, filters. Good. |
| `/settings` | users/invites | invite/role/remove | Staff management with roles and pending invites. No MFA, no session list, no store-profile editor (store config lives in env). |
| `/resale`, `/inspections`, `/fit-rules` | custom | CRUD | Real, flag-gated, hidden. |
| `/design` | none | static | Dev-only token gallery. |

---

## 3. Information architecture problems

1. **Entity-driven, not workflow-driven.** A shopkeeper's day is: *what needs shipping, what needs refunding, what is out of stock, what is a customer asking*. The nav offers "Payments", "Shipments", "Returns", "Reports" as separate destinations with no queue linking them.
2. **19 flat items.** No grouping, no hierarchy, no prioritisation. Settings sits between "Fit Studio Rules" and "Audit log".
3. **Everything requires only `support`.** Role-based visibility is effectively binary: support sees almost all operational screens; only Settings is manager+. A read-only user still sees every screen (writes fail server-side, but the UI invites them).
4. **Orphans and dead ends.** `Purchasing` and `Reviews` are unreachable. `Payments` has no actions. GST export is hidden inside Purchasing. Stock ledger is inside Purchasing instead of Inventory.
5. **No global search.** Finding an order by customer email requires the Orders page; finding a product by SKU requires Products.
6. **No error context.** "The action failed." with no status or reason (observed in prior screenshot). Operators cannot self-serve failures.
7. **No responsive strategy.** Fixed 240 px rail; at 520 px it consumes nearly half the width and content overflows horizontally. No mobile/tablet operations path.
8. **No confirmation or undo for destructive actions** beyond `confirm()` in a couple of places; role changes and deletions are confirmed via browser dialogs.

---

## 4. Usability specifics

**Good**
- Server-side RBAC and audit on every mutation.
- Status chips and tone mapping across orders/returns.
- Sensible empty states and explicit error states on most pages.
- Table primitive with sticky first column and horizontal scroll.
- Real, honest handling of missing values (e.g., no fabricated timestamps).
- Order detail consolidates payments, refunds, address, bespoke stage and actions.

**Poor**
- Tables: no column sorting, no page-size control, no "showing X of Y" with jump-to-page, filters not preserved in some pagination links.
- Forms: labels exist, but no inline field-level validation summary, no dirty-state warning, no autosave.
- No keyboard shortcuts, no bulk selection outside products.
- Dates are formatted per-cell with inconsistent styles (`toLocaleDateString` vs `toLocaleString`).
- Money is correctly whole-rupee in most places (`moneyFromRupees`), but the checkout bug proves the convention is not enforced by a single formatter at the API boundary.
- Dashboard has no timeframe and no link from KPI to the filtered list.
- No print/invoice view for staff; invoices are customer-only.
- No shipment label printing verified; no pickup scheduling UI beyond the API.

---

## 5. Proposed information architecture

```
OVERVIEW
  Dashboard            needs-attention queue, today's revenue, open returns, low stock
COMMERCE
  Orders               default view: unfulfilled + requires-action queue
  Returns              default: awaiting approval
  Products             list · new · edit (media, variants, content)
  Inventory            levels · adjustments · stock ledger
  Brands
  Categories
  Promotions
FULFILMENT
  Shipments            create/bulk, labels, tracking exceptions
CUSTOMERS
  Customers            360 view, notes, risk flag
  Support              inbox by SLA
CONTENT
  Content & CMS
  Reviews
FINANCE & INSIGHTS
  Reports              sales, GST exports, date ranges
  Payments             read-only ledger (optional if order detail covers it)
  Audit log
SETTINGS
  Store profile
  Staff & roles        MFA, sessions, invites
  Integrations         read-only status of Razorpay/Shiprocket/email/SMS
```

Rules: group headers; collapsible rail (icons only) with persisted state; `⌘K` command palette (order #, email, SKU, customer); role-aware groups (readonly sees Overview/Commerce/Reports but no action buttons); hide Purchasing until purchase orders are actually used, then place under Commerce.

---

## 6. Screen-level redesign notes

- **Dashboard:** replace six equal KPI cards with a two-column action board: left "Needs attention" (unpaid, unfulfilled > 24 h, returns awaiting approval, low stock, failed webhooks), right "Today" (orders, revenue, AOV) + 14-day sparkline. Each row links to a filtered list.
- **Orders list:** tabs for `Unfulfilled · Awaiting payment · In transit · Returns · All`; date range; saved views; bulk fulfil/label; row shows customer, total, age, payment, fulfilment, shipment.
- **Order detail:** single cockpit with tabs (Summary, Items, Payment, Shipment, Returns, Notes); sticky action bar; every action explains preconditions and surfaces backend error text.
- **Returns:** SLA column (days since request), value, reason; inline approve/reject; reverse-pickup status.
- **Products:** add stock and category columns; inline publish toggle; media-first edit page; variant matrix with bulk price/stock edit.
- **Inventory:** merge stock ledger here; low-stock view with reorder action; export.
- **Customers:** add orders count, lifetime value, last order, risk flag filter; detail page becomes 360 (orders, returns, tickets, notes).
- **Settings:** add store profile (name, address, GSTIN, CIN, support contacts), integrations status, staff MFA.

---

## 7. Responsive requirements

- ≥ 1280 px: full sidebar + dense tables.
- 768–1279 px: collapsible icon rail; tables scroll.
- < 768 px: top bar + drawer nav; card-list fallback for tables; order detail stacked; actions in a fixed bottom bar. Admin is desktop-optimised but must not be unusable on a phone for a boutique owner.

---

## 8. Priority fixes

**P0**
1. Group navigation and add the needs-attention dashboard.
2. Fix action error surfacing (show backend message/status).
3. Add nav entries for Reviews; move GST export to Reports; decide Purchasing (hide or wire).
4. Responsive rail and table fallback.

**P1**
5. Global search/command palette.
6. Order detail cockpit + bulk fulfilment.
7. Inventory ledger consolidation + reorder.
8. Customer 360.
9. Store profile settings (statutory data) instead of env-only.
10. Staff MFA and session management.

**P2**
11. Saved views, column sorting, page-size control.
12. Promotions performance, review moderation workflow, support SLA.
13. Export scheduling and accounting-friendly GST files.
