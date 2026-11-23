# FEATURE INVENTORY — The Hidden Label

**Audit date:** 23 November 2026 · **Code state:** local `main` @ `478e7ec` (remote `a8127d9`)

Status legend:
- **WORKING** — verified end-to-end in this or a prior recorded run, with backend + DB evidence.
- **PARTIAL** — implemented, but an important part is missing, gated, or unverified.
- **BROKEN** — does not perform its advertised function.
- **MOCK** — demonstration/placeholder data or behaviour.
- **UNVERIFIED** — code exists; no evidence it works in this environment.
- **REDUNDANT** — overlaps another feature.
- **UNUSED** — no active business purpose found.
- **OPTIONAL** — useful, not launch-critical.
- **MISSING** — required, not implemented.

Business importance: **C** critical, **H** high, **M** medium, **L** low.

---

## 1. Storefront

| Feature | Route / component | Backend | Data model | Status | Imp. | Recommendation |
|---|---|---|---|---|---|---|
| Homepage | `/` · `app/page.tsx` | `/store/products`, `/store/brands`, `/store/catalog/stock` | Medusa product/variant/inventory | PARTIAL | C | Redesign (empty hero, no imagery, mobile overflow) |
| Recent-activity ticker | `components/market-ticker.tsx` | `/store/resale/recent-activity` | order lines | PARTIAL | L | Keep only if truthful; currently shows real line, verify empty state |
| Header | `components/site-header.tsx` | cart, categories, brands, session | cart/customer | PARTIAL | C | Redesign + add mobile nav |
| Mega menu | `components/mega-menu.tsx` | `/store/categories`, `/store/brands` | product_category | WORKING | H | Keep; add imagery and column structure |
| Search overlay | `components/search-overlay.tsx` | `/store/search/suggest` | products | WORKING | H | Keep; make mobile reachable |
| Search results | `/search` | `/store/products?q=` | products | WORKING | H | Add facets, synonyms, zero-result recovery |
| Brands index | `/brands` | `/store/brands` | brand | WORKING | H | Keep; add brand imagery |
| Brand page | `/brands/[handle]` | brand + product filter | brand/product | WORKING | H | Keep |
| Collections (all) | `/collections/all` | `/store/products` | products | PARTIAL | C | Fix facet pagination/brand data; redesign |
| Collection by handle | `/collections/[handle]` | products (no category filter) | products | PARTIAL | M | Filter server-side per category |
| Category tabs | `catalog-client.tsx` | none (client filter) | — | PARTIAL | H | Move facets to server; counts from full set |
| Price/size/brand filters | `catalog-client.tsx` | none | — | BROKEN (brand facet empty; counts page-bound) | H | Rebuild |
| Sort | `catalog-client.tsx` | none (client) | — | PARTIAL | M | Server sort |
| Quick view | `catalog-client.tsx` | cart add | cart | WORKING | M | Keep, restyle |
| PDP | `/products/[handle]` | product, stock, reviews, wishlist, (resale) | product/variant/review | PARTIAL | C | Redesign; gallery, brand, size guide, correct imagery |
| PDP delivery checker | `components/delivery-checker.tsx` | pincode lookup | — | WORKING | M | Keep |
| PDP reviews | `components/product-reviews.tsx` | `/store/products/[id]/reviews` | product_review | UNVERIFIED (0 rows) | M | Seed/test; moderate in admin |
| Wishlist | `/account/wishlist` | `/store/wishlist` | wishlist_item | WORKING | M | Keep |
| Cart drawer | `components/cart-drawer.tsx` | `/api/cart`, cart actions | cart | WORKING | C | Keep; fix totals presentation |
| Cart page | `/cart` | cart actions | cart | PARTIAL | C | Fix totals; add delivery estimate |
| Promo codes | `components/promo-code-input.tsx` | Medusa promotions | promotion | WORKING | M | Add governance rules |
| Checkout — address | `/checkout?step=address` | cart address, pincode | cart/address | WORKING | C | Keep; add saved addresses |
| Checkout — shipping | `?step=shipping` | shipping options + metadata | cart/shipping_option | WORKING | C | Keep; clearer pricing |
| Checkout — payment | `?step=payment` | Razorpay session + complete cart | payment_* | BLOCKED/BROKEN locally (no key) | C | Supply test keys; verify end-to-end |
| Payment confirmation | `components/checkout-payment-form.tsx` | `completeCart` + signature | payment_operation | UNVERIFIED live | C | Test with sandbox |
| Order confirmation | `/checkout/confirmation/[id]` | order read | order | WORKING (read) | C | Verify only after real payment |
| Login / register | `/login`, `/register` | Medusa auth + OTP | customer | WORKING | C | Keep; add social/OTP polish |
| OTP verification | `/verify` | `/store/otp/*` | otp_challenge | WORKING (dev echo) | H | Wire real SMS; `/verify` unreachable (0 links) |
| Forgot / reset password | `/forgot-password`, `/reset-password` | Medusa + Resend | customer | UNVERIFIED (no email key) | C | Test with provider |
| Account dashboard | `/account` | orders, profile, delete | customer/order | WORKING | H | Redesign |
| Order history | `/account/orders` | `/store/orders` | order | WORKING | C | Keep |
| Order detail | `/account/orders/[id]` | order, shipment | order/shipment | WORKING | C | Add tracking timeline |
| Order cancel | `/account/orders/[id]/cancel` | `/store/orders/[id]/cancel` | order/refund/credit_note | PARTIAL | H | Verify refund path with paid order |
| Order invoice | `/account/orders/[id]/invoice` | order | order/credit_note | PARTIAL | C | GSTIN blank; remove false authenticity line |
| Return request | `/account/orders/[id]/return` | `/store/return-requests` | return_request/item | WORKING (eligibility tested) | C | Keep |
| Returns list | `/account/returns` | return read | return_request | WORKING | H | Keep |
| Support / ticket | `/support` | `/store/support/tickets` | support_ticket | UNVERIFIED (0 rows) | H | Test; add SLA view |
| Policies | `/policies/[slug]` | CMS | cms_page | PARTIAL (copy ownership) | C | Legal copy from owner |
| Grievance | `/policies/grievance` | env + page | — | PARTIAL (placeholders) | C | Fill statutory details |
| Size guide | `/size-guide` | CMS/static | — | PARTIAL | H | Per-brand charts; link from PDP |
| About | `/about` | CMS | cms_page | WORKING | M | Keep |
| Authenticity page | `/authenticity` | CMS | cms_page | PARTIAL | M | Rewrite to claim only inspected units (or hide) |
| Mobile navigation | — | — | — | MISSING | C | Add hamburger drawer |
| Cookie/analytics consent | — | — | — | MISSING (analytics off) | M | Add before analytics |
| SEO (robots/sitemap/OG) | — | — | — | MISSING/BROKEN (`noindex`) | C | Add before launch |

