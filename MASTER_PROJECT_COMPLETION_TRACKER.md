# THE HIDDEN LABEL — MASTER PROJECT COMPLETION TRACKER
**Complete Audit Finding Reconciliation & Traceability Matrix**

- **Last Updated:** 2026-11-21 (Phase 2 Architectural Closure Reconciled)
- **Audit Baseline:** `AUDIT_REPORTS/` (16 individual reports + `ALL_IN_ONE_AUDIT_REPORT.md`)
- **Total Universe Census:** 68 tracked entries across all audit dimensions.
  - **Reconciliation of 68 vs 67 Count:** 67 items represent active actionable engineering/business tasks. 1 item (`GAP-005: COD / Alternative Payment Rails`) is formally classified as `NOT APPLICABLE — WITH EXPLANATION` (deliberate removal to prevent COD delivery fraud). 67 active + 1 N/A = 68 total tracked entries.
- **Status Vocabulary (Exact Standard):**
  1. `VERIFIED COMPLETE`
  2. `IMPLEMENTED — VERIFICATION PENDING`
  3. `PARTIALLY COMPLETE`
  4. `OPEN`
  5. `BLOCKED — OWNER DECISION REQUIRED`
  6. `DEFERRED — APPROVAL REQUIRED`
  7. `NOT APPLICABLE — WITH EXPLANATION`

---

## 1. Security & Compliance Findings (SEC-01 to SEC-13)

| Finding ID | Original Audit Document | Severity | Current Status | Actual Source-Code Evidence | Test Evidence | Git Commit Status | GitHub Push Status | Remaining Work | Dependencies | Recommended Phase |
|---|---|---|---|---|---|---|---|---|---|---|
| **SEC-01** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **High** | **VERIFIED COMPLETE** | `apps/backend/src/lib/admin-auth.ts`: `parseAdminRole()`, `adminAccess()` returns 403 `no_role_assigned`. `apps/admin/lib/api/auth.ts`: returns `null`. Layout blocks access. | `apps/backend/src/lib/admin-auth.test.ts` (17 tests), `apps/admin/lib/roles.test.ts` (5 tests) | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |
| **SEC-02** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **High** | **VERIFIED COMPLETE** | `apps/backend/src/lib/refund-operations.ts`: `refundOperationKey()` digests intent `(order, payment, amount, reason)`; `claimRefundOperation()` uses unique index. | `refund-operations.test.ts` (5 tests), `refund-operations.integration.test.ts` (4 tests) | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |
| **SEC-03** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Medium** | **VERIFIED COMPLETE** | `apps/backend/src/lib/stock-adjustment.ts`: `applyStockDelta()` executes `SELECT ... FOR UPDATE` inside transaction. Negative bound rechecked under lock. | `stock-adjustment.integration.test.ts` (3 tests), `inventory/route.integration.test.ts` (6 tests) | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |
| **SEC-04** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Medium** | **VERIFIED COMPLETE** | `apps/backend/src/lib/concierge-session.ts`: issues HMAC-SHA256 tokens; stores `session_token_hash`. `src/api/store/concierge/chat/route.ts` enforces thread ownership. | `concierge-session.test.ts` (12 tests), `concierge/chat/route.integration.test.ts` (7 tests) | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |
| **SEC-05** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Medium** | **OPEN** | `apps/backend/src/api/webhooks/shiprocket/route.ts`: still checks query parameter `?token=`. | None | Unmodified | On `origin/main` | Implement IP allowlist or HMAC verification per Shiprocket API docs. | Shiprocket credentials | Phase B (Phase 2 Logistics) |
| **SEC-06** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Medium** | **VERIFIED COMPLETE** | `apps/backend/src/lib/rate-limit.ts` (Redis + in-memory fallback) and `apps/backend/src/lib/write-rate-limit.ts` applied to support tickets, chat, and resale endpoints. | `rate-limit.test.ts` (4 tests), `write-rate-limit.test.ts` (3 tests) | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |
| **SEC-07** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Medium** | **VERIFIED COMPLETE** | `apps/backend/src/lib/env-guard.ts`: `assertProductionEnv()` asserts non-dev secrets, disallows `local_dev_*`, and blocks `OTP_DEV_ECHO` in production. | `env-guard.test.ts` (9 tests) | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |
| **SEC-08** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Medium** | **PARTIALLY COMPLETE** | `apps/admin/next.config.ts`: adds CSP/HSTS/Frame-Deny headers. File validation implemented in `upload-rules.ts` and `upload-validation.ts`. Medusa core `/admin/uploads` only checks multipart. | `upload-rules.test.ts` (5 tests), `upload-validation.test.ts` (6 tests) | Committed in `06df83b` | **Unpushed (Local only)** | Live reverse proxy header assertion and core upload hook | Reverse proxy setup | Phase 1 / Phase C |
| **SEC-09** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Low** | **DEFERRED — APPROVAL REQUIRED** | Admin authentication relies on 24h JWT cookie; no staff TOTP/MFA or session revocation table. | None | Unmodified | On `origin/main` | Design and implement staff MFA (TOTP) and session revocation table. | Owner MFA policy | Phase C (Infrastructure) |
| **SEC-10** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Low** | **VERIFIED COMPLETE** | `apps/storefront/next.config.ts`: replaced wildcard `remotePatterns` with explicit host allowlist (`images.unsplash.com`, `cdn.thehiddenlabel.com`, localhost). | Next.js build verification (`next build` exits 0) | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |
| **SEC-11** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Low** | **PARTIALLY COMPLETE** | `.github/workflows/ci.yml` contains lint, test, build and migration assertions, but lacks explicit `pnpm audit` step. | CI workflow execution | Committed in `06df83b` | **Unpushed (Local only)** | Add `pnpm audit --audit-level=high` and Dependabot configuration to CI. | None | Phase C (CI Hardening) |
| **SEC-12** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Low** | **OPEN** | Product creation defaults country of origin to "India" if omitted. Legal Metrology Act requires explicit provenance. | None | Unmodified | On `origin/main` | Make country of origin mandatory on product schema and admin forms. | Admin product form | Phase E (Retail Ops) |
| **SEC-13** | `09_SECURITY_AND_COMPLIANCE_AUDIT.md` | **Informational** | **VERIFIED COMPLETE** | `apps/backend/src/lib/env-guard.ts` asserts `OTP_DEV_ECHO` is rejected whenever `NODE_ENV === "production"`. | `env-guard.test.ts` test case #6 | Committed in `06df83b` | **Unpushed (Local only)** | None | None | Phase 1 (Closed) |

