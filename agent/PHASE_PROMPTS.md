# Phase Prompts — paste one at a time

One prompt per phase. Do not combine them, and do not send the next one until the previous
gate is signed in `docs/PROJECT_PLAN.md` §8.

Every prompt ends by requiring a phase report. Reject a report that says "done" without a test
result, and reject a phase whose tests were not run.

---

## P0 — Audit & blueprint  *(delivered; keep for reference)*

> Decisions D1, D2, D4 and Q6 are recorded in `docs/PROJECT_PLAN.md` §8 and reflected across
> `docs/`. Where the Stitch frames show deferred features (AI layer, bids, price index, RFID
> certificate, escrow/ledger copy), implement the v1 behaviour from `docs/SCREEN_MAP.md` §3 and
> `docs/QA_PLAN.md` §5.5 — do not reproduce those claims.
>
> We have completed the full UI design in Google Stitch (project `10766877595551018159`).
> Inspect the complete UI and all project documentation. Do not build the application yet.
> Audit every customer-facing and admin screen; create a complete screen inventory; map each
> screen to required functionality and backend data; identify reusable components and design
> tokens; identify missing screens, states and interactions; propose the frontend/backend
> architecture, the database schema and entity relationships, and the API endpoints; break
> implementation into phases with small testable tasks; list technical risks, dependencies and
> decisions needing approval. Centralized multi-brand retailer, not a marketplace. Baseline:
> Next.js, TypeScript, Medusa, PostgreSQL — validate compatibility before finalising.
> Deliver `PROJECT_PLAN.md`, `SCREEN_MAP.md`, `DATABASE_PLAN.md`, `API_PLAN.md` and open
> questions. Wait for approval before implementing.

Delivered in `docs/`. Gate: **G0** — Q1–Q6 answered, D1–D4 recorded.

---

## P1 — Repository & development foundation

> Read `agent/RULES.md` and every file in `docs/` before writing code.
>
> Set up the monorepo from `docs/PROJECT_PLAN.md` §4: `apps/storefront`, `apps/admin`,
> `apps/backend`, `packages/ui`, `packages/config`, `packages/shared`.
>
> Requirements:
> - TypeScript strict everywhere; shared tsconfig, eslint and prettier in `packages/config`.
> - **Pin the Medusa version**, record it in `docs/PROJECT_PLAN.md` §8, and read that version's
>   own docs for the extension model before writing any backend code.
> - Docker compose for PostgreSQL and Redis; `DATABASE_URL` and `REDIS_URL` in `.env.example`.
> - Backend migrations run from an empty database with one command.
> - Health endpoints on both apps; structured JSON logging with request ids.
> - Error tracking wired (DSN via env, no-op when absent).
> - CI: typecheck, lint, unit tests. Failures block.
> - Seed script (idempotent, refuses to run in production) with 2 brands and 3 products.
>
> Do not build UI beyond a raw unstyled list proving the storefront reads from the backend.
>
> Report: versions pinned, commands to run each app, migrations output, CI result, open issues.

Gate: **G1 prerequisites** — both apps boot, DB connects, seed renders.

---

## P2 — Design system

> Build `packages/ui` from `docs/DESIGN_TOKENS.md` only. No page work in this phase.
>
> Primitives: button (primary/secondary/disabled/loading), input, textarea, select, checkbox,
> radio, quantity stepper, modal, drawer/sheet, accordion, tabs, badge (verified/drop/countdown),
> product card, brand tile, image gallery, size selector, price display, breadcrumb, pagination,
> table, toast, skeleton, empty state, error state, tooltip.
>
> Requirements:
> - Tailwind preset in `packages/config` implementing the token mapping in `DESIGN_TOKENS.md` §8.
> - Fonts self-hosted through `next/font/local`; no CDN at runtime.
> - Radius 0 everywhere; only the `micro` shadow exists; single gold accent.
> - `formatINR()` and a `Money` type in `packages/shared` used by every price render; tabular
>   figures in JetBrains Mono; `label-caps` always uppercase at 0.12em.
> - A `/design` dev-only route rendering every primitive and every state, at 375/768/1440.
> - Keyboard and focus behaviour defined for modal, drawer, accordion, select, size selector.
> - **Reference-build workflow (approved D4):** produce mobile builds for six templates —
>   homepage, catalog, PDP, cart, checkout and the admin table — per `DESIGN_TOKENS.md` §7.
>   Present these for approval **before** the responsive system is applied to other templates.
>
> Report: component list, any token the designs required that is missing from the file, the
> `/design` route screenshot set, and the six mobile reference builds for approval.

Gate: **G1** — token diff review passes; primitives approved before pages use them.

