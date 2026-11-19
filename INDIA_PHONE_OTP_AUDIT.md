# THE HIDDEN LABEL — INDIAN PHONE NUMBER & OTP AUDIT
**Investigation of Mobile Validation, OTP Lifecycle Security, SMS Gateway Architecture, and DLT Compliance**

---

## 1. Executive Summary & Operational Verdict

### **VERDICT: ⛔ CRITICALLY VULNERABLE & NON-OPERATIONAL IN PRODUCTION**

> [!CAUTION]
> 1. **Zero SMS Gateway Code:** The backend has **NO** integration with any Indian SMS provider (MSG91, Gupshup, Twilio, Fast2SMS). The SMS path returns HTTP 501, or in development mode simulates delivery by leaking the OTP code in the response body (`dev_code`).
> 2. **Critical Security Bypass (SEC-CRIT-02):** The server-side Cash-on-Delivery (COD) phone verification can be **completely forged by any remote client** by injecting `cod_otp_verified_at` into `POST /store/carts/:id`.
> 3. **Indian Mobile Format Friction:** Validation strictly requires international E.164 format (`+919876543210`). Bare 10-digit Indian numbers (`9876543210`) or numbers with spaces or leading zeroes are rejected without auto-normalization.

---

## 2. Phone Number Validation & Database Normalization

### 2.1. Format Validation Mechanics
- **Files:** `packages/shared/src/schemas.ts` (lines 23, 64, 86) and `apps/backend/src/api/store/otp/send/route.ts` (lines 47–53).
- **Enforced Regex:** `/^\+[1-9]\d{7,14}$/`
- **Validation Behavioral Matrix:**

| Input Format | Example Input | Validation Outcome | User Impact / Friction |
|---|---|---|---|
| **E.164 with +91** | `+919876543210` | ✅ **PASS** | Validated cleanly. |
| **Bare 10 Digits** | `9876543210` | ❌ **FAIL** (Rejected) | **Severe Friction:** Standard Indian mobile convention rejected with "Use E.164 format". |
| **Leading Zero** | `09876543210` | ❌ **FAIL** (Rejected) | Standard landline/dialing convention rejected. |
| **With Spaces** | `+91 98765 43210` | ❌ **FAIL** (Rejected) | Mobile auto-complete formatting rejected. |
| **With Hyphen** | `+91-9876543210` | ❌ **FAIL** (Rejected) | Mobile copy-paste formatting rejected. |
| **Invalid 9-digit** | `+91987654321` | ❌ **FAIL** (Rejected) | Correctly rejected. |
| **Invalid 11-digit**| `+9198765432109`| ⚠️ **PASS (Incorrect)**| Accepted by E.164 regex despite being an invalid Indian number length. |

### 2.2. Database Schema & Normalization
- **Database Table:** `customer` (Medusa Core) and `order_address`.
- **Normalization:** **Zero normalization exists**. If a user enters `+919876543210`, it is stored as a raw string. No sanitization helper strips spaces, hyphens, or prefixes before database insertion.
- **Duplicate Prevention:**
  - `customer.email` has a UNIQUE constraint in PostgreSQL.
  - `customer.phone` has **NO UNIQUE CONSTRAINT**. Multiple accounts can register with the exact same phone number, creating identity collision risks in customer support and courier delivery.

---

## 3. OTP Security Architecture & Cryptographic Lifecycle

### 3.1. Code Generation & Cryptographic Storage
- **File:** `apps/backend/src/lib/otp.ts`
- **Entropy & Generation:** `generateCode()` uses Node.js cryptographically secure `crypto.randomInt(0, 1_000_000)` padded with leading zeroes to 6 digits (`000000` to `999999`).
- **Storage at Rest:** **HMAC-SHA256 hashed**. Codes are never stored in plaintext in PostgreSQL:
  ```typescript
  export function hashCode(destination: string, code: string): string {
    return createHmac("sha256", secret()).update(`${destination.toLowerCase()}:${code}`).digest("hex");
  }
  ```
  The HMAC secret is derived from `process.env.OTP_SECRET` or `process.env.MEDUSA_JWT_SECRET`.
- **Comparison Security:** Uses `crypto.timingSafeEqual` to prevent side-channel timing attacks during code verification.

### 3.2. Lifecycle Controls & Rate Limiting

| Control | Specification in Code | Implementation File & Line | Verification Result |
|---|---|---|---|
| **Time-to-Live (TTL)** | 5 minutes (300,000 ms) | `src/lib/otp.ts#L7` | ✅ **VERIFIED** (Rejects expired challenges with HTTP 400) |
| **Attempt Limit** | Max 5 attempts per challenge | `src/lib/otp.ts#L8` | ✅ **VERIFIED** (Increments attempt count; returns 429 when exceeded) |
| **Send Rate Limit** | Max 3 requests per 15 min | `src/lib/otp.ts#L9-L10` | ✅ **VERIFIED** (Rejects 4th request with HTTP 429) |
| **Replay Prevention** | Single-use consumption | `src/api/store/otp/verify/route.ts#L31` | ✅ **VERIFIED** (Records `consumed_at` timestamp; rejects replayed codes) |
| **IP Tracking** | Request IP logged | `src/api/store/otp/send/route.ts#L99` | ✅ **VERIFIED** (Records client IP on challenge row) |

