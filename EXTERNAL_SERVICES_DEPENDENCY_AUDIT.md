# THE HIDDEN LABEL — EXTERNAL SERVICES DEPENDENCY AUDIT
**Exhaustive Technical Audit of all 21 Platform Integrations, Providers, Fallbacks, and Runtime Connectivity**

---

## 1. Executive Summary & Infrastructure Health Matrix

| Service Category | Targeted Service Provider | Implementation in Code | Env Config Present | Live Connectivity | Graceful Fallback? | Current Production State |
|---|---|---|---|---|---|---|
| **1. Transactional Email** | Resend (`api.resend.com`) | ✅ Implemented in `email.ts` | ❌ `RESEND_API_KEY` unset | ❌ Disconnected | ✅ Logs to console | ⛔ **NON-OPERATIONAL** |
| **2. Indian SMS / OTP** | Indian DLT Gateway (MSG91/Twilio) | ❌ Zero API client code | ❌ `OTP_PROVIDER` unset | ❌ Disconnected | ⚠️ Simulated echo | ⛔ **NON-OPERATIONAL** |
| **3. WhatsApp Messaging** | WhatsApp Business Cloud API | ❌ Not implemented | ❌ None | ❌ Disconnected | ❌ None | ❌ **NOT IMPLEMENTED** |
| **4. Payment Gateway** | Razorpay (`api.razorpay.com`) | ⚠️ Backend scaffold only | ❌ Keys unset | ❌ Disconnected | ⚠️ COD only | ⛔ **NON-OPERATIONAL** |
| **5. Courier & Logistics** | Shiprocket (`apiv2.shiprocket.in`)| ✅ Implemented in `shiprocket.ts`| ❌ Credentials unset| ❌ Disconnected | ⚠️ Manual dispatch | ⚠️ **FALLBACK ONLY** |
| **6. PIN Serviceability**| India Post / Shiprocket API | ❌ Not implemented | ❌ None | ❌ Disconnected | ⚠️ Accepts all PINs | ❌ **NOT IMPLEMENTED** |
| **7. Primary Database** | Managed PostgreSQL 18 | ✅ Fully integrated | ✅ `DATABASE_URL` set | ✅ Connected | N/A (Core Engine) | ⚠️ **LOCAL EMBEDDED** |
| **8. Redis & In-Memory** | Redis 7+ Cluster | ✅ Medusa Redis driver | ❌ `REDIS_URL` unset | ❌ Disconnected | ⚠️ Medusa In-Memory | ⚠️ **IN-MEMORY ONLY** |
| **9. Job Queue / Events**| BullMQ / Medusa Event Bus | ⚠️ In-memory queue | ❌ No Redis | ⚠️ In-memory | ⚠️ Ephemeral queue | ⚠️ **EPHEMERAL** |
| **10. Object Storage** | AWS S3 / Cloudflare R2 | ⚠️ S3 env template only | ❌ `S3_*` unset | ❌ Disconnected | ⚠️ External URLs | ⚠️ **UNCONFIGURED** |
| **11. Content Delivery**| Cloudflare / AWS CloudFront | ❌ Not configured | ❌ None | ❌ Disconnected | ⚠️ Localhost origin | ⚠️ **LOCAL ONLY** |
| **12. Image Optimization**| Next.js Image Optimizer | ✅ Next.js native | ✅ Built-in | ✅ Active | N/A | ✅ **OPERATIONAL** |
| **13. Search Engine** | Algolia / Meilisearch / DB | ⚠️ PostgreSQL ILIKE | ✅ Built-in | ✅ Active | N/A | ⚠️ **BASIC SQL ONLY** |
| **14. Web Analytics** | PostHog / Google Analytics 4 | ❌ Not implemented | ❌ None | ❌ Disconnected | None | ❌ **NOT IMPLEMENTED** |
| **15. Error Monitoring** | Sentry (`@sentry/nextjs`) | ⚠️ Template entry | ❌ `SENTRY_DSN` unset| ❌ Disconnected | ⚠️ Console error | ⚠️ **UNCONFIGURED** |
| **16. System Logging** | Winston / Medusa Logger | ✅ Fully integrated | ✅ `LOG_LEVEL=info` | ✅ Active | N/A | ✅ **OPERATIONAL** |
| **17. Bot Protection** | Cloudflare Turnstile / reCAPTCHA| ❌ Not implemented | ❌ None | ❌ Disconnected | None | ❌ **NOT IMPLEMENTED** |
| **18. Helpdesk & Support**| Zendesk / Freshdesk | ❌ Not implemented | ❌ None | ❌ Disconnected | ⚠️ Static FAQ | ❌ **NOT IMPLEMENTED** |
| **19. Reviews & Ratings** | Judge.me / Yotpo / Custom | ❌ Not implemented | ❌ None | ❌ Disconnected | None | ❌ **NOT IMPLEMENTED** |
| **20. Generative AI** | Google Gemini (`gemini-flash-latest`)| ✅ Fully integrated | ✅ `GEMINI_API_KEY` set| ✅ Active | ⚠️ Keyword template | ✅ **OPERATIONAL** |
| **21. Database Backups**| Automated pg_dump / WAL-G | ❌ Not implemented | ❌ None | ❌ Disconnected | None | ❌ **MANUAL ONLY** |

