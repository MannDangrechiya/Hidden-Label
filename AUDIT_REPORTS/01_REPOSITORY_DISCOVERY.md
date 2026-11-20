# 01 — REPOSITORY DISCOVERY

## 1. Root inventory

```
C:\Users\ASUS\Documents\Hidden Label
├── apps/
│   ├── backend/        Medusa 2.22.7 commerce API + custom modules, routes, jobs, subscribers, seeds
│   ├── storefront/     Next.js 16.4.6 customer application (port 3000)
│   └── admin/          Next.js 16.4.6 custom admin dashboard (port 7001, --webpack)
├── packages/
│   ├── shared/         money/INR, GST, HSN, schemas, phone helpers + unit tests
│   ├── ui/             design-system components + Tailwind v4 tokens
│   └── config/         shared ESLint config
├── docs/               19 specification / handover documents + screenshots
├── scripts/            dev DB launcher, operational scripts, an ad-hoc e2e script
├── agent/              coding-agent rules and phase prompts
├── .audit/             committed evidence scripts + JSON result files from earlier audit rounds
├── .github/workflows/  single CI workflow
├── AUDIT_REPORTS/      ← this audit (new, dated)
├── *.md (40 files)     previous audit / status reports at the root
├── docker-compose.yml  postgres:18-alpine :5437, redis:7-alpine :6380
├── pnpm-workspace.yaml apps/* + packages/*
├── .env.example        the only tracked env file (values are placeholders)
└── *.bat               Windows start/stop launchers for backend, admin, storefront
```

**Workspace count:** 6 projects (`apps/backend`, `apps/storefront`, `apps/admin`, `packages/shared`, `packages/ui`, `packages/config`) plus the root.

**Excluded from this map:** `node_modules/`, `.next/`, `.dev/` (local Postgres cluster + logs), `*.log`, `pnpm-lock.yaml` internals.

## 2. Entry points and how the system starts

| Service | Command | Port | Config |
|---|---|---|---|
| PostgreSQL | `pnpm db:start` (portable `embedded-postgres`) or `docker compose up -d` | **5437** | `scripts/dev-db.mjs` sanitises env on Windows (documented `0xC0000142` failure) |
| Redis | `docker compose up -d` only | **6380** | not required — `MEDUSA_REDIS_URL` unset ⇒ Medusa in-memory modules |
| Backend | `pnpm dev:backend` → `medusa develop --port 9000` | **9000** | `apps/backend/medusa-config.ts`, `apps/backend/.env` |
| Storefront | `pnpm dev:storefront` → `next dev -p 3000` | **3000** | `apps/storefront/.env.local` |
| Admin | `pnpm dev:admin` → `next dev -p 7001 --webpack` | **7001** | `BACKEND_URL` (defaults to `http://localhost:9000`) |

CORS is restricted in `medusa-config.ts`:

```ts
const STOREFRONT_ORIGIN = process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000";
const ADMIN_ORIGIN      = process.env.ADMIN_ORIGIN      ?? "http://localhost:7001";
storeCors: STOREFRONT_ORIGIN,
adminCors: `${ADMIN_ORIGIN},${STOREFRONT_ORIGIN}`,
```

**Windows-specific caveat honoured during this audit:** the dev servers were already running (backend `:9000` healthy, storefront `:3000` healthy). The admin app was **not** running on `:7001`. No service was restarted or altered.

## 3. Backend structure (`apps/backend`, 118 TypeScript files)