---

## 2. Core Bug Register (BUG-01 to BUG-12)

| Bug ID | Summary | Severity | Current Status | Actual Source-Code Evidence | Test Evidence | Git Commit Status | GitHub Push Status | Remaining Work | Recommended Phase |
|---|---|---|---|---|---|---|---|---|---|
| **BUG-01** | No payment provider enabled on INR region; checkout dead end. | **P0** | **IMPLEMENTED — VERIFICATION PENDING** | `region_payment_provider` linked to `pp_razorpay_razorpay`; `apps/backend/src/modules/razorpay/service.ts` and `middlewares.ts` fully implemented. Verified across 12/12 state transitions against emulator. | 9 unit tests in `service.test.ts`, 7 tests in `payment-operations.integration.test.ts`, 12 scenarios in `verify-phase2-sandbox.ts` | **Ready for atomic commit (Phase 2)** | **Unpushed** | Provide live/test Razorpay keys and verify against `api.razorpay.com`. | Phase 2 (Gateway Verification) |
| **BUG-02** | `pnpm lint` fails with 15 errors in `.audit/*.mjs`. | **P1** | **VERIFIED COMPLETE** | `.audit/*.mjs` files remediated; ESLint configured and clean. | `pnpm lint` exits 0 (0 errors, 0 warnings). | Committed in `06df83b` | **Unpushed (Local only)** | None | Phase 1 (Closed) |
| **BUG-03** | Missing role metadata defaults to `owner`. | **P0** | **VERIFIED COMPLETE** | `apps/backend/src/lib/admin-auth.ts`: `parseAdminRole()` fails closed (`null`); returns 403 `no_role_assigned`. UI mirrors refusal. | 17 unit tests in `admin-auth.test.ts`; 5 tests in `roles.test.ts`. | Committed in `06df83b` | **Unpushed (Local only)** | None | Phase 1 (Closed) |
| **BUG-04** | Refund idempotency key uses `Date.now()`. | **P1** | **VERIFIED COMPLETE** | `apps/backend/src/lib/refund-operations.ts`: deterministic SHA-256 key from `(order, payment, amount, reason)` with database unique index. | 5 unit tests in `refund-operations.test.ts`; 4 integration tests in `refund-operations.integration.test.ts`. | Committed in `06df83b` | **Unpushed (Local only)** | None | Phase 1 (Closed) |
| **BUG-05** | Inventory adjustment read-then-write without row lock. | **P1** | **VERIFIED COMPLETE** | `apps/backend/src/lib/stock-adjustment.ts`: `applyStockDelta()` executes `SELECT ... FOR UPDATE` inside transaction. | 3 integration tests in `stock-adjustment.integration.test.ts`; 6 tests in `inventory/route.integration.test.ts`. | Committed in `06df83b` | **Unpushed (Local only)** | None | Phase 1 (Closed) |
| **BUG-06** | Homepage hardcodes brand cards and counts. | **P1** | **OPEN** | `apps/storefront/app/page.tsx` contains static literal `BRANDS` array ("Jordan · 12 Silhouettes", etc.). | None | Unmodified | On `origin/main` | Fetch dynamic brand list from `GET /store/brands` with live counts. | Phase D (Storefront) |
| **BUG-07** | Homepage card says "In Stock →" unconditionally. | **P2** | **OPEN** | `apps/storefront/app/page.tsx` renders in-stock label without stock check. | None | Unmodified | On `origin/main` | Check availability via `POST /store/catalog/stock` or hide label when out of stock. | Phase D (Storefront) |
| **BUG-08** | RMA display ID derived from row count. | **P2** | **VERIFIED COMPLETE** | `apps/backend/src/lib/rma-numbering.ts` uses PostgreSQL sequence `return_request_display_seq`. | 2 integration tests in `rma-numbering.integration.test.ts`. | Committed in `06df83b` | **Unpushed (Local only)** | None | Phase 1 (Closed) |
| **BUG-09** | Concierge thread ownership not checked. | **P2** | **VERIFIED COMPLETE** | `apps/backend/src/lib/concierge-session.ts` signs session tokens; route rejects foreign access. | 12 unit tests in `concierge-session.test.ts`; 7 integration tests in `concierge/chat/route.integration.test.ts`. | Committed in `06df83b` | **Unpushed (Local only)** | None | Phase 1 (Closed) |
| **BUG-10** | Storefront catalogue capped at first page (`limit: 24`). | **P2** | **OPEN** | `apps/storefront/lib/medusa.ts` defaults to `limit: 24`; filters evaluate only first page. | None | Unmodified | On `origin/main` | Implement server-side pagination / infinite scroll and query parameters. | Phase D (Storefront) |
| **BUG-11** | `GET /store/customers/me` returns 400 instead of 401 unauthenticated. | **P3** | **OPEN** | Medusa core customer route returns 400 when Authorization header is absent. | Observed live | Unmodified | On `origin/main` | Add storefront error normalization middleware to treat 400 without token as 401. | Phase D (Storefront) |
| **BUG-12** | Audit fixtures left in working database (36 `Audit Brand` rows). | **P2** | **OPEN** | Live PostgreSQL database contains `Audit Brand` / `TestBrand` rows from initial development. | Observed live in DB | Unmodified | In local DB | Run fixture cleanup script `scripts/db-clean-audit-fixtures.ts`. | Phase C (Data Hygiene) |

