# THE HIDDEN LABEL — COMPLETE FEATURE INVENTORY
**Comprehensive Technical & Architectural Asset Register**

---

## 1. Applications & Packages Structure

The repository is organized as a pnpm monorepo consisting of 3 applications and 3 packages:

| Workspace Member | Location | Technology Stack | Runtime Port / Target | Operational Purpose |
|---|---|---|---|---|
| `@thl/backend` | `apps/backend` | Medusa 2.22.7, Node 22, TypeScript 5.9, Knex, Mikro-ORM | `:9000` (HTTP) | Central commerce engine, custom modules, authentication, and database orchestration. |
| `@thl/storefront` | `apps/storefront` | Next.js 16.4.6 (App Router), React 19, Tailwind CSS 4 | `:3000` (HTTP) | Customer-facing omnichannel luxury boutique, fit studio, checkout, and customer portal. |
| `@thl/admin` | `apps/admin` | Next.js 16.4.6 (App Router), React 19, Tailwind CSS 4 | `:7001` (HTTP) | Internal management console for merchandising, fulfillment, returns, and RBAC governance. |
| `@thl/shared` | `packages/shared` | TypeScript, Zod, Vitest | Bundled npm package | Shared validation schemas, INR currency formatting (`formatINR`), and shared domain types. |
| `@thl/ui` | `packages/ui` | React 19, Tailwind CSS 4, Radix primitives | Bundled npm package | Shared design tokens, buttons, inputs, modals, and design system components. |
| `@thl/config` | `packages/config` | ESLint 9 (Flat Config), Prettier | Lint configuration | Shared linting rules and code style standards. |

---

## 2. Complete Database Table Inventory

The PostgreSQL 18.6 database (`the_hidden_label`) hosts **168 total tables** (151 Medusa Core tables + 17 THL custom tables).

### 2.1. Project-Owned Custom Tables (`src/modules/thl`)

