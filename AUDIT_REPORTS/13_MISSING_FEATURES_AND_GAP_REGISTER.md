# 13 — MASTER GAP REGISTER

**Priority definitions**
`P0` release blocker / critical business risk · `P1` essential to operate the business · `P2` growth, experience, efficiency · `P3` optional future enhancement.

**State vocabulary**
`VERIFIED` (executed this session) · `IMPLEMENTED` (code complete, unverified) · `PARTIAL` · `MISSING` · `BLOCKED` (code exists, credentials/infrastructure absent) · `DEFECT`

---

## A. Commerce critical path

| ID | Module | Feature | Current state | Evidence | Business impact | Priority | Dependency | Recommended action |
|---|---|---|---|---|---|---|---|---|
| GAP-001 | Payments | Razorpay enabled on the INR region | **BLOCKED** | `region_payment_provider` = 0 rows **[LIVE]** | Cannot take money at all | **P0** | Test-mode Razorpay keys | Set keys, run `pnpm db:setup-payments`, verify `/store/payment-providers` lists razorpay |
| GAP-002 | Payments | End-to-end sandbox purchase | **BLOCKED** | no keys, no provider | No proof the money path works | **P0** | GAP-001 | One complete sandbox purchase with a recorded order id |
| GAP-003 | Payments | Webhook replay safety in practice | **PARTIAL** | custom route only logs; state via Medusa hook | Double-processing risk unknown | **P0** | GAP-001 | Replay the same event twice; assert one payment event |
| GAP-004 | Payments | Stable refund idempotency key | **DEFECT** | `idempotency_key: ...-${Date.now()}` in `admin/orders/[id]/actions` | Double refund | **P1** | — | Derive key from `(orderId, paymentId, amount, reason)` |
| GAP-005 | Checkout | Alternative payment rails (COD/EMI) | **MISSING (deliberate)** | removed in code + migration | Lower conversion in India | **P3** | business decision | Do not re-add COD without a forgery-proof verification design |
| GAP-006 | Checkout | Duplicate-submit guard on pay button | **PARTIAL** | relies on Medusa cart completion | Double-click could double-call complete | **P2** | GAP-001 | Disable button + idempotency key on `completeCart` |
| GAP-007 | Checkout | Courier serviceability check at address step | **MISSING** | only PIN existence is checked | Delivered-to-unserviceable risk | **P2** | Shiprocket | Query serviceability API after PIN validation |
| GAP-008 | Checkout | Weight/value-based shipping rates | **MISSING** | only flat ₹0 and ₹199 options | Margin leakage | **P2** | business pricing | Add Medusa shipping options/rules |

## B. Storefront experience

| ID | Module | Feature | Current state | Evidence | Impact | Priority | Dependency | Action |
|---|---|---|---|---|---|---|---|---|
| GAP-010 | Catalogue | Server-side pagination / infinite scroll | **MISSING** | `fetchProducts` default `limit: 24`; filters run client-side | Catalogue beyond page 1 is invisible to filters | **P1** | — | Move filtering/sorting/paging to a paginated store API query |
| GAP-011 | Catalogue | Unified category model | **PARTIAL** | `lib/catalog.ts` metadata heuristics vs real `product_category` | Same product in different categories by entry point | **P1** | — | Drive tabs from `/store/categories` everywhere |
| GAP-012 | Catalogue | Availability (in-stock) filter | **MISSING** | no facet exists; stock hidden by store API | Cannot shop "available only" | **P2** | stock route | Add facet using `POST /store/catalog/stock` |
| GAP-013 | Homepage | CMS-driven brand pavilion | **DEFECT** | hardcoded `BRANDS` with invented counts in `app/page.tsx` | Ops cannot change it; published numbers unverifiable | **P1** | — | Fetch `/store/brands` + real counts |
| GAP-014 | Homepage | Honest stock label | **DEFECT** | "In Stock →" rendered for every card | Misleading availability claim | **P2** | stock route | Render only when known available |
| GAP-015 | Homepage | Banner slots consumed | **PARTIAL** | `/store/content/home` works; homepage ignores it | Banners seeded but unused | **P2** | — | Render `BannerSlot` data |
| GAP-016 | PDP | Multi-image gallery | **MISSING** | only `product.thumbnail` rendered | Premium perception; can't show detail | **P1** | seed data | Render `product.images`; seed multiple photos |
| GAP-017 | PDP | Related products | **MISSING** | none | AOV loss | **P2** | — | Same-category/brand recommendations |
| GAP-018 | PDP | Product reviews & ratings | **MISSING** | no model/route/UI | Trust & conversion | **P1** | new model | Verified-purchase-only reviews with moderation |
| GAP-019 | PDP | Colour/variant beyond size | **MISSING** | size-only options | Can't sell colourways | **P2** | catalogue model | Add colour option + images |
| GAP-020 | PDP | Discount / compare-at display | **MISSING** | no strike-through price | Promotions invisible on PDP | **P2** | — | Surface Medusa price lists |
| GAP-021 | PDP | SEO metadata (description, OG, canonical) | **PARTIAL** | `generateMetadata` returns title only | Search/social visibility | **P2** | — | Add description/OG/canonical + JSON-LD |
| GAP-022 | Catalogue | Size guide inline on PDP | **PARTIAL** | separate `/size-guide` + fit widget | Friction | **P3** | — | Inline link per product |
| GAP-023 | Storefront | Design-token gallery route `/design` public | **DEFECT (minor)** | exists in both apps | Unintended public surface | **P3** | — | Remove from production build or gate it |