---

## 4. Critical Security Finding: SEC-CRIT-02 (COD OTP Forgery)

### 4.1. Defect Analysis & Root Cause
- **Vulnerability Title:** Client-Side Forgery of Cash-on-Delivery OTP Verification
- **Severity:** **CRITICAL (CVSS 8.6)**
- **Vulnerable File:** `apps/backend/src/api/middlewares.ts` (lines 53–97)
- **Root Cause:**
  The server middleware `codOtpVerificationMiddleware` guards `POST /store/carts/:id/complete` by reading `cart.metadata.cod_otp_verified_at`:
  ```typescript
  const cart = await pg("cart").where({ id: cartId }).first("id", "metadata");
  const metadata = (cart?.metadata ?? {}) as Record<string, unknown>;
  const verifiedAt = metadata.cod_otp_verified_at;
  if (!verifiedAt || typeof verifiedAt !== "string") {
    res.status(400).json({ type: "invalid_data", message: "Cash on Delivery requires phone OTP..." });
    return;
  }
  ```
  However, in Medusa's public API, `POST /store/carts/:id` allows any unauthenticated caller to set arbitrary metadata fields on their cart.

### 4.2. Adversarial Exploit Proof
Any attacker or bot script can place high-value COD orders using fake or victim phone numbers without ever solving an OTP:
```bash
# Step 1: Create cart and add items
# Step 2: Inject forged verification proof via public cart API
curl -X POST http://localhost:9000/store/carts/cart_01M7... \
  -H "Content-Type: application/json" \
  -H "x-publishable-api-key: pk_..." \
  -d '{"metadata": {"cod_otp_verified_at": "2026-11-15T09:00:00.000Z", "cod_otp_verified_phone": "+919999999999"}}'

# Step 3: Complete order without OTP challenge
curl -X POST http://localhost:9000/store/carts/cart_01M7.../complete \
  -H "x-publishable-api-key: pk_..."
```
**Result:** HTTP 200 OK. The order is placed and committed to the database.

---

## 5. Indian SMS Provider & Regulatory (TRAI / DLT) Audit

### 5.1. SMS Provider Codebase Inspection
- **Provider Status:** **ZERO IMPLEMENTATION**.
- **Inspection Evidence:**
  In `apps/backend/src/api/store/otp/send/route.ts` (lines 82–88 and 102–110):
  ```typescript
  if (channel === "sms" && !process.env.OTP_PROVIDER) {
    res.status(501).json({
      type: "not_configured",
      message: "SMS one-time codes are not configured on this environment.",
    });
    return;
  }

  // Delivery block:
  let delivery: { sent: boolean; reason?: string } = { sent: false };
  if (channel === "email") {
    delivery = await sendEmail(...);
  }
  // NOTICE: No "else if (channel === 'sms')" exists!
  ```
  Even if an operator configures `OTP_PROVIDER=msg91` in `.env`, the code **literally contains no API client** to call MSG91 or any other SMS gateway. Delivery remains `false`.

### 5.2. Indian Regulatory Compliance (TRAI / DLT)
Under the Telecom Commercial Communications Customer Preference Regulations (TCCCPR), 2018, all commercial and transactional SMS messages delivered to Indian phone numbers must comply with strict Distributed Ledger Technology (DLT) mandates:

| Regulatory Mandate | Compliance Requirement | Repository Status |
|---|---|---|
| **Principal Entity (PE) Registration** | Legal entity registered with Indian telecom operators (Jio, Airtel, Vodafone-Idea) | ❌ **UNCONFIGURED** |
| **Sender Header (Header ID)** | 6-character registered sender alphanumeric ID (e.g., `THLBL` or `THLIND`) | ❌ **NOT CONFIGURED** |
| **Content Template Registration** | Exact template registered with static text and `{#var#}` variable placeholders | ❌ **NOT CONFIGURED** |
| **DLT Template ID Header** | Every outbound SMS API call must include the registered 19-digit Template ID | ❌ **NOT IMPLEMENTED** |
| **Consent Management** | Transactional vs Service Explicit routing | ❌ **NOT IMPLEMENTED** |

---

## 6. Required Remediation for Phone & OTP Architecture

1. **Implement Real Indian SMS Client (MSG91 / Twilio):**
   - Build `apps/backend/src/lib/sms.ts` integrating with a licensed DLT-compliant Indian SMS provider.
   - Support DLT Template ID parameters in API payloads.
2. **Fix Security Vulnerability SEC-CRIT-02:**
   - Strip `cod_otp_verified_at` and `cod_otp_verified_phone` from client-submitted metadata updates in `POST /store/carts/:id`.
   - Store verified challenge IDs in a dedicated server-controlled database table (`cart_cod_verification`) linked to the cart, verifying `otp_challenge.consumed_at` directly during cart completion.
3. **Implement Phone Normalization Helper:**
   - Create a sanitizer that converts `9876543210`, `09876543210`, or `+91 98765 43210` into canonical E.164 `+919876543210`.
