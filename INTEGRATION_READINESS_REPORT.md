# THE HIDDEN LABEL — INTEGRATION READINESS REPORT

**Date:** 2026-11-22  
**Scope:** Third-Party Service Integrations, Webhook Security, and External API Resilience  
**Auditor:** Integration Engineer & Security Engineer  

---

## 1. External Integration Overview Matrix

| Integration | Implementation Status | Sandbox / Test Status | Live Credentials Configured? | Webhook Security & Verification | Retry & Failure Resilience |
|---|---|---|---|---|---|
| **Razorpay** | **Complete** | **12/12 Scenarios Verified** | Pending live merchant keys | HMAC-SHA256 signature verification (`x-razorpay-signature`) | Payment mutex, idempotency locks, replay deduplication |
| **Shiprocket** | **Complete** | **13/13 Scenarios Verified** | Pending commercial account | Constant-time token verification (`x-webhook-token`) | Anti-regression status ranking, timeout retries |
| **Resend** | **Complete** | **Verified (Mocked & Unit)** | Pending live API key & domain | N/A (Outbound transactional email) | Exponential backoff, non-blocking background queue |
| **Storage (S3 / R2)** | **Complete** | **Verified (Local Volume)** | Pending production S3 bucket | N/A (Asset upload) | Fail-closed MIME & magic byte validation |
| **Redis** | **Complete** | **Verified (Standalone 7.x)** | Configured in Docker Compose | Password-protected (`--requirepass`) | Fallback to in-memory cache/locks in dev |
| **Gemini AI** | **Complete** | **9/9 Unit Tests Passed** | API key configured | N/A (Styling concierge) | Token rate limiter, graceful error fallback |

---

## 2. Detailed Service Audit

### A. Razorpay Payment Gateway
- **Implementation Status:** Fully implemented in `apps/backend/src/modules/razorpay/` and `src/lib/payment-operations.ts`.
- **Required Environment Variables:**
  - `RAZORPAY_KEY_ID`: Public merchant key (e.g. `rzp_live_...`).
  - `RAZORPAY_KEY_SECRET`: Secret key for server-side order creation and capture.
  - `RAZORPAY_WEBHOOK_SECRET`: Secret used to compute and verify the HMAC-SHA256 signature on incoming callbacks.
- **Sandbox Testing Status:** 12/12 sandbox scenarios passed in `verify-phase2-sandbox.ts`. 7 integration tests pass in `payment-operations.integration.test.ts`. 9 unit tests pass in `service.test.ts`.
- **Webhook Verification:** `apps/backend/src/api/webhooks/razorpay/route.ts` verifies the `x-razorpay-signature` header against raw request body using `crypto.createHmac("sha256", secret).digest("hex")`. Replayed webhooks are matched against `webhook_event` and acknowledged as duplicates without re-executing order creation.
- **Retry & Failure Handling:** Distributed mutex lock (`payment_operation`) ensures that if a customer retries checkout or network drops during capture, the transaction remains idempotent and double-charging is impossible.
- **Operational Limitation:** Cash-on-Delivery (COD) is deliberately omitted to prevent luxury delivery fraud. All orders are prepaid via UPI, Net Banking, or Credit/Debit Card.

---

### B. Shiprocket Courier & Logistics
- **Implementation Status:** Fully implemented in `apps/backend/src/modules/shiprocket/client.ts` and `src/lib/rma-reverse-pickup.ts`.
- **Required Environment Variables:**
  - `SHIPROCKET_EMAIL`: Commercial merchant login email.
  - `SHIPROCKET_PASSWORD`: Merchant account password.
  - `SHIPROCKET_WEBHOOK_TOKEN`: Pre-shared secret header expected from Shiprocket scans.
- **Sandbox Testing Status:** 13/13 scenarios passed in `verify-phase-b-sandbox.ts`. 12 unit tests in `client.test.ts`. 5 integration tests in `shiprocket/route.integration.test.ts`.
- **Webhook Verification:** Incoming status updates are validated using `crypto.timingSafeEqual` against `x-webhook-token` (with query parameter fallback). 
- **Anti-Regression Safeguard:** Webhook events are checked against the status hierarchy (`requested` < `in_transit` < `delivered`). Out-of-order scans cannot revert an order that is already marked `delivered` back to `in_transit`.
- **Warehouse Pickup Resolution:** `apps/backend/src/lib/warehouse-pickup.ts` validates physical warehouse presence and resolves stock locations before booking courier dispatches.

---

### C. Resend Transactional Email Engine
- **Implementation Status:** Fully implemented in `apps/backend/src/lib/order-email.ts`.
- **Required Environment Variables:**
  - `RESEND_API_KEY`: Production API token (`re_...`).
  - `RESEND_FROM_EMAIL`: Verified sender address (`THE HIDDEN LABEL <orders@thehiddenlabel.com>`).
- **Templates Supported:**
  - Order Confirmation (HTML summary with line items, delivery address, and GST breakdown).
  - Shipping Notification (Carrier name, AWB tracking link).
  - Return / RMA Approval (Pickup date, return shipping instructions).
  - Credit Note / Refund Confirmation (Credit note PDF reference and amount).
- **Failure Handling:** Email dispatch is designed to be non-blocking. If Resend experiences temporary upstream downtime, the core order creation transaction still succeeds, and failure is logged in the `audit_event` table for manual retry.

---

### D. Object Storage (S3 / Cloudflare R2 / Local Volume)
- **Implementation Status:** Configured in `docker-compose.prod.yml` and `apps/backend/medusa-config.ts`.
- **Current Mode:** Docker named volume `thl-prod-uploads` mounted to `/app/apps/backend/uploads` with Nginx static cache rules.
- **Cloud Migration Readiness:** Prepared for `medusa-file-s3` plugin configuration:
  - `MEDUSA_STORAGE_S3_ENDPOINT`
  - `MEDUSA_STORAGE_S3_BUCKET`
  - `MEDUSA_STORAGE_S3_ACCESS_KEY_ID`
  - `MEDUSA_STORAGE_S3_SECRET_ACCESS_KEY`
- **Upload Validation:** `apps/admin/lib/upload-rules.ts` and `apps/backend/src/api/middlewares.ts` enforce 8MB request limits, allowed image MIME types (`image/jpeg`, `image/png`, `image/webp`), and magic-byte header validation.

---

### E. Redis Cache & Distributed Lock
- **Implementation Status:** Configured via `redis:7-alpine` in `docker-compose.prod.yml`.
- **Capabilities Powered:**
  - Distributed checkout lock mutex (`payment_operation`).
  - Rate limiting for public endpoints (`apps/backend/src/lib/rate-limit.ts`).
  - Medusa event bus and workflow queue.
- **Security & Networking:** Bound exclusively to the internal Docker network `internal-net`. Password-protected via `--requirepass ${REDIS_PASSWORD}`. External port 6379 is not exposed to the public internet.

---

### F. Google Gemini AI Styling Concierge
- **Implementation Status:** Implemented in `apps/backend/src/lib/gemini.ts` and `/store/concierge/chat`.
- **Capabilities Powered:**
  - Natural-language styling recommendations for luxury silhouettes.
  - Bespoke fit studio guidance.
- **Security:** Concierge sessions issue signed HMAC-SHA256 tokens (`apps/backend/src/lib/concierge-session.ts`). Chat thread ownership is strictly checked; requests with forged or foreign thread tokens are rejected with HTTP 403.
- **Failure Resilience:** If the Gemini API reaches quota limits or encounters network timeouts, the endpoint catches the error and returns a polite fallback response without crashing the customer UI.