## C. Account & identity

| ID | Module | Feature | Current state | Impact | Priority | Dependency | Action |
|---|---|---|---|---|---|---|---|
| GAP-030 | Auth | Email delivery for verification/reset | **BLOCKED** | No OTP/reset emails reach customers | **P0** | Resend key | Configure Resend + verified sending domain |
| GAP-031 | Auth | SMS OTP | **BLOCKED** | Indian mobile verification unavailable | **P1** | DLT + MSG91/Twilio | Register DLT template, set provider keys |
| GAP-032 | Auth | Staff MFA | **MISSING** | Admin compromise risk | **P1** | — | TOTP for owner/manager roles |
| GAP-033 | Auth | Session revocation / active session list | **MISSING** | Logout leaves JWT valid until expiry | **P2** | — | Add token denylist or short TTL + refresh |
| GAP-034 | Account | Order/address/return self-service | **IMPLEMENTED** | — | — | — | Verify with a real account |
| GAP-035 | Account | Loyalty / membership | **MISSING** | Retention | **P3** | new models | Defer |

## D. Admin, RBAC, operations

| ID | Module | Feature | Current state | Evidence | Impact | Priority | Action |
|---|---|---|---|---|---|---|---|
| GAP-040 | RBAC | Default role fallback | **DEFECT (High)** | `metadata.role ?? "owner"` in backend + admin | Any role-less staff becomes owner | **P0** | Default to no-role → 403; require explicit assignment |
| GAP-041 | Inventory | Atomic stock adjustment | **DEFECT** | read-then-write in `admin/inventory` | Silent stock drift | **P1** | `SELECT … FOR UPDATE` inside the transaction |
| GAP-042 | Inventory | Multi-location operations | **PARTIAL** | `stock_location.first()` in fulfil + restock | Wrong-location fulfilment/restock | **P2** | Choose/assign location per shipment |
| GAP-043 | Inventory | Stock movement ledger | **MISSING** | audit log only | No ageing/reconciliation/transfers | **P1** | New `stock_movement` table written by every mutation |
| GAP-044 | Inventory | Per-product reorder points | **PARTIAL** | hardcoded `available ≤ 3` | Wrong low-stock alerts | **P2** | Store threshold per variant |
| GAP-045 | Orders | Bulk actions | **MISSING** | per-order only | Ops inefficiency at volume | **P2** | Batch capture/fulfil |
| GAP-046 | Admin | Date filters on lists & reports | **MISSING** | fixed ranges | No period reporting | **P1** | Add range params to admin queries |
| GAP-047 | Admin | Audit coverage for price/publish/promotion/media/customer-flag | **PARTIAL** | no `writeAudit` in those actions | Weak accountability | **P2** | Add audit rows |
| GAP-048 | Admin | Admin app security headers | **MISSING** | only storefront has CSP/HSTS | Admin XSS exposure | **P1** | Mirror storefront headers |
| GAP-049 | Admin | Admin UI verified end-to-end | **NOT VERIFIED** | server not running, no credentials | Unknown state | **P1** | Run a staff-role walkthrough with test accounts |

