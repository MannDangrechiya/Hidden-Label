# THE HIDDEN LABEL — Order & Payment State Machine

The single most important document in the project. Every bug class in e-commerce checkout
traces to an unstated transition. Nothing here may be implemented "approximately".

---

## 1. Order lifecycle

```
cart ──checkout──▶ pending_payment ──verified──▶ paid ──▶ processing ──▶ fulfilled ──▶ delivered
                        │                        │            │
                        │                        │            └─▶ cancelled (pre-dispatch, refund if paid)
                        └──expired/failed──▶ payment_failed   └─▶ refunded / partially_refunded
```

| State | Meaning | Entered by | Allowed next |
|---|---|---|---|
| `pending_payment` | order + line items persisted, stock reserved, payment intent created | server, at checkout submit | `paid`, `payment_failed`, `expired` |
| `payment_failed` | provider reported failure or intent abandoned | server, on provider signal | retry → `pending_payment`; else `expired` |
| `expired` | intent expired with no payment | scheduled job (default 30 min) | — (reservation released) |
| `paid` | **payment verified server-side** | server, on signed webhook or verified capture lookup | `processing`, `cancelled`, `refunded` |
| `processing` | admin has begun fulfilment | admin (or auto) | `fulfilled`, `cancelled`, `refunded` |
| `fulfilled` | dispatched, AWB exists | admin / Shiprocket event | `delivered`, `returned` |
| `delivered` | final courier event | Shiprocket webhook/poll | `returned` |
| `returned` | RMA closed with goods back | admin, on RMA completion | `refunded` |
| `cancelled` | order voided | admin, or customer before dispatch per policy | — |
| `refunded` / `partially_refunded` | money returned | admin, via provider | — |

### Hard invariants

1. `paid` is **never** set from a browser request. Not from a success URL, not from a query
   param, not from client-posted "payment_id". Only from:
   - a webhook whose signature verifies and whose payload amount/currency/order matches, or
   - a server-initiated `fetch payment` against the provider for that intent, after which the
     webhook path is still expected (it becomes a no-op).
2. `paid → processing` requires the amount captured to equal the order total within the
   configured tolerance (default: exact).
3. Money may only move through provider APIs. No "manual mark as refunded" without a
   corresponding provider refund id recorded, unless the payment method was offline (COD).
4. Stock is reserved at `pending_payment` and converted to a deduction at `paid`; released at
   `expired`, `payment_failed` (after retry window), and `cancelled`.
5. Every transition writes an `audit_event` with actor, previous state, new state and reason.
6. Any state can receive duplicate webhooks. All handlers must be idempotent keyed on the
   provider event id (unique index) — a duplicate is a 200 and a no-op, never a second refund.

---

## 2. Payment states (separate from order state)

```
created ──▶ authorized ──▶ captured ──▶ (refunded | partially_refunded)
   │             │
   └─failed      └─voided / expired
```

- `authorized` and `captured` may collapse into one step for Razorpay's standard flow; store
  whichever states the provider actually reports rather than forcing the diagram.
- `payment.provider_payment_id` is unique. A second capture attempt on the same intent
  returns the existing payment (idempotent), it does not create a new row.
- Refunds are their own rows with `amount`, `reason`, `provider_refund_id`, and a linked
  `audit_event`. Sum of refunds may never exceed captured amount — enforce with a DB check
  plus a service-side guard.

---

## 3. Stock and concurrency

- Reservation is a row-level operation on the inventory level, executed inside a transaction
  with `SELECT ... FOR UPDATE` (or the Medusa reservation primitive for the installed version).
- Two customers, one unit: exactly one order may reach `paid`; the other must fail cleanly at
  payment-verification time with a customer-legible message and an automatic refund path.
- Revalidation happens **three times**: at add-to-cart, at checkout submit, and at payment
  verification. The third is the only one that is authoritative.
- Oversell is never silently accepted: if stock vanished between capture and verification, the
  order enters a `needs_attention` admin queue and the customer is refunded — never shipped
  from phantom inventory.

---

## 4. Discounts and totals

- Totals are computed **server-side only**; the client displays, it never calculates money.
- A coupon is re-validated at payment verification. If it expired or its usage limit was hit
  mid-checkout, the order is not silently charged a different amount — the customer is returned
  to checkout with an explicit message.
- Free-shipping thresholds are evaluated on the discounted subtotal, and that rule is stated in
  one place shared by cart, checkout and order records.
- Rounding: compute in paise (integers), format for display. One rounding rule for the whole
  system, documented in the money helper.

---

## 5. Returns and refunds

```
return_requested ─▶ approved ─▶ in_transit ─▶ received ─▶ inspecting ─▶ refunded │ rejected
```

- Eligibility: within the policy window (from `delivered_at`, not `created_at`), item
  returnable, quantity ≤ purchased minus already-returned.
- Refund amount is computed from the **order item's paid price**, not today's product price.
- Partial refunds must reconcile: `sum(refunds) ≤ order.paid_total`.
- Restock only after inspection, and only if `restock_decision = restock`. A returned item that
  is not restocked must still be traceable in the audit log.
- Exchange resolution creates a new fulfilment against the same order, not a new order, unless
  the amounts differ — in which case a new order plus a refund is created, and both are linked
  in the audit log.

---

## 6. Shipping status mapping (single source)

| Shiprocket status | Internal | Customer sees |
|---|---|---|
| `NEW`, `PICKUP SCHEDULED` | `pickup_scheduled` | "Preparing for pickup" |
| `PICKED UP` | `picked_up` | "Picked up" |
| `IN TRANSIT` | `in_transit` | "In transit" |
| `OUT FOR DELIVERY` | `out_for_delivery` | "Out for delivery" |
| `DELIVERED` | `delivered` | "Delivered" |
| `RTO *` | `rto` | "Returning to origin" |
| `CANCELLED` | `cancelled` | "Shipment cancelled" |

Admin `A-11` and customer `U-20` render from the same mapper. If they can disagree, the mapper
is wrong.

---

## 7. Failure & retry policy

| Failure | Behaviour |
|---|---|
| Payment webhook arrives before order commit | Retry with backoff (3 attempts, 2s/8s/30s); if still missing, park in `webhook_unmatched` for admin review |
| Webhook signature invalid | 400, log with redaction, never process, alert if rate spikes |
| Duplicate webhook | 200 no-op |
| Provider timeout on capture verification | Treat as `pending_payment`, poll up to 10 min, then surface in admin `needs_attention` |
| Shipment creation fails | Order stays `paid`/`processing`; admin can retry; error shown in `A-11` row |
| Tracking poll fails | Keep last known state, flag `stale` after 12h, retry with backoff |
| Email send fails | Order unaffected; queued retry; failure visible in admin order timeline |

Every one of these has a test in Phase 7. A row in this table without a test is an untested claim.