| Table Name | Entity Identifier Prefix | Migration File | Columns & Types | Key Constraints & Foreign Keys | Functional Purpose |
|---|---|---|---|---|---|
| `brand` | `brd_` | `Migration20261114090000.ts` | id, name, handle, tagline, description, tier, country, sort_order, is_active, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (handle) | Brand management across Flagship, Partner, and Core tiers. |
| `cms_page` | `cms_` | `Migration20261114090000.ts` | id, slug, kind, title, body_md, blocks, is_published, published_at, seo_title, seo_description, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (slug) | CMS pages, legal policies (privacy, terms, shipping, returns), and FAQs. |
| `banner_slot` | `bnr_` | `Migration20261114090000.ts` | id, slot_id, title, subtitle, image_url, link_url, cta_label, sort_order, is_active, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (slot_id) | Editorial homepage merchandising banners and carousel slots. |
| `wishlist_item` | `wsh_` | `Migration20261114090000.ts` | id, customer_id, product_id, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (customer_id, product_id) | Customer saved items and personal wishlists. |
| `otp_challenge` | `otp_` | `Migration20261114090000.ts` | id, purpose, channel, destination, code_hash, attempts, max_attempts, expires_at, consumed_at, ip, metadata, created_at, updated_at | PRIMARY KEY (id), INDEX (destination, purpose) | Hashed single-use OTP codes for phone verification and password resets. |
| `shipment` | `shp_` | `Migration20261114093000.ts` | id, order_id, provider, provider_shipment_id, awb, courier, status, label_url, note, shipped_at, delivered_at, last_synced_at, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (order_id), INDEX (awb) | Carrier tracking record (Shiprocket or manual dispatch). |
| `shipment_event` | `shpe_` | `Migration20261114093000.ts` | id, shipment_id, event_key, status, occurred_at, payload, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (shipment_id, event_key) | Immutable append-only audit trail of carrier milestones. |
| `return_request` | `ret_` | `Migration20261114092000.ts` | id, order_id, customer_id, reason_code, note, status, approved_at, rejected_at, metadata, created_at, updated_at | PRIMARY KEY (id), INDEX (order_id), INDEX (customer_id) | Customer self-service RMA lifecycle and review state. |
| `return_item` | `reti_` | `Migration20261114092000.ts` | id, return_request_id, order_item_id, quantity, metadata, created_at, updated_at | PRIMARY KEY (id), FOREIGN KEY (return_request_id) REFERENCES return_request(id) ON DELETE CASCADE | Specific order line items and quantities requested for return. |
| `resale_ask` | `ask_` | `Migration20261114100000.ts` | id, product_handle, size, seller_id, ask_price, status, unit_serial, metadata, created_at, updated_at | PRIMARY KEY (id), INDEX (product_handle, size, status) | Consignor listings for resale sneakers and luxury apparel. |
| `resale_bid` | `bid_` | `Migration20261114100000.ts` | id, product_handle, size, buyer_id, bid_price, status, metadata, created_at, updated_at | PRIMARY KEY (id), INDEX (product_handle, size, status) | Buyer offers on resale catalogue items. |
| `price_history_point`| `php_` | `Migration20261114100000.ts` | id, product_handle, size, price, event_type, occurred_at, metadata, created_at, updated_at | PRIMARY KEY (id), INDEX (product_handle, size, occurred_at) | Market trend price points for StockX-style trade graphs. |
| `condition_inspection`| `ins_`| `Migration20261114100000.ts` | id, unit_serial, product_handle, size, grade, defects, photos, inspector_id, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (unit_serial) | Physical authentication records for serialized units (`UNIT-THL-XXXXX`). |
| `customer_fit_profile`| `fitp_`| `Migration20261114100000.ts` | id, customer_id, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, preferred_fit, metadata, created_at, updated_at | PRIMARY KEY (id), UNIQUE (customer_id) | Customer body measurements and ease preferences. |
| `silhouette_fit_rule` | `fitr_`| `Migration20261114100000.ts` | id, brand_handle, category, silhouette, size, min_chest, max_chest, min_waist, max_waist, guidance, metadata, deleted_at, created_at, updated_at | PRIMARY KEY (id), INDEX (brand_handle, category, size) | Sizing translation rules mapping measurements to garments. |
| `concierge_thread` | `thrd_`| `Migration20261114100000.ts` | id, customer_id, title, status, metadata, created_at, updated_at | PRIMARY KEY (id), INDEX (customer_id) | Style concierge conversational sessions. |
| `concierge_message`| `cmsg_`| `Migration20261114100000.ts` | id, thread_id, role, content, metadata, created_at, updated_at | PRIMARY KEY (id), FOREIGN KEY (thread_id) REFERENCES concierge_thread(id) ON DELETE CASCADE | Individual chat dialogue exchanges between user and concierge. |

### 2.2. Medusa Core Commerce Tables (Key Subsets)
- **Orders & Fulfilment:** `order`, `order_item`, `order_line_item`, `order_address`, `fulfillment`, `order_fulfillment`.
- **Carts & Payments:** `cart`, `cart_line_item`, `payment_collection`, `cart_payment_collection`, `payment_session`, `payment`.
- **Catalog & Inventory:** `product`, `product_variant`, `product_category`, `inventory_item`, `inventory_level`, `reservation_item`.
- **Taxation (Empty in DB):** `tax_region` (0 rows), `tax_rate` (0 rows), `tax_rate_rule` (0 rows), `order_line_item_tax_line` (0 rows), `cart_line_item_tax_line` (0 rows).
- **Identity & RBAC:** `customer`, `user` (Staff), `invite`, `auth_identity`.

---

## 3. Backend API Route Discovery & Inventory

### 3.1. Storefront API Routes (`/store/*`)