## E. Returns, refunds, after-sales

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-050 | Returns | Full RMA lifecycle exercised | **PARTIAL** | Unknown reliability | **P1** | Sandbox run: request→approve→receive→refund |
| GAP-051 | Returns | Reverse pickup | **BLOCKED** | No pickup booked | **P1** | Shiprocket credentials + correct pickup address |
| GAP-052 | Returns | Credit note document | **MISSING** | GST/accounting gap | **P1** | Generate GST credit note on refund |
| GAP-053 | Returns | Exchange flow | **MISSING** | Customer friction | **P2** | Exchange as replacement order |
| GAP-054 | Returns | Unique RMA numbering | **DEFECT (Low)** | diff --count collision | **P2** | Use a Postgres sequence |
| GAP-055 | Returns | Retry on RMA collision | **MISSING** | 500 on race | **P3** | Retry/backoff |

## F. Logistics

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-060 | Shipping | Shiprocket credentials + live AWB | **BLOCKED** | No tracking possible | **P0** | Set credentials, create a sandbox shipment |
| GAP-061 | Shipping | Correct return-destination block | **DEFECT** | hardcoded Ahmedabad/380054/9999999999 in `shiprocket.ts` | Wrong pickup destination | **P1** | Make it env/config driven |
| GAP-062 | Shipping | Shiprocket webhook HMAC or IP allowlist | **PARTIAL** | static query token | Webhook spoofing | **P1** | Add IP allowlist or HMAC per provider docs |
| GAP-063 | Shipping | Label/pickup scheduling from admin | **PARTIAL** | label_url stored, not generated on demand | Manual work | **P2** | Add label + pickup endpoints |
| GAP-064 | Shipping | RTO and failed-delivery handling | **PARTIAL** | status `rto` mapped; no workflow | Stock/refund ambiguity | **P2** | Define RTO disposition |
| GAP-065 | Shipping | Courier cost capture | **MISSING** | no expense data | No shipping P&L | **P2** | Record charged freight per shipment |

## G. Retail back office (missing domain)

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-070 | Purchasing | Supplier records | **MISSING** | Cannot manage vendors | **P1** | New `supplier` model + admin CRUD |
| GAP-071 | Purchasing | Purchase orders & GRN | **MISSING** | No controlled inbound stock | **P1** | PO + GRN + receive-to-inventory |
| GAP-072 | Costing | Purchase/landed cost per variant | **MISSING** | No margin possible | **P1** | Cost field per variant + FX/duty |
| GAP-073 | Finance | Margin & profitability report | **MISSING** | Blind pricing | **P1** | Depends on GAP-072 |
| GAP-074 | Finance | Inventory valuation | **MISSING** | Balance-sheet gap | **P1** | Depends on GAP-072 |
| GAP-075 | Finance | Gateway settlement reconciliation | **MISSING** | Unreconciled cash | **P1** | Import Razorpay settlements, match to payments |
| GAP-076 | Finance | GST output report / GSTR-ready export | **MISSING** | Compliance workload | **P1** | Aggregate tax lines by rate/state |
| GAP-077 | Finance | Daily reconciliation view | **MISSING** | Control gap | **P2** | Sales vs captured vs settled |
| GAP-078 | Compliance | Real GSTIN/CIN/grievance values | **MISSING** | Placeholders on site | **P0** | Set `BUSINESS_*`, `GRIEVANCE_OFFICER_*` |
| GAP-079 | Compliance | Country-of-origin data per product | **PARTIAL** | defaults to "India" | Legal Metrology risk | **P1** | Require the field on product create |

## H. Bespoke tailoring

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-080 | Bespoke | Consultation booking | **MISSING** | No lead capture for MTM | **P1** | Booking model + slots |
| GAP-081 | Bespoke | Persistent measurement profile + revisions | **PARTIAL** | per-line snapshots only | Repeat-customer friction | **P1** | Customer-level profile with version history |
| GAP-082 | Bespoke | Fabric catalogue | **MISSING** | Cannot sell fabric choice | **P1** | Fabric entity + swatches + availability |
| GAP-083 | Bespoke | Quote → customer approval | **MISSING** | No priced bespoke offer | **P1** | Quote entity + approval state |
| GAP-084 | Bespoke | Production job card & tailor assignment | **PARTIAL** | printable sheet + 5 stages | Atelier can't be scheduled | **P2** | Job card entity, assignee, due date |
| GAP-085 | Bespoke | Fittings & alterations | **MISSING** | Core MTM service step | **P2** | Appointment + alteration records |
| GAP-086 | Bespoke | Garment QC record | **PARTIAL** | `qc_passed` flag only | No evidence trail | **P2** | QC checklist entity |

