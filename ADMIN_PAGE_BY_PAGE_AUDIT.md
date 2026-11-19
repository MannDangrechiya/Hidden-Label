# THE HIDDEN LABEL — ADMIN PAGE-BY-PAGE AUDIT
**Detailed Technical & Functional Audit of all 30 Administrative Console Pages**

---

## 1. Admin Pages Register

Every administrative route in `apps/admin/app` was evaluated across operational role access, data hydration, state management, table actions, mutations, and API connectivity.

---

## 2. Page-by-Page Audit Details

### Page 1: Admin Overview Dashboard (`/(dashboard)`)
- **File:** `apps/admin/app/(dashboard)/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Support, Operations, Manager, Owner (Readonly blocked).
- **APIs Called:** `GET /admin/dashboard/summary`.
- **UI Elements:** Gross Revenue KPI card, Orders Count KPI card, Active Shipments card, Pending Returns card, Recent Orders table.
- **States Handled:** Zero-data fallback cards; loading skeleton on page transition.
- **Status:** **A. VERIFIED WORKING**

### Page 2: Orders Ledger (`/(dashboard)/orders`)
- **File:** `apps/admin/app/(dashboard)/orders/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Support, Operations, Manager, Owner.
- **APIs Called:** `GET /admin/orders`.
- **UI Elements:** Paginated order table, status filter tabs (All, Pending, Completed, Canceled), customer search input, fulfillment badges.
- **Status:** **A. VERIFIED WORKING**

### Page 3: Order Detail & Actions (`/(dashboard)/orders/:id`)
- **File:** `apps/admin/app/(dashboard)/orders/[id]/page.tsx`
- **Render Mode:** SSR with client action buttons.
- **RBAC Role Access:** Operations, Manager, Owner (Support is read-only).
- **APIs Called:** `GET /admin/orders/:id`, `POST /admin/orders/:id/actions`.
- **UI Elements:** Line item breakdown, delivery address card, payment status, "Fulfill Items" modal, "Cancel Order" prompt, "Capture Payment" trigger.
- **Status:** **A. VERIFIED WORKING**

### Page 4: Shipments Management (`/(dashboard)/shipments`)
- **File:** `apps/admin/app/(dashboard)/shipments/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET /admin/shipments`.
- **UI Elements:** Shipment table, AWB search, carrier filter (Shiprocket vs Manual), status badges (Created, In Transit, Delivered, RTO).
- **Status:** **A. VERIFIED WORKING**

### Page 5: Shipment Detail & Tracking (`/(dashboard)/shipments/:id`)
- **File:** `apps/admin/app/(dashboard)/shipments/[id]/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET /admin/shipments/:id`, `PUT /admin/shipments/:id`.
- **UI Elements:** Carrier event timeline, manual status override dropdown, AWB editor, shipping label viewer.
- **Status:** **A. VERIFIED WORKING**

### Page 6: Returns & RMA Ledger (`/(dashboard)/returns`)
- **File:** `apps/admin/app/(dashboard)/returns/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET /admin/returns`.
- **UI Elements:** RMA ledger table, status filters (Requested, Approved, Rejected, Received), customer return notes.
- **Status:** **A. VERIFIED WORKING**

### Page 7: Return Detail & Review (`/(dashboard)/returns/:id`)
- **File:** `apps/admin/app/(dashboard)/returns/[id]/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET /admin/returns/:id`, `POST /admin/returns/:id`.
- **UI Elements:** Returned items checklist, customer reason, "Approve Return" button, "Reject Return" prompt with reason note.
- **Status:** **A. VERIFIED WORKING**

### Page 8: Product Catalog (`/(dashboard)/products`)
- **File:** `apps/admin/app/(dashboard)/products/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET /admin/products`.
- **UI Elements:** Product catalog table, thumbnail previews, variant counts, stock health indicators, "New Product" button.
- **Status:** **A. VERIFIED WORKING**

### Page 9: Create Product (`/(dashboard)/products/new`)
- **File:** `apps/admin/app/(dashboard)/products/new/page.tsx`
- **Render Mode:** Client form.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `POST /admin/products`, `GET /admin/product-categories`.
- **UI Elements:** Product title, handle, description, category selector, base price in INR, variant generator.
- **Status:** **A. VERIFIED WORKING**