---

## P3 — Commerce model & backend

> Implement the commerce data model on the pinned Medusa version.
>
> Custom modules with migrations exactly as specified in `docs/DATABASE_PLAN.md`: brand
> (+ `product_brand`), cms_page + banner_slot, wishlist_item, otp_challenge, return_request +
> return_item, shipment + shipment_event, and a plain append-only `audit_event` log.
>
> **Do not create `authentication_record`** — it is V2 per decision D2, and no RFID, certificate
> or "verified authentic" data exists in v1. **No hash chain and no `verify_audit_chain()`** —
> the audit log is ordinary, reliable and insert-only; do not describe it as tamper-evident.
>
> Also: brand/category wiring on products, variants with size option, inventory levels and one
> active stock location, region = India/INR with tax settings, shipping options seeded.
>
> Requirements:
> - Every admin mutation writes an `audit_event` in the same transaction.
> - Stock reservation implemented and tested with two concurrent buyers on one unit.
> - Audit rows written in the same transaction as each mutation; UPDATE/DELETE revoked from the
>   application role.
> - Integration tests against real Postgres for: reservation, audit chain, return eligibility,
>   banner scheduling.
> - Admin/store routes for each custom module per `docs/API_PLAN.md`.
>
> Do not touch the storefront. Report: migration list, table list, test results, endpoint list.

Gate: **G2** — migrations from empty DB, tests green, endpoints smoke-tested.

---

## P4 — Storefront

> Implement the customer screens in this order, one page per commit, using only `packages/ui`
> primitives and real backend data. Reference the screen code in every commit.
>
> 1. `U-01` Homepage · 2. `U-02` Mega menu · 3. `U-03` Brand directory · 4. `U-04` Brand vault
> 5. `U-05` Catalog listing · 6. `U-06`/`U-07` Search · 7. `U-08` PDP · 8. `U-09` Quick view
> 9. `U-10` Wishlist · 10. `U-11`/`U-12` Cart · 11. `U-13` Checkout · 12. `U-14` Confirmation
> 13. `U-15`–`U-17` Auth + OTP · 14. `U-18`–`U-20` Account & orders · 15. `U-21` Returns
> 16. `U-22`–`U-26` Support, About, Policies, Size guide, Authenticity
>
> Requirements:
> - Every listing: loading skeleton, empty, error, and correct pagination without duplicates.
> - Every variant selector: sold-out sizes disabled **with visible reason**.
> - Totals always from the server; the client never computes money.
> - **Stop after cart (step 10) and report** before starting checkout. Do not build checkout on
>   an unapproved cart.
> - Checkout: address, shipping options, payment intent, then `POST /store/checkout/verify` —
>   the confirmation screen renders only on `status: "paid"`.
> - Mobile derived per `DESIGN_TOKENS.md` §7; approve one reference build per template family
>   before applying to the rest.
> - No mock data anywhere in these routes.
>
> Report: route list, states implemented per route, E2E coverage, deviations from Stitch.

Gate: **G3** — browse → variant → cart → address → shipping option verified end to end.

---

## P5 — Admin dashboard

> Build `apps/admin` as a separate app with its own auth boundary, reproducing `SYS-01` and
> `A-01`–`A-17`.
>
> Requirements:
> - RBAC roles (`owner`, `manager`, `operations`, `support`, `readonly`) enforced per route
>   server-side; a scripted sweep proving a customer session gets 401/403 on every admin route.
> - Every mutation requires reason codes where specified (stock adjust, cancel, refund) and
>   writes an audit event.
> - Product create/edit with variant matrix, media upload (presigned), publish checklist that
>   blocks on missing weight/dimensions/price.
> - Order detail action bar: capture, fulfil, cancel, refund — all idempotent, all reflected in
>   the customer-facing order.
> - Shipment create, label, sync; returns approve/receive/refund with restock decision.
> - CMS editing that changes the storefront without a deploy.
> - Audit log screen (`A-17`) with filters and detail view — presented as an activity log, with
>   no integrity or tamper-proofing claim in the UI.
> - Admin app: `noindex`, not linked from storefront, separate cookie scope.
>
> Report: module-by-module status, RBAC sweep results, audit coverage gaps (should be none).

Gate: **G4** — an authorised admin can run a day of operations without SQL.

---

## P6 — Integrations