| Route Path | Method | File Path | Auth Requirement | DB Tables Touched | External Client | Status |
|---|---|---|---|---|---|---|
| `/store/content/home` | GET | `src/api/store/content/home/route.ts` | None | `banner_slot`, `brand`, `product` | None | **VERIFIED WORKING** |
| `/store/brands` | GET | `src/api/store/brands/route.ts` | None | `brand` | None | **VERIFIED WORKING** |
| `/store/brands/:handle` | GET | `src/api/store/brands/[handle]/route.ts` | None | `brand`, `product` | None | **VERIFIED WORKING** |
| `/store/catalog/stock` | GET | `src/api/store/catalog/stock/route.ts` | None | `inventory_level` | None | **VERIFIED WORKING** |
| `/store/search/suggest` | GET | `src/api/store/search/suggest/route.ts` | None | `product`, `brand` | None | **VERIFIED WORKING** |
| `/store/sight-search` | POST | `src/api/store/sight-search/route.ts` | None | `product` | Gemini AI | **WORKING WITH LIMITATIONS** (AI fallback) |
| `/store/cms/:slug` | GET | `src/api/store/cms/[slug]/route.ts` | None | `cms_page` | None | **VERIFIED WORKING** |
| `/store/cms/policies/:slug` | GET | `src/api/store/cms/policies/[slug]/route.ts` | None | `cms_page` | None | **VERIFIED WORKING** |
| `/store/otp/send` | POST | `src/api/store/otp/send/route.ts` | Rate-limited | `otp_challenge` | Resend (email) / None (SMS) | **WORKING WITH LIMITATIONS** (No SMS gateway) |
| `/store/otp/verify` | POST | `src/api/store/otp/verify/route.ts` | None | `otp_challenge` | None | **VERIFIED WORKING** |
| `/store/wishlist` | GET, POST, DELETE | `src/api/store/wishlist/route.ts` | Bearer/Session Customer | `wishlist_item` | None | **VERIFIED WORKING** |
| `/store/orders/:id/cancel` | POST | `src/api/store/orders/[id]/cancel/route.ts` | Bearer/Session Customer | `order` | None | **VERIFIED WORKING** |
| `/store/orders/:id/shipment` | GET | `src/api/store/orders/[id]/shipment/route.ts` | None | `shipment`, `shipment_event` | None | **VERIFIED WORKING** |
| `/store/return-requests` | GET, POST | `src/api/store/return-requests/route.ts` | Bearer/Session Customer | `return_request`, `return_item`, `order` | Resend (email) | **VERIFIED WORKING** |
| `/store/resale/asks` | GET, POST | `src/api/store/resale/asks/route.ts` | Customer (POST) | `resale_ask` | None | **VERIFIED WORKING** |
| `/store/resale/asks/:id` | DELETE | `src/api/store/resale/asks/[id]/route.ts` | Customer | `resale_ask` | None | **VERIFIED WORKING** |
| `/store/resale/bids` | GET, POST | `src/api/store/resale/bids/route.ts` | Customer (POST) | `resale_bid` | None | **VERIFIED WORKING** |
| `/store/resale/bids/:id` | DELETE | `src/api/store/resale/bids/[id]/route.ts` | Customer | `resale_bid` | None | **VERIFIED WORKING** |
| `/store/resale/products/:handle/index` | GET | `src/api/store/resale/products/[handle]/index/route.ts` | None | `resale_ask`, `resale_bid`, `price_history_point` | None | **VERIFIED WORKING** |
| `/store/resale/recent-activity` | GET | `src/api/store/resale/recent-activity/route.ts` | None | `price_history_point` | None | **VERIFIED WORKING** |
| `/store/inspections/:unit_serial` | GET | `src/api/store/inspections/[unit_serial]/route.ts` | None | `condition_inspection` | None | **VERIFIED WORKING** |
| `/store/fit/profile` | GET, POST | `src/api/store/fit/profile/route.ts` | Bearer/Session Customer | `customer_fit_profile` | None | **VERIFIED WORKING** |
| `/store/fit/recommend` | POST | `src/api/store/fit/recommend/route.ts` | None | `silhouette_fit_rule` | None | **VERIFIED WORKING** |
| `/store/concierge/chat` | POST | `src/api/store/concierge/chat/route.ts` | None | `concierge_thread`, `concierge_message` | Gemini AI | **WORKING WITH LIMITATIONS** (AI fallback) |

