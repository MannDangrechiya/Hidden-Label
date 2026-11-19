# THE HIDDEN LABEL — Audit Remediation Execution Report

**Date:** 17 November 2026
**Scope:** all 18 audit deliverables listed in `MASTER_AUDIT_SUMMARY.md` §4 (35 gaps in
`FUNCTIONAL_GAP_REGISTER.md`)
**Approach:** phase-by-phase, root-cause fixes in code; no test suppression, no fake providers.

This report supersedes the claims in `REMEDIATION_REPORT.md` that the final release gate
disproved (self-role escalation, forgeable COD proof, placeholder GST invoice).

---

## 0. Verdict

| Area | Before | After this remediation |
|---|---|---|
| Privilege escalation via `/admin/users/me` | CRITICAL, exploitable | **Fixed and exploit re-run: 403** |
| COD OTP forgery via cart metadata | CRITICAL, exploitable | **Fixed and exploit re-run: blocked** |
| GST configuration in the tax engine | 0 rows, tax_total = 0 | **4 slabs seeded; tax now computed** |
| GST invoice | dummy GSTIN, CGST/SGST nationwide, HSN 6403 for everything | **env GSTIN, IGST/CGST split by place of supply, per-item HSN** |
| Razorpay checkout | no SDK in the storefront | **checkout.js + verify + webhook endpoint** |
| SMS OTP | no provider code | **MSG91/Twilio client + Indian phone normalisation + DLT vars** |
| Shiprocket | hardcoded box, hardcoded "COD" | **per-item dimensions/weight, real payment mode, reverse pickup** |
| Transactional email | orphaned template | **order placed / shipped / cancelled / delivered subscribers** |
| Support & grievance | static FAQ only | **ticket API + storefront form + admin inbox + grievance page/SLA** |
| DPDP / Legal Metrology | absent | **affirmative consent, self-service erasure, PDP declarations** |
| Infra headers | no HSTS/CSP | **HSTS + CSP on storefront and admin** |
| Unit tests | 70/70 | **70/70 still passing** |
| Typecheck | — | **0 errors, 6/6 workspaces** |

---

## 0.1 Product decision — prepaid only (UPI and card)

Cash on Delivery is **not offered**. Every order is prepaid through Razorpay with **UPI or
card**; EMI and COD were removed from the checkout. This supersedes the COD-specific items in
Phases 1, 3 and 5 below:

- `pp_system_default` (COD) is **no longer linked to the India region**. Verified live:
  `GET /store/payment-providers` returns `[]`, and creating a session with `pp_system_default`
  fails with *"Payment provider pp_system_default is not enabled in the cart's region"*.
- `pnpm db:setup-payments` enforces that state idempotently on any existing environment, and
  `db:seed` creates new regions prepaid-only.
- The storefront payment step shows only UPI and cards; both open the Razorpay checkout with the
  method preselected. If Razorpay is unconfigured the step says payment is unavailable rather
  than falling back to COD.
- The COD refund-account capture form was removed (online refunds return to the original UPI
  account or card). The backend `refund_account` endpoint/table are left in place but unused.
- The COD OTP gate and `/store/carts/:id/verify-cod` remain in the backend as defence in depth
  for any legacy cart that still holds a system-provider session; with COD unlinked they are
  inert for normal traffic.

---

## 1. Phase 1 — Critical security & RBAC

| Gap | Fix | Files |
|---|---|---|
| **GAP-SEC-01** self-role escalation | The `/admin/users/me` exemption is now `GET`/`HEAD`/`OPTIONS` only. A non-GET carrying `role`/`roles`/`permissions`/`is_owner`/`owner` returns **403**; privileged keys are stripped from any accepted self-update. | `apps/backend/src/api/middlewares.ts` |
| **GAP-SEC-02** COD OTP forgery | New server-only table **`cod_verification`**. `POST /store/carts/:id/verify-cod` solves a real `otp_challenge` (purpose `cod_verify`), consumes it, and writes the proof. Cart completion reads that table, consumes the proof, and rejects without it. Every store cart write passes a guard that strips `cod_otp_verified_at`, `cod_otp_verified_phone` and the other reserved keys — the wildcard matcher is deliberate because an exact `:id` matcher did not catch Medusa's core update route. | `middlewares.ts`, `api/store/carts/[id]/verify-cod/route.ts`, `modules/thl/models/cod-verification.ts`, migration `Migration20261117100000.ts`, `apps/storefront/app/actions/checkout.ts` |
| **GAP-SEC-03** brute force | Sliding-window limiter on `/auth/customer/emailpass` and `/auth/user/emailpass` (10 attempts / 15 min per IP+email, 15-minute lock, cleared on success). | `src/lib/rate-limit.ts`, `middlewares.ts` |

**Verified live** (backend on :9000, audit accounts):