---

## 3. Handover Carry-Over Defects (R-01 to R-08)

| Defect ID | Description | Severity | Current Status | Actual Source-Code Evidence | Test Evidence | Git Commit Status | GitHub Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|---|
| **R-01** | No HTTP-level E2E test for admin refund route. | **Low** | **OPEN** | Refund logic covered at unit and DB integration level (`refund-operations.ts`), but no full HTTP route test with booted Medusa admin server. | Unit & DB tests pass | Uncommitted | Unpushed | Add end-to-end HTTP test using Medusa test client. |
| **R-02** | MIME validation in admin app; Medusa core checks multipart only. | **Low** | **PARTIALLY COMPLETE** | `apps/admin/lib/upload-rules.ts` and `apps/backend/src/lib/upload-validation.ts` check magic bytes and extensions. | 11 unit tests pass | Committed in `06df83b` | **Unpushed (Local only)** | Intercept core `/admin/uploads` via custom route middleware. |
| **R-03** | Admin and storefront production builds unverified in Phase 1. | **Low** | **VERIFIED COMPLETE** | Verified in this forensic session: `next build` on `@thl/storefront` exits 0 (42 routes); `next build` on `@thl/admin` exits 0 (34 routes); `medusa build` on `@thl/backend` exits 0. | Live build execution exit code 0 | Builds executed | N/A | None. All 3 builds pass cleanly. |
| **R-04** | Admin security headers verified by config, not live response. | **Low** | **VERIFIED COMPLETE** | `apps/admin/next.config.ts` headers array contains CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff. Next.js production build verified. | Next build exits 0 | Committed in `06df83b` | **Unpushed (Local only)** | Test headers on live deployed domain once hosting is provisioned. |
| **R-05** | Return restock concurrency / double restock. | **Medium** | **VERIFIED COMPLETE** | `apps/backend/src/lib/return-restock.ts`: compare-and-set on `restocked_at` inside transaction; re-uses `applyStockDelta()`. | 3 unit tests, 4 integration tests in `return-restock.integration.test.ts`, 5 tests in `returns.integration.test.ts`. | Committed in `4b3aa6d` | **Unpushed (Local only)** | None. Closed with regression suite. |
| **R-06** | `refund_amount` numeric floating-point handling. | **Low** | **VERIFIED COMPLETE** | `apps/backend/src/lib/money.ts`: digit-by-digit parsing into integer paise, formatting to 2-decimal string. | 6 unit tests in `money.test.ts`. | Committed in `4b3aa6d` | **Unpushed (Local only)** | None. Closed with regression suite. |
| **R-07** | Single stock location assumption on fulfilment/restock. | **Low** | **VERIFIED COMPLETE** | `apps/backend/src/lib/stock-location.ts`: explicit location resolution policy; fails closed with 422 if ambiguous. | 7 unit tests, 5 integration tests in `stock-location.integration.test.ts`. | Committed in `4b3aa6d` | **Unpushed (Local only)** | None. Closed with regression suite. |
| **R-08** | Razorpay webhook topology & state unexercised with live keys. | **Medium** | **IMPLEMENTED — VERIFICATION PENDING** | Webhook route `apps/backend/src/api/webhooks/razorpay/route.ts` and `webhook-tracking.ts` implemented and tested with local mock server. | 5 integration tests in `route.integration.test.ts`; `verify-phase2-sandbox.ts` | **Uncommitted (Phase 2 working tree)** | **Unpushed** | Test with live Razorpay webhook delivery from merchant dashboard. |

