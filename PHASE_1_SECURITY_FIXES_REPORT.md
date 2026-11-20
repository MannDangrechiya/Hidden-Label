# PHASE 1 — SECURITY, BUG FIX AND ENGINEERING STABILISATION

**Date:** 2026-11-20
**Scope:** Phase A of the remediation roadmap (audit IDs BUG-01…BUG-09, SEC-01…SEC-06, GAP-110/117/118/041/042/054).
**Not in scope, unchanged:** payment behaviour, business model, prices, GST logic, checkout flow, catalogue.

Every finding below was re-verified in code before it was changed. Two audit claims did **not** reproduce and are recorded as such rather than "fixed".

---

## 1. Status summary

| # | Requirement | Status |
|---|---|---|
| 1 | RBAC default-owner | **UNIT TESTED** + **INTEGRATION TESTED** (route-level 403) |
| 2 | Refund idempotency & concurrency | **UNIT TESTED** + **INTEGRATION TESTED** (DB concurrency) · route E2E **BLOCKED** (no payment provider) |
| 3 | Inventory concurrency | **UNIT TESTED** + **INTEGRATION TESTED** (route + 40 concurrent adjustments) |
| 4 | RMA numbering | **INTEGRATION TESTED** (25 concurrent allocations) |
| 5 | Concierge ownership | **UNIT TESTED** + **INTEGRATION TESTED** (7 route-level cases) |
| 6 | Production secret defaults | **UNIT TESTED** + **E2E VERIFIED** (real production boot refused) |
| 7 | Web security | **IMPLEMENTED** + **UNIT TESTED**; header claims verified in code, not viewed in a browser |
| 8 | CI and lint | **E2E VERIFIED** — `pnpm lint` exit 0, no lint scope disabled |

No unresolved **High** security defect remains from the audit. Residual items are listed in §7.

---

## 2. Fixes

### 2.1 RBAC default-owner (SEC-01 / BUG-03)

**Before:** `apps/backend/src/lib/admin-auth.ts` and `apps/admin/lib/api/auth.ts` both resolved a missing
`metadata.role` to `"owner"`. Any staff account created through Medusa's own invite flow was a full owner.

**After:**
- `parseAdminRole(raw)` accepts only the five documented role strings; anything else is `null`.
- `adminAccess()` distinguishes **401 not signed in** from **403 `no_role_assigned`**.
- `requireRole()` — used by every admin route — denies role-less accounts.
- `decideAdminRequest()` is a pure function holding the whole `/admin/*` policy (readonly lockout,
  manager/owner staff management, owner-only role changes, self-escalation block, privileged
  metadata refusal). The middleware now calls it, so the tested logic *is* the production logic.
- Admin UI: `resolveAdminRole()` has no default; `fetchCurrentAdmin()` throws `NoRoleAssignedError`
  and the dashboard layout renders an access-denied panel instead of the console.
- Existing staff accounts were checked: `admin@…` = `owner`, `audit.readonly@…` = `readonly`.
  Nobody is locked out, and no role was invented for anyone.

### 2.2 Refund idempotency (BUG-04)

**Before:** `` idempotency_key: `order-${orderId}-refund-${Date.now()}` `` — a new key on every retry.

**After:** `apps/backend/src/lib/refund-operations.ts` derives `rfn_<sha256>` from
`(orderId, paymentId, amount, normalised reason)` and persists it in `refund_operation` with a **unique**
`idempotency_key`. The route:
- claims the intent with `INSERT … ON CONFLICT DO NOTHING` — exactly one of N concurrent requests wins;
- returns the existing refund (`duplicate: true`) when the operation already completed;
- answers **409 `refund_in_progress`** while another request holds it;
- answers **409 `refund_failed`** after a failure unless the operator explicitly passes
  `retry: true`, because a failed attempt may have reached the provider before failing locally;
- hands the same stable key to `refundPaymentWorkflow`.

### 2.3 Inventory concurrency (BUG-05)

Extracted to `apps/backend/src/lib/stock-adjustment.ts`: one transaction, `SELECT … FOR UPDATE` on the
level, negative bound re-checked **under the lock**, audit row written in the same transaction.
The route keeps its reason-code requirement and now delegates the mutation.

### 2.4 RMA numbering (BUG-08)

`return_request_display_seq` (PostgreSQL sequence) replaces `1000 + count + 1`. The migration backfills
the sequence past existing values: this database's highest id is `RMA-1028`, sequence `last_value` is
`1028`, so the next request receives `RMA-1029` — no reuse, no collision.

### 2.5 Concierge ownership (BUG-09)

**Before:** the route accepted any `thread_id` and trusted the browser's `session_token` string.

**After:** `apps/backend/src/lib/concierge-session.ts`
- guests receive a backend-issued HMAC-SHA256 signed token (`v1.<payload>.<sig>`) with a 30-day expiry;
  only its SHA-256 hash is stored (`concierge_thread.session_token_hash`);