---

## 2. In-Depth Service Breakdown & Audit Analysis

### 2.1. Transactional Email — Resend
1. **Why the Business Needs It:** Delivery of order confirmations, invoice receipts, shipping tracking updates, return approvals, and password resets.
2. **Code References:** `apps/backend/src/lib/email.ts`, `apps/backend/src/api/store/otp/send/route.ts`, `apps/backend/src/subscribers/auth-password-reset.ts`.
3. **Implementation Status:** Implemented in `email.ts` using `fetch("https://api.resend.com/emails")`.
4. **Configuration Exists:** **No**. `RESEND_API_KEY` is undefined in `apps/backend/.env`.
5. **Runtime Connectivity:** Fails closed gracefully; returns `{ sent: false, reason: "RESEND_API_KEY is not configured." }`.
6. **Works Without It:** Yes; API routes log to console and continue.
7. **Fallback Exists:** Logs `[email:not-configured] to=... subject=...` to console.
8. **Currently Mocked:** Effectively mocked via console logger.
9. **Remaining Work:** Provision Resend API key; verify sender domain `thehiddenlabel.com` (SPF/DKIM); build order confirmation and shipping email event listeners.

### 2.2. Indian SMS / OTP Provider
1. **Why the Business Needs It:** Verification of Indian phone numbers during registration and Cash on Delivery order placement; courier delivery notifications.
2. **Code References:** `apps/backend/src/api/store/otp/send/route.ts#L82`.
3. **Implementation Status:** **Not implemented**. Zero code calling MSG91, Twilio, or any SMS gateway.
4. **Configuration Exists:** **No**. `OTP_PROVIDER` is undefined.
5. **Runtime Connectivity:** Returns HTTP 501 `not_configured`.
6. **Works Without It:** Only when `OTP_DEV_ECHO=true` in non-production. In production, SMS fails completely.
7. **Fallback Exists:** Falls back to transactional email if email address is present in checkout session.
8. **Currently Mocked:** Mocked via development echo leaking `dev_code` in JSON response.
9. **Remaining Work:** Procure DLT-registered SMS gateway account; register Sender Header and Templates; implement real API client in `src/lib/sms.ts`.