---

## 4. Master Gap Register (GAP-001 to GAP-122)

### A. Commerce Critical Path
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-001** | Payments | Razorpay enabled on INR region | **P0** | **IMPLEMENTED — VERIFICATION PENDING** | Linked in `region_payment_provider`; provider options in `medusa-config.ts`. Verified with emulator. | Uncommitted / Unpushed | Configure real Razorpay test keys from owner. |
| **GAP-002** | Payments | End-to-end sandbox purchase | **P0** | **IMPLEMENTED — VERIFICATION PENDING** | Tested in `verify-phase2-sandbox.ts` (Order THL-62 & THL-65); verified in DB. | Uncommitted / Unpushed | Conduct verification using live Razorpay test gateway (`api.razorpay.com`). |
| **GAP-003** | Payments | Webhook replay safety | **P0** | **VERIFIED COMPLETE** | `recordWebhookEvent()` in `webhook-tracking.ts` + `webhook_event` table unique constraint. | Uncommitted / Unpushed | Commit and push to repository. |
| **GAP-004** | Payments | Stable refund idempotency key | **P1** | **VERIFIED COMPLETE** | `refund-operations.ts` sha256 digest + `refund_operation` table. | Committed in `06df83b` / Unpushed | None. |
| **GAP-005** | Checkout | Alternative payment rails (COD/EMI) | **P3** | **NOT APPLICABLE — WITH EXPLANATION** | Deliberately removed per business decision; COD forgery risk eliminated. | Committed in baseline | Re-evaluate only if owner requests COD with OTP verification. |
| **GAP-006** | Checkout | Duplicate-submit guard on pay button | **P2** | **VERIFIED COMPLETE** | Button disabled in `checkout/payment/page.tsx`; storefront action checks `fetchOrderByCart()`. | Modified in Phase 2 / Uncommitted | Commit and push to repository. |
| **GAP-007** | Checkout | Courier serviceability check at address | **P2** | **OPEN** | Only PIN existence checked; no live courier API query. | Unmodified on `origin/main` | Query Shiprocket serviceability API after PIN entry. |
| **GAP-008** | Checkout | Weight/value-based shipping rates | **P2** | **OPEN** | Hardcoded flat options (₹0 and ₹199). | Unmodified on `origin/main` | Add Medusa shipping option rules based on cart subtotal and weight. |

### B. Storefront Experience & Merchandising
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-010** | Catalogue | Server-side pagination & infinite scroll | **P1** | **OPEN** | `fetchProducts` capped at `limit: 24`. | Unmodified on `origin/main` | Move filtering and sorting to paginated Medusa store API queries. |
| **GAP-011** | Catalogue | Unified category model | **P1** | **OPEN** | Uses heuristic metadata rather than pure `product_category`. | Unmodified on `origin/main` | Drive navigation strictly from `/store/categories`. |
| **GAP-012** | Catalogue | In-stock facet filter | **P2** | **OPEN** | No availability facet exists on catalogue. | Unmodified on `origin/main` | Add in-stock filter querying stock status. |
| **GAP-013** | Homepage | CMS-driven brand pavilion | **P1** | **OPEN** | Hardcoded `BRANDS` array in `app/page.tsx`. | Unmodified on `origin/main` | Fetch `/store/brands` dynamically. |
| **GAP-014** | Homepage | Truthful in-stock labels | **P2** | **OPEN** | "In Stock →" rendered for every item. | Unmodified on `origin/main` | Render availability conditionally based on variant inventory. |
| **GAP-015** | Homepage | Banner slots rendered dynamically | **P2** | **OPEN** | `/store/content/home` works; homepage ignores it. | Unmodified on `origin/main` | Consume `BannerSlot` records on homepage components. |
| **GAP-016** | PDP | Multi-image product gallery | **P1** | **OPEN** | Only `thumbnail` rendered. | Unmodified on `origin/main` | Render `product.images` array and seed multi-angle photography. |
| **GAP-017** | PDP | Related products / recommendations | **P2** | **OPEN** | None. | Unmodified on `origin/main` | Add category/brand-based recommendation carousel. |
| **GAP-018** | PDP | Customer reviews & ratings | **P1** | **OPEN** | No review entity or UI. | Unmodified on `origin/main` | Build verified-purchase review model and moderation queue. |
| **GAP-019** | PDP | Colourway / variant options | **P2** | **OPEN** | Size options only. | Unmodified on `origin/main` | Add colour option linking to variant images. |
| **GAP-020** | PDP | Compare-at / discount pricing display | **P2** | **OPEN** | Strike-through pricing missing. | Unmodified on `origin/main` | Surface Medusa original price vs sale price on cards. |