- a customer thread is matched on `customer_id` and ignores tokens entirely;
- a thread with neither owner nor hash (legacy rows) is inaccessible;
- the storefront no longer mints a random token in `localStorage`; it stores and returns the
  server-issued one.

### 2.6 Production secret defaults (GAP-116)

`apps/backend/src/lib/env-guard.ts` validates `DATABASE_URL`, `MEDUSA_JWT_SECRET`,
`MEDUSA_COOKIE_SECRET` (≥32 chars, not a known dev default, not equal to each other), https
`STOREFRONT_ORIGIN`/`ADMIN_ORIGIN`, and refuses `OTP_DEV_ECHO=true`. `medusa-config.ts` calls it at
load time when `NODE_ENV=production` and no longer falls back to `local_dev_*` in production.
The error lists **variable names only**.

### 2.7 Web security

- **Admin headers:** the audit's "admin has no CSP/HSTS" claim **did not reproduce** —
  `apps/admin/next.config.ts` already set CSP, HSTS, frame-deny, nosniff, referrer and permissions
  policy. Added `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`.
- **Image remote patterns:** the storefront's `http(s)://**` wildcard is replaced by an allowlist
  derived from `MEDUSA_URL`, `NEXT_PUBLIC_MEDUSA_URL`, `S3_PUBLIC_BASE_URL`, `NEXT_PUBLIC_IMAGE_HOSTS`
  plus `images.unsplash.com` (used by the seed). Malformed values are ignored, never widened.
- **Uploads:** admin validates MIME, extension, size and emptiness before sending
  (`apps/admin/lib/upload-rules.ts`); the backend rejects non-multipart and >9 MB bodies before
  buffering (`apps/backend/src/lib/upload-validation.ts` + `/admin/uploads` middleware).
- **Rate limits:** generic policy-driven limiter (Redis-backed when `REDIS_URL` is set) applied to
  `/store/otp/send`, `/store/support/tickets`, `/store/concierge/chat`, `/store/sight-search`,
  `/store/resale/asks|bids` (POST/DELETE) and account deletion.

### 2.8 Lint

All 15 errors were **fixed in the evidence scripts** — unused destructured bindings/imports removed and
empty `catch {}` blocks documented. No lint rule was disabled and no directory was added to `ignores`.

---

## 3. Files changed

**Backend**
- Modified: `medusa-config.ts`; `src/lib/admin-auth.ts`; `src/lib/rate-limit.ts`;
  `src/api/middlewares.ts`; `src/api/admin/inventory/route.ts`;
  `src/api/admin/orders/[id]/actions/route.ts`; `src/api/store/return-requests/route.ts`;
  `src/api/store/concierge/chat/route.ts`; `src/modules/thl/models/concierge-thread.ts`;
  `package.json` (added `test:integration`).
- Added: `src/lib/stock-adjustment.ts`, `refund-operations.ts`, `rma-numbering.ts`,
  `concierge-session.ts`, `env-guard.ts`, `upload-validation.ts`, `write-rate-limit.ts`;
  `src/modules/thl/migrations/Migration20261120100000.ts`;
  `test/integration-db.ts`; `vitest.config.mts`; `vitest.integration.config.mts`.

**Admin**
- Modified: `lib/roles.ts`, `lib/api/auth.ts`, `lib/api/uploads.ts`, `app/(dashboard)/layout.tsx`,
  `next.config.ts`, `lib/roles.test.ts`.
- Added: `lib/upload-rules.ts`, `lib/upload-rules.test.ts`.

**Storefront**
- Modified: `next.config.ts`, `components/style-concierge.tsx`, `lib/resale.ts`.

**Repository**
- Modified: `package.json` (`test:integration`), `.github/workflows/ci.yml` (new `integration` job +
  schema assertions), `.env.example`, and eight `.audit/*.mjs` scripts (lint errors only).

---

## 4. Database migration

`apps/backend/src/modules/thl/migrations/Migration20261120100000.ts`

| Object | Purpose | Verified |
|---|---|---|
| `refund_operation` (+ unique `idempotency_key`, status check, indexes) | persisted refund identity | table 1, unique index 1 |
| `return_request_display_seq` | atomic RMA numbering, backfilled | `last_value = 1028`, next `RMA-1029` |
| `concierge_thread.session_token_hash` (+ index) | guest-session binding | column 1 |

Applied with `pnpm db:migrate` (exit 0) to the local development database. Down migration drops all
three. CI now asserts these four objects exist after a real migration run.

---

## 5. Tests executed — actual results

```
pnpm typecheck            → exit 0   6/6 packages
pnpm lint                 → exit 0   0 errors, 0 warnings
pnpm test                 → exit 0   132 tests / 17 files
                                     backend 99 · shared 23 · admin 10
pnpm test:integration     → exit 0   22 tests / 5 files (real PostgreSQL)
```

