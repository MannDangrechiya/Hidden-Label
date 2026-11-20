# 08 — EXTERNAL INTEGRATION AUDIT

Every integration below is hand-written against the provider's REST API. **No vendor SDK is used anywhere** (no `razorpay` npm package, no `shiprocket` package, no `resend`, no `twilio`), which means there is no SDK-level retry, no typed responses, and no automatic idempotency — behaviour is exactly what the code in this repository does.

Legend for "Configured?": **[LIVE]** from env key enumeration in this environment.

---

## 1. Razorpay (payments)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — a real `AbstractPaymentProvider` implementation: `apps/backend/src/modules/razorpay/service.ts` (~290 lines) |
| Correct API usage? | **Plausibly yes, unverified.** Uses `POST /v1/orders` (`payment_capture: 0`), `POST /v1/payments/:id/capture`, `POST /v1/payments/:id/refund`, `GET /v1/payments/:id`; Basic auth `base64(key_id:key_secret)`. Shapes follow Razorpay's documented v1 API. |
| Credentials configured? | **No.** No `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in `apps/backend/.env`; no `NEXT_PUBLIC_RAZORPAY_KEY_ID` in the storefront env. |
| Sandbox connection successful? | **No — BLOCKED.** Not attempted (no credentials). |
| Error handling? | Good: every network call has a 15 s `AbortSignal.timeout`, non-2xx logs and throws `MedusaError`; provider refuses to operate when unconfigured instead of silently succeeding. |
| Retry handling? | **None.** A transient 5xx from Razorpay surfaces as a failure to the customer with no retry/backoff. |
| Webhook validation? | **Yes, twice over.** (a) `getWebhookActionAndData` verifies HMAC-SHA256 of the raw body against the webhook secret; (b) the dedicated `/webhooks/razorpay` route does the same with `timingSafeEqual`. Both correctly *ignore/refuse* when the secret or signature is missing. |
| Rate limiting? | N/A (outbound). Provider requests are one-per-checkout. |
| Logging? | Signature mismatches logged as warnings with the order id (no card data, no signature echo). |
| Production readiness? | **Not ready** — unconfigured and unexercised. Two concrete concerns: the storefront public key and the backend keys must be set **and** `pnpm db:setup-payments` must run, otherwise the payment step stays empty; and refunds are non-idempotent at the caller. |

**Ambiguity worth noting:** there are two parallel webhook paths — the custom verified logger at `/webhooks/razorpay` and Medusa's canonical `/hooks/payment/razorpay_razorpay`. Only the latter mutates payment state. An operator registering both in the Razorpay dashboard gets one logging endpoint and one state endpoint; registering only the custom one means **payment state never advances from webhooks**. This must be documented for go-live.

---

## 2. Shiprocket (logistics)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — `apps/backend/src/lib/shiprocket.ts`: token auth (9-day cache), `POST /orders/create/adhoc`, `POST /orders/create/return` |
| Correct API usage? | **Documented as unverified inside the file itself**: "this client has not been exercised against their live API … verify field names against a real response." Uses `apiv2.shiprocket.in/v1/external`. |
| Credentials configured? | **No** (`SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_TOKEN`, `SHIPROCKET_PICKUP_LOCATION` all absent) |
| Sandbox connection successful? | **No — BLOCKED** |
| Error handling? | Good: throws on any failure; callers fall back to **manual dispatch** and never invent an AWB (explicit comment and code discipline in both `returns.ts` and the admin shipment route). |
| Retry handling? | **None.** A failed create means the admin arranges a manual pickup. |
| Webhook validation? | **Weak by design:** a static shared token in the query string or `x-webhook-token` header. Shiprocket does not sign with HMAC; the route documents this and recommends verifying against current docs. Risk: token leakage via logs/proxies (SEC-05). |
| Rate limiting? | None needed (low volume). |
| Logging? | Failures logged with provider status and body prefix; unknown AWB logged and 200'd to stop retries. |
| Production readiness? | **Not ready.** No credentials, unverified payload shapes, one hardcoded destination block in the return request (`Ahmedabad / Gujarat / 380054 / phone 9999999999`) that must be corrected before real reverse pickups. |

**Hardcoded values found in the return path:** `shipping_customer_name: "The Hidden Label Returns"`, `shipping_city: "Ahmedabad"`, `shipping_state: "Gujarat"`, `shipping_pincode: "380054"`, `shipping_phone: "9999999999"`. If the boutique address differs, labels print the wrong destination.

---

## 3. Resend (transactional email)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — `lib/email.ts` (`POST https://api.resend.com/emails`), `lib/order-email.ts` templates, subscribers for order placed/cancelled/fulfilled/delivered, password reset, RMA acknowledgement, daily report with base64 attachments |
| Correct API usage? | Yes — documented shape, `from` from `EMAIL_FROM` (default `orders@thehiddenlabel.com`), 10 s timeout |
| Credentials configured? | **No** (`RESEND_API_KEY` absent, `REPORTS_EMAIL` absent) |
| Sandbox connection successful? | **No — BLOCKED** |
| Error handling? | Returns `{ sent, reason }`, logs `[email:not-configured]`, never blocks an order transition. Deliberate and correct. |
| Retry handling? | **None**; a Resend outage silently drops the message (logged only). |
| Webhook validation? | N/A (no inbound email webhooks: no bounce/complaint handling) |
| Rate limiting? | None client-side |
| Logging? | Unconfigured sends are logged with recipient + subject; failures log provider status |
| Production readiness? | **No.** Without a key, **no customer ever receives an order confirmation, password reset, RMA acknowledgement or delivery notice.** There is also no bounce/complaint processing, no unsubscribe/consent handling, and no template management (HTML is inline in code). |