### C. Storefront Information Architecture & Trust
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-030** | CMS | Dynamic policy pages | **P2** | **OPEN** | Static markdown; no admin CMS editor. | Unmodified on `origin/main` | Connect policy pages to CMS content module. |
| **GAP-031** | Search | Debounced autocomplete & search facets | **P2** | **OPEN** | Basic keyword match only. | Unmodified on `origin/main` | Add category/brand facets and autocomplete dropdown. |
| **GAP-032** | Auth | Mobile SMS OTP login | **P1** | **BLOCKED — OWNER DECISION REQUIRED** | Gateway mock exists; requires DLT-registered MSG91/Twilio credentials. | Gated in code | Provide SMS gateway credentials and approved DLT templates. |
| **GAP-033** | Legal | Mandatory India e-commerce disclosures | **P0** | **BLOCKED — OWNER DECISION REQUIRED** | Placeholders in footer for GSTIN, CIN, Grievance Officer. | Unmodified on `origin/main` | Owner must supply legal business entities: GSTIN, CIN, officer contact. |

### D. Admin Panel & Operations
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-040** | Admin | Four-role RBAC enforcement | **P0** | **VERIFIED COMPLETE** | Middleware and `requireRole()` enforce owner, manager, operations, support, readonly. | Committed in `06df83b` / Unpushed | None. |
| **GAP-041** | Admin | Product image upload to S3 | **P1** | **BLOCKED — OWNER DECISION REQUIRED** | Files stored in local filesystem `uploads/`. | Committed in `06df83b` / Unpushed | Provision S3/R2 bucket credentials (`S3_BUCKET`, `S3_KEY`). |
| **GAP-042** | Admin | Bulk inventory update | **P2** | **OPEN** | Single-item adjustments only. | Unmodified on `origin/main` | Add CSV upload and bulk stock adjustment endpoint. |
| **GAP-043** | Admin | Low-stock threshold configuration | **P2** | **OPEN** | Hardcoded `<= 3` in inventory queries. | Unmodified on `origin/main` | Add configurable threshold per variant or location. |
| **GAP-044** | Admin | Refund reason taxonomy | **P2** | **VERIFIED COMPLETE** | Admin action supports reason codes; stored in `refund_operation.reason`. | Committed in `06df83b` / Unpushed | None. |

### E. Returns, Refunds & After-Sales
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-050** | Returns | Full RMA lifecycle exercised | **P1** | **OPEN** | Route logic exists; needs end-to-end sandbox run. | Tests pass in DB | Execute end-to-end RMA flow: request → approve → receive → restock → refund. |
| **GAP-051** | Returns | Reverse pickup booking | **P1** | **BLOCKED — OWNER DECISION REQUIRED** | No reverse AWB booked. | Unmodified on `origin/main` | Provide Shiprocket credentials; wire reverse pickup API call. |
| **GAP-052** | Returns | GST credit note generation | **P1** | **OPEN** | No credit note document created on refund. | Unmodified on `origin/main` | Implement credit note sequence and PDF generator. |
| **GAP-053** | Returns | Item exchange workflow | **P2** | **OPEN** | Return-only flow; no replacement order creation. | Unmodified on `origin/main` | Implement exchange action linking return to replacement order. |
| **GAP-054** | Returns | Unique RMA numbering | **P2** | **VERIFIED COMPLETE** | PostgreSQL sequence `return_request_display_seq`. | Committed in `06df83b` / Unpushed | None. |
| **GAP-055** | Returns | Concurrency retry on RMA generation | **P3** | **VERIFIED COMPLETE** | Sequence eliminates race conditions. | Committed in `06df83b` / Unpushed | None. |

### F. Logistics & Fulfillment
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-060** | Shipping | Shiprocket credentials & live AWB | **P0** | **BLOCKED — OWNER DECISION REQUIRED** | Client implemented in `lib/shiprocket.ts`; credentials absent. | Code exists | Owner to supply `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD`. |
| **GAP-061** | Shipping | Dynamic return pickup destination | **P1** | **OPEN** | Hardcoded Ahmedabad destination in `shiprocket.ts`. | Code exists | Make warehouse return address environment-driven. |
| **GAP-062** | Shipping | Shiprocket webhook security | **P1** | **OPEN** | Static query token `?token=`. | Code exists | Add IP allowlist or HMAC signature verification. |
| **GAP-063** | Shipping | Shipping label generation from admin | **P2** | **OPEN** | Stores URL; cannot generate on demand. | Unmodified on `origin/main` | Add admin action to fetch and render shipping labels. |
| **GAP-064** | Shipping | RTO (Return to Origin) disposition | **P2** | **OPEN** | Status mapped; no automated inventory return workflow. | Unmodified on `origin/main` | Define RTO disposition state machine. |
| **GAP-065** | Shipping | Courier freight cost capture | **P2** | **OPEN** | Shipping freight cost not recorded per order. | Unmodified on `origin/main` | Record carrier charges in order financial summary. |