> Wire the four external services per `docs/INTEGRATIONS.md`, test credentials only.
>
> - Razorpay: order creation, checkout handoff, server-side verification, webhook with signature
>   verification and idempotency, refunds (full and partial).
> - Shiprocket: shipment creation, label/manifest, webhook + polling, status mapping through the
>   single mapper in `ORDER_STATE_MACHINE.md` §6.
> - Email: the ten templates listed in `INTEGRATIONS.md` §3, queued with retry, failures visible
>   on the order timeline.
> - OTP: adapter + one SMS provider and email OTP, hashed codes, server-side limits. Email +
>   password remains the primary credential (decision Q6); OTP verifies the registered email or
>   phone and supports password reset. No OTP-only login.
> - Storage: presigned uploads, derivative pipeline, EXIF stripped.
>
> Build a `/dev` replay script for each webhook so failures can be reproduced.
> Produce a failure matrix per service: what the customer sees, what the admin sees, what the
> system does. That table is a deliverable.
>
> Report: sandbox evidence per service, failure matrix, and anything that needed a design
> decision.

Gate: **G5** — all four work in test mode with documented failure handling.

---

## P7 — Business rules & edge cases

> Implement and test every row in `docs/ORDER_STATE_MACHINE.md` §7 plus the invariants in §1.
>
> Required tests (each automated, each in CI):
> - Two concurrent buyers, one unit → one paid order, one clean failure with refund path.
> - Stock revalidation at all three points (cart, checkout submit, payment verification).
> - Coupon expires mid-checkout → explicit message, no silent re-price.
> - Duplicate payment webhook → single order, single payment, single confirmation email.
> - Tampered webhook signature → rejected and logged.
> - Payment verified after stock vanished → auto-refund + admin `needs_attention` flag.
> - Abandoned payment → order expires, reservation released.
> - Partial refund reconciliation; refund sum never exceeds captured.
> - Cancellation before dispatch with refund; after dispatch → refused with reason.
> - Return eligibility at request time **and** re-check at approval.
> - Shipment failure and tracking staleness.
>
> Report: test list with results, and any rule that could not be enforced as written.

Gate: **G6** — the 16-step order flow passes end to end including failure cases.

---

## P8 — QA & security

> Execute `docs/QA_PLAN.md` in full against the real app. Record every row in
> `docs/QA_REPORT.md` with pass/fail and evidence.
>
> Specifically: the customer matrix (§2), the admin matrix (§3), the security checklist (§4),
> the design-consistency checks (§5) including the token diff and the **copy-honesty sweep**, and
> the performance/accessibility targets (§6).
>
> Fix critical and high findings. Do not weaken tests, skip assertions, or suppress lint/type
> errors to pass. Do not touch approved visuals without approval.
>
> Report: test report, prioritised bug list with severities, fixed vs deferred with reasoning,
> and a release-candidate statement.

Gate: **G7** — zero criticals, highs fixed or explicitly accepted with a date and owner.

---

## P9 — Production deployment

> Prepare production per `docs/PROJECT_PLAN.md` §3.
>
> - Managed frontend, backend and PostgreSQL; production Redis.
> - Domain, DNS, HTTPS, redirects; `www` vs apex decided once.
> - Production secrets in the host's secret store; separate Razorpay/Shiprocket production keys.
> - Production webhook URLs registered and verified with a test event.
> - Error tracking, uptime checks, alert routing.
> - Migration + rollback runbook written and **rehearsed**; backup restore verified once.
> - Security headers live; admin app `noindex`; source maps not public.
> - Legal pages published from supplied policy copy (`U-24`).
>
> Do not deploy untested code straight to production. Deploy the exact commit that passed G7.
>
> Report: URLs, deploy evidence, migration result, webhook verification, rollback rehearsal
> output, and anything still environment-dependent.

Gate: **G8 (first half)** — production deployment with a verified checkout.

---

## P10 — Launch & handover

> Final verification and handover.
>
> - One real test order end to end in production, authorised test payment, then a real refund.
> - Verify inventory decrement, invoice, confirmation email, admin visibility, AWB creation.
> - Admin training notes: one page per module, in plain language.
> - Documentation set: setup, environment variables, deployment, backup/restore, API, database,
>   admin guide, incident playbook.
> - Handover record: source code access, hosting access, domain ownership, credential ownership,
>   third-party account ownership (Razorpay, Shiprocket, email, OTP, storage).
> - Maintenance process: how bugs are reported, triaged and released.
>
> Report: acceptance statement against `QA_PLAN.md` §7, ownership table, and a list of anything
> deliberately left out of v1.

Gate: **G8 complete** — usable store with documented ownership and recovery.

---

## Standing instruction appended to every phase

> Follow `agent/RULES.md`. Do not change architecture, dependencies or scope without written
> approval. Do not claim a check passed unless you ran it and saw it pass. If something is
> blocked, say what and stop — do not substitute a mock and call it done.
