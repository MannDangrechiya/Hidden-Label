# THE HIDDEN LABEL — Integrations

Rule for every integration here: **sandbox/test credentials first, then production.** No
integration merges with only the happy path exercised. Each section ends with the failure
behaviour that must be demonstrated before its phase closes.

Secrets live in environment variables only (`.env` locally, the host's secret store in
production). Nothing here appears in client bundles, in the repo, or in logs.

---

## 1. Razorpay (payments, INR)

### Flow
1. Server creates the order record (`pending_payment`) and a Razorpay order for
   `amount = total_in_paise`, `currency = INR`, `receipt = order.display_id`.
2. Server stores the provider order id against our order. **Never trust an amount supplied by
   the client at payment time.**
3. Client opens Razorpay checkout with the server-issued order id.
4. On return, the client calls `POST /store/checkout/verify` — which does a **server-side**
   payment fetch (or awaits the webhook) before anything is shown.
5. `payment.captured` / `order.paid` webhook arrives, signature verified with the webhook
   secret, payload reconciled against our order (amount, currency, order id), then the order
   transitions to `paid`.

### Requirements
- Signature verification: HMAC-SHA256 of the raw body with the webhook secret, compared in
  constant time. The raw body must be preserved — parsing first and re-serialising breaks it.
- Webhook idempotency: unique index on provider event id; duplicates return 200 and do nothing.
- Retry handling: Razorpay retries; every handler must be safe to run N times.
- Refunds: full and partial, recorded with `provider_refund_id`; sum of refunds ≤ captured.
- Failure surface: card declined, timeout, abandoned intent, amount mismatch, unknown order id.
  Each maps to a specific customer message and a specific admin-visible state.

