# MASTER PLAN — The Hidden Label (end-to-end, current → production launch)

**Written:** 2026-11-14. This is the single consolidated plan covering everything from where the
project stands right now to a live, production, end-to-end working platform — storefront,
admin, backend, resale/authentication layer, integrations, deployment, launch. It does not
replace `docs/PROJECT_PLAN.md` (architecture/decisions log), `docs/SCREEN_MAP.md` (screen-by-
screen detail), `docs/HANDOFF.md` (state-of-the-tree, autonomy rules) or `docs/BUILD_LOG.md`
(verified-vs-not) — it sequences all of them into one ordered task list so "what's left and in
what order" is answered in one place. Any agent picking this up should treat this file as the
master checklist and update the ✅/🟡/🔴 markers as work actually lands — don't let it go stale.

**Source of truth for scope, in order of authority:** `docs/PROJECT_PLAN.md` §8 decisions log
(D1-D7 + gates) > this file's task breakdown > everything else. If this file ever conflicts with
the decisions log, the decisions log wins — fix this file, don't follow it blindly.

**Standing authorization:** full, end-to-end, no approval gates between phases. Stop only for a
real third-party credential, a hosting/domain decision, or a genuine business-rule ambiguity not
already answered in the decisions log — see `docs/HANDOFF.md` "Autonomy contract" for the exact
wording. Everything else in this plan is the agent's call to execute.

---

## 0. Current state snapshot (update this block as phases close)

| Phase | What it is | Status |
|---|---|---|
| P0 / P0.5 | Design audit, docs pack, decisions D1-D6 | ✅ Done, approved (G0 signed) |
| P1 | Repo, DB, backend boot, minimal storefront | ✅ Done, verified (G1 closed) |
| P2 | Design system (`packages/ui`) | ✅ Mostly done, verified |
| P3 | Commerce model (brand/cms/returns/shipment modules) | ✅ Built, verified at API level |
| P4 | Storefront customer journey (auth/search/checkout/orders/returns) | 🟡 Code written, re-verification pending |
| P5 | Admin dashboard (`apps/admin`) | 🟡 Code written, re-verification pending |
| **P5.5 (new, D7)** | Resale/authentication layer (CultureCircle-style) | 🔴 Not started — data model design first |
| P6 | External integrations (Razorpay/Shiprocket/email/OTP/storage) | 🔴 Scaffolded only, needs real credentials |
| P7 | Business rules / edge cases / concurrency | 🔴 Not started |
| P8 | QA, security, automated tests | 🔴 Not started (zero new tests since P3) |
| P9 | Production deployment | 🔴 Not started, needs hosting/domain decisions |
| P10 | Launch, handover, maintenance | 🔴 Not started |

Detail on exactly what's built vs. verified for P1-P5: `docs/BUILD_LOG.md`.

---

## 1. P4/P5 re-verification (do this FIRST, before any new feature work)

Code for the full storefront journey and the admin app already exists (see `docs/HANDOFF.md`
file list) but was never re-driven end-to-end after the agents that wrote it were stopped. Don't
build P5.5 or P6 on top of an unverified foundation.

1. Start the stack: `pnpm db:start`, `pnpm --filter @thl/backend dev` (:9000),
   `pnpm --filter @thl/storefront dev` (:3000), `pnpm --filter @thl/admin dev`.
2. Walk the customer journey for real: register → verify OTP → login → browse → search → open a
   brand page → add to cart → checkout with COD → see a real order confirmation (real order id
   from the backend, never a client-side assumption) → see it in order history → request a
   return.
3. Walk the admin journey: login → dashboard → create/edit a product → create a brand → view an
   order → change its status → check the audit log reflects it → confirm a request with no
   admin session gets 401/403 on at least 2-3 admin routes.
4. Fix whatever breaks. Run `pnpm typecheck && pnpm lint && pnpm test` and keep them clean.
5. Write automated tests for the parts that touch money or auth: checkout/payment-verification,
   admin RBAC (401/403 enforcement), return eligibility. This is the single biggest gap against
   `agent/RULES.md`'s definition of done.
6. Update `docs/BUILD_LOG.md`'s verified-table with what you actually confirmed, commit.

**Exit criterion:** a customer can go from homepage to a confirmed, trackable order with COD, and
an admin can run a full day of operations, entirely through the UI, with no manual DB edits.

---

## 2. P5.5 — Resale & authentication layer (new scope, D7)

This is its own phase with its own data model — do not retrofit it onto pages built assuming one
sell price per variant. Full detail: `docs/SCREEN_MAP.md` §3.