```
GET  /admin/users/me          -> 200  role readonly
POST /admin/users/me {role}   -> 403  privileged metadata cannot be changed
PATCH/admin/users/me          -> 403
GET  /admin/users/me/../orders-> 403
POST /admin/users/:id (self)  -> 403
GET  /admin/users/me          -> 200  role still readonly   (no mutation)
```

```
POST /store/carts/:id {metadata:{cod_otp_verified_at}}  -> 200, stored metadata {}
POST /store/carts/:id/complete (no proof)               -> 400 COD OTP required
POST /store/carts/:id/complete (server proof present)   -> passes the gate
```

Reproduce: `node .audit/verify-cod-hardening.mjs` and `node .audit/test-users-me.mjs`.

> Deployment note: the limiter is process-local. With more than one backend replica, move it to
> Redis or the edge/WAF, otherwise the effective limit is `replicas × 10`.

---

## 2. Phase 2 — GST tax engine & statutory invoice

| Gap | Fix | Files |
|---|---|---|
| **GAP-TAX-01** zero tax config | Idempotent `ensureIndiaTaxSetup()` seeds a country-level India `tax_region` (provider `tp_system`) with GST **5 / 12 / 18 / 28**, 18 % as the single default. Wired into `db:seed` and a production-safe `pnpm db:setup-tax`. | `src/lib/tax.ts`, `src/scripts/setup-tax.ts`, `src/scripts/seed.ts`, root `package.json` |
| **GAP-TAX-02** illegal CGST/SGST nationwide | `computeInclusiveGst()` compares the shipping state with `BUSINESS_STATE_CODE`; same state → CGST+SGST, different state → **IGST**. Legs are rendered conditionally and the place of supply is printed with the buyer's state code. | `packages/shared/src/gst.ts`, invoice page |
| **GAP-TAX-03** dummy GSTIN | `BUSINESS_GSTIN`, `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_STATE_CODE/NAME`. When the GSTIN is unset the invoice says "Registration not configured" instead of printing a fake number. | invoice page, `.env.example` |
| **GAP-TAX-04** universal HSN 6403 | Products are seeded with `metadata.hsn` (6403 footwear, 6203/6204 apparel, 6110/6109 knitwear, 4202 bags, 9004 eyewear, 3303 fragrance) plus parcel metadata. The invoice uses line → product → title-classifier fallback. | `src/lib/hsn.ts`, `seed.ts`, invoice page |
| **GAP-TAX-05** hardcoded payment mode | `order.metadata.payment_method` is written server-side at order placement (`cod` / `razorpay`); the invoice derives "Cash on Delivery" or "Prepaid — online payment". | `app/actions/checkout.ts`, invoice page |

**Verified live:** cart with a ₹15,999 line item, shipping address in Gujarat and then
Maharashtra:

```
Gujarat     subtotal 15999  tax_total 2879.82  total 18878.82
Maharashtra subtotal 15999  tax_total 2879.82  total 18878.82
```

GST region `txr_01M7N4PQ58ZRCZ7VEKW6DWYQX5`, rates `GST5/GST12/GST18(default)/GST28` in the
database. (`tax_total` was 0 on every order before this change.)

---

## 3. Phase 3 — Razorpay online payments