### Page 10: Edit Product (`/(dashboard)/products/:id`)
- **File:** `apps/admin/app/(dashboard)/products/[id]/page.tsx`
- **Render Mode:** Client form.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `GET/PUT/DELETE /admin/products/:id`.
- **UI Elements:** Variant price overrides, status toggles (Draft vs Published), delete product confirmation.
- **Status:** **A. VERIFIED WORKING**

### Page 11: Inventory Matrix (`/(dashboard)/inventory`)
- **File:** `apps/admin/app/(dashboard)/inventory/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET /admin/inventory`, `POST /admin/inventory-items/:id/location-levels`.
- **UI Elements:** SKU inventory levels, location breakdown (Ahmedabad central warehouse), inline stock quantity adjustment inputs.
- **Status:** **A. VERIFIED WORKING**

### Page 12: Promotions Directory (`/(dashboard)/promotions`)
- **File:** `apps/admin/app/(dashboard)/promotions/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `GET /admin/promotions`.
- **UI Elements:** Active promo codes table, discount type (percentage vs fixed), usage counters, expiration dates, "New Promotion" CTA.
- **Status:** **A. VERIFIED WORKING**

### Page 13: Create Promotion (`/(dashboard)/promotions/new`)
- **File:** `apps/admin/app/(dashboard)/promotions/new/page.tsx`
- **Render Mode:** Client form.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `POST /admin/promotions`.
- **UI Elements:** Promo code input, value in INR or %, usage limit input, start and end datetime pickers.
- **Status:** **A. VERIFIED WORKING**

### Page 14: Edit Promotion (`/(dashboard)/promotions/:id`)
- **File:** `apps/admin/app/(dashboard)/promotions/[id]/page.tsx`
- **Render Mode:** Client form.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `GET/PUT/DELETE /admin/promotions/:id`.
- **UI Elements:** Promotion status toggle, usage limit editor, delete promo button.
- **Status:** **A. VERIFIED WORKING**

### Page 15: Customer Directory (`/(dashboard)/customers`)
- **File:** `apps/admin/app/(dashboard)/customers/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Support, Operations, Manager, Owner.
- **APIs Called:** `GET /admin/customers`.
- **UI Elements:** Customer directory table, registration timestamps, order counts, customer search.
- **Status:** **A. VERIFIED WORKING**

### Page 16: Customer Profile Detail (`/(dashboard)/customers/:id`)
- **File:** `apps/admin/app/(dashboard)/customers/[id]/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Support, Operations, Manager, Owner.
- **APIs Called:** `GET /admin/customers/:id`.
- **UI Elements:** Customer details card, saved addresses, complete order history with fulfillment status.
- **Status:** **A. VERIFIED WORKING**

### Page 17: Condition Inspections (`/(dashboard)/inspections`)
- **File:** `apps/admin/app/(dashboard)/inspections/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET /admin/inspections`, `POST /admin/inspections`.
- **UI Elements:** Serialized units ledger (`UNIT-THL-XXXXX`), grade badges, new inspection creation drawer.
- **Status:** **A. VERIFIED WORKING**

### Page 18: Silhouette Fit Rules (`/(dashboard)/fit-rules`)
- **File:** `apps/admin/app/(dashboard)/fit-rules/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Operations, Manager, Owner.
- **APIs Called:** `GET/POST/DELETE /admin/fit-rules`.
- **UI Elements:** Fit rules matrix (Brand, Category, Silhouette, Min/Max Chest & Waist bounds), new rule drawer, soft-delete trigger.
- **Status:** **A. VERIFIED WORKING**

### Page 19: Resale & Consignment Monitor (`/(dashboard)/resale`)
- **File:** `apps/admin/app/(dashboard)/resale/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Support, Operations, Manager, Owner.
- **APIs Called:** `GET /admin/resale/asks`, `GET /admin/resale/bids`.
- **UI Elements:** Live marketplace orderbook: active asks and bids across products and sizes, administrative cancel/delist actions.
- **Status:** **A. VERIFIED WORKING**

### Page 20: Content Management (`/(dashboard)/content`)
- **File:** `apps/admin/app/(dashboard)/content/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `GET /admin/cms`.
- **UI Elements:** CMS pages list (policies, FAQs, guides), published status badges, "New Page" button.
- **Status:** **A. VERIFIED WORKING**

