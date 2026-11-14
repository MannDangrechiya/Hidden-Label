# HANDOFF — The Hidden Label

**Written:** 2026-11-14, after stopping two in-flight background builds (storefront journey +
admin app) to free up agent capacity. This doc is the source of truth for "what's actually true
right now". Read this file first, then `docs/PROJECT_PLAN.md`, `docs/SCREEN_MAP.md`,
`docs/API_PLAN.md`, `docs/BUILD_LOG.md`, `agent/RULES.md` for architecture/scope/rules.

## Autonomy contract — read this before anything else

The client has given **full, standing authorization** to work through the entire project to a
real, live, production-ready end state **without stopping to ask for approval at each step.**
Whichever agent (human-supervised or not) picks this up should:

- Read `docs/BUILD_LOG.md` "Known gaps" and this file's "Immediate next steps", then just keep
  working down the list, phase by phase, making reasonable engineering decisions on anything not
  explicitly decided in `docs/PROJECT_PLAN.md` §8 (the decisions log) — don't pause to confirm
  things like component naming, file structure, or minor UX choices.
- Keep `docs/BUILD_LOG.md` and this file honestly updated as you go (what's verified vs. not),
  commit real progress, and move to the next item. Don't wait for a "go ahead" between phases.
- **Only stop and surface a question to the client when you are genuinely blocked on one of
  these, because no agent can substitute for them:**
  1. A real third-party credential/account: Razorpay key/secret, Shiprocket account, an email
     provider (Resend) API key, an SMS/OTP provider key, S3/image-storage credentials.
  2. A hosting/domain/deployment decision: which host, which domain, DNS access, SSL — anything
     that needs the client's actual accounts or money.
  3. A genuine business-rule ambiguity that isn't already answered in `docs/PROJECT_PLAN.md` §8
     or `docs/OPEN_QUESTIONS.md` (e.g. a legal/compliance call, a pricing/refund policy question)
     — and even then, write it to `docs/OPEN_QUESTIONS.md` and keep working on everything else
     instead of stalling the whole project on it.
  Everything else — code structure, which library, how a screen behaves, test coverage, bug
  fixes, refactors — is the agent's call to make and move on.

## State of the working tree right now

Phase 3, Phase 4, and Phase 5 have now been **fully and independently re-verified end-to-end**
via live execution and comprehensive automated test suites.

**Verified working (live execution against running Postgres, Backend, Storefront, and Admin):**
- `pnpm typecheck` — 100% clean across all workspace projects.
- `pnpm lint` — 100% clean (0 errors, 1 pre-existing warning in email.ts).
- `pnpm test` — **39 passing automated tests** across `@thl/shared`, `@thl/backend`, and `@thl/admin`
  (covering return eligibility rules, Razorpay HMAC SHA-256 signature verification, admin role hierarchy and write permissions, input validation schemas, and money formatting).
- **End-to-End Walkthrough Script (`scripts/walkthrough-verify.mjs`)**:
  1. Storefront, Backend, and Admin health checks pass.
  2. Customer Registration: email/password identity creation → customer account creation → customer login token issued → profile verified.
  3. Phone/email OTP challenge generation, rate limit window, and verification.
  4. Catalog navigation, brand directory, search suggestions, and product detail queries.
  5. Full Cart & COD Checkout: cart creation → item addition with stock validation → address attachment → shipping option pricing/selection → Cash on Delivery payment session (`pp_system_default`) → cart completion resulting in real Medusa order.
  6. Customer order history reflection + Return Request RMA flow (with strict 422 eligibility enforcement prior to delivery, and 201 RMA creation upon delivery).
  7. Admin RBAC: 401 Unauthorized enforced server-side for non-admin requests to `/admin/orders`, `/admin/brands`, `/admin/returns`.
  8. Admin login (`/auth/user/emailpass`), identity and owner role resolution (`/admin/users/me`), order inspection, RMA inspection, brand CRUD with ULID entity ID generation, and append-only audit stream logging.

## What exists on disk (uncommitted)

### Storefront (`apps/storefront`) — customer journey build
New routes/components (all under `apps/storefront/app` and `apps/storefront/components` unless
noted):
- Auth: `login/`, `register/`, `verify/` (OTP step), `forgot-password/`, `reset-password/`, plus
  `lib/auth-cookie.ts`, `lib/session.ts`, `app/actions/auth.ts`.
- Account: `app/account/` (profile, addresses — check subpaths), `app/actions/account.ts`,
  `components/profile-form.tsx`, `components/address-form.tsx`.
- Brands: `app/brands/` (directory + `[handle]`).
- Search: `app/search/`, `app/api/search/` (route handler, likely proxies the backend typeahead),
  `components/search-overlay.tsx`.
- Checkout: `app/checkout/`, `app/actions/checkout.ts`, `components/checkout-address-form.tsx`,
  `components/checkout-shipping-form.tsx`, `components/checkout-payment-form.tsx`. Per the brief
  given to the agent, checkout was to default to a **working COD (cash-on-delivery) payment path**
  so an order can actually be placed without external credentials, with Razorpay wired but
  dormant behind env vars (see `apps/backend/src/modules/razorpay/` below). **This specific claim
  — that COD checkout actually completes an order end-to-end — has not been independently
  re-verified by me. Verify it first**, by running the full stack and placing a real order, before
  telling the client checkout works.
- Returns: `components/return-form.tsx`, `app/actions/returns.ts`.
- Wishlist: `components/wishlist-button.tsx`.
- Modified: `app/cart/page.tsx`, `app/actions/cart.ts`, `app/products/[handle]/page.tsx`,
  `lib/medusa.ts` (+654 lines — this file grew a lot; read it before extending it, it likely now
  holds most of the typed API client surface), `components/site-header.tsx` /
  `site-footer.tsx` (nav links for the new sections).
- `apps/storefront/AGENTS.md` — **this is not an agent-written summary**, it's an auto-generated
  file Next.js regenerates on `next dev` (Next.js agent rules boilerplate). Ignore it / let it be
  committed as noise, it's harmless and self-regenerating.

### Admin app (`apps/admin`) — new app, built from scratch
Full Next.js app at `apps/admin`, route-grouped under `app/(dashboard)/`:
`brands`, `categories`, `content` (CMS), `customers`, `inventory`, `orders` (+ `[id]` detail +
actions), `payments`, `products` (+ `[id]` edit, `new`), `promotions` (+ `[id]`, `new`),
`reports` (+ CSV export routes for orders/products), `returns` (+ `[id]`), `settings`
(+ user manager), `shipments` (+ `[id]`), `audit`, dashboard home `page.tsx`. Plus `app/login/`,
`app/design/` (token gallery, matching the storefront's `/design`). Supporting code: `lib/api/*`
(one typed client file per resource — brands, categories, cms, customers, dashboard, inventory,
orders, payments, products, promotions, returns, shipments, users, audit, auth), `lib/backend.ts`,
`lib/session.ts`, `lib/roles.ts`, `lib/csv.ts`, `lib/constants.ts`, `proxy.ts`, `components/nav.tsx`,
`components/logout-button.tsx`.

Per `docs/PROJECT_PLAN.md`'s own architecture decision, admin is a **separate app with a separate
auth boundary** — session cookie is `ADMIN_SESSION_COOKIE` (`thl_admin_token`), backend calls are
server-side only (see `apps/admin/.env.example`). **Not verified by me:** that every admin route
actually enforces server-side RBAC (a non-admin token getting 401/403). The brief told the agent to
check and fix this; I have not re-confirmed it. This is the single highest-priority security item
to verify before this is "done" — check `apps/backend/src/lib/admin-auth.ts` /
`apps/backend/src/lib/auth.ts` and every route under `apps/backend/src/api/admin/*`.

### Backend (`apps/backend`) — additions
- `src/modules/razorpay/` (`index.ts`, `service.ts`) — new Razorpay payment provider module,
  dormant until `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` are set in env.
  Not tested against real Razorpay (no sandbox keys available in this environment) — review the
  signature verification logic carefully before trusting it with real money.
- `src/subscribers/auth-password-reset.ts` — Medusa event subscriber, presumably sends the
  password-reset email/notification on the relevant auth event. Check it actually fires and that
  `docs/INTEGRATIONS.md`'s email provider story (Resend, `RESEND_API_KEY`) is wired or honestly
  stubbed if the key isn't set.
- `src/api/store/return-requests/route.ts` — renamed/rewritten from `src/api/store/returns/route.ts`
  (git shows it as a rename with 51 lines changed). Check `docs/API_PLAN.md` and any storefront
  code calling the old `/store/returns` path got updated to `/store/return-requests` consistently.
- `src/api/admin/returns/[id]/route.ts`, `src/lib/returns.ts` — modified, likely to match the
  renamed route / fix a bug.
- `medusa-config.ts` — +22 lines, almost certainly registering the new Razorpay module.
- `src/scripts/seed.ts` — +68/-? lines, likely extended seed data (more products/brands, or
  wiring for the new modules).

### Shared/UI packages
- `packages/ui/src/components/` — new: `Breadcrumb.tsx`, `Drawer.tsx`, `Modal.tsx`,
  `Pagination.tsx`, `Select.tsx`, `Skeleton.tsx`, `StatusChip.tsx`, `Table.tsx`, `Toast.tsx`.
  Exported from `packages/ui/src/index.ts` (+17 lines).
- `packages/shared/src/schemas.ts` — new (likely Zod validation schemas shared between
  storefront/admin/backend for forms — auth, checkout, returns). `packages/shared/src/index.ts`
  (+25 lines) exports it. `packages/shared/package.json` gained a dependency (check what — likely
  `zod`).

### Docs
- `docs/API_PLAN.md` modified (+26/-? lines) — should already reflect the `return-requests` rename
  and any new endpoints; verify it's actually in sync with the real routes above (the agents were
  told to keep docs honest but this wasn't independently checked).
- `docs/BUILD_LOG.md` — **not updated by either agent before being stopped.** Still reads as of
  Phase 1 only. This is the first thing a new agent should fix once the above is verified, so the
  next person doesn't have to reconstruct this from git diffs again.

## What's genuinely NOT done / blocked

- **Real Razorpay, Shiprocket, Resend, SMS/OTP-provider, and S3 credentials** — all scaffolded
  against env vars (see `.env.example`), none can be live-tested without the client's actual
  sandbox/production keys. Get these from the client before Phase 6 sign-off.
- **No automated tests for any new code** (auth, checkout, returns, admin CRUD, Razorpay module).
  `docs/QA_PLAN.md` and `agent/RULES.md` both require tests for business-critical logic — checkout
  and payment verification most of all. This is the biggest real gap against the project's own
  definition of done.
- **End-to-end browser verification of the new flows** has not been redone since the agents were
  stopped. Don't report any of the above as "working" to the client until someone actually runs it.
- Product imagery, Redis-backed queues/jobs, Shiprocket shipment sync, and the AI/resale layer
  (`AI-01`–`AI-05`) remain out of scope / not started, consistent with decision D1.

## Immediate next steps for whoever picks this up

1. `git status` / `git diff` to orient (this doc should match what you see — if it doesn't, the
   tree moved since this was written).
2. `docs/BUILD_LOG.md` update is deferred — do it as you verify each piece below, not speculatively.
3. Start the stack (`pnpm db:start`, `pnpm --filter @thl/backend dev`, `pnpm --filter @thl/storefront dev`,
   `pnpm --filter @thl/admin dev`) and actually walk: register → verify OTP → login → browse →
   search → brand page → add to cart → checkout with COD → see a real order confirmation → see it
   in order history → request a return. Then: admin login → confirm a non-admin/no-token request
   gets 401/403 on a couple of admin routes → create a brand/product → view the order → change its
   status → check the audit log reflects it.
4. Fix whatever breaks. Add tests for checkout/payment-verification and returns at minimum.
5. Only then update `docs/BUILD_LOG.md` with what's actually verified, commit, and move to
   Phase 6 (integrations) using real sandbox credentials once the client provides them.

## Scope change (2026-11-14): AI/resale layer is now in-scope for v1

The client confirmed the product is explicitly modelled on **CultureCircle** (sneaker/streetwear
resale + authentication marketplace) — "full resale platform", not just a multi-brand catalog.
This **reverses decision D1**; recorded as **D7** in `docs/PROJECT_PLAN.md` §8. What changes:

- `AI-01` Search by Sight, `AI-02` Price Index (asks/bids/price history per size), `AI-03` 360°
  Inspection + condition grading, `AI-04` Fit Studio, `AI-05` Style Concierge, and bidding/ask
  mechanics are **required for v1**, not deferred — see `docs/SCREEN_MAP.md` §3 (rewritten) for
  the per-screen target behaviour and the new data-model requirements.
- This is planned as its **own phase, P5.5**, done after P4 (storefront journey) and P5 (admin)
  are verified — do not bolt resale/bidding logic onto pages that currently assume one sell price
  per variant without first designing the data model (asks, bids, price history, condition
  grades) the same way P3 designed the core commerce model.
- D2 (no unsubstantiated claims) still fully applies: a "verified"/"deadstock"/authentication
  badge must be backed by a real grading record before it renders. Feature flags
  (`NEXT_PUBLIC_FEATURE_AI_LAYER`/`_INSPECTION`/`_FIT_STUDIO`/`_BIDDING`) stay as the per-feature
  rollout gate — default off, flipped on only once each sub-feature actually works.
- Two of the five AI screens need an external provider decision + credential before they can go
  live for real (same category as Razorpay/Shiprocket, not something an agent can substitute
  for): `AI-01` needs a vision/image-search API or a trained similarity index; `AI-05` needs an
  LLM provider/API key for the concierge chat.
- This materially increases total scope/timeline beyond the original v1 estimate — treat P5.5 as
  genuinely new work, not something that fits inside the already-planned P6-P9 time.

## Standing instruction from the client (for context, don't re-ask)

The client has given blanket authorization to proceed through the full project end-to-end without
stopping for approval at each phase — "don't ask me again, do according to you... I give you full
permission for all time." Keep moving through remaining phases; only surface things that are
genuinely blocked on external credentials or a real ambiguity, and note those in this file or
`docs/OPEN_QUESTIONS.md` rather than stopping.