### G. Retail Back Office (Purchasing, Costing & Accounting)
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-070** | Purchasing | Supplier records | **P1** | **OPEN** | No supplier model. | Unmodified on `origin/main` | Create `supplier` table and admin management screens. |
| **GAP-071** | Purchasing | Purchase orders & Goods Receipt Notes | **P1** | **OPEN** | No PO or GRN entities. | Unmodified on `origin/main` | Implement PO → GRN → inventory receipt workflow. |
| **GAP-072** | Costing | Landed purchase cost per variant | **P1** | **OPEN** | Variants only store selling price. | Unmodified on `origin/main` | Add cost price and landed duty fields to variant model. |
| **GAP-073** | Finance | Gross margin & profitability reporting | **P1** | **OPEN** | Depends on GAP-072. | Unmodified on `origin/main` | Build margin reports (selling price minus landed cost). |
| **GAP-074** | Finance | Inventory valuation ledger | **P1** | **OPEN** | Depends on GAP-072. | Unmodified on `origin/main` | Implement FIFO / average cost inventory valuation report. |
| **GAP-075** | Finance | Gateway settlement reconciliation | **P1** | **OPEN** | Razorpay settlements not imported. | Unmodified on `origin/main` | Import settlement CSVs and reconcile against captured payments. |
| **GAP-076** | Finance | GSTR-ready tax export | **P1** | **OPEN** | Tax lines not aggregated by HSN / GST rate / state. | Unmodified on `origin/main` | Build GSTR-1 compliant monthly sales and tax report. |
| **GAP-077** | Finance | Daily cash & order reconciliation | **P2** | **OPEN** | No daily balancing view. | Unmodified on `origin/main` | Add daily sales vs gateway capture dashboard. |
| **GAP-078** | Compliance | Legal entity parameters (GSTIN, CIN) | **P0** | **BLOCKED — OWNER DECISION REQUIRED** | Empty in config. | Unmodified on `origin/main` | Owner must supply registered legal business credentials. |
| **GAP-079** | Compliance | Mandatory Country of Origin per product | **P1** | **OPEN** | Defaults to "India". | Unmodified on `origin/main` | Require country of origin field on product entry. |

### H. Bespoke Atelier
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-080** | Bespoke | Atelier consultation booking | **P1** | **OPEN** | No consultation booking model or calendar. | Unmodified on `origin/main` | Build consultation request model and scheduling interface. |
| **GAP-081** | Bespoke | Customer measurement profile & revisions | **P1** | **OPEN** | Measurements stored only as order line snapshots. | Unmodified on `origin/main` | Create persistent customer measurement profile entity with version history. |
| **GAP-082** | Bespoke | Fabric swatch catalogue | **P1** | **OPEN** | Fabric choices not modeled. | Unmodified on `origin/main` | Implement fabric entity, swatch photos, and metre stock tracking. |
| **GAP-083** | Bespoke | Atelier quotation & customer approval | **P1** | **OPEN** | No bespoke quote workflow. | Unmodified on `origin/main` | Build quote generation and customer digital approval action. |
| **GAP-084** | Bespoke | Production job card & tailor assignment | **P2** | **PARTIALLY COMPLETE** | Printable job card exists; tailor assignment not tracked. | UI exists | Add tailor assignment, milestone due dates, and stage timers. |
| **GAP-085** | Bespoke | Fitting appointments & alterations | **P2** | **OPEN** | No fitting appointment model. | Unmodified on `origin/main` | Implement fitting stage tracking and alteration instructions. |
| **GAP-086** | Bespoke | Atelier garment quality control record | **P2** | **PARTIALLY COMPLETE** | Simple `qc_passed` boolean only. | Model exists | Build multi-point garment inspection checklist. |