| Gap | Fix | Files |
|---|---|---|
| **GAP-PAY-01** no storefront SDK | `checkout.js` is loaded on demand; the modal opens with the **server-created** Razorpay order id and amount. The handler posts the signed triple back to a server action that updates the payment session and completes the cart; a bad signature fails the session and no order exists. UPI/card/EMI rows are only enabled when the provider is linked **and** `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set. | `components/checkout-payment-form.tsx`, `app/actions/checkout.ts`, `app/checkout/page.tsx`, `lib/medusa.ts` |
| **GAP-PAY-02 / 03** keys & region link | Already scaffolded; `pnpm db:seed` links `pp_razorpay_razorpay` to the India region when `RAZORPAY_KEY_ID` is present. Activation is now env-only. | `.env.example`, `seed.ts` |
| **GAP-PAY-04** COD refund instrument | Superseded by the prepaid-only decision: online refunds return to the original instrument, and the storefront payout form was removed. The validated backend endpoint remains for manual payouts. | `modules/thl/models/refund-account.ts`, `api/store/refund-accounts/route.ts`, `components/refund-account-form.tsx`, returns page |
| **GAP-PAY-05** no `/webhooks/razorpay` | Dedicated route with `preserveRawBody`, timing-safe HMAC-SHA256 verification against `RAZORPAY_WEBHOOK_SECRET`; invalid signatures 401, unconfigured 503. Medusa's canonical provider hook still performs the payment-state advance (no duplicate mutation). | `api/webhooks/razorpay/route.ts`, `middlewares.ts` |

**Activation:** set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in the
backend, `NEXT_PUBLIC_RAZORPAY_KEY_ID` in the storefront, then run `pnpm db:seed` (or link the
provider manually) and point the Razorpay dashboard at `/webhooks/razorpay`.

---

## 4. Phase 4 — Indian SMS & DLT

| Gap | Fix | Files |
|---|---|---|
| **GAP-SMS-01** no SMS provider | Real client: **MSG91 v5 flow API** (auth key + DLT template id + sender header) with a **Twilio** fallback. No mock: unconfigured → HTTP 501, and the storefront says it fell back to email. | `src/lib/sms.ts`, `api/store/otp/send/route.ts` |
| **GAP-SMS-02** rejects bare 10 digits | `normalizeIndianPhone()` accepts `9876543210`, `09876543210`, `91 98765 43210`, `+91 98765 43210` and stores E.164. | `src/lib/phone.ts`, OTP route |
| **GAP-SMS-03** no DLT config | `OTP_PROVIDER`, `OTP_API_KEY`, `OTP_TEMPLATE_ID`, `OTP_SENDER_ID` documented and used; `OTP_DEV_ECHO` remains gated to non-production. | `.env.example`, `sms.ts` |

---

## 5. Phase 5 — Logistics & reverse logistics

| Gap | Fix | Files |
|---|---|---|
| **GAP-LOG-01** unconfigured | Credentials read from env as before; every failure still falls back to a truthful manual dispatch. | `lib/shiprocket.ts` |
| **GAP-LOG-02** hardcoded box & payment mode | `computePackage()` derives L×B×H from product/line metadata and category, stacks quantities, caps height at 60 cm, and charges `max(actual, volumetric L×B×H/5000)`. Payment mode is `Prepaid` for every new order (COD removed); the `COD` branch remains only for legacy records. | `lib/package.ts`, `api/admin/shipments/route.ts`, `lib/shiprocket.ts`, `seed.ts` |
| **GAP-LOG-03** webhook doesn't reach Medusa | A delivered scan now writes `fulfillment.delivered_at` for the linked fulfilment (idempotent, webhook dedupe preserved) and sends the delivery email. | `api/webhooks/shiprocket/route.ts` |
| **GAP-LOG-04** no reverse pickup | Return approval books a Shiprocket **return** order with the same computed dimensions and stores AWB/courier on `return_request`. Provider failure returns a manual-pickup note, never a fake AWB. | `lib/shiprocket.ts`, `lib/returns.ts` |

**Activation:** `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION`,
`SHIPROCKET_WEBHOOK_TOKEN`.

---

## 6. Phase 6 — Transactional email

| Gap | Fix | Files |
|---|---|---|
| **GAP-EML-01** no Resend key | Existing `sendEmail` used everywhere; key remains env-driven and failures never block an order. | `lib/email.ts` |
| **GAP-EML-02** no lifecycle mail | Subscribers for `order.placed`, `order.canceled`, `order.fulfillment_created`, plus the delivered mail from the courier webhook. All render through the shared branded template. | `subscribers/order-placed.ts`, `order-canceled.ts`, `order-fulfillment-created.ts`, `lib/order-email.ts`, shiprocket webhook |
| **GAP-EML-03** orphaned `orderEmailHtml` | Now the single template used by every order message. | `lib/email.ts`, `lib/order-email.ts` |

**Activation:** `RESEND_API_KEY`, `EMAIL_FROM`; verify SPF, DKIM and DMARC for the sending
domain in DNS (deployment step).

---

## 7. Phase 7 — Consumer protection, privacy & support

| Gap | Fix | Files |
|---|---|---|
| **GAP-SUP-01** static FAQ only | `support_ticket` table, public `POST /store/support/tickets` (validated, category, optional order/customer), storefront contact form, and an admin **Support inbox** (A-21) listing tickets with status/priority/resolution. | model + migration, `api/store/support/tickets/route.ts`, `api/admin/support/tickets/*`, `app/actions/support.ts`, `components/support-contact-form.tsx`, `app/support/page.tsx`, admin `support/page.tsx`, nav |
| **GAP-SUP-02** no Grievance Officer | `/policies/grievance` with officer, email, phone, hours, address, and the statutory **48 h acknowledgement / 30-day resolution**; the same block appears in the footer on every page. Env-driven. | `app/policies/grievance/page.tsx`, `components/site-footer.tsx`, `.env.example` |
| **GAP-REG-01** DPDP notice | Privacy policy plus the consent notice on registration and checkout; grievance page carries the data-principal rights summary. | policy seed, register/checkout UI |
| **GAP-REG-02** no affirmative consent | Unticked, required consent checkbox at registration and at checkout, with a stored `privacy_consent_at` + policy version (customer metadata / order metadata). | `register-form.tsx`, `actions/auth.ts`, `checkout-payment-form.tsx`, `actions/checkout.ts` |
| **GAP-REG-03** no erasure workflow | `DELETE /store/customers/me/delete-account`: closes the account, redacts name/phone/address/email, removes provider identities, retains order records in redacted form for tax law. Self-service button in the account area. | `api/store/customers/me/delete-account/route.ts`, `actions/account.ts`, `app/account/page.tsx` |
| **GAP-REG-04** no Legal Metrology data | PDP "Product declarations": country of origin, net quantity, MRP inclusive of taxes, HSN, marketed-by and consumer-care contacts. | `app/products/[handle]/page.tsx`, product metadata from seed |

---

## 8. Phase 8 — Infrastructure hardening

| Gap | Fix | Files |
|---|---|---|
| **GAP-INF-01** no HSTS/CSP | `Strict-Transport-Security` (production only) and a CSP that keeps Razorpay working (`script/frame/connect` for `checkout.razorpay.com` and `api.razorpay.com`), `unsafe-inline` for Next's bootstrap, `unsafe-eval` dev-only, `frame-ancestors 'none'`, `object-src 'none'`. Applied to storefront and admin. | `apps/storefront/next.config.ts`, `apps/admin/next.config.ts` |
| **GAP-INF-02** local PostgreSQL | Application-level fixes complete; migrating to a managed instance with SSL, pooling and backups is an infrastructure action, not code. Set `DATABASE_URL` to the managed URL and run `pnpm db:migrate && pnpm db:setup-tax`. | `.env.example` |
| **GAP-INF-03** in-memory Redis | Set `REDIS_URL` to the managed cluster; Medusa's event bus, locking engine and cache then use it (the boot log currently warns about the fake Redis). Also the prerequisite for moving auth rate limiting off process memory. | `medusa.config.ts` (already reads `REDIS_URL`), `.env.example` |

CORS is already env-driven (`STOREFRONT_ORIGIN`, `ADMIN_ORIGIN`); set the production HTTPS
origins at deploy time.

---

## 9. Verification actually run

| Check | Result |
|---|---|
| `pnpm typecheck` (6 workspaces) | **0 errors** |
| `pnpm test` | **70 / 70** (23 shared + 45 backend + 2 admin) |
| `npx eslint apps packages` | **0 errors, 0 warnings** |
| `pnpm db:migrate` | new migration applied; `cod_verification`, `support_ticket`, `refund_account` exist |
| `pnpm db:setup-tax` | India region + 4 GST slabs created (idempotent) |
| Tax computation probe | tax_total ₹2,879.82 on ₹15,999 (18 %) for intra- and inter-state carts |
| SEC-CRIT-01 exploit (`.audit/test-users-me.mjs`) | POST/PATCH `/admin/users/me` → **403**, role unchanged |
| SEC-CRIT-02 exploit (`.audit/verify-cod-hardening.mjs`) | forged metadata stripped, completion **400**, gate opens only with server proof |
| Prepaid-only enforcement | `/store/payment-providers` → `[]`; `pp_system_default` session → **400 not enabled** |
| `pnpm db:setup-payments` | COD link removed from the India region (idempotent) |

**Not verified (needs credentials or a device):** live Razorpay modal, real SMS delivery, real
Shiprocket AWB/label, Resend inbox delivery, and the browser rendering of the modified pages.
Those flows are implemented against each provider's documented API and fail loudly when
unconfigured; they are not claimed as tested.

**Lint caveat:** a bare `pnpm lint` also lints the throwaway `.audit/*.mjs` harnesses and
reports 15 pre-existing no-unused-vars / no-empty errors there. Product code
(`apps`, `packages`) is clean; those scratch scripts were left untouched.

---

## 10. Activation checklist (in order)

1. **Business identity:** `BUSINESS_GSTIN`, `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`,
   `BUSINESS_STATE_CODE`, `BUSINESS_STATE_NAME` → invoices become statutory.
2. **Tax:** `pnpm db:setup-tax` on every environment after migrations.
3. **Razorpay:** backend keys + webhook secret, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, then
   `pnpm db:seed` to link the provider to India; point the dashboard webhook at
   `/webhooks/razorpay`.
4. **SMS/DLT:** register the Principal Entity, sender header and OTP template; set
   `OTP_PROVIDER/MSG91` values (or Twilio); ensure `OTP_DEV_ECHO` is unset in production.
5. **Shiprocket:** credentials + pickup location + webhook token.
6. **Email:** `RESEND_API_KEY`, `EMAIL_FROM`, and SPF/DKIM/DMARC DNS records.
7. **Support/grievance:** `GRIEVANCE_OFFICER_*`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`.
8. **Infrastructure:** managed `DATABASE_URL` with SSL, managed `REDIS_URL`, production CORS
   origins, HTTPS termination in front of both Next apps.
