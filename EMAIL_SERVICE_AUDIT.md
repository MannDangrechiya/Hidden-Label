# THE HIDDEN LABEL — EMAIL SERVICE DEEP AUDIT
**Detailed Investigation of Transactional Email Architecture, Provider Configuration, Triggers, and Deliverability**

---

## 1. Executive Summary & Operational Verdict

### **VERDICT: ⛔ NOT CONFIGURED / SEVERELY INCOMPLETE**

> [!CAUTION]
> The transactional email system is **not operational**. The third-party API key (`RESEND_API_KEY`) is unset in the runtime environment. When invoked, the email service logs an informative line to the console (`[email:not-configured]`) and returns `{ sent: false }`. Furthermore, **critical transactional triggers (Order Confirmation, Payment Receipt, Shipment Tracking, Delivery Confirmation, and Cancellation) are completely absent from the codebase**; they are neither wired to Medusa event subscribers nor invoked during business workflows.

---

## 2. Email Provider Configuration & Runtime Mechanics

### 2.1. Provider Identification & Initialization
- **Configured Provider:** Resend (`https://api.resend.com/emails`).
- **File:** `apps/backend/src/lib/email.ts`
- **Client Implementation:** Native `fetch()` call against Resend REST API v1 using `Bearer ${apiKey}` authorization.
- **Runtime Environment Check:**
  - `RESEND_API_KEY`: **UNDEFINED** (Not configured in `apps/backend/.env`).
  - `EMAIL_FROM`: Falls back to default `"orders@thehiddenlabel.com"`.
- **Runtime Fallback Behavior:**
  When `RESEND_API_KEY` is not present, `email.ts` executes:
  ```typescript
  if (!apiKey) {
    console.info(`[email:not-configured] to=${input.to} subject="${input.subject}"`);
    return { sent: false, reason: "RESEND_API_KEY is not configured." };
  }
  ```
  The caller receives `{ sent: false }` and continues execution. While this prevents order creation from crashing due to an unconfigured email provider, **no actual emails can reach customers**.

### 2.2. Error & Failure Handling
- **Network / HTTP Timeout:** Enforces `AbortSignal.timeout(10_000)` (10-second bounded timeout).
- **Non-2xx HTTP Responses:** Truncates response error body to 200 characters and returns `{ sent: false, reason: "Resend <status>: ..." }`.
- **Retry Mechanism:** **Zero retries**. If a network glitch occurs or Resend returns a 5xx error, the email is permanently lost with no retry queue or dead-letter queue.
- **Queueing / Asynchronous Dispatch:** Calls to `sendEmail()` are executed sequentially in-process. Without a background BullMQ / Redis job queue, slow Resend responses directly block API request latency.

---

## 3. Email Functional Coverage Matrix

Every potential transactional email event across the 18-stage business lifecycle was audited across the entire repository:

| Email Category | Intended Business Purpose | Codebase Implementation Status | Exact Location / Trigger | Actual Runtime Behavior |
|---|---|---|---|---|
| **Welcome Email** | Greet new registered customer | ❌ **NOT IMPLEMENTED** | None | No email dispatched upon customer registration. |
| **Email Verification** | Verify customer email address | ❌ **NOT IMPLEMENTED** | None | Accounts created without email ownership verification. |
| **Login / OTP Email** | Deliver 6-digit one-time code | ⚠️ **PARTIALLY IMPLEMENTED** | `src/api/store/otp/send/route.ts` line 104 | Generates OTP, logs to console; returns 201 with `{ delivered: false }`. |
| **Password Reset** | Deliver secure reset password link | ⚠️ **PARTIALLY IMPLEMENTED** | `src/subscribers/auth-password-reset.ts` line 29 | Listens to `auth.password_reset`; logs to console; returns `{ sent: false }`. |
| **Order Confirmation** | Send itemized receipt upon purchase | ❌ **NOT IMPLEMENTED (ORPHANED CODE)** | `src/lib/email.ts` lines 54–79 (`orderEmailHtml`) | Template exists in `email.ts` but is **never imported or called anywhere in the repository**. |
| **Payment Confirmation** | Confirm online payment capture | ❌ **NOT IMPLEMENTED** | None | Zero payment confirmation notifications. |
| **Order Cancellation** | Notify customer of order cancellation | ❌ **NOT IMPLEMENTED** | `src/api/store/orders/[id]/cancel/route.ts` | Order status changes to `canceled` in DB with zero email dispatch. |
| **Shipment Tracking** | Deliver AWB and tracking link | ❌ **NOT IMPLEMENTED** | `src/api/admin/shipments/route.ts` | Shipment created with zero email dispatch. |
| **Out for Delivery** | Alert customer of imminent arrival | ❌ **NOT IMPLEMENTED** | None | Zero courier milestone email notifications. |
| **Delivery Confirmation** | Confirm parcel handover & invoice | ❌ **NOT IMPLEMENTED** | `src/lib/shipment-status.ts` | Status updates to `delivered` in DB with zero email dispatch. |
| **Return Request Receipt**| Acknowledge return request & RMA | ⚠️ **PARTIALLY IMPLEMENTED** | `src/api/store/return-requests/route.ts` line 209 | Gathers return details, logs to console; returns `{ sent: false }`. |
| **Return Approved/Rejected**| Notify customer of inspection result | ❌ **NOT IMPLEMENTED** | `src/api/admin/returns/[id]/route.ts` | Return status mutated in DB with zero email dispatch. |
| **Refund Confirmation** | Confirm credit / UPI transfer | ❌ **NOT IMPLEMENTED** | None | Zero refund confirmation emails. |
| **Customer Support Ticket**| Acknowledge support inquiry | ❌ **NOT IMPLEMENTED** | None | No support ticketing email system exists. |
| **Admin Alerts** | High-value order or stockout alerts | ❌ **NOT IMPLEMENTED** | None | No administrative email notifications exist. |