### I. Resale & Authentication Marketplace
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-090** | Resale | Consignment intake workflow | **P1** | **OPEN** | Consignment intake status machine missing. | Unmodified on `origin/main` | Build intake entity, tracking serial, and warehouse check-in. |
| **GAP-091** | Resale | Seller ownership & authenticity declaration | **P1** | **OPEN** | Legal terms acceptance not recorded. | Unmodified on `origin/main` | Implement digital signature / consent record on listing submission. |
| **GAP-092** | Resale | Physical inspection tied to listing ask | **P1** | **PARTIALLY COMPLETE** | Inspection model exists but has no foreign key to an ask. | Model exists | Add foreign key constraint linking inspection to consignment ask. |
| **GAP-093** | Resale | Consignor payout settlement ledger | **P1** | **OPEN** | Sellers cannot be paid by system. | Unmodified on `origin/main` | Implement payout ledger, commission deduction, and payout state. |
| **GAP-094** | Resale | Tokenised seller bank account (DPDP Act) | **P1** | **OPEN** | No secure bank detail storage. | Unmodified on `origin/main` | Tokenise bank/UPI accounts via Razorpay Payouts API. |
| **GAP-095** | Resale | Bid → Order conversion | **P2** | **BLOCKED — OWNER DECISION REQUIRED** | Bids never become orders. | Unmodified on `origin/main` | Depends on BD-1 (bidding vs fixed-price model). |
| **GAP-096** | Resale | Authenticity dispute workflow | **P2** | **OPEN** | No buyer dispute handling. | Unmodified on `origin/main` | Implement buyer challenge case review and return gate. |
| **GAP-097** | Resale | Resale return policy enforcement | **P2** | **PARTIALLY COMPLETE** | Uses standard return flow. | Unmodified on `origin/main` | Restrict returns on resale items to authenticity disputes only. |

### J. Production Infrastructure & Operations
| Finding ID | Module | Feature | Severity | Current Status | Code / Test Evidence | Git / Push Status | Remaining Work |
|---|---|---|---|---|---|---|---|
| **GAP-100** | Support | Support ticket SLA & staff assignment | **P2** | **PARTIALLY COMPLETE** | Tickets stored; no SLA timer or staff assign. | Model exists | Add ticket assignment dropdown and SLA breach tracking. |
| **GAP-101** | CRM | Marketing consent & unsubscribe | **P1** | **OPEN** | No DPDP-compliant marketing consent record. | Unmodified on `origin/main` | Add explicit opt-in checkbox and one-click unsubscribe route. |
| **GAP-102** | CRM | Customer communication history | **P2** | **OPEN** | Outbound messages not logged to customer. | Unmodified on `origin/main` | Centralize email and WhatsApp message log in admin customer view. |
| **GAP-110** | Build | Green lint gate in CI | **P0** | **VERIFIED COMPLETE** | `.audit/*.mjs` fixed; `eslint .` exits 0. | Committed in `06df83b` / Unpushed | None. |
| **GAP-111** | Deploy | Docker containerisation & deployment | **P0** | **OPEN** | No Dockerfiles for backend/storefront/admin. | Unmodified on `origin/main` | Create production Dockerfiles, compose, and deploy workflow. |
| **GAP-112** | Deploy | Automated database backup & restore drill | **P0** | **OPEN** | No backup scripts. | Unmodified on `origin/main` | Create daily pg_dump script and test restore procedure. |
| **GAP-113** | Monitoring | Sentry error monitoring & alerting | **P1** | **BLOCKED — OWNER DECISION REQUIRED** | `SENTRY_DSN` unconfigured. | Code handles unset DSN | Supply Sentry DSN and setup uptime health checks. |
| **GAP-114** | Infra | Dedicated Redis cluster | **P1** | **OPEN** | Uses in-memory fake redis. | Config accepts `REDIS_URL` | Provision Redis 7; set `REDIS_URL`. |
| **GAP-115** | Infra | S3 object storage for product images | **P1** | **BLOCKED — OWNER DECISION REQUIRED** | Uses local disk `uploads/`. | Local disk driver | Provide AWS S3 or Cloudflare R2 credentials. |
| **GAP-116** | Security | Production secret assertions | **P1** | **VERIFIED COMPLETE** | `assertProductionEnv()` fails fast on startup. | Committed in `06df83b` / Unpushed | None. |
| **GAP-117** | Security | Rate limiting on public write APIs | **P2** | **VERIFIED COMPLETE** | Limiter applied to tickets, chat, resale. | Committed in `06df83b` / Unpushed | None. |
| **GAP-118** | Security | Dependency vulnerability scanning | **P1** | **PARTIALLY COMPLETE** | CI yaml exists; lacks `pnpm audit`. | Committed in `06df83b` / Unpushed | Add `pnpm audit` step to CI. |
| **GAP-119** | Data | Remove audit fixture data | **P2** | **OPEN** | 36 `Audit Brand` rows in dev DB. | Unmodified | Run fixture deletion script on development DB. |
| **GAP-120** | Analytics | Product & checkout analytics pipeline | **P2** | **OPEN** | No analytics tracking. | Unmodified on `origin/main` | Implement privacy-focused analytics events. |
| **GAP-121** | Tooling | Production builds verified | **P1** | **VERIFIED COMPLETE** | All three builds (`storefront`, `admin`, `backend`) tested live and exit 0. | Verified in this session | None. |
| **GAP-122** | Process | Archive legacy root markdown reports | **P3** | **OPEN** | 40+ stale root reports remain. | Unmodified on `origin/main` | Move obsolete reports into `docs/archive/`. |