### 3.2. Admin API Routes (`/admin/*`)

| Route Path | Method | File Path | Auth Requirement | DB Tables Touched | External Client | Status |
|---|---|---|---|---|---|---|
| `/admin/dashboard/summary` | GET | `src/api/admin/dashboard/summary/route.ts` | Support, Manager, Owner | `order`, `customer`, `shipment` | None | **VERIFIED WORKING** |
| `/admin/brands` | GET, POST | `src/api/admin/brands/route.ts` | Manager, Owner | `brand` | None | **VERIFIED WORKING** |
| `/admin/brands/:id` | PUT, DELETE | `src/api/admin/brands/[id]/route.ts` | Manager, Owner | `brand` | None | **VERIFIED WORKING** |
| `/admin/cms` | GET, POST | `src/api/admin/cms/route.ts` | Manager, Owner | `cms_page` | None | **VERIFIED WORKING** |
| `/admin/cms/:id` | PUT, DELETE | `src/api/admin/cms/[id]/route.ts` | Manager, Owner | `cms_page` | None | **VERIFIED WORKING** |
| `/admin/inventory` | GET | `src/api/admin/inventory/route.ts` | Operations, Manager, Owner | `inventory_item`, `inventory_level` | None | **VERIFIED WORKING** |
| `/admin/orders/:id/actions` | POST | `src/api/admin/orders/[id]/actions/route.ts` | Operations, Manager, Owner | `order`, `fulfillment` | None | **VERIFIED WORKING** |
| `/admin/shipments` | GET, POST | `src/api/admin/shipments/route.ts` | Operations, Manager, Owner | `shipment`, `shipment_event` | Shiprocket / Manual | **WORKING WITH LIMITATIONS** (Shiprocket unconfigured) |
| `/admin/shipments/:id` | PUT | `src/api/admin/shipments/[id]/route.ts` | Operations, Manager, Owner | `shipment`, `shipment_event` | None | **VERIFIED WORKING** |
| `/admin/return-requests/:id` | POST | `src/api/admin/return-requests/[id]/route.ts` | Operations, Manager, Owner | `return_request` | None | **VERIFIED WORKING** |
| `/admin/returns` | GET | `src/api/admin/returns/route.ts` | Operations, Manager, Owner | `return_request` | None | **VERIFIED WORKING** |
| `/admin/returns/:id` | POST | `src/api/admin/returns/[id]/route.ts` | Operations, Manager, Owner | `return_request` | None | **VERIFIED WORKING** |
| `/admin/resale/asks` | GET | `src/api/admin/resale/asks/route.ts` | Support, Manager, Owner | `resale_ask` | None | **VERIFIED WORKING** |
| `/admin/resale/bids` | GET | `src/api/admin/resale/bids/route.ts` | Support, Manager, Owner | `resale_bid` | None | **VERIFIED WORKING** |
| `/admin/inspections` | GET, POST | `src/api/admin/inspections/route.ts` | Operations, Manager, Owner | `condition_inspection` | None | **VERIFIED WORKING** |
| `/admin/inspections/:id` | PUT | `src/api/admin/inspections/[id]/route.ts` | Operations, Manager, Owner | `condition_inspection` | None | **VERIFIED WORKING** |
| `/admin/fit-rules` | GET, POST | `src/api/admin/fit-rules/route.ts` | Operations, Manager, Owner | `silhouette_fit_rule` | None | **VERIFIED WORKING** |
| `/admin/fit-rules/:id` | PUT, DELETE | `src/api/admin/fit-rules/[id]/route.ts` | Operations, Manager, Owner | `silhouette_fit_rule` | None | **VERIFIED WORKING** |
| `/admin/audit` | GET | `src/api/admin/audit/route.ts` | Owner | `user`, `order` | None | **VERIFIED WORKING** |