## I. Resale & authentication

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-090 | Resale | Consignment intake workflow | **MISSING** | Items cannot be received | **P1** | Intake entity + status machine |
| GAP-091 | Resale | Ownership declaration & terms acceptance | **MISSING** | Legal exposure | **P1** | Signed declaration record |
| GAP-092 | Resale | Authentication tied to intake/ask | **PARTIAL** | inspections exist but not linked to an ask | Cannot prove this listed item was inspected | **P1** | FK inspection → ask/intake |
| GAP-093 | Resale | Consignor settlement ledger | **MISSING** | Sellers are never paid by the system | **P1** | Settlement entity + payout status |
| GAP-094 | Resale | Bank/payout details (DPDP-safe) | **MISSING** | Cannot transfer money | **P1** | Tokenised payout account |
| GAP-095 | Resale | Bid → order conversion | **MISSING** | Bids never become sales | **P2** | Accept-bid workflow creating an order |
| GAP-096 | Resale | Authentication dispute flow | **MISSING** | Trust failure handling | **P2** | Dispute case + resolution |
| GAP-097 | Resale | Resale-specific return policy | **PARTIAL** | generic RMA | Policy ambiguity | **P2** | Rules per item type |

## J. CRM, support, marketing

| ID | Module | Feature | Current state | Impact | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-100 | Support | SLA, assignment, categories | **PARTIAL** | Inbox without ownership | **P2** | Assignee + SLA timer |
| GAP-101 | CRM | Marketing consent & unsubscribe | **MISSING** | Non-compliant outreach | **P1** | Consent records + unsubscribe |
| GAP-102 | CRM | Communication history | **MISSING** | Support can't see what was sent | **P2** | Log email/WhatsApp per customer |
| GAP-103 | CRM | Segmentation | **MISSING** | No targeting | **P3** | Defer |
| GAP-104 | CRM | Customer risk surface | **PARTIAL** | flag exists, limited display | **P3** | Extend |

## K. Platform, security, DevOps

| ID | Module | Feature | Current state | Evidence | Priority | Action |
|---|---|---|---|---|---|---|
| GAP-110 | Build | Lint gate green | **DEFECT** | 15 errors in `.audit/*.mjs` | **P0** | Add ignore for `.audit/` |
| GAP-111 | Deploy | Hosting, domain, TLS, secrets | **MISSING** | no Dockerfile/IaC/deploy job | **P0** | Choose host; containerise; secret store |
| GAP-112 | Deploy | Backups & restore drill | **MISSING** | none | **P0** | Automated dumps + tested restore |
| GAP-113 | Observability | Error monitoring & alerting | **MISSING** | no Sentry, no alerts | **P1** | Sentry + uptime checks |
| GAP-114 | Infra | Redis for queues/events/limits | **MISSING (config exists)** | in-memory modules | **P1** | Provision Redis, set `REDIS_URL` |
| GAP-115 | Infra | Durable object storage for uploads | **PARTIAL** | local `uploads/` | **P1** | S3-compatible bucket |
| GAP-116 | Security | Production secret assertions | **MISSING** | dev defaults in code | **P1** | Fail-fast on missing prod secrets |
| GAP-117 | Security | Rate limits on AI/support/resale writes | **MISSING** | only auth+OTP limited | **P2** | Add limiter |
| GAP-118 | Security | Dependency vulnerability scanning | **MISSING** | no audit step | **P1** | `pnpm audit` + Dependabot |
| GAP-119 | Data | Remove audit fixtures from dev/staging DBs | **DEFECT** | 36 `Audit Brand` rows | **P2** | Cleanup script + fresh seed |
| GAP-120 | Analytics | Product/funnel analytics | **MISSING** | none | **P2** | Add event pipeline |
| GAP-121 | Tooling | Production build verified | **NOT VERIFIED** | not run in this audit | **P1** | Run in CI/worktree |
| GAP-122 | Process | Archive stale root audit reports | **DEFECT (process)** | 40 contradictory `.md` files | **P3** | Move to `docs/archive/` |
