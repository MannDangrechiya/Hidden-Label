# Admin-Side Flow Audit — Operations Console

Executed against `http://localhost:7001` (app) and `http://localhost:9000/admin/*` (API) with a real owner account and a real `readonly` account. “Verified” means an HTTP/browser operation was performed.

**Admin accounts:** `admin@thehiddenlabel.com` (owner) and `audit.readonly@thehiddenlabel.com` (temporary fixture, removed after the audit).

---

## 1. Authentication and access control

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| ADM-01 | Admin login | JWT | 200 | ✅ |
| ADM-02 | Identity + role | owner | `admin@… role=owner` | ✅ |
| ADM-G-* | Guest on `/`, `/orders`, `/products`, `/customers`, `/settings`, `/audit` | 307 → `/login` | all redirect | ✅ |
| SEC-ADM-* | 7 admin APIs without token | 401 | 401 for orders, brands, returns, audit, inspections, resale, fit-rules | ✅ |
| SEC-04 | Customer JWT on admin API | 401/403 | 401 | ✅ |
| ADM-404 | Admin unknown route | 404 | 404 | ✅ |
| — | Admin login in browser | dashboard | succeeded, owner nav rendered | ✅ |

### Role model — **critically broken**

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| RBAC-01 | Readonly role resolves | readonly | readonly | ✅ |
| RBAC-02 | Readonly reads custom module `/admin/brands` | 403 | 403 | ✅ |
| RBAC-03 | Readonly reads `/admin/orders` | 403 | **200, full order list** | ❌ **Critical** |
| RBAC-04 | Readonly lists `/admin/users` | 403 | **200, full admin directory incl. roles** | ❌ **Critical** |
| RBAC-05 | Readonly sets its own `metadata.role='owner'` via `POST /admin/users/:id` | 403 | **200, escalated** | ❌ **Critical** |
| W-RBAC-01 | Support reads brands / writes brand | 200 / 403 | 200 / 403 | ✅ |
| W-RBAC-02 | Support runs order action | 403 | 403 | ✅ |

**Cause:** `requireRole` guards only the project’s custom `/admin/*` routes. Medusa core routes (`/admin/orders`, `/admin/products`, `/admin/customers`, `/admin/users`, `/admin/payments`, `/admin/invites`, …) are protected only by “is a Medusa user”, so `readonly` is a UI label, not a security boundary. The self-escalation makes every other check moot once exploited.

---

## 2. Admin pages

| # | Route | Screen | Result |
|---|---|---|---|
| ADM-P-/ | A-01 Dashboard | ✅ 200, KPIs + recent orders |
| ADM-P-/products | A-02 | ✅ 200 |
| ADM-P-/products/new | A-03 | ✅ 200 |
| ADM-P-/brands | A-04 | ✅ 200 |
| ADM-P-/categories | A-05 | ✅ 200 |
| ADM-P-/inventory | A-06 | ✅ 200 |
| ADM-P-/orders | A-07 | ✅ 200 |
| ADM-P-ORDER | A-08 | ✅ 200 — but heading renders `Order #` with no number and `Invalid Date` |
| ADM-P-/customers + detail | A-09 | ✅ 200 |
| ADM-P-/payments | A-10 | ✅ 200 |
| ADM-P-/shipments + detail | A-11 | ✅ 200 |
| ADM-P-/returns + detail | A-12 | ✅ 200 |
| ADM-P-/promotions + new | A-13 | ✅ 200 (create is broken, §4) |
| ADM-P-/content + new | A-14 | ✅ 200 |
| ADM-P-/reports | A-15 | ✅ 200 |
| ADM-P-/settings | A-16 | ✅ 200 |
| ADM-P-/audit | A-17 | ✅ 200 |
| ADM-P-/inspections | A-18 | ✅ 200 |
| ADM-P-/resale | A-19 | ✅ 200 |
| ADM-P-/fit-rules | A-20 | ✅ 200 (read-only; no create/edit/delete UI) |
| ADM-P-/design | SYS-01 | ✅ 200 |