### 3.3. Webhooks & Subscribers

| Endpoint / File | Trigger Mechanism | Target Operations | Security & Verification | Status |
|---|---|---|---|---|
| `/webhooks/shiprocket` (`src/api/webhooks/shiprocket/route.ts`) | POST from Shiprocket servers on tracking change | Updates `shipment` row and appends to `shipment_event` | `SHIPROCKET_WEBHOOK_TOKEN` header/query string check | **WORKING WITH LIMITATIONS** (Does not notify customer or update Medusa order) |
| `src/subscribers/auth-password-reset.ts` | Medusa Event Bus (`auth.password_reset`) | Dispatches reset token via `sendEmail()` | Internal Medusa event bus dispatch | **VERIFIED WORKING** (Subject to Resend config) |

---

## 4. Frontend Routes & Interactive Component Inventory

### 4.1. Storefront Routes (`apps/storefront/app`)

| Route | Page File | Core Interactive Components | Forms & Validation | Data Source | Connected Status |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | Hero banner, Curated drops, Brand lookbook carousel | Newsletter form | `GET /store/content/home`, `GET /store/products` | **VERIFIED WORKING** |
| `/collections/all` | `app/collections/all/page.tsx` | Product grid, Faceted filter drawer, Sort dropdown | Filter query params | `GET /store/products` | **VERIFIED WORKING** |
| `/collections/:handle`| `app/collections/[handle]/page.tsx` | Collection grid, Breadcrumbs, Category header | Filter query params | `GET /store/products?category_id=...` | **VERIFIED WORKING** |
| `/products/:handle` | `app/products/[handle]/page.tsx` | Gallery lightbox, Variant pill selector, Bag trigger, Fit Studio modal, Quick View | Add to Bag action | `GET /store/products?handle=...`, `GET /store/catalog/stock` | **VERIFIED WORKING** |
| `/cart` | `app/cart/page.tsx` | Cart line item table, Quantity adjuster, Promo code input, Checkout CTA | Promo redemption form | `GET /store/carts/:id`, `POST /store/carts/:id/promotions` | **VERIFIED WORKING** |
| `/checkout` | `app/checkout/page.tsx` | Multi-step progress tabs (Address, Shipping, Payment) | Address, Shipping forms | `GET /store/carts/:id` | **VERIFIED WORKING** |
| `/checkout/payment` | `app/checkout/payment/page.tsx` | Payment method radio cards, OTP modal, COD button | Payment selector, OTP form | `GET /store/carts/:id`, `GET /store/payment-collections` | **WORKING WITH LIMITATIONS** (Only COD operational; SEC-CRIT-02 bypass vulnerability) |
| `/checkout/confirmation/:id` | `app/checkout/confirmation/[id]/page.tsx` | Order summary card, Live tracker pill, Print invoice link | None | `GET /store/orders/:id` | **VERIFIED WORKING** |
| `/account` | `app/account/page.tsx` | Account dashboard, Overview stats, Profile summary | Profile update form | `GET /store/customers/me` | **VERIFIED WORKING** |
| `/account/orders` | `app/account/orders/page.tsx` | Order list cards, Status badges, Details links | None | `GET /store/orders?customer_id=...` | **VERIFIED WORKING** |
| `/account/orders/:id` | `app/account/orders/[id]/page.tsx` | Order timeline, Item details, Cancel CTA, Return CTA, Invoice CTA | Cancel order action | `GET /store/orders/:id`, `GET /store/orders/:id/shipment` | **VERIFIED WORKING** |
| `/account/orders/:id/invoice` | `app/account/orders/[id]/invoice/page.tsx` | Printable Tax Invoice layout, Print trigger | Print button | `GET /store/orders/:id` | **IMPLEMENTED BUT BROKEN / NON-COMPLIANT** (Dummy GSTIN, hardcoded HSN 6403, missing IGST) |
| `/account/orders/:id/return` | `app/account/orders/[id]/return/page.tsx` | Return item selector checkboxes, Reason dropdown, Notes | `returnRequestSchema` | `GET /store/orders/:id`, `POST /store/return-requests` | **VERIFIED WORKING** |
| `/account/orders/:id/cancel` | `app/account/orders/[id]/cancel/page.tsx` | Confirmation prompt, Reason selector | Cancellation action | `POST /store/orders/:id/cancel` | **VERIFIED WORKING** |
| `/account/returns` | `app/account/returns/page.tsx` | Customer RMA list, Tracking badge, Re-inspection status | None | `GET /store/return-requests` | **VERIFIED WORKING** |
| `/account/addresses` | `app/account/addresses/page.tsx` | Address cards, Add Address drawer, Delete action | `addressSchema` | `GET /store/customers/me`, `POST/DELETE /store/customers/me/addresses` | **VERIFIED WORKING** |
| `/account/wishlist` | `app/account/wishlist/page.tsx` | Wishlist grid, Remove button, Move to Bag button | None | `GET /store/wishlist`, `DELETE /store/wishlist` | **VERIFIED WORKING** |
| `/account/asks` | `app/account/asks/page.tsx` | Active and past consignor asks, Delist CTA | Delist action | `GET /store/resale/asks?seller_id=...` | **VERIFIED WORKING** |
| `/account/bids` | `app/account/bids/page.tsx` | Active buyer bids, Cancel bid CTA | Cancel action | `GET /store/resale/bids?buyer_id=...` | **VERIFIED WORKING** |
| `/brands` | `app/brands/page.tsx` | Brand index directory grouped by tier | None | `GET /store/brands` | **VERIFIED WORKING** |
| `/brands/:handle` | `app/brands/[handle]/page.tsx` | Brand banner, Storytelling bio, Brand catalogue grid | None | `GET /store/brands/:handle`, `GET /store/products` | **VERIFIED WORKING** |
| `/search` | `app/search/page.tsx` | Instant search input, Suggestion dropdown, Result cards | Search query params | `GET /store/search/suggest` | **VERIFIED WORKING** |
| `/sell` | `app/sell/page.tsx` | Consignment consignment landing, Ask placement modal | Ask creation form | `POST /store/resale/asks` | **VERIFIED WORKING** |
| `/fit-studio` | `app/fit-studio/page.tsx` | Measurement questionnaire, Silhouette selector | `customer_fit_profile` form | `GET/POST /store/fit/profile` | **VERIFIED WORKING** |
| `/inspection/:serial`| `app/inspection/[serial]/page.tsx` | Authentication certificate, Photo viewer, Grading score | None | `GET /store/inspections/:unit_serial` | **VERIFIED WORKING** |
| `/verify/:serial` | `app/verify/[serial]/page.tsx` | Serial lookup verification redirect | Serial input form | Redirects to `/inspection/:serial` | **VERIFIED WORKING** |
| `/login` | `app/login/page.tsx` | Customer email/password login card | `loginSchema` | `POST /auth/customer/emailpass` | **VERIFIED WORKING** |
| `/register` | `app/register/page.tsx` | Customer registration card with anti-enumeration | `registerSchema` | `POST /auth/customer/emailpass/register` | **VERIFIED WORKING** |
| `/forgot-password`| `app/forgot-password/page.tsx` | Password reset request card | `forgotPasswordSchema` | `POST /auth/customer/emailpass/reset-password` | **VERIFIED WORKING** |
| `/reset-password` | `app/reset-password/page.tsx` | New password creation card | `resetPasswordSchema` | `POST /auth/customer/emailpass/update` | **VERIFIED WORKING** |
| `/verify` | `app/verify/page.tsx` | OTP verification form | `otpVerifySchema` | `POST /store/otp/verify` | **VERIFIED WORKING** |
| `/policies/:slug` | `app/policies/[slug]/page.tsx` | Markdown legal policy viewer | None | `GET /store/cms/policies/:slug` | **VERIFIED WORKING** |
| `/support` | `app/support/page.tsx` | FAQ CMS page renderer | None | `GET /store/cms/support` | **WORKING WITH LIMITATIONS** (Static FAQ only; no contact form/tickets) |
| `/about` | `app/about/page.tsx` | Brand heritage and boutique story | None | `GET /store/cms/about` | **VERIFIED WORKING** |
| `/authenticity` | `app/authenticity/page.tsx` | Multi-point verification explanation | None | `GET /store/cms/authenticity` | **VERIFIED WORKING** |
| `/size-guide` | `app/size-guide/page.tsx` | Conversion charts (UK/US/EU/CM) | None | `GET /store/cms/size-guide` | **VERIFIED WORKING** |
| `/design` | `app/design/page.tsx` | Design token test gallery | None | Internal static tokens | **VERIFIED WORKING** |