## 2. Resale / AI add-ons (gated)

| Feature | Route | Backend | Status | Recommendation |
|---|---|---|---|---|
| Sell / consign hub | `/sell` | asks + publish-inventory | PARTIAL (gated) | DEFER — hide |
| Buyer bids | `/account/bids`, bid modal | `/store/resale/bids` | PARTIAL (gated; UI visible locally) | DEFER — hide CTA |
| Seller asks | `/account/asks` | `/store/resale/asks` | PARTIAL (gated) | DEFER |
| Price index | `components/price-index-card.tsx` | `/store/resale/products/[handle]/index` | WORKING (DB-backed) | DEFER |
| Inspection certificate | `/inspection/[serial]` | `/store/inspections/[serial]` | WORKING (DB-backed) | DEFER; route unreachable |
| Fit Studio | `/fit-studio`, widget | `/store/fit/*` | WORKING (rules) | DEFER/OPTIONAL |
| AI search by sight | search overlay | `/store/sight-search` | MOCK fallback (keyword) unless Gemini key | DEFER |
| AI concierge | floating tab | `/store/concierge/chat` | MOCK fallback; unit-tested | DEFER |
| Admin resale/inspections/fit-rules | `/resale`, `/inspections`, `/fit-rules` | admin resale/inspection/fit | WORKING but hidden by flag | DEFER |
| `/verify` | `/verify`, `/verify/[serial]` | — | UNUSED/REDUNDANT | REMOVE from UI |

## 3. Admin

