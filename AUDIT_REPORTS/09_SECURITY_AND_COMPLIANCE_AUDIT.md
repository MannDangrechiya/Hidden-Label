# 09 — SECURITY AND COMPLIANCE AUDIT

**Scope:** defensive review only. No penetration testing, no destructive probing, no attempt to access real customer data. Probes were limited to unauthenticated `GET`/`POST` on public or protected endpoints, with no payloads that create records.

## 1. Authentication

| Control | Status | Evidence |
|---|---|---|
| Customer auth | Medusa `emailpass` via `/auth/customer/emailpass` (+`/register`) | `lib/medusa.ts` |
| Password minimum | 8 characters, enforced in middleware **and** Zod schema | `middlewares.ts` `customerRegistrationMiddleware` |
| Registration enumeration protection | Generic failure copy when the email exists | same file |
| Login enumeration protection | Single generic message on failure | `app/actions/auth.ts` |
| Session storage | httpOnly `thl_auth` cookie, `sameSite=lax`, `secure` in production, 30-day max age | `lib/auth-cookie.ts` |
| Admin session storage | httpOnly `thl_admin_token`, `sameSite=lax`, 24h | `apps/admin/lib/session.ts` |
| Tokens in browser storage | **None** — never `localStorage` | verified by grep/read |
| Brute-force protection | IP+email keyed limiter, 10 attempts / 15-min block, Redis when available, in-memory fallback | `lib/rate-limit.ts`, `middlewares.ts` |
| Password reset | Tokenised link, email delivery, subscriber | `subscribers/auth-password-reset.ts` |
| MFA for staff | **Missing** | — |
| Session revocation list | **Missing** — logout deletes the cookie; the JWT remains valid until expiry | — |

## 2. Authorisation

| Control | Status |
|---|---|
| Server-side RBAC on every `/admin/*` | **Yes** — global middleware + per-handler `requireRole` |
| UI-only gating | Explicitly documented as cosmetic |
| Self-escalation via `/admin/users/me` | **Blocked** — privileged metadata keys rejected on non-GET |
| Owner-only role changes, no self-role change | Yes |
| Readonly role | Fully denied on operational resources and all writes |
| Customer object ownership (orders, returns, shipment, wishlist) | **Yes**, all scoped by `customer_id`/`actorId`; mismatched order renders 404 not 403 |
| **Default role fallback** | **`owner` when `metadata.role` is missing — HIGH RISK (SEC-01)** |
| Staff invite flow | Medusa core `/admin/invites`, owner/manager guarded |

**SEC-01 detail.** `apps/backend/src/lib/admin-auth.ts`:
```ts
const role = typeof metadata.role === "string" ? (metadata.role as AdminRole) : "owner";
```
and `apps/admin/lib/api/auth.ts` mirrors it. Impact: any staff account created through Medusa's native invite/admin UI — which does not set `metadata.role` — is granted owner rights: full refunds, stock, staff management and role changes. This is the most serious finding in the audit. Severity **High**, effort to fix **minutes** (default to `null` + 403 "no role assigned").

## 3. Transport and browser hardening

`apps/storefront/next.config.ts` **[CODE]**:
- `Content-Security-Policy` restricting `default-src 'self'`, allowing Razorpay script/frame/connect, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`.
- `Strict-Transport-Security` (production only).
- `poweredByHeader: false`.
- `unsafe-inline` (and `unsafe-eval` in dev) remain in `script-src` for Next's bootstrap — a known, common trade-off.

**Gap:** the **admin app has no equivalent security headers** (no CSP, no HSTS, no frame-deny configured in `apps/admin/next.config.ts`). Given the admin handles refunds and customer PII this should match the storefront.

**Gap:** `images.remotePatterns` allows `http://**` and `https://**` — an unrestricted image proxy.

## 4. Input handling

| Class | Assessment |
|---|---|
| SQL injection | **No exposure found.** Raw knex queries inspected use bound parameters; identifiers are static. The only dynamic SQL is whitelisted column selection. |
| XSS | React escapes by default; the CMS markdown renderer is a hand-written renderer (`cms-page-renderer.tsx`) — it should be re-reviewed for raw HTML passthrough before letting non-owner staff publish, but no `dangerouslySetInnerHTML` sink was found in the storefront pages read. |
| CSRF | Server Actions carry Next's built-in origin checks; cookies are `SameSite=Lax`; no custom cookie-authenticated state-changing `GET` was found. No explicit CSRF token scheme. |
| SSRF | The only user-influenced outbound fetch is the sight-search image URL → Gemini. It is sent to Google, not fetched by this server. No general URL fetcher exists. |
| Path traversal | No file-serving route accepts a user path; uploads go through Medusa's file module. |
| File upload validation | Admin-only, through Medusa's upload endpoint; no explicit MIME/size allowlist was found in `apps/admin/lib/api/uploads.ts`. |
| Mass assignment | Storefront actions whitelist fields; order/return routes whitelist columns. |
| Webhook authenticity | Razorpay: HMAC over raw body, constant-time compare (**good**). Shiprocket: static shared token (**weak — SEC-05**). |

## 5. Rate limiting coverage

