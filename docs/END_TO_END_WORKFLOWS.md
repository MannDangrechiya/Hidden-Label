# END-TO-END WORKFLOW AUDIT — The Hidden Label

**Date:** 23 November 2026
**Method:** traced each step through storefront → server action → API → service/lib → DB → external service → result, using source code, live HTTP checks and read-only SQL. A full paid journey was **not executed** because no Razorpay credentials exist in this environment.

Legend: ✅ implemented and verified in code/tests · 🟡 implemented but unverified externally · 🔴 broken or blocked · ⛔ missing.

---

## 1. Happy path — discovery to delivery

| # | Step | Frontend | Server action / API | Business logic | DB | External | Status |
|---|---|---|---|---|---|---|---|
| 1 | Discover product | `/`, `/collections/all`, `/brands/[handle]`, search | `GET /store/products`, `/store/brands`, `/store/categories` | Medusa product query | product/variant/price/inventory | — | ✅ |
| 2 | Select size/variant | PDP `AddToBag` | — | variant availability + stock read | inventory_level | — | ✅ |
| 3 | Add to cart | size CTA / quick view | `addToCart` server action → Medusa cart | cart line create | cart, line_item | — | ✅ |
| 4 | Register / sign in | `/register`, `/login`, OTP | Medusa auth, `/store/otp/*` | customer create, OTP challenge | customer, otp_challenge | SMS (dev echo) | 🟡 OTP unlinked |
| 5 | Delivery address | checkout step 1 | `setCheckoutAddressAction` → cart update | Zod + India Post PIN check | cart address | pincode lookup (external, fail-open) | ✅ |
| 6 | Shipping choice | step 2 | `selectShippingAction` | shipping option + `fulfilment_mode` metadata | cart shipping method | — | ✅ |
| 7 | Payment | step 3 | `beginRazorpayPaymentAction`, Razorpay checkout, `confirmRazorpayPaymentAction` | collection → session → provider order → complete cart | payment_collection/session/operation | Razorpay | 🔴 blocked (no key) |
| 8 | Order created | confirmation page | `POST /store/carts/:id/complete` (+ idempotency middleware) | Medusa order workflow | order, order_item, payment | Razorpay | 🟡 unverified live |
| 9 | Admin receives order | `/orders`, dashboard | admin orders | reads | order | — | ✅ code |
| 10 | Inventory reserved/adjusted | — | Medusa reservation on complete; admin adjustments | stock location + movement ledger | reservation, inventory_level, stock_movement | — | ✅ code/tests |
| 11 | Shipment created | admin `/shipments` or order action | `POST /admin/orders/[id]/shipment` | package computation, pickup resolution, AWB | shipment, shipment_operation | Shiprocket | 🟡 sandbox only |
| 12 | Customer gets tracking | account order detail | `GET /store/orders/[id]/shipment` (+ webhook updates) | status mapping | shipment, shipment_event | Shiprocket webhook | 🟡 |
| 13 | Delivered | — | Shiprocket webhook | `delivered_at` recorded on fulfillment | fulfillment, shipment | Shiprocket | 🟡 |
| 14 | Invoice | `/account/orders/[id]/invoice` | order read | GST split, HSN | order, credit_note | — | 🟡 statutory fields blank |
| 15 | Return request | `/account/orders/[id]/return` | `POST /store/return-requests` | eligibility (delivered, window, custom/final-sale, quantity) | return_request/item | — | ✅ tested |
| 16 | Admin approve/reject | `/returns/[id]` | `POST /admin/returns/[id]` intercepted | re-check eligibility, RMA, reverse pickup | return_request, shipment | Shiprocket reverse | 🟡 |
| 17 | Reverse shipment | — | RMA reverse pickup | creates reverse shipment/AWB | shipment | Shiprocket | 🟡 |
| 18 | Refund | admin order/return action | `/admin/returns` refund / orders actions | `refundCapturedPayment` + credit note | refund_operation, payment.refund, credit_note | Razorpay | 🟡 |
| 19 | GST credit note | — | same | inclusive GST reversal with seller/buyer state | credit_note | — | ✅ code (2 rows) |
| 20 | Notifications | — | subscribers (`order-placed`, `fulfillment-created`, `canceled`, password reset) | Resend email, optional WhatsApp | — | Resend/MSG91 | 🟡 no keys |

**Conclusion:** the modelled workflow is complete and unusually well-instrumented for this stage. The weakest links are all external-credential links (payment, courier, email/SMS) and the invoice's statutory data.

---

## 2. Failure and edge-case scenarios