New regression coverage mapped to the requirement list:

| Required test | Where | Result |
|---|---|---|
| Missing staff role | `admin-auth.test.ts` (parse), `roles.test.ts` (UI), inventory route integration → 403 `no_role_assigned` | pass |
| Invalid staff role | `admin-auth.test.ts` (mis-cased/unknown/non-string), `roles.test.ts` | pass |
| Unauthorized role escalation | `admin-auth.test.ts` — manager role change, owner self-escalation, `/admin/users/me` metadata writes | pass |
| Concurrent refunds | `refund-operations.integration.test.ts` — 10 parallel claims → 1 winner, 1 row | pass |
| Duplicate refund requests | same file — completed operation returned with `refund_id`, no second row | pass |
| Concurrent stock adjustments | `stock-adjustment.integration.test.ts` — 40 parallel ±1 → correct total, 40 audit rows | pass |
| Duplicate RMA generation | `rma-numbering.integration.test.ts` — 25 parallel → 25 unique ids, all insertable | pass |
| Cross-session concierge access | `chat/route.integration.test.ts` — no token, foreign token, forged token, legacy thread, customer-vs-customer | pass |
| Missing production secrets | `env-guard.test.ts` + live boot below | pass |
| Rate limit enforcement | `rate-limit.test.ts`, `write-rate-limit.test.ts` (429, `Retry-After`, per-client and per-actor buckets) | pass |

**Production startup assertion, executed:**

```
NODE_ENV=production pnpm exec medusa exec ./src/scripts/setup-payments.ts
→ exit 1
  "Refusing to start in production with unsafe configuration:
     - MEDUSA_JWT_SECRET …
     - MEDUSA_COOKIE_SECRET …
     - STOREFRONT_ORIGIN …
     - ADMIN_ORIGIN …
     - OTP_DEV_ECHO …"
```

Names only; no value appears in the message.

---

## 6. Security and data-integrity review of this change set

- **Authorisation:** both layers now fail closed; role-less → 403 in middleware *and* `requireRole`.
- **Money:** no new money path. Refund amounts still derive from the captured payment; the operation
  key includes the amount, so a partial and a full refund are distinct intents.
- **Transactions:** stock adjustment and refund state changes are transactional; audit rows commit with
  the mutation they describe.
- **Idempotency:** unique database constraint, not application timing. No `Date.now()` remains in the
  refund path (`grep` verified).
- **Secrets:** tokens are hashed before storage; the guest token is signed, not merely opaque; the
  production guard never echoes values.
- **No behaviour changes** to payments, prices, promotions, GST or checkout.

---

## 7. Remaining defects and limitations

| ID | Severity | Item | Status |
|---|---|---|---|
| R-01 | Low | Refund route has no HTTP-level E2E test (needs a Medusa process and a payment provider). Its data layer and key are covered by 4 DB tests + 5 unit tests. | NOT VERIFIED at HTTP level |
| R-02 | Low | Per-file MIME is enforced by the admin app, not by Medusa's core `/admin/uploads` handler (the request-level guard checks multipart + size only). | PARTIAL |
| R-03 | Low | `apps/admin` build and the storefront production build were not run in this phase (typecheck only). | NOT VERIFIED |
| R-04 | Low | Admin CSP/headers were verified by reading config, not by inspecting a live response or browser. | NOT VERIFIED |
| R-05 | Medium | `processReturnAction` still restocks with a read-then-write (no `FOR UPDATE`) inside its transaction; same class of bug as BUG-05, outside this phase's stated scope. | OPEN |
| R-06 | Low | `return_request.refund_amount` remains a numeric string (second money representation). | OPEN (planned P0-09) |
| R-07 | Low | `stock_location.first()` still governs fulfilment and return restock (single-location assumption). | OPEN |
| R-08 | Medium | Razorpay webhook topology and payment state cannot be exercised without keys; payment behaviour was explicitly out of scope. | BLOCKED |

## 8. Blocked external configuration

None of these were supplied; nothing in this phase required them.
Razorpay test keys · `RESEND_API_KEY` + verified domain · `SHIPROCKET_*` · `S3_*` · `SENTRY_DSN` ·
`BUSINESS_*` / `GRIEVANCE_OFFICER_*`.

## 9. Next steps

1. Apply the pending P0-09 money-type normalisation and lock the return-restock path (R-05/R-06).
2. Run the payment-path phase with owner-supplied **test-mode** keys: full sandbox purchase, webhook
   replay, one refund, one duplicate refund.
3. Add HTTP-level tests for the refund route once a test provider exists (R-01).
4. Keep `.audit/` evidence scripts inside lint scope — the fixes were code fixes, not suppressions.