---

## 4. Email Quality & Template Engineering

### 4.1. Template Inventory & Inspection
Only three email payloads are defined in the entire backend:

1. **OTP Verification Email (`src/api/store/otp/send/route.ts`):**
   - Subject: `"Your The Hidden Label verification code"`
   - HTML: `<p>Your verification code is <strong style="font-size:22px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 5 minutes. If you did not request it, ignore this message.</p>`
   - Quality: Minimal unstyled HTML. Lacks brand logo, responsive container, or legal footer.

2. **Password Reset Email (`src/subscribers/auth-password-reset.ts`):**
   - Subject: `"Reset your The Hidden Label password"`
   - HTML: Inline paragraph with a plain link to `${storefrontOrigin}/reset-password?token=${token}`.
   - Quality: Minimal unstyled HTML. Lacks brand identity or security warning regarding unauthorized reset attempts.

3. **Return Request Confirmation (`src/api/store/return-requests/route.ts`):**
   - Subject: `"Return request received — THL-${order.display_id}"`
   - HTML: Basic bulleted list of returned items and return reason.
   - Quality: Plain inline HTML.

4. **Orphaned Order Confirmation Template (`src/lib/email.ts#L54-L79`):**
   - Heading, intro, order display ID, item table (title, quantity, price), and order total.
   - Styling: Responsive table container (`max-width: 560px`, background `#f8f7f4`, border `#e4e4e7`).
   - Defect: **Dead code**. It is never called by Medusa order workflows or API handlers.

---

## 5. Domain, Deliverability & Compliance Audit

| Requirement | Audit Finding | Compliance Status |
|---|---|---|
| **Sender Domain** | `orders@thehiddenlabel.com` | Unverified in Resend DNS |
| **SPF Record** | `v=spf1 include:amazonses.com ...` or `include:resend.com` | Not verifiable in local environment |
| **DKIM Signing** | Resend automated DKIM CNAME records | Not verifiable in local environment |
| **DMARC Policy** | `v=DMARC1; p=reject; rua=mailto:...` | Not verifiable in local environment |
| **Unsubscribe Headers** | `List-Unsubscribe` / `List-Unsubscribe-Post` | Absent on all outbound templates |
| **Physical Address Footer** | Mandatory Indian postal address in footer | Absent on all outbound templates |

---

## 6. Required Remediation for Email Production Readiness

1. **Provision Resend Account & API Keys:** Add `RESEND_API_KEY` to secret store and configure DNS TXT/CNAME records for `thehiddenlabel.com` (SPF, DKIM, DMARC).
2. **Implement Event Subscribers for Order Lifecycle:**
   - Create Medusa event subscribers in `src/subscribers/` for:
     - `order.placed`: Invokes `orderEmailHtml` to send order confirmation.
     - `order.canceled`: Dispatches order cancellation notice.
     - `order.fulfillment_created`: Dispatches shipment notification with carrier and AWB tracking URL.
     - `return.created` & `return.received`: Dispatches RMA progress updates.
3. **Queue Email Jobs in BullMQ/Redis:** Decouple email dispatch from HTTP request lifecycle by queueing email tasks in Redis.
4. **Implement Luxury Branded HTML Templates:** Build responsive, dark/light luxury email templates matching the brand's visual identity with logo, boutique address, and support links.