| Endpoint | Limited? |
|---|---|
| `/auth/customer/emailpass` | Yes |
| `/auth/user/emailpass` | Yes |
| `/store/otp/send` | Yes (3/15 min per destination) |
| `/store/otp/verify` | Yes (5 attempts per challenge) |
| `/store/support/tickets` | **No** |
| `/store/concierge/chat`, `/store/sight-search` | **No** — paid third-party calls reachable unauthenticated |
| `/store/resale/bids|asks` | **No** |
| `/store/carts*` mutations | **No** (Medusa defaults only) |

## 6. Secrets management

- Only `.env.example` and `apps/admin/.env.example` are tracked **[LIVE]** `git ls-files`.
- Local `.env` / `.env.local` are correctly gitignored and untracked.
- No secret, key or token appears in any `.md` report, test fixture or log examined.
- **Weakness:** dev secrets are *defaults in code* (`jwtSecret ?? "local_dev_jwt_secret"`, `cookieSecret ?? "local_dev_cookie_secret"`, OTP secret falling back to the JWT secret). A production process that loses its env file boots successfully with a publicly known signing key. There is no startup assertion.
- **Weakness:** `OTP_DEV_ECHO=true` exists in the local backend env; the route gates it on `NODE_ENV !== "production"`, which is correct, but the variable should not be present in any production manifest.

## 7. Data protection (DPDP Act 2023 / privacy)

| Requirement | Status |
|---|---|
| Lawful-basis consent captured | **Yes** — affirmative checkbox on registration and at payment, with `privacy_consent_at` + `privacy_policy_version` stored on the customer and cart |
| Privacy policy published | Yes — CMS page `/policies/privacy`, linked in the footer |
| Grievance officer published | Yes — footer + dedicated page, driven by `GRIEVANCE_OFFICER_*` env (**currently all unset → placeholders rendered**) |
| Data export (right to access) | Yes — `download-my-data-button.tsx` → account export |
| Account deletion (right to erase) | Yes — `POST /store/customers/me/delete-account` |
| Data minimisation in logs | Good — OTP destinations logged as a hash prefix; audit `changes` explicitly excludes secrets |
| PII in third-party payloads | Shiprocket receives name/address/phone/email (necessary for shipping); Gemini receives catalogue titles and, for sight search, an image URL/keywords |
| Retention policy | **None defined**; `audit_event` grows unbounded |
| Cookie consent banner | **None** (only strictly necessary cookies are set, so this is defensible — but it must be confirmed with counsel) |

## 8. Consumer-protection / Indian ecommerce compliance

| Requirement | Status |
|---|---|
| Legal Metrology declarations (country of origin, net qty, MRP, marketer, consumer care) | **Implemented on the PDP** |
| GSTIN / CIN displayed | Layout present, **values unset** (`GSTIN: —`) |
| GST invoice with CGST/SGST vs IGST | **Implemented** (state-code comparison in `packages/shared/src/gst.ts`) |
| Return/refund policy | Published; 7-day window implemented **in code** (`RETURN_WINDOW_DAYS = 7`) — policy text and code must be kept aligned |
| Grievance officer name/contact/SLA | Page and footer exist; values are placeholders; SLA copy says 48h/30 days |
| Country of origin accuracy | Defaults to "India" when metadata is absent — a **compliance risk** for imported goods |
| HSN codes | Derived from title/gender heuristics with metadata override — a real invoice needs the true HSN per product |
| Terms of service | CMS page; **not reviewed by counsel** |

**Matters requiring professional legal/accounting confirmation:** GST treatment of consignment/resale margin, whether the resale marketplace makes the platform a "marketplace e-commerce entity" under the Consumer Protection (E-Commerce) Rules, invoice/credit-note format, DLT template registration, and the DPDP consent notice wording. Nothing in the repository substitutes for that advice.

## 9. Dependency and supply-chain

- No `pnpm audit` in CI; no Dependabot/Renovate config found.
- Lockfile is committed; `pnpm install --frozen-lockfile` is used in CI.
- `.github/workflows/ci.yml` pins actions by major tag (`@v4`), not by commit SHA — acceptable but weaker than SHA pinning.
- No SBOM, no image scanning (no images).

## 10. Security findings summary

| ID | Severity | Finding |
|---|---|---|
| SEC-01 | **High** | Missing role metadata ⇒ `owner` |
| SEC-02 | High | Refund idempotency key uses `Date.now()` |
| SEC-03 | Medium | Inventory adjustment lost-update |
| SEC-04 | Medium | Concierge thread not owner-scoped; trusts client `session_token` |
| SEC-05 | Medium | Shiprocket webhook uses a static query-string token |
| SEC-06 | Medium | No rate limit on AI/support/resale write endpoints |
| SEC-07 | Medium | Dev secrets as code defaults with no production assertion |
| SEC-08 | Medium | Admin app lacks CSP/HSTS/frame-deny |
| SEC-09 | Low | No staff MFA, no session revocation |
| SEC-10 | Low | `images.remotePatterns` allows any https host |
| SEC-11 | Low | No dependency vulnerability scanning |
| SEC-12 | Low | Country of origin defaults to "India" |
| SEC-13 | Info | `OTP_DEV_ECHO=true` present locally (correctly gated) |
