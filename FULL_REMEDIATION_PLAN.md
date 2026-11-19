# THE HIDDEN LABEL — Full Remediation & Completion Plan

**Audience:** a fresh coding agent with no memory of prior sessions. This document is
self-contained — read this file, not the 29 other audit `.md` files in the repo root, as your
source of truth for *planning*. Those files are historical records of past audit rounds and
**some of their claims are stale or were later proven false by re-verification** (see §0.2). Use
them only as background colour, never as proof that something works. Verify against the actual
code every time, the way §0.2 below had to.

**Project:** Hidden Label — an Indian luxury multi-brand boutique + bespoke tailoring + resale
marketplace. Monorepo: `apps/backend` (Medusa 2.22.7 + Postgres), `apps/storefront` and
`apps/admin` (Next.js 16 / React 19), `packages/shared`, `packages/ui`. Package manager: `pnpm`.

---

## 0. Ground rules before touching anything

### 0.1 Why this document exists
A prior session ran ~10 rounds of self-audits (`AUDIT_REPORT.md`, `QA_REPORT.md`,
`FINAL_RELEASE_READINESS.md`, `MASTER_AUDIT_SUMMARY.md`, `REMEDIATION_EXECUTION_REPORT.md`,
etc.). Twice, a round claimed "100% fixed / production ready" and an independent re-check later
proved that claim false (the test harness itself was cheating — testing the wrong endpoint,
injecting state via raw SQL instead of the real API). **Do not repeat that mistake.** Any time you
mark something "done," you must have either (a) read the actual current source and traced the
logic yourself, or (b) run a real command/request against a running instance and seen the result.
Markdown claims — including this file's own §0.2, which may drift out of date as you work — are
not evidence.

### 0.2 Verified current state as of 2026-11-19 (re-check this before relying on it)
Two independent verification passes (one reading every relevant source file, one re-deriving from
`git status`/`git log`) established, at that point in time:

| Area | State | Committed? |
|---|---|---|
| Staff self-escalation to `owner` via `/admin/users/me` | Fixed — non-GET requests carrying role/permission keys → 403, keys stripped (`apps/backend/src/api/middlewares.ts`) | **No** — modified, uncommitted |
| COD OTP forgery | Fixed — server-side `cod_verification` table, single-use/TTL proof. Product decision: COD removed, checkout is prepaid-only (UPI/card via Razorpay) | **No** — mixed modified/untracked |
| Razorpay checkout + webhook | Real, signature-verified integration, not a stub | **Yes** — committed 14 Nov, before any audit even ran |
| GST tax engine (`ensureIndiaTaxSetup`, invoice CGST/SGST vs IGST, per-line HSN) | Fixed and actually wired — `seed.ts:562` really calls it, not orphaned | **No** — uncommitted |
| SMS (MSG91 + Twilio) | Fixed — real clients, typed failure instead of fake success when unconfigured | **No** — untracked, new files |
| Transactional email (Resend + lifecycle subscribers) | Fixed — real API calls, 3 subscribers actually call the template | **No** — untracked, new files |
| Shiprocket dimensions/webhook | Fixed — `computePackage()` is actually called with real item data at both order-creation call sites (`apps/backend/src/api/admin/shipments/route.ts`, `apps/backend/src/lib/returns.ts`); webhook updates Medusa's own fulfillment state | **No** — uncommitted |
| Admin fulfil / returns-approve / promotion-create 422 errors | Fixed in an earlier round (wrong field names, a route collision) | **Yes** — committed 15 Nov |
| Order cancellation, policy pages (`/policies/[slug]`, `/policies/grievance`), quick view | All exist in code; older audit docs calling them "missing" are stale | **Yes** — committed |

**The single biggest risk right now is git, not code**: `git status` shows ~32 modified and ~15
untracked source files. A `git reset --hard` or a lost working tree would silently revert every
security, tax, SMS, and email fix, while the markdown files would keep claiming they're done.
**Phase 1 below exists to fix exactly that, first, before any new work.**

### 0.3 Commands you'll need
```
pnpm install
pnpm typecheck          # must be 0 errors across all 6 workspaces before you call anything done
pnpm test                # 70/70 baseline — must not regress
pnpm lint                # 0 errors/warnings in apps/ and packages/ (ignore .audit/*.mjs scratch scripts)
pnpm db:migrate
pnpm db:setup-tax        # idempotent India GST region/rate seeding
pnpm db:setup-payments   # idempotent: unlinks COD, links Razorpay if RAZORPAY_KEY_ID is set
pnpm db:seed
```
Re-run `pnpm typecheck && pnpm lint && pnpm test` after every phase. Don't batch fixes across
phases without checkpointing — commit after each phase so a bad phase can be reverted without
losing earlier ones.