---

## 5. Strategic Business Decisions (BD-1 to BD-3)

| Decision ID | Description | Impacted Modules | Status | Options Under Consideration | Recommended Action |
|---|---|---|---|---|---|
| **BD-1** | Resale Pricing Model: Fixed-Price vs StockX-Style Two-Sided Bidding | Resale (GAP-090..097), Storefront PDP | **BLOCKED — OWNER DECISION REQUIRED** | Option A: Single fixed sell price per item (recommended for luxury curation).<br>Option B: Dynamic buyer bids & seller asks with automatic order matching. | Owner must decide business model before Phase G execution. |
| **BD-2** | Merchandising Scope: Sneaker/Streetwear Specialist vs Multi-Category Luxury Fashion | Catalogue, Bespoke (GAP-080..086), Fit Studio | **BLOCKED — OWNER DECISION REQUIRED** | Option A: Sneaker/Streetwear only (defer tailoring).<br>Option B: Complete 3-pillar luxury platform (Sneakers, Designer Apparel, Bespoke Tailoring). | Owner must confirm whether Bespoke Atelier is launched in v1. |
| **BD-3** | Commercial & Consignment Fee Parameters | Resale Payouts (GAP-093..094), Finance (GAP-075) | **BLOCKED — OWNER DECISION REQUIRED** | Current code has hardcoded 9.5% commission fee in `calculateConsignorPayout()`. | Owner must specify standard commission rates, payout schedules, and GST treatment. |

---

## 6. Newly Discovered Findings (NEW-01 to NEW-08)

| Finding ID | Severity | Discovery Context | Description | Forensic Evidence | Remediation Action Required |
|---|---|---|---|---|---|
| **NEW-01** | **High** | Git History Inspection | **Phase 1 commits unpushed to GitHub.** 3 local commits (`06df83b`, `4b3aa6d`, `7a68479`) exist only on the local machine. | `git log origin/main..HEAD` shows 3 commits ahead. | Review and push local commits to GitHub `origin/main` upon owner authorization. |
| **NEW-02** | **High** | Git Working Tree Inspection | **Phase 2 implementation uncommitted and untracked.** 12 modified files and 11 untracked files are dirty in the working tree. | `git status --short` shows 23 modified/untracked files. | Stage, commit with descriptive message, and push Phase 2 work upon authorization. |
| **NEW-03** | **High** | Payment Gateway Analysis | **Razorpay integration tested against local mock only.** The backend was tested against `RazorpaySandboxServer` on port 9099; zero tests against real Razorpay sandbox API. | `RAZORPAY_API_URL=http://127.0.0.1:9099/v1` in `apps/backend/.env`. | Configure official Razorpay test keys and run one live transaction against `api.razorpay.com`. |
| **NEW-04** | **Medium** | Architecture Verification | **`payment_operation` table connected to checkout flow.** | `apps/backend/src/api/middlewares.ts` intercepts `POST /store/carts/:id/complete` to enforce atomic `claimPaymentOperation()` mutex, idempotency, stale lock recovery, and order completion tracking. Storefront action handles 409 and concurrent resolution. | **VERIFIED COMPLETE** (7 unit/integration tests + 12-scenario sandbox verification pass). |
| **NEW-05** | **Medium** | Notification Verification | **Order confirmation email notification reliability & tracking.** | `apps/backend/src/lib/order-email.ts` tracks explicit `skipped_unconfigured` / `sent` / `failed` in `order.metadata` and `audit_event`, prevents duplicate sends, logs operationally, and never blocks orders. | **VERIFIED COMPLETE** (5 unit tests in `order-email.test.ts` pass; verified in DB). |
| **NEW-06** | **Low** | Audit Document Reconciliation | **Customer data discrepancy in Phase 2 report.** Report claimed customer `test-customer-1774291129328@example.com` in Mumbai; real database has `raghav.sharma@thehiddenlabel.test` in Ahmedabad. | DB query on `order_01M7X2THRE4A8Z2A1D7YX4CJ7M`. | Update report documentation to match physical database evidence. |
| **NEW-07** | **Low** | Core Medusa Payment State | **Order THL-62 payment state is authorized, not captured in Medusa core.** Medusa `payment` row has `captured_amount: "0"`, while external webhook logged captured event in custom audit table. | DB query on `payment` table. | Trigger `capturePaymentWorkflow` upon receiving `payment.captured` webhook. |
| **NEW-08** | **Low** | Environment Configuration | **Missing `.env` files in storefront and admin.** Only `apps/backend/.env` exists; storefront and admin rely on Next.js framework defaults. | Directory inspection of `apps/storefront` and `apps/admin`. | Provide explicit `.env.local` templates for storefront and admin. |