### 2.1 Design pass (before any code)
- Data model: `ask`, `bid`, `price_history` (per variant/size), `authentication_record` /
  `condition_grade`, admin review queue for grading submissions. Write it as a
  `docs/RESALE_DATABASE_PLAN.md` the same way `docs/DATABASE_PLAN.md` covered P3 — ERD,
  migrations, who can write which field, audit trail.
- Decide and document the matching rule: how an ask and a bid reconcile into a sale (continuous
  order-book style, or a simpler "accept this ask" flow) — this is a real business-rule decision;
  if it's not obvious from CultureCircle's own behaviour, write it to `docs/OPEN_QUESTIONS.md`
  and propose a sensible default rather than blocking.
- Condition grading workflow: who submits photos (seller/consignor vs. the platform's own
  inspection team), who grades, what grade scale, how a grade becomes a stored record that AI-03
  and any "verified"/"authenticated" badge can honestly point to (D2 still applies).

### 2.2 Backend
- New Medusa custom module(s) for `ask`/`bid`/`price_history`/`authentication_record`
  (consistent with how `apps/backend/src/modules/thl` already does brand/cms/returns).
- Admin routes: grading review queue, ask/bid moderation, price-history read/export.
- Store routes: submit an ask, place a bid, read price history for a variant, submit an item for
  authentication.

### 2.3 Storefront (behind the existing feature flags, flip on per sub-feature once real)
- `AI-02` Price Index: per-size price history chart + current best ask/bid on the PDP.
- Bidding UI on PDP/cart/checkout (`NEXT_PUBLIC_FEATURE_BIDDING`).
- `AI-03` 360° Inspection viewer + condition grade display — only once real photos/grades exist
  for at least the seed products; never show a fabricated grade.
- `AI-04` Fit Studio — sizing recommendation; can ship as a simpler rules-based version first
  (based on brand + size chart data already in `DATABASE_PLAN.md`) before a trained model.

### 2.4 The two externally-blocked sub-features — flag these to the client early, don't wait
- `AI-01` Search by Sight: needs a vision/image-search API or a trained similarity index. Pick a
  provider (e.g. a hosted vision-embedding API), get an API key from the client, scaffold behind
  `NEXT_PUBLIC_FEATURE_AI_LAYER` same as Razorpay — code the integration now, activate when the
  key arrives.
- `AI-05` Style Concierge: needs an LLM provider/API key for a catalogue-grounded chat. Same
  pattern — scaffold now, activate with a real key.

**Exit criterion:** price history and bidding work end-to-end on at least the seeded products
with real stored data (no mock numbers); a condition grade can be submitted and reviewed through
the admin queue and shown truthfully on the PDP; Search by Sight and the Concierge are wired and
gated, ready to switch on the moment their provider keys arrive.

---

## 3. P6 — External integrations (credentials needed from client; code can proceed in parallel)

All of these are already scaffolded against env vars (`.env.example`) — none can be *tested for
real* without the client's actual sandbox/production keys, but the integration code itself should
be finished and unit-testable against mocked provider responses while waiting.

| Integration | What to build now (no key needed) | What needs the client's real key |
|---|---|---|
| Razorpay | Payment module exists (`apps/backend/src/modules/razorpay`) — finish signature verification, webhook idempotency, refund flow against Razorpay's documented contract | `RAZORPAY_KEY_ID` / `SECRET` / `WEBHOOK_SECRET` — sandbox first |
| Shiprocket | Shipment creation/tracking client, webhook handler for status updates, courier-name-from-code mapping (resolves the BlueDart-vs-Shiprocket copy question, D3) | `SHIPROCKET_EMAIL` / `PASSWORD` / `WEBHOOK_TOKEN` / `PICKUP_LOCATION` |
| Email (Resend) | Transactional templates: order confirmation, shipping update, password reset (subscriber already exists), OTP email | `RESEND_API_KEY`, `EMAIL_FROM` |
| SMS/OTP | Provider-agnostic OTP send/verify interface (already has `src/lib/otp.ts`); wire the real provider adapter | `OTP_PROVIDER`, `OTP_API_KEY`, `OTP_SENDER_ID` |
| Image storage | S3-compatible upload/serve path for product + authentication photos | `S3_*` credentials |
| Vision/image-search (AI-01) | Integration scaffold per §2.4 | vision API key/provider choice |
| LLM (AI-05) | Integration scaffold per §2.4 | LLM API key/provider choice |

**Exit criterion:** every row above either works in sandbox mode with the client's test keys, or
(for anything still waiting on a key) is code-complete and unit-tested against a mocked provider
response, with webhook signature verification and duplicate-processing protection in place.