| Module | Route | Backend | Status | Recommendation |
|---|---|---|---|---|
| Dashboard | `/` (dashboard) | `/admin/dashboard/summary` | WORKING (code) | Redesign → needs-attention |
| Product list | `/products` | Medusa admin products | WORKING | Keep; add saved filters |
| Product create/edit | `/products/new`, `/products/[id]` | admin product + variants | WORKING | Keep; add media pipeline |
| Product media | `media-manager.tsx` | `/admin/uploads` | WORKING (local storage) | Move to S3/R2 |
| Bulk product actions | `products-bulk-table.tsx` | admin product | WORKING | Keep |
| Brands | `/brands` | `/admin/brands` | WORKING | Keep |
| Categories | `/categories` | Medusa categories | WORKING | Keep |
| Inventory | `/inventory` | `/admin/inventory` | WORKING | Keep; add stock ledger view |
| Stock movements | (only inside Purchasing) | `/admin/stock-movements` | PARTIAL | Surface under Inventory |
| Purchase orders / suppliers / GRN | `/purchasing` | `/admin/purchase-orders`, `/suppliers` | UNVERIFIED (0 POs), no nav | HIDE or wire + nav |
| Orders list | `/orders` | admin orders | WORKING | Redesign with queue |
| Order detail + actions | `/orders/[id]` | `/admin/orders/[id]/actions` | WORKING (code); prior screenshot showed failure surface | Fix error copy; consolidate workflow |
| Bespoke pipeline | order detail | order metadata + audit | PARTIAL | Keep; clearer stages |
| Payments | `/payments` | admin payments | WORKING (read-only) | Fold into Finance |
| Shipments | `/shipments` | `/admin/shipments` | WORKING (sandbox) | Keep |
| Returns | `/returns`, `/returns/[id]` | `/admin/returns`, `/return-requests` | WORKING | Keep; SLA column |
| Customers | `/customers`, `/customers/[id]` | admin customers + notes | WORKING | Keep |
| Promotions | `/promotions` | Medusa promotions | WORKING | Keep; usage rules |
| Content/CMS | `/content` | `/admin/cms` | WORKING | Keep |
| Reviews | `/reviews` | `/admin/reviews` | UNVERIFIED (0 rows), no nav | Add under Content |
| Support inbox | `/support` | `/admin/support/tickets` | UNVERIFIED (0 tickets) | Keep; test |
| Reports | `/reports` | dashboard + returns | PARTIAL | Add date range + GST |
| CSV exports | `/reports/export/*` | admin data | WORKING | Keep |
| GST export | `/reports/export/gst` | orders/payments | WORKING but only linked from Purchasing | Move link to Reports |
| Settings / staff | `/settings` | users + invites | PARTIAL | Keep; add MFA |
| Audit log | `/audit` | `/admin/audit` | WORKING (299 events) | Keep |
| Global search / command bar | — | — | MISSING | Add |
| Role-based nav groups | — | RBAC backend exists | PARTIAL (flat nav) | Redesign |

## 4. Backend platform

| Capability | Status | Evidence |
|---|---|---|
| Medusa REST + admin API | WORKING | running, health OK |
| Custom THL module (32 models) | WORKING | 12 migrations, queries succeed |
| RBAC | WORKING | middleware + 17 tests |
| Payment idempotency | WORKING | `payment_operation` |
| Refund idempotency | WORKING | `refund_operation`, tests |
| GST + credit notes | WORKING | 144-line GST lib, 2 credit notes |
| Returns eligibility/restock | WORKING | 8 tests + integration tests |
| Shiprocket client/webhook | PARTIAL | sandbox only |
| Razorpay provider | PARTIAL | sandbox emulator, keys missing |
| Email/SMS/WhatsApp | PARTIAL | no keys, dev echo |
| Uploads | PARTIAL | local storage |
| Rate limiting | WORKING | auth + write limits |
| Env guard | WORKING | prod/staging rules |
| Scheduled daily report | WORKING (code) | `jobs/emailed-reports.ts`, needs `REPORTS_EMAIL` + key |
| Webhook dedupe | WORKING | `webhook_event` (17 rows) |
| Monitoring / tracing | MISSING | none |
| Backups | PARTIAL | scripts exist, no schedule |
| E2E test suite | MISSING | none |