All 30 admin pages load real data; none render an error boundary.

---

## 3. Orders — the critical failure

**Browser repro (real UI, Chromium):**

1. Sign in as owner → `/orders/order_01M7F01R26QRSFSJDZX3Q76E24`.
2. Click **FULFIL REMAINING ITEMS** → confirm.
3. UI shows **“The action failed.”**; `FULFILLED` remains `0`; status remains `NOT_FULFILLED`.

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| E2E-01 | Admin fulfils order | 200, fulfilled | **422 `{"type":"action_failed","message":"The action failed."}`** | ❌ **Critical** |
| E2E-02 | Double fulfilment | 422 | not reached (first fails) | ⛔ Blocked |
| E2E-04 | Capture payment | 200 | 200 | ✅ |
| E2E-05 | Refund captured payment | 200 | 200, refund ₹38,990 recorded with note | ✅ |
| E2E-06 | Refund without reason | 400 | 400 | ✅ |
| EDGE-02 | Cancel without reason | 400 | 400 | ✅ |
| W-FUL-01 | Medusa core `POST /admin/orders/:id/fulfillments` | 200 | 200 (proves the workflow itself works) | ✅ |
| W-FUL-02 | Customer sees fulfilment after admin action | status/shipment | no fulfilment state rendered | ❌ High |

**Root cause:** `apps/backend/src/api/admin/orders/[id]/actions/route.ts` builds `items` from `order_item.id` (`orditem_…`) and passes them to `createOrderFulfillmentWorkflow`, which expects the order line-item id (`ordli_…`, exposed as `items[].id`). The core route with the correct ids succeeds, isolating the defect to the custom action. The handler also catches every exception and returns a generic message without logging, so the admin cannot diagnose it.

**Additional order UI defect:** `fetchOrder`’s `DETAIL_FIELDS` omits `display_id` and `created_at`, so the page heading is `Order #` (blank) and the timestamp is `Invalid Date` on every order. Screenshot: `docs/screenshots/audit-admin-fulfil-error.png`.

---

## 4. Module-by-module write audit

| Module | Operation | Expected | Actual | Status |
|---|---|---|---|---|
| Brands | create | 201 | 201 | ✅ |
| Brands | duplicate handle | 409 | 409 | ✅ |
| Brands | invalid payload | 400 | 400 | ✅ |
| Brands | update | 200 + persisted | 200, tagline changed | ✅ |
| Brands | delete | 200/204 | 200 | ✅ |
| Products | create draft (2 variants) | 201 | 200/201 | ✅ |
| Products | draft hidden from storefront | 404 | 404 | ✅ |
| Products | publish | published | published | ✅ |
| Products | appears on storefront | 200 + title | 200, H1 “Audit Tee …” | ✅ |
| Products | delete | 200/204 | 200 | ✅ |
| Promotions | create (form payload) | 201 | **400 `Unrecognized fields: 'usage_limit'`** | ❌ **High** |
| Promotions | create without the field | 200 | 200 (proves field name is the defect) | ✅ |
| Promotions | list | present | not reached (creation blocked) | ⛔ Blocked |
| Promotions | delete | 200/204 | not reached | ⛔ Blocked |
| CMS | create page | 201 | 201 | ✅ |
| CMS | published page served | 200 | 200 via `/store/cms/<single-segment>` | ✅ |
| CMS | update | persisted | 200, title changed | ✅ |
| CMS | storefront policy slug (`policies/shipping`) | 200 | **404 “Cannot GET”** | ❌ **High** |
| Inventory | adjust +2 `count_correction` | 200, 4→6 | 200, 6; reverted to 4 | ✅ |
| Inventory | audit event | event | `inventory.adjusted` | ✅ |
| Inspections | change verdict | 200, public reflects | 200, public certificate shows `rejected`; restored | ✅ |
| Inspections | audit event | event | present | ✅ |
| Customers | notes save + render | visible | visible | ✅ |
| Fit rules | create (API) | 201 | 201 | ✅ |
| Fit rules | delete | 200/204 | **404, no DELETE route** | ❌ Medium |
| Fit rules | create/edit in UI | controls | read-only table only | ❌ Medium |
| Shipments | create for order | 201 | 201 (`provider=manual`, no fake AWB) | ✅ |
| Shipments | update status/AWB | 200 | 200 `in_transit`, AWB `AUDIT123456` | ✅ |
| Shipments | customer API + page show it | visible | both show courier + AWB | ✅ |
| Settings | invite admin | 200/201 | 200 | ✅ |
| Settings | revoke invite | 200/204 | 200 | ✅ |
| Settings | change role (owner) | 200 | 200 | ✅ |
| Settings | role change restricted to owner | 403 for readonly | **not enforced** (RBAC-05) | ❌ Critical |