### Page 21: Create CMS Page (`/(dashboard)/content/new`)
- **File:** `apps/admin/app/(dashboard)/content/new/page.tsx`
- **Render Mode:** Client form.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `POST /admin/cms`.
- **UI Elements:** Title, Slug, Kind (policy/page/faq), Markdown body editor, SEO title and description.
- **Status:** **A. VERIFIED WORKING**

### Page 22: Edit CMS Page (`/(dashboard)/content/:id`)
- **File:** `apps/admin/app/(dashboard)/content/[id]/page.tsx`
- **Render Mode:** Client form.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `GET/PUT/DELETE /admin/cms/:id`.
- **UI Elements:** Markdown editor, publish/unpublish toggle, delete page button.
- **Status:** **A. VERIFIED WORKING**

### Page 23: Category Hierarchy (`/(dashboard)/categories`)
- **File:** `apps/admin/app/(dashboard)/categories/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `GET/POST /admin/product-categories`.
- **UI Elements:** Category taxonomy tree, parent/child assignment, category creation drawer.
- **Status:** **A. VERIFIED WORKING**

### Page 24: Payment Transaction Monitor (`/(dashboard)/payments`)
- **File:** `apps/admin/app/(dashboard)/payments/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Manager, Owner (Financial visibility).
- **APIs Called:** `GET /admin/payments`.
- **UI Elements:** Payment collections list, provider identifiers (`pp_system_default`), amounts, capture statuses.
- **Status:** **A. VERIFIED WORKING**

### Page 25: Financial & Inventory Reports (`/(dashboard)/reports`)
- **File:** `apps/admin/app/(dashboard)/reports/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** Direct download links to `/reports/export/orders` and `/reports/export/products`.
- **UI Elements:** Export cards with date range selectors and "Export Orders CSV" / "Export Products CSV" buttons.
- **Status:** **A. VERIFIED WORKING**

### Page 26: Brand Management (`/(dashboard)/brands`)
- **File:** `apps/admin/app/(dashboard)/brands/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Manager, Owner.
- **APIs Called:** `GET/POST /admin/brands`.
- **UI Elements:** Brand catalog, tier assignment (Flagship, Partner, Core), country, active toggle.
- **Status:** **A. VERIFIED WORKING**

### Page 27: System Audit Trail (`/(dashboard)/audit`)
- **File:** `apps/admin/app/(dashboard)/audit/page.tsx`
- **Render Mode:** SSR.
- **RBAC Role Access:** Owner strictly.
- **APIs Called:** `GET /admin/audit`.
- **UI Elements:** Audit log table displaying staff login events, role modification events, and sensitive data accesses.
- **Status:** **A. VERIFIED WORKING**

### Page 28: Settings & Staff Management (`/(dashboard)/settings`)
- **File:** `apps/admin/app/(dashboard)/settings/page.tsx`
- **Render Mode:** SSR with client actions.
- **RBAC Role Access:** Owner strictly.
- **APIs Called:** `GET /admin/users`, `POST /admin/invites`, `POST /admin/users/:id`.
- **UI Elements:** Staff members table, role selector dropdowns, "Invite Staff" modal.
- **Defects & Security Findings:**
  - **SEC-CRIT-01:** Any authenticated staff user can bypass the Owner barrier by issuing `POST /admin/users/me` with `{"metadata": {"role": "owner"}}`.
- **Status:** **C. IMPLEMENTED BUT BROKEN / CRITICALLY VULNERABLE**

### Page 29: Staff Login (`/login`)
- **File:** `apps/admin/app/login/page.tsx`
- **Render Mode:** Client form.
- **APIs Called:** `POST /auth/user/emailpass`.
- **UI Elements:** Staff email and password form, sign-in button.
- **Validation:** Enforces email and password format; sets `thl_admin_token` cookie.
- **Status:** **A. VERIFIED WORKING**

### Page 30: Admin Component Gallery (`/design`)
- **File:** `apps/admin/app/design/page.tsx`
- **Render Mode:** Static UI testbed.
- **UI Elements:** Buttons, tables, modals, input elements.
- **Status:** **A. VERIFIED WORKING**