```
src/
├── api/
│   ├── middlewares.ts            ← the single routing/middleware registry
│   ├── admin/      (21 route handlers)
│   ├── store/      (27 route handlers)
│   └── webhooks/   razorpay, shiprocket (2)
├── lib/
│   ├── admin-auth.ts    role resolution + requireRole + canWrite
│   ├── audit.ts         append-only audit writer
│   ├── auth.ts          typed access to req.auth_context
│   ├── email.ts resend │ sms.ts MSG91/Twilio │ whatsapp.ts MSG91 Wa
│   ├── shiprocket.ts    shipment + reverse pickup client
│   ├── shipment-status.ts  the single courier→status mapper (idempotent)
│   ├── returns.ts       eligibility + admin return actions + restock
│   ├── tax.ts hsn.ts    GST slabs / HSN derivation
│   ├── otp.ts phone.ts  OTP hashing and Indian phone normalisation
│   ├── rate-limit.ts    Redis-backed, in-memory fallback
│   ├── package.ts       volumetric/chargeable weight for couriers
│   ├── resale.ts        payout maths, size conversion, price index
│   ├── gemini.ts        grounded LLM prompt / fallback
│   └── csv.ts
├── modules/
│   ├── thl/             19 models, 8 migrations, MedusaService
│   └── razorpay/        AbstractPaymentProvider implementation
├── jobs/emailed-reports.ts   scheduled daily orders report
├── subscribers/         order-placed, order-canceled, order-fulfillment-created, auth-password-reset
└── scripts/             seed.ts, seed-phase5-5.ts, setup-tax.ts, setup-payments.ts
```

**Total custom HTTP route handlers: 50** (21 admin + 27 store + 2 webhooks).

## 4. Storefront structure (`apps/storefront`, 105 files)