---

## 4. P7 — Business rules & edge cases

- Stock revalidation at order placement; a concurrency test (two buyers, one unit left) proving
  only one order succeeds.
- Discount/coupon calculation consistency; coupon misuse prevention (reuse, stacking rules).
- Failed/pending/duplicated payment handling; webhook replay safety (idempotency keys already a
  requirement per `agent/RULES.md`).
- Cancellations, partial refunds, returns keep order/shipment status consistent.
- Admin-action audit coverage for every state-changing operation (already have the audit log from
  P3 — confirm every new P5.5/P6 mutation writes to it too).

**Exit criterion:** each rule above has an automated test exercising the failure case, not just
the happy path.

---

## 5. P8 — QA, security, performance

- Every screen checked against Stitch (now including the resale/authentication screens).
- Mobile/tablet/desktop per the six reference builds (D4) — extend to any new P5.5 screens.
- Customer vs. admin permission boundaries re-tested, including the new resale endpoints.
- Copy-honesty sweep (D2): every "verified"/"authenticated"/"escrow"/"settlement" claim on screen
  maps to a real backend record — this now specifically includes the P5.5 grading/authentication
  copy, which is the highest legal-risk area in the whole project.
- Accessibility, SEO, Lighthouse performance pass.
- Full Playwright suite across the core flows (browse → buy, bid/ask, return, admin ops).

**Exit criterion:** `docs/QA_REPORT.md` filled in with pass/fail per `docs/QA_PLAN.md`'s matrix,
zero open criticals.

---

## 6. P9 — Production deployment (needs client decisions/accounts, flag early)

- Hosting choice for storefront + admin + backend (e.g. a managed Node host + managed Postgres);
  domain + DNS + HTTPS.
- Production env vars/secrets in the host's secret store, never in the repo.
- Production Razorpay/Shiprocket/email/SMS/vision/LLM credentials swapped in from sandbox.
- Webhook URLs registered with each provider against the production domain.
- Error reporting + uptime monitoring.
- Database backup schedule + a tested restore; migration rollback runbook.
- Legal pages: privacy policy, terms, shipping, cancellation/returns — content needed from the
  client (a real business-rule input, not something an agent can invent).

**Exit criterion:** a real test order (COD and, once live, a real low-value Razorpay payment)
completes successfully in production, admin can see and process it, and it's refundable.

---

## 7. P10 — Launch, handover, maintenance

- Admin training (walkthrough of the dashboard built in P5/P5.5).
- Handover: source code access, deployment access, credential ownership transferred to the
  client's own accounts where applicable (don't keep the client's production secrets in an
  agent's own storage longer than needed).
- Bug-fix/maintenance process documented (where to report issues, expected response).

**Exit criterion:** the five-point final acceptance test in `docs/PROJECT_PLAN.md`
("final acceptance test" section, or §10 of the original implementation plan) all pass in
production: customer experience, admin operations, business reliability, design consistency,
production readiness.

---

## 8. Rough sequencing & dependency notes

- §1 (re-verify P4/P5) blocks everything else — don't start P5.5 or P6 on an unverified base.
- §2 (P5.5 design pass) and §3 (P6 integration code, the parts that don't need a key) can run in
  parallel once §1 is done — they touch mostly disjoint files (new resale module vs. existing
  payment/shipping modules).
- §3's *real* testing (with sandbox keys) depends on the client supplying credentials — don't let
  this block §2 or §4.
- §4 (edge cases) depends on §2 and §3 being functionally complete (can't test stock-concurrency
  edge cases on a checkout that isn't finished, can't test webhook replay on an integration with
  no real webhook yet).
- §5 (QA) depends on §1-§4 being substantially done.
- §6 (deployment) can start its *infrastructure* prep (hosting account, domain) in parallel with
  §4/§5, but the actual deploy happens after §5 passes.
- §7 (launch) is last, always.

---

## 9. What only the client can unblock (collect these early, don't wait until they're needed)

1. Razorpay sandbox + production keys.
2. Shiprocket account credentials.
3. Email provider (Resend) API key + sending domain.
4. SMS/OTP provider choice + API key.
5. S3-compatible storage credentials (or confirm using Medusa's local file storage short-term).
6. Vision/image-search provider choice + key (for `AI-01`).
7. LLM provider choice + key (for `AI-05`).
8. Hosting provider, domain name, DNS access.
9. Legal page content: privacy policy, terms, shipping policy, cancellation/returns policy.
10. The ask/bid matching rule for P5.5 if it's not obvious once the design pass starts (§2.1).

Everything else in this plan, an agent executes without asking.