---

## 5. Returns — the second critical failure

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| W-RET-01 | Customer creates return after delivery | 201 | RMA-1022 | ✅ |
| W-RET-02 | Visible in admin detail | 200 | 200 | ✅ |
| W-RET-03 | Admin approves | 200, `approved` | **400 `Unrecognized fields: 'action'`** | ❌ **Critical** |
| W-RET-04 | Customer API sees approval | `approved` | `requested` | ❌ High |
| W-RET-05 | Customer UI sees status | page | **404 `/account/returns`** | ❌ High |

The admin returns page renders an **Approve** control, but the request never reaches the handler: Medusa’s core `/admin/returns/:id` validator rejects the body first — the same class of collision already documented for `/store/returns` and worked around with `/store/return-requests`. The fixture RMA remains `requested` in the database.

---

## 6. Audit log and synchronisation

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| AUDIT-01 | Brand mutation audited | event | `brand.created` / `brand.deleted` | ✅ |
| AUDIT-02 | Audit page renders | 200 | 200 | ✅ |
| — | Order capture/refund audited | events | `order.capture`, `order.refund` present | ✅ |
| — | Return requested/approved audited | events | `return.requested` present; approval blocked | ⚠️ |
| — | Inspection change audited | event | present | ✅ |
| SYNC-01 | User order appears in admin | present | order found among 44 | ✅ |
| SYNC-02 | Bespoke measurements shown to tailor | sheet | Master Tailor Sheet with chest 42 / waist 34 / notes (verified in UI) | ✅ |
| SYNC-03 | Order visible in customer account | 200 | 200 | ✅ |
| SYNC-04 | Admin fulfilment visible to customer | status | not visible | ❌ High |
| SYNC-05 | Customer return appears in admin | present | present | ✅ |
| SYNC-06 | Admin approval visible to customer | approved | blocked, stays `requested` | ❌ High |
| SYNC-08/09 | Customer profile update visible in admin | visible | `AuditUpdated` visible | ✅ |

---

## 7. Admin UX and data-presentation defects

1. **Order detail header** — blank `Order #` and `Invalid Date` on every order (missing `display_id` / `created_at` in `DETAIL_FIELDS`).
2. **Opaque failures** — the fulfil action reports “The action failed.” with no cause; the backend catch-all does not log the workflow error.
3. **Fit rules screen** — labelled a manager but is a read-only table; API has no delete.
4. **Permissions UI vs reality** — Settings can set roles, and the nav hides links by role, but core routes ignore roles. This is actively misleading for operators.
5. **Promotions form** — fields look valid but submission always fails; no inline indication of the real field mismatch.

---

## 8. Admin summary

- Works: login, all 30 screens, brand/product/CMS/inventory/inspection/customer/shipment/settings writes, audit stream, IDOR-safe customer isolation, support-vs-manager gating on custom routes.
- Broken: fulfilment, return actions, promotion creation, role enforcement on core resources, self-escalation, order detail header.
- Blocked: full promotion lifecycle, full return lifecycle, double-fulfilment edge case.
