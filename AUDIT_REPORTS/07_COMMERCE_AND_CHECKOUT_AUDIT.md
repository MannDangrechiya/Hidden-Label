# 07 — COMMERCE AND CHECKOUT AUDIT

## 1. The end-to-end path as implemented

```
PDP → addToCart (server action)
    → POST /store/carts (region resolved from INR)         [cookie thl_cart]
    → POST /store/carts/:id/line-items  (+ bespoke metadata)
Cart → POST /store/carts/:id (metadata merge: fulfilment_mode, payment_method, consent)
Checkout address → POST /store/carts/:id (email, shipping_address)  [pincode gate]
Checkout shipping → GET /store/shipping-options → POST /store/carts/:id/shipping-methods
Checkout payment → POST /store/payment-collections
                 → POST /store/payment-collections/:id/payment-sessions {provider_id: pp_razorpay_razorpay}
                 → provider initiatePayment → Razorpay order (amount from cart total, server-side)
Browser Razorpay Checkout → razorpay_order_id / payment_id / signature
confirmRazorpayPaymentAction → POST payment-sessions/:id {data}
                             → POST /store/carts/:id/complete
                             → provider authorizePayment verifies HMAC (order|payment, key secret)
                             → order created, cart cleared
Post-order → subscribers (email/WhatsApp) · admin capture/fulfil · Shiprocket · webhooks · returns
```

## 2. Verified facts

**[LIVE]**
- Only two shipping options exist in the database: `Standard delivery` (flat **₹0**) and `Express delivery` (flat **₹199**).
- `region_payment_provider` is **empty** — no provider is offered at the payment step.
- Unsigned `POST /webhooks/razorpay` → **503** (`RAZORPAY_WEBHOOK_SECRET` unset).
- `/checkout` with an empty cart → **307** to `/cart`.
- 55 payments exist, 9 captured, 1 cancelled — i.e. payment records are being created, but no evidence of a completed paid order in this environment.

**[CODE]**
- Amount is **always** computed server-side: `amountPaise: Math.round((cart.total ?? 0) * 100)` in `beginRazorpayPaymentAction`; the provider's `initiatePayment` receives Medusa's amount. The browser never supplies a price.
- Currency: `input.currency_code.toUpperCase()` from the cart region → `INR`.
- Checkout signature verification: `crypto.createHmac("sha256", key_secret).update(`${orderId}|${paymentId}`)` compared against `razorpay_signature`; mismatch returns `PaymentSessionStatus.ERROR` (order not created).
- Webhook signature verification: HMAC over the **raw** body, `crypto.timingSafeEqual`, 401 on mismatch.
- Refund: `refundPaymentWorkflow` with amount defaulting to the full captured payment, guarded by "no captured payment" → 422 with an honest message about offline settlement.
- Cancel: `cancelOrderWorkflow`, blocked when any fulfilment exists or `fulfillment_status` is `fulfilled|shipped`.
- Stock: all 60 variants `manage_inventory=true`, `allow_backorder=false` → Medusa reserves at completion. **No custom stock decrement exists anywhere.**
- COD: fully removed — no branch in checkout, `pp_system_default` deleted by `setup-payments.ts`, migration drops the COD verification table.

## 3. State-consistency review

| Property | Assessment |
|---|---|
| Order marked paid only after trustworthy verification | **Yes in design** — `authorizePayment` verifies the HMAC before returning `AUTHORIZED`; capture is a separate admin workflow step. Cannot be observed without keys. |
| Duplicate checkout submissions | Depends on Medusa's complete-cart workflow rejecting an already-completed cart. No custom guard. **Unverified.** |
| Retry after failure | `authorizePayment` returns `PENDING` (not an error) when the browser has not completed checkout, so the customer can retry. Reasonable. |
| Payment/order association | Created through Medusa's payment collection ↔ order payment collection links. |
| Refund idempotency | **Broken** — `Date.now()` in the key (BUG-04). |
| Gateway settlement reconciliation | **Absent.** No settlement/UTR/payout import, no reconciliation view. |
| Failure/timeout flow | Provider fetch has `AbortSignal.timeout(15_000)`; errors surface as `MedusaError` with a message. No automatic retry, no dead-letter.

## 4. Checkout blockers, ranked

1. **P0 — no payment provider enabled / no keys.** A real customer reaches "payment" and cannot pay.
2. **P1 — email unconfigured.** Even if paid, no order confirmation is delivered; password reset cannot work either.
3. **P1 — refund idempotency** could double-refund on retry.
4. **P2 — shipping price model is flat only.** ₹0 standard shipping on every order is a business decision that has not been reflected in pricing; there is no weight/value-based rate, no free-shipping threshold rule beyond the flat zero.
5. **P2 — no address validation beyond PIN existence**; no courier serviceability check at the address step (Shiprocket serviceability is not queried).
6. **P2 — single shipping option per mode**; customer cannot choose a courier.

## 5. What a "standard purchase" scenario would do today

| Scenario | Expected | Actual |
|---|---|---|
| Discover → PDP → add to bag → cart | Works | Verified structurally; add-to-cart not executed to avoid mutating shared data |
| Checkout address + shipping | Works | Code path complete; pincode gate real |
| Payment | Should show UPI/cards via Razorpay | **Fails**: no provider, no key → "Online payment is not configured on this environment." |
| Order confirmation | Created by complete-cart | **Never reached** |
| Warehouse processing | Admin capture → fulfil | Unable to test (no admin session) |
| Shipment | Shiprocket AWB | **Blocked** (no credentials) |

**Conclusion: the commerce lifecycle is code-complete but operationally unproven. The single highest-value action in this project is to enable Razorpay in test mode and run one full sandbox purchase.**