Routes (`app/`):
`/` · `/collections/all` · `/collections/[handle]` · `/products/[handle]` · `/brands` · `/brands/[handle]` · `/search` · `/cart` · `/checkout` (+ `/payment`, `/confirmation/[id]`) · `/account` (+ `addresses`, `orders`, `orders/[id]`, `orders/[id]/cancel`, `orders/[id]/invoice`, `orders/[id]/return`, `returns`, `wishlist`, `asks`, `bids`) · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/verify` · `/verify/[serial]` · `/fit-studio` · `/inspection/[serial]` · `/sell` · `/support` · `/about` · `/authenticity` · `/size-guide` · `/policies/[slug]` · `/policies/grievance` · `/[...slug]` (generic CMS) · `/design` (token gallery) · `not-found` · `error`.

Server actions in `app/actions/`: `account`, `auth`, `cart`, `checkout`, `pincode`, `resale`, `returns`, `support`.
Route handlers: `/api/health`, `/api/search`, `/api/cart`.

Data access is centralised in `lib/medusa.ts` (server-only Medusa Store API client, no mock fallback) plus `lib/catalog.ts` (metadata-driven category heuristics), `lib/pincode.ts`, `lib/resale.ts`, `lib/session.ts`, `lib/auth-cookie.ts`, `lib/cart-cookie.ts`.

## 5. Admin structure (`apps/admin`, 108 files)

Route group `app/(dashboard)/` with 19 navigation modules:
Dashboard · Products (+ new, [id]/edit, media, variants, publish controls) · Brands · Categories · Inventory · Orders (+ [id] with bespoke pipeline and action bar) · Customers (+ [id], notes) · Payments · Shipments (+ [id]) · Returns (+ [id]) · Support · Promotions (+ new, [id]) · Content/CMS (+ new, [id]) · Reports (+ CSV exports) · Inspections · Resale orderbook · Fit rules · Settings (staff/invites) · Audit log.

Auth: `app/login` + `lib/session.ts` (httpOnly `thl_admin_token`) + `proxy.ts` (Next 16 proxy convention; redirects to `/login` when the cookie is absent — explicitly documented as UX only, not authorisation).

## 6. Database configuration

- Engine: PostgreSQL 18 (portable binaries via `embedded-postgres`, or Docker `postgres:18-alpine`).
- Connection: `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5437/the_hidden_label`.
- Pool: `DB_POOL_MIN=2`, `DB_POOL_MAX=20` via `databaseDriverOptions.pool` in `medusa-config.ts` (a real, previously measured optimisation recorded in `CURRENT_PROJECT_STATUS.md`).
- Migrations: Medusa core migrations (run by `pnpm db:migrate`) **plus** 8 hand-written migrations in `apps/backend/src/modules/thl/migrations/`:
  `Migration20261114090000`, `…091000`, `…092000`, `…093000`, `…100000`, `Migration20261117100000`, `Migration20261119100000` (COD/payout drop), `Migration20261119110000`.
- Current size: **171 public tables** **[LIVE]**.

## 7. Background jobs, subscribers, webhooks

| Kind | File | Trigger |
|---|---|---|
| Scheduled job | `src/jobs/emailed-reports.ts` | daily orders report email (no-op without `REPORTS_EMAIL` + `RESEND_API_KEY`) |
| Subscriber | `subscribers/order-placed.ts` | confirmation email + WhatsApp |
| Subscriber | `subscribers/order-canceled.ts` | cancellation email |
| Subscriber | `subscribers/order-fulfillment-created.ts` | shipment/dispatch notice |
| Subscriber | `subscribers/auth-password-reset.ts` | reset email with tokenised link |
| Webhook | `api/webhooks/razorpay` | HMAC-verified raw body; logs the event; payment state itself advances through Medusa's canonical `/hooks/payment/razorpay_razorpay` |
| Webhook | `api/webhooks/shiprocket` | static-token auth; updates `shipment` + `shipment_event`; reflects `delivered` into Medusa fulfilment; sends delivery email |

## 8. Existing documentation and audit artefacts (read, not trusted)

- `docs/` — 19 files: PROJECT_PLAN, SCREEN_MAP, DATABASE_PLAN, API_PLAN, ORDER_STATE_MACHINE, INTEGRATIONS, QA_PLAN, BUILD_LOG, HANDOFF, PHASE_5.5_PLAN, OMNICHANNEL_MASTER_ARCHITECTURE, …
- Root — 40 `*.md` reports from earlier rounds, including `FINAL_RELEASE_READINESS.md` and `CURRENT_PROJECT_STATUS.md`, which themselves warn that an earlier round's "100% production ready" claim was independently disproven.
- `.audit/` — 25 committed `.mjs`/`.mts` evidence scripts and `results.json` / `results2.json` JSON outputs from previous rounds.
- `scripts/audit-e2e.mjs` — a large ad-hoc end-to-end script (not part of `pnpm test`).

**This audit treated all of the above as claims to re-verify.** Where a prior report's claim is repeated here, it carries its own `[LIVE]`/`[CODE]` tag; where it could not be reproduced it is recorded as unverified. Two concrete contradictions were found and are recorded in `12_TEST_RESULTS_AND_EVIDENCE.md`: `pnpm lint` is **not** clean (BUILD_LOG claims "100% clean"), and the storefront catalogue is capped at one page.

## 9. Existing audit directory handling

The repository already contains `.audit/` (scripts + results) and 40 root-level audit documents. Per the audit brief, **nothing was overwritten**. This audit writes a new, dated directory: `AUDIT_REPORTS/`.

## 10. Environment observations

- `.env` and `.env.local` files exist locally and are correctly **untracked** (`git ls-files` shows only `.env.example` and `apps/admin/.env.example`).
- `apps/storefront/.env.local` keys: `MEDUSA_URL`, `NEXT_PUBLIC_MEDUSA_URL`, `MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and the four `NEXT_PUBLIC_FEATURE_*` flags.
- `apps/backend/.env` keys: `DATABASE_URL`, `MEDUSA_BACKEND_URL`, `STOREFRONT_ORIGIN`, `ADMIN_ORIGIN`, `MEDUSA_JWT_SECRET`, `MEDUSA_COOKIE_SECRET`, `LOG_LEVEL`, `PORT`, `OTP_DEV_ECHO`, `GEMINI_API_KEY`.
  **Absent:** every `RAZORPAY_*`, `RESEND_API_KEY`, `SHIPROCKET_*`, `OTP_PROVIDER`/`MSG91_*`/`TWILIO_*`, `S3_*`, `SENTRY_DSN`, `BUSINESS_*`, `GRIEVANCE_OFFICER_*`, `REDIS_URL`, `REPORTS_EMAIL`.
- `apps/admin` has **no** local env file; it relies on defaults.
- The working database contains **audit fixture data** left behind by earlier rounds (36 `Audit Brand`/`TestBrand` rows, test products, 43 reserved units). This is documented as BUG-12 and is *not* a clean demo dataset.