### 0.4 Engineering defaults for this task
- No feature flags, no backwards-compatibility shims, no "removed X" comments. If something is
  confirmed dead (see Phase 2), delete it outright.
- No speculative abstraction. Match the existing code's style (raw `knex`/`pg` query builder
  patterns in backend routes, server actions + `fetch` in storefront, see any existing route for
  the house style).
- Every phase ends with a real command run (not "should work"), and a commit.
- Where a task needs a secret/credential only the business owner has (Razorpay keys, MSG91
  account, Shiprocket login, Resend domain, GSTIN), you cannot complete that task — wire the code
  so it activates correctly the moment the env var is set, confirm it fails loudly and safely when
  unset, and say explicitly in your report which credentials are still needed.

---

## Phase 1 — Checkpoint the current working tree (do this literally first)

1. `git status` — review the full list of modified/untracked files.
2. Confirm none of the modified files contain anything that shouldn't be committed (no secrets,
   no `.env` with real keys — check `.env.example` only has placeholder names, never real values).
3. `git add` the relevant files (backend `src/`, `apps/storefront`, `apps/admin`, `packages/`,
   `.env.example`, `package.json` changes) and commit with a message describing what this
   actually contains (security fix, GST engine, Razorpay wiring confirmation, SMS/email clients,
   Shiprocket fix) — **do not commit the 29 audit `.md` files as part of this commit**; they can
   go in a separate commit or be left as-is, your call, but don't mix doc noise into the code
   commit.
4. Run `pnpm typecheck && pnpm lint && pnpm test` on the committed state. If anything fails, fix
   it before moving on — you now have a known-good baseline to work from and to roll back to.

**Acceptance:** `git status` is clean (or only shows files you've deliberately left out), and the
three commands above pass.

---

## Phase 2 — Remove Cash on Delivery entirely (product decision: COD is not offered)

The business will never offer COD. A previous round kept COD's verification plumbing around "as
defence in depth," but a feature that doesn't exist shouldn't need defending — it adds dead code
and migration surface for no benefit. Fully remove it, don't just disable it.

### 2.1 Investigate before deleting
Run this first and read every hit before changing anything — some are false positives
(`PromoCode`, `postal_code` both contain the substring "cod"):
```
grep -rniI "cod[_-]\|cash.on.delivery\|cod_otp\|cod_verif\|pp_system_default\|refund_account\|refund-account" apps packages --include="*.ts" --include="*.tsx"
```

### 2.2 Known real hits to remove (confirmed by that grep on 2026-11-19 — re-run it yourself,
the file set may have changed)

- **`apps/backend/src/modules/thl/models/cod-verification.ts`** — delete the model.
- **`apps/backend/src/modules/thl/models/refund-account.ts`** — delete the model. (This table
  only ever existed to hold a customer's bank/UPI details for refunding a COD order. With COD
  gone, online refunds always return to the original Razorpay payment instrument, which Razorpay
  itself handles — this table has no remaining purpose.)
- **`apps/backend/src/modules/thl/models/index.ts`** — remove the `CodVerification` and
  `RefundAccount` exports.