---

## 4. SMS OTP (MSG91 or Twilio)

| Question | Answer |
|---|---|
| Code exists? | **Yes** — `lib/sms.ts` (MSG91 DLT template flow, Twilio alternative), `lib/otp.ts` (HMAC-hashed codes, 5 min TTL, 5 attempts, 3 sends/15 min), `lib/phone.ts` (Indian E.164 normalisation) |
| Correct API usage? | Plausible; not exercised |
| Credentials configured? | **No** — `OTP_PROVIDER`, `OTP_API_KEY`, `OTP_TEMPLATE_ID`, `OTP_SENDER_ID`, `TWILIO_*` all absent. `OTP_DEV_ECHO=true` is set for development only. |
| Sandbox connection successful? | **No — BLOCKED** |
| Error handling? | **Excellent:** unconfigured SMS returns **501** with an explicit message rather than pretending to send; the storefront falls back to email OTP and says so. |
| Retry handling? | None; customer requests a new code (rate-limited) |
| Webhook validation? | N/A |
| Rate limiting? | Yes — 3 sends per destination/purpose per 15 minutes, plus 5 verification attempts |
| Logging? | Logs a SHA-256 prefix reference of the destination, never the number |
| Production readiness? | **No.** DLT registration and an approved template are prerequisites in India; neither is present. `OTP_DEV_ECHO` must be off. |

---

## 5. WhatsApp (MSG91)

| Question | Answer |
|---|---|
| Code exists? | Yes — `lib/whatsapp.ts`, invoked from order subscribers |
| Correct API usage? | Plausible MSG91 WhatsApp template call with numbered params |
| Credentials configured? | **No** (`MSG91_WHATSAPP_AUTH_KEY`, integrated number, four template names) |
| Sandbox connection | **No — BLOCKED** |
| Error handling | Non-blocking, logged |
| Retry | None |
| Webhook | N/A (no inbound message handling → WhatsApp is **not** a support channel, only an outbound notification) |
| Production readiness | No — templates must be pre-approved; never sent |

---

## 6. Gemini (AI layer)

| Question | Answer |
|---|---|
| Code exists? | Yes — `lib/gemini.ts`, used by `/store/sight-search` (visual/keyword search) and `/store/concierge/chat` |
| Correct API usage? | REST call to Gemini with a grounded catalogue prompt; 9 unit tests cover prompt building and fallbacks with mocked `fetch` |
| Credentials configured? | **Key name present** in `apps/backend/.env`; validity not tested |
| Sandbox connection | **NOT VERIFIED** — no live call was made (cost + third-party side effect) |
| Error handling | Good: on failure the concierge falls back to a deterministic keyword/template reply and logs a warning |
| Retry | None |
| Webhook | N/A |
| Rate limiting | **None** on `/store/concierge/chat` or `/store/sight-search` → an unauthenticated caller can drive paid API usage |
| Logging | Failure warnings only |
| Production readiness | **Conditional.** Works as a *conservative* feature (falls back honestly, makes no authentication claims), but needs a per-session/IP quota before the AI flag is switched on. |

---

## 7. Image storage

- No S3 credentials (`S3_ENDPOINT/BUCKET/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY` absent).
- Medusa therefore uses its **local file provider**; uploads land in `uploads/` (gitignored).
- Admin upload works through `POST /admin/uploads` (`apps/admin/lib/api/uploads.ts` → `uploadFile`).
- **Production blocker:** local disk is not durable or shareable across replicas. Object storage is required before deploy. The storefront also accepts `images.remotePatterns` of `**` over http/https, which is permissive.

## 8. PostgreSQL / Redis

- PostgreSQL 18 is real and healthy **[LIVE]**. Pool configured (`min 2 / max 20`).
- **Redis is not configured** (`REDIS_URL` absent) → Medusa uses in-memory event bus/workflow engine, so **background jobs and subscriber delivery do not survive a restart and are not shared across replicas**. The auth rate limiter falls back to in-process memory, which is per-replica.
- `docker-compose.yml` provides both, but the app is currently running without Redis.

## 9. Analytics / monitoring / CDN

| Integration | Status |
|---|---|
| Error monitoring (Sentry) | **Configured? No.** `SENTRY_DSN` absent; no Sentry SDK in any `package.json`. Logs go to stdout/`.dev/*.log`. |
| Log aggregation | None (only `LOG_LEVEL=info`) |
| Product analytics / funnel events | **None** — no GA4, no PostHog, no server-side event pipeline |
| CDN | None configured; Next serves images directly |
| Search service | None — Medusa/Postgres `ilike` queries only |

## 10. Integration readiness summary

| Integration | Code | Credentials | Verified | Readiness |
|---|---|---|---|---|
| Razorpay | ✅ real | ❌ | ❌ | **NOT READY** (P0) |
| Shiprocket | ✅ real | ❌ | ❌ | **NOT READY** |
| Resend | ✅ real | ❌ | ❌ | **NOT READY** |
| MSG91/Twilio SMS | ✅ real | ❌ | ❌ | **NOT READY** |
| MSG91 WhatsApp | ✅ real | ❌ | ❌ | **NOT READY** |
| Gemini | ✅ real | ⚠️ key present | ❌ | **CONDITIONALLY READY** |
| S3 storage | ⚠️ config-only | ❌ | ❌ | **NOT READY** |
| PostgreSQL | ✅ | ✅ | ✅ | **READY** (local only) |
| Redis | ✅ config | ❌ | ❌ | **NOT READY** (dev runs in-memory) |
| Sentry/analytics | ❌ | ❌ | ❌ | **MISSING** |