### 2.3. Payment Gateway — Razorpay
1. **Why the Business Needs It:** Processing online Indian payments: UPI (Google Pay, PhonePe, Paytm, CRED), RuPay, Visa, Mastercard, Net Banking, and Cardless EMI.
2. **Code References:** `apps/backend/src/modules/razorpay/service.ts`, `apps/backend/medusa-config.ts`.
3. **Implementation Status:** Backend provider class implemented; **Storefront client SDK completely missing**.
4. **Configuration Exists:** **No**. `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are undefined.
5. **Runtime Connectivity:** Throws `MedusaError(NOT_ALLOWED)`.
6. **Works Without It:** Yes, but strictly restricted to Cash on Delivery (`pp_system_default`).
7. **Fallback Exists:** Fallback to Cash on Delivery.
8. **Currently Mocked:** No (fails loudly if keys are missing).
9. **Remaining Work:** Add live keys; attach `pp_razorpay_razorpay` to India region in database; embed `checkout.js` in storefront.

### 2.4. Logistics & Courier — Shiprocket
1. **Why the Business Needs It:** Automated courier dispatch across India, Air Waybill (AWB) generation, shipping label printing, real-time tracking webhooks.
2. **Code References:** `apps/backend/src/lib/shiprocket.ts`, `apps/backend/src/api/admin/shipments/route.ts`, `apps/backend/src/api/webhooks/shiprocket/route.ts`.
3. **Implementation Status:** REST client implemented.
4. **Configuration Exists:** **No**. `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` are undefined.
5. **Runtime Connectivity:** `isConfigured()` returns `false`.
6. **Works Without It:** Yes; admin shipments route falls back to `{ provider: "manual" }`.
7. **Fallback Exists:** Manual dispatch entry (admin enters courier name and tracking code manually).
8. **Currently Mocked:** No (returns manual provider record).
9. **Remaining Work:** Provision Shiprocket credentials; implement dynamic volumetric box dimensions; implement reverse logistics return pickups.

### 2.5. Primary Database — PostgreSQL
1. **Why the Business Needs It:** Relational persistence for orders, inventory, catalog, customers, and custom modules.
2. **Code References:** `apps/backend/medusa-config.ts`, `scripts/dev-db.mjs`.
3. **Implementation Status:** Fully implemented on PostgreSQL 18.6 with 168 tables.
4. **Configuration Exists:** **Yes**. `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5437/the_hidden_label`.
5. **Runtime Connectivity:** **Operational** on port 5437.
6. **Works Without It:** No (Platform fails closed).
7. **Fallback Exists:** WASM in-process database exists for inspection scripts (`scripts/dev-db-wasm.mjs`), but unsupported for production pooling.
8. **Currently Mocked:** No (Real PostgreSQL cluster).
9. **Remaining Work:** Migrate from local embedded instance to a managed cloud database (AWS RDS / GCP Cloud SQL / Neon) with automated daily snapshots and SSL connections.

### 2.6. Cache & Event Bus — Redis
1. **Why the Business Needs It:** Distributed caching, Medusa event bus routing, BullMQ job queuing, and horizontal scalability.
2. **Code References:** `apps/backend/medusa-config.ts#L15`.
3. **Implementation Status:** Supported via `@medusajs/medusa/event-bus-redis` and `cache-redis`.
4. **Configuration Exists:** **No**. `REDIS_URL` is undefined.
5. **Runtime Connectivity:** Disconnected.
6. **Works Without It:** Yes; Medusa boots using in-memory event bus and in-memory cache fallbacks.
7. **Fallback Exists:** In-memory EventEmitter fallback.
8. **Currently Mocked:** No; uses official in-memory fallback.
9. **Remaining Work:** Provision managed Redis instance (port 6379/6380) and set `REDIS_URL` to prevent job queue loss during server restarts.

### 2.7. Generative AI — Google Gemini
1. **Why the Business Needs It:** Style Concierge conversational styling advice and Search by Sight visual item discovery.
2. **Code References:** `apps/backend/src/lib/gemini.ts`, `apps/backend/src/api/store/concierge/chat/route.ts`, `apps/backend/src/api/store/sight-search/route.ts`.
3. **Implementation Status:** Fully implemented using `gemini-flash-latest` with a 2-second timeout and retry logic.
4. **Configuration Exists:** **Yes**. Valid API key configured in `apps/backend/.env`.
5. **Runtime Connectivity:** **Operational**. Calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`.
6. **Works Without It:** Yes; bounded to < 4.5s latency, falling back to deterministic keyword template matching.
7. **Fallback Exists:** Catalog keyword lookup fallback.
8. **Currently Mocked:** No; real live HTTP calls to Google AI Studio.
9. **Remaining Work:** Monitor free-tier rate limits and transition to Vertex AI or paid tier before heavy public traffic drops.