| Scenario | Behaviour in code | Assessment |
|---|---|---|
| Payment fails at provider | Signature verification fails → no order; payment operation marked failed; customer sees error | ✅ |
| Duplicate "pay" click / duplicate webhook | `payment_operation`/`webhook_event` unique keys; duplicate returns existing order or 200 duplicate | ✅ (unit/integration tested) |
| Concurrent completion | Claim in progress → poll ≤ 3 s → 409 with message | ✅ |
| Interrupted checkout (browser closed) | Cart persists by cookie; payment session may exist with no order; no cleanup job | 🟡 orphan sessions |
| Payment succeeded, cart completion fails | Provider charged, no order; webhook can reconcile? Razorpay webhook handles payment events, but reconciliation to cart is not automatic | 🔴 risk: money without order; needs alerting + manual runbook |
| Insufficient stock at completion | Medusa reservation rejects; error surfaced from `completeCart`; operation marked failed | ✅ code path, unverified live |
| Overselling under concurrency | Reservation semantics + `test-concurrency.mjs` recorded as passing in project history | 🟡 not re-run in this audit |
| Cancellation before dispatch | Admin cancel → provider refund + credit note + restock path | 🟡 unverified with real payment |
| Cancellation after dispatch | Not prevented by an explicit guard in the UI; relies on fulfillment status checks | 🔴 verify guard |
| Shipping creation fails | Shipment route returns provider error; prior UI showed generic "The action failed." | 🔴 poor error surfacing |
| Shipping status webhook duplicate/out-of-order | Event dedupe + status monotonicity helper exists (`shipment-status.ts`) | ✅ unit tested |
| Refund fails at provider | Explicit `failed` outcome; return not marked refunded; operator retry flag | ✅ code, unverified live |
| Return outside window | 422 with reason from eligibility | ✅ tested |
| Return of custom bespoke | Blocked in eligibility and copy | ✅ |
| Return pickup not configured | Honest "not configured" outcome, not a fake AWB | ✅ (a prior fake-AWB bug was fixed) |
| Return received damaged | Condition required; disposition recorded; restock decision explicit | ✅ |
| Refund without payment (manual) | `no_payment` outcome still issues credit note | ✅ |
| Customer deletes account with open orders | Delete-account route must preserve statutory order records; redaction policy claimed | 🟡 verify redaction |
| Support ticket spam | Rate limit on POST | ✅ |
| OTP brute force | Attempt limits + rate limit; dev echo must be off in prod (env guard) | ✅ |
| Checkout with unreachable backend | Redirect to cart with no explanation | 🔴 UX gap |
| Product price missing | Cards show "Price unavailable", never fabricated (a prior bug) | ✅ |
| Storefront copy claims | No blanket "authenticated" badge (mostly fixed) but invoice line remains | 🔴 |

---

## 3. Workflow gaps that need product decisions

1. **Payment reconciliation runbook.** Define what happens when Razorpay captures money but order creation fails. Needs a scheduled reconciliation job and an admin "orphan payments" view.
2. **Cancellation policy.** Explicitly block cancellation after `fulfilled`/`picked_up`, or define a return-based path.
3. **Exchange flow.** Returns exist; exchanges do not. Indian apparel customers expect size exchanges.
4. **Partial refunds.** Refund API supports amounts, but the return UI refunds the whole request; define line-level refunds.
5. **Shipping price rules.** Standard free / express ₹199 exist; no weight/zone logic or free-shipping threshold configuration.
6. **Bespoke lifecycle.** Admin pipeline exists (5 stages) but customer-facing progress and alteration SLA need definition.
7. **Notifications.** Define the full matrix (placed, paid, packed, shipped, delivered, cancelled, refunded, return approved/rejected) and who owns templates.
8. **Guest orders.** Guest checkout is allowed? Cart and account flows assume optional login; verify guest order lookup/tracking without an account.
9. **Invoice series.** Decide financial-year invoice numbering and whether credit notes are PDFs.
10. **Return window.** Configured 7 days by default; confirm business policy and reflect it everywhere.

---

## 4. Minimum acceptance tests before launch

1. Register → verify OTP → login → add to cart → address → shipping → Razorpay **test** payment → confirmed order with real order id.
2. Admin sees the order, captures/fulfils, generates AWB (Shiprocket test), customer sees tracking.
3. Customer downloads a tax invoice with valid GSTIN and correct CGST/SGST or IGST.
4. Customer requests a return within window; admin approves; reverse pickup created; unit received; refund executed; credit note generated; customer notified.
5. Duplicate webhook and duplicate payment confirmation produce exactly one order and one refund.
6. Payment success with forced order-creation failure is detected by reconciliation and resolved without a second charge.
7. Out-of-stock and concurrent purchase show honest errors and never oversell.
8. Guest checkout (if enabled) and signed-in checkout both reach confirmation.
9. Mobile (390 px) completes the whole journey without horizontal scroll.
10. All failure states show an actionable message, not "The action failed."