- **`apps/backend/src/modules/thl/migrations/Migration20261117100000.ts`** — this migration
  bundles **three** tables: `refund_account`, `support_ticket`, `cod_verification`. Keep
  `support_ticket` (that's the real, needed customer-support feature from Phase 7 of the old
  remediation report) — only remove the `refund_account` and `cod_verification`
  `create table`/index statements and their matching `drop table` lines in `down()`.
  - **First check whether this migration has already been applied** to any database you're
    working against (query the Medusa/mikro-orm migrations tracking table, or just run
    `pnpm db:migrate` and see if it's a no-op). If it has **not** been applied anywhere that
    matters, it's safe to edit this migration file in place. If it **has** already run against a
    database you need to preserve, instead write a new migration that does
    `drop table if exists "cod_verification" cascade;` and `drop table if exists "refund_account" cascade;`
    — never edit a migration that's already been applied to a database with real data.
- **`apps/backend/src/api/store/carts/[id]/verify-cod/route.ts`** — delete the route entirely.
- **`apps/backend/src/api/store/refund-accounts/route.ts`** — delete the route entirely.
- **`apps/backend/src/api/middlewares.ts`** — remove:
  - `COD_PROOF_TTL_MS` constant and the `cod_otp_verified_at` / `cod_otp_verified_phone` /
    `cod_otp_challenge_id` / `cod_verified_at` reserved-key list (unless any of those keys are
    reused for something non-COD — check before deleting the whole list, don't assume).
  - The `codOtpVerificationMiddleware` function and its route registration (`matcher:
    "/store/carts/:id/complete"` or wherever it's wired — read the full file, the exact matcher
    line may have shifted).
  - The `matcher: "/store/refund-accounts*"` middleware registration.
  - Keep the general-purpose cart-metadata-guard middleware if it protects other reserved keys
    unrelated to COD — only strip the COD-specific key names from its list, don't delete the
    whole guard if it's doing other useful work.
- **`apps/backend/src/api/admin/shipments/route.ts`** — the line
  `const paymentMethod = orderMeta.payment_method === "cod" ? "COD" : "Prepaid";` — simplify to
  always `"Prepaid"` (confirmed via `seed.ts` that no seeded order ever sets
  `payment_method: "cod"`, so this branch is dead).
- **`apps/storefront/app/account/orders/[id]/invoice/page.tsx`** — the ternary at the line
  matching `order.metadata?.payment_method === "cod"` — simplify to always render
  `"Prepaid — online payment"`.
- **`apps/backend/src/scripts/setup-payments.ts`** — **do not delete this file.** It's the script
  that *enforces* "no COD" by unlinking `pp_system_default` from the region — that's exactly the
  behaviour you want to keep. Only revisit its comments if they reference files you just deleted.
- Search `.env.example` and any docs/README for COD-specific env vars (there may not be any —
  confirm) and remove if present.

### 2.3 What NOT to touch
- `apps/backend/src/lib/sms.ts` / the OTP system used for **registration/login phone
  verification** is a separate, still-needed feature — do not remove general OTP code, only the
  `cod_verify`-purpose-specific paths if any exist. Check the `otp_challenge` table's `purpose`
  enum/usage before deleting anything there; if `cod_verify` is just one value among several
  purposes, only remove that value and its specific call sites, not the OTP system itself.
- Razorpay integration, GST engine, Shiprocket, email — unrelated to COD, leave alone.

### 2.4 Acceptance
- `grep -rniI "cod_otp\|cod_verif\|pp_system_default.*refund\|RefundAccount\|CodVerification" apps packages` returns nothing in source (ignore `.medusa/` generated/build output and `node_modules`).
- `pnpm typecheck && pnpm lint && pnpm test` pass.
- A fresh `pnpm db:migrate && pnpm db:setup-payments && pnpm db:seed` run against a clean database
  succeeds, and `GET /store/payment-providers` for the India region returns Razorpay only (empty
  array if `RAZORPAY_KEY_ID` isn't set — never `pp_system_default`).
- Commit this phase separately from Phase 1.

---

## Phase 3 — Live re-verification of the Phase-1 baseline (don't just trust the code read)

With a real local backend + Postgres running:

1. `node .audit/test-users-me.mjs` — must show `POST`/`PATCH /admin/users/me` with a role/
   permission key → 403, and the account's role unchanged afterward.
2. Create a cart, attempt to write `metadata.cod_otp_verified_at` directly via
   `POST /store/carts/:id` — must either 404 (route gone) or be silently stripped; completing a
   cart must never succeed through a forged metadata key (this check is partly moot after Phase 2
   removes the whole COD path — confirm the removal didn't leave a half-working remnant).
3. Tax probe: create a cart with a real product, set a Gujarat address, then a Maharashtra
   address (or whatever states differ from `BUSINESS_STATE_CODE`), and confirm `tax_total` is
   non-zero and the invoice shows CGST+SGST for the same-state case and IGST for the other.
4. Confirm `GET /store/payment-providers` never lists `pp_system_default`.
5. If `RAZORPAY_KEY_ID`/`SECRET` are set in your environment, run a full checkout with a real (or
   Razorpay test-mode) UPI/card payment and confirm the order completes and an email fires (check
   logs if `RESEND_API_KEY` isn't set — it should log visibly rather than fail silently).

**Acceptance:** every check above produces the expected result from an actual HTTP
request/response you observed, not from reading the code. Record the exact commands and output in
your final report.

---

## Phase 4 — Credential activation (do what you can; flag what you can't)

None of this is code work — it's wiring env vars the business owner must supply. For each:
confirm the code path is correctly gated (fails loudly and safely when unset — never silently
pretend success), wire the env var name into `.env.example` if it isn't already, and report which
ones are still missing in your final summary. Do not fabricate or guess at real credentials.

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `OTP_PROVIDER` (`msg91` or `twilio`) + matching `OTP_API_KEY`, `OTP_TEMPLATE_ID`,
  `OTP_SENDER_ID` (DLT-registered)
- `RESEND_API_KEY`, `EMAIL_FROM` (+ SPF/DKIM/DMARC DNS records — infra, not code)
- `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION`,
  `SHIPROCKET_WEBHOOK_TOKEN`
- `BUSINESS_GSTIN`, `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_STATE_CODE`,
  `BUSINESS_STATE_NAME`
- `GRIEVANCE_OFFICER_*`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`

---

## Phase 5 — End-to-end flow verification, both modules

Script these as repeatable checks (follow the existing pattern in `.audit/*.mjs` — direct HTTP
calls against the running backend, not a browser), rather than relying on manual clicking.

**User/storefront module**, in order:
register → OTP verify → browse catalogue → PDP (variant select, fit studio if applicable) → add
to cart → checkout (address → PIN lookup → shipping method → Razorpay UPI/card payment) → order
confirmation page → confirm `order.placed` email fired → (as admin) fulfil the order → confirm
shipment/email fired → (simulate or call) Shiprocket webhook delivered scan → confirm delivery
email + `fulfillment.delivered_at` set → customer requests a return from `/account/returns` →
admin approves → refund → customer sees updated return status.

**Admin module**, in order:
staff login → dashboard loads → create a brand → create a product under it with a category →
adjust inventory → create a CMS page and publish it → create a promotion (confirm it actually
saves — regression-test BUG-007's old fields) → view an order → capture payment → fulfil → create
a manual or Shiprocket shipment → view the returns ledger → approve/reject a return → invite a
new staff member at a low role → **as that low-role staff user, attempt `POST /admin/users/me`
with a role key and confirm 403 and no role change** (this is the regression test for GAP-SEC-01 —
never skip it) → check the audit log recorded all of the above.

**Acceptance:** every step above completed with an observed result (status code, DB row, rendered
page content), with failures logged as new bugs rather than silently skipped.

---

## Phase 6 — Remaining completeness backlog (lower priority, do after 1–5 are solid)

No prior round claims to have fixed these. Verify each is actually still missing before spending
time on it (some older audit docs are stale — see §0.1):

1. Cart drawer (slide-in quick-access cart, instead of only a full `/cart` page link)
2. Mega-menu category/brand overlay (currently flat header links)
3. Wishlist "move to bag" action
4. SKU-code search in the header typeahead (currently product/handle only)
5. Bulk/batch admin product actions + real image upload (currently single-product forms, URL/metadata-only images)
6. Category tree with parent/child hierarchy (currently a flat list)
7. Scheduled/emailed report exports (CSV export endpoint exists; no scheduling)
8. Partial-refund amount + reason-code UI in admin (full refund with note works today)
9. Generic multi-segment CMS page routing (today only specific hardcoded slugs resolve)
10. Customer risk/blacklist flags (notes + tier exist; no risk flag)
11. Bespoke tailoring-stage visibility on the customer's own order page (admin has the pipeline field; customer can't see it)
12. Return reverse-inspection/restock/condition-grading step (reverse AWB booking exists per Phase-1 baseline; no restock workflow after the item comes back)
13. WhatsApp channel for concierge/order notifications

Prioritize in roughly this order; re-propose if something here turns out already fixed or turns
out to be more/less urgent once you're in the code.

---

## Phase 7 — Production infrastructure (ops work, flag rather than attempt blindly)

- Managed Postgres with SSL + automated backups (currently local/embedded — single point of
  failure)
- Managed Redis (currently in-memory fallback — job queue and rate limiting are lost on restart;
  note the rate limiter in `middlewares.ts` is explicitly documented as process-local and needs
  Redis once there's more than one backend replica)
- Lock CORS (`STOREFRONT_ORIGIN`, `ADMIN_ORIGIN`) to real production origins — currently
  localhost-only
- Confirm the HSTS/CSP headers added to `next.config.ts` in both apps don't break Razorpay's
  `checkout.js` in a real deployed environment (they were tuned to allow
  `checkout.razorpay.com`/`api.razorpay.com` — verify live, not just by reading the config)

---

## Reporting back

At the end of each phase, report: what you verified and how (exact command + exact observed
result), what you changed (files, not just area names), what's still broken or blocked and why
(missing credential vs. genuine bug), and what you deliberately chose not to touch. Never report a
phase "done" on the strength of a code read alone if a live check was possible — that exact
shortcut is what caused this project's two false "production ready" claims.