### 4.2. Admin Console Routes (`apps/admin/app/(dashboard)/*`)

| Route | Page File | Operational Tools | Primary Actions | Backend APIs | Connected Status |
|---|---|---|---|---|---|
| `/` | `app/(dashboard)/page.tsx` | Revenue cards, Order velocity chart, Recent orders table | Quick navigation | `GET /admin/dashboard/summary` | **VERIFIED WORKING** |
| `/orders` | `app/(dashboard)/orders/page.tsx` | Order table, Status filters, Fulfillment badges | Filter, Search | `GET /admin/orders` | **VERIFIED WORKING** |
| `/orders/:id` | `app/(dashboard)/orders/[id]/page.tsx` | Line items, Delivery address, Payment capture, Fulfillment trigger | Mark Fulfilled, Capture Payment | `GET /admin/orders/:id`, `POST /admin/orders/:id/actions` | **VERIFIED WORKING** |
| `/shipments` | `app/(dashboard)/shipments/page.tsx` | Shipment ledger, Courier filters, AWB status | Search AWB | `GET /admin/shipments` | **VERIFIED WORKING** |
| `/shipments/:id` | `app/(dashboard)/shipments/[id]/page.tsx` | Courier tracking timeline, Status dropdown | Update Shipment Status | `GET /admin/shipments/:id`, `PUT /admin/shipments/:id` | **VERIFIED WORKING** |
| `/returns` | `app/(dashboard)/returns/page.tsx` | RMA ledger, Customer notes, Reason codes | Filter by status | `GET /admin/returns` | **VERIFIED WORKING** |
| `/returns/:id` | `app/(dashboard)/returns/[id]/page.tsx` | Return inspection details, Item photos | Approve Return, Reject Return | `GET /admin/returns/:id`, `POST /admin/returns/:id` | **VERIFIED WORKING** |
| `/products` | `app/(dashboard)/products/page.tsx` | Product catalog table, Stock indicators, Thumbnail | Search, New Product | `GET /admin/products` | **VERIFIED WORKING** |
| `/products/new` | `app/(dashboard)/products/new/page.tsx` | Product creation form (Title, Handle, Price, Category) | Create Product | `POST /admin/products` | **VERIFIED WORKING** |
| `/products/:id` | `app/(dashboard)/products/[id]/page.tsx` | Variant pricing, Description editor, Status toggle | Save Changes, Delete | `GET/PUT/DELETE /admin/products/:id` | **VERIFIED WORKING** |
| `/inventory` | `app/(dashboard)/inventory/page.tsx` | Stock level matrix across locations | Stock Adjustments | `GET /admin/inventory`, `POST /admin/inventory-items/:id/location-levels` | **VERIFIED WORKING** |
| `/promotions` | `app/(dashboard)/promotions/page.tsx` | Discount codes, Usage counts, Expiry dates | Search, New Promo | `GET /admin/promotions` | **VERIFIED WORKING** |
| `/promotions/new`| `app/(dashboard)/promotions/new/page.tsx` | Promo code builder (Percentage, Fixed, Code, Usage Limit) | Create Promo | `POST /admin/promotions` | **VERIFIED WORKING** |
| `/promotions/:id`| `app/(dashboard)/promotions/[id]/page.tsx` | Promotion status editor, Delete button | Update / Delete | `GET/PUT/DELETE /admin/promotions/:id` | **VERIFIED WORKING** |
| `/customers` | `app/(dashboard)/customers/page.tsx` | Registered customer directory, Order count | Search Customer | `GET /admin/customers` | **VERIFIED WORKING** |
| `/customers/:id` | `app/(dashboard)/customers/[id]/page.tsx` | Profile details, Saved addresses, Order history | View Customer | `GET /admin/customers/:id` | **VERIFIED WORKING** |
| `/inspections` | `app/(dashboard)/inspections/page.tsx` | Condition inspection ledger, Grade distribution | New Inspection | `GET /admin/inspections` | **VERIFIED WORKING** |
| `/fit-rules` | `app/(dashboard)/fit-rules/page.tsx` | Silhouette fit rules matrix (Brand, Category, Size bounds) | Add / Delete Rule | `GET/POST/DELETE /admin/fit-rules` | **VERIFIED WORKING** |
| `/resale` | `app/(dashboard)/resale/page.tsx` | Active asks and bids marketplace monitor | Delist Ask / Bid | `GET /admin/resale/asks`, `GET /admin/resale/bids` | **VERIFIED WORKING** |
| `/content` | `app/(dashboard)/content/page.tsx` | CMS page directory, Policy publisher | Edit Page, New Page | `GET /admin/cms` | **VERIFIED WORKING** |
| `/content/new` | `app/(dashboard)/content/new/page.tsx` | Markdown editor, Slug and SEO config | Publish Page | `POST /admin/cms` | **VERIFIED WORKING** |
| `/content/:id` | `app/(dashboard)/content/[id]/page.tsx` | Markdown page updater | Save / Delete Page | `GET/PUT/DELETE /admin/cms/:id` | **VERIFIED WORKING** |
| `/categories` | `app/(dashboard)/categories/page.tsx` | Category taxonomy tree | Create Category | `GET/POST /admin/product-categories` | **VERIFIED WORKING** |
| `/payments` | `app/(dashboard)/payments/page.tsx` | Payment transaction monitor | View Transactions | `GET /admin/payments` | **VERIFIED WORKING** |
| `/reports` | `app/(dashboard)/reports/page.tsx` | Export dashboard for Orders and Products CSV | Download CSV | `GET /admin/reports/export/orders`, `products` | **VERIFIED WORKING** |
| `/audit` | `app/(dashboard)/audit/page.tsx` | System audit trail (Staff logins, Role escalations) | View Logs | `GET /admin/audit` | **VERIFIED WORKING** |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Staff user manager, Role assigner | Invite Staff, Change Role | `GET/POST /admin/users` | **IMPLEMENTED BUT BROKEN** (SEC-CRIT-01 self-escalation bypass via `/admin/users/me`) |
| `/login` | `app/login/page.tsx` | Staff credentials login card | Staff Login | `POST /auth/user/emailpass` | **VERIFIED WORKING** |
| `/design` | `app/design/page.tsx` | Admin UI component gallery | None | Internal UI components | **VERIFIED WORKING** |

---

## 5. Master Implementation Status Classification

| Classification Code | Meaning | Total Features in Platform |
|---|---|---|
| **A** | Fully implemented and verified working | 52 |
| **B** | Implemented and working with limitations | 8 |
| **C** | Implemented but broken / Vulnerable | 3 |
| **D** | UI exists but backend integration is missing | 2 |
| **E** | Backend exists but frontend integration is missing | 2 |
| **F** | Mocked or hardcoded | 4 |
| **G** | Partially implemented | 3 |
| **H** | Not implemented | 6 |
| **I** | Cannot verify (third-party credentials absent) | 4 |