### Env
```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

### Must demonstrate at G5
Declined card, abandoned checkout (order expires, stock released), duplicate webhook replay,
webhook with tampered signature (rejected + logged), partial refund, full refund, and a
payment for an order whose stock vanished (auto-refund + admin flag).

---

## 2. Shiprocket (shipping)

### Implementation status (2026-11-14)
- **Built:** `apps/backend/src/lib/shiprocket.ts` (real auth + create-order API client, unit
  tested against a mocked fetch — never exercised against Shiprocket's live API, no sandbox
  credentials available here), wired into `POST /admin/shipments` (only labels a shipment
  `provider: "shiprocket"` when the API call actually returns a real shipment id/AWB; falls back
  to `manual` honestly on any failure), and a real webhook receiver `POST /webhooks/shiprocket`
  (shared-token auth via `SHIPROCKET_WEBHOOK_TOKEN`, idempotent via the same
  `applyShipmentUpdate` helper the admin manual-update route uses).
- **Not built yet:** the 30-minute polling backstop for shipments with no webhook coverage, the
  pincode serviceability check at checkout, and RTO auto-handling beyond the basic status mapper.
  Verify Shiprocket's current webhook auth mechanism against https://apidocs.shiprocket.in/
  before activating in production — this was built from their documented shapes without a live
  test.

### Flow
1. Admin (or auto on `paid`) creates a shipment: pickup location, weight/dimensions from the
   product record, order items, declared value.
2. Shiprocket assigns courier + AWB. We store `provider_shipment_id`, `awb`, `courier`, label URL.
3. Tracking: webhook where available, plus a polling job every 30 min for open shipments as a
   backstop. Both feed `shipment_event` with a dedupe key.
4. Customer-facing status comes from the single mapper in `ORDER_STATE_MACHINE.md` §6.

### Requirements
- Product weight/dimensions are required fields for shippable items — a missing dimension is a
  publish-blocker on `A-03`, not a runtime surprise at dispatch.
- Serviceability check by pincode before showing shipping options at checkout.
- RTO handling: RTO status must surface in admin `A-12` and on the order, and must not
  auto-refund without an admin decision.
- The courier name is rendered from the allocation (BlueDart, Delhivery, etc.) — no hardcoded
  "BlueDart" in the UI, per decision D3.

### Env
```
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_WEBHOOK_TOKEN=
SHIPROCKET_PICKUP_LOCATION=
```

### Must demonstrate at G5
Shipment created for a real order in test mode, label + manifest retrieved, tracking event
ingested, duplicate tracking event ignored, shipment failure visible in admin with retry.

---

## 3. Transactional email (Resend)

Templates required: verify email, password reset, OTP fallback, order confirmation, payment
failed, shipment dispatched (+ AWB), delivery confirmation, return approved, refund processed,
admin alert (payment/webhook anomaly).

- Send from a verified domain with SPF/DKIM/DMARC configured before launch.
- HTML + plain-text alternatives; images referenced from the CDN, not inlined base64.
- All sends go through a queue with retry (3 attempts, exponential); failures are logged and
  visible on the order timeline. **An email failure never blocks an order transition.**
- No PII beyond what the recipient needs; no full address in the subject line.

### Env
```
RESEND_API_KEY=
EMAIL_FROM="orders@thehiddenlabel.com"
```

---

## 4. OTP (email and phone)

**Approved Q6:** email + password is the primary authentication method. OTP is a *verification*
step for the registered email or phone where required — registration verification, phone
verification, and high-risk actions. It is not the sole credential and there is no OTP-only login
in v1.

- Provider-agnostic adapter (`OtpProvider` interface) with one SMS implementation at launch
  (MSG91 or Twilio — choose on price/deliverability for India) and email OTP through the
  transactional email provider.
- Codes are 6 digits, **hashed at rest**, 5-minute expiry, max 5 attempts, max 3 sends/15 min per
  destination. Enforced server-side; the client cannot widen these.
- Templates must not reveal whether an address or number is registered.
- Cost guard: per-destination and global daily caps, with an alert when exceeded.
- Password reset is a first-class flow (single-use token, 30-minute expiry, invalidated on use
  and on password change), rate-limited per identity and per IP.
- Account verification state is stored and shown honestly: an unverified account is usable for
  browsing, and any restriction is explained rather than silently enforced.

### Env
```
OTP_PROVIDER=
OTP_API_KEY=
OTP_SENDER_ID=
```

### Must demonstrate at G5
Send, verify, expiry, wrong-code lockout, resend cooldown, and a password-reset round trip —
with rate limits held under a burst test.

---

## 5. Image storage

- S3-compatible bucket (or Cloudinary) with server-issued presigned uploads. The client never
  holds write credentials.
- Upload pipeline: validate mime/type/size, strip EXIF, generate responsive derivatives
  (400/800/1200/2000 wide, AVIF+WebP), store originals privately.
- Product cards need the 3:4 / 4:5 crops specified in `DESIGN_TOKENS.md`; the derivative
  pipeline is responsible, not CSS object-fit guesswork.
- Deleting a product image must not break historical order pages — order items keep their own
  image snapshot URL.

### Env
```
S3_ENDPOINT=
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
```

---

## 6. Analytics & monitoring

- Error tracking (Sentry or equivalent) on both apps + backend, with PII scrubbing on.
- Uptime checks on storefront home, PDP, `/store/carts` and admin login.
- Structured logs with request ids; log levels configurable by env.
- Payment webhook anomalies (signature failures, unmatched orders) trigger an alert, not just a log line.
- Analytics: privacy-respecting page analytics only; no third-party pixels on checkout.

### Env
```
SENTRY_DSN=
LOG_LEVEL=info
```

---

## 7. Cross-cutting integration rules

1. **Every outbound call has a timeout** (default 10s) and a bounded retry (max 3, exponential,
   jitter). No unbounded awaits in a request path.
2. **Every inbound webhook is idempotent** via a unique provider event id.
3. **No secret reaches the browser.** Third-party publishable keys are fine; secrets never.
4. **A provider outage degrades, it does not corrupt:** payments unavailable → checkout shows a
   truthful error; shipping unavailable → orders stay `paid` with an admin flag; email down →
   queue grows, orders proceed.
5. **Test doubles are not acceptable in production paths.** Sandbox credentials for staging,
   production credentials for production, feature-flagged mocks only in tests.
6. Document each integration's failure matrix in `agent/PHASE_PROMPTS.md` output when its phase
   closes, so handover includes "what happens when Razorpay is down", not just "it works".
