# THE HIDDEN LABEL — platform build

Centralized multi-brand e-commerce platform: customer storefront, custom admin dashboard,
Medusa commerce backend on PostgreSQL, Razorpay + Shiprocket + email + OTP integrations.

Design source of truth: Google Stitch project `10766877595551018159`
(`https://stitch.google.com/projects/10766877595551018159`).

**Status: Phase 1 ✅ G1 closed · Phase 2 design system built · storefront browse → bag working on
live Medusa data. Running inventory of what works: `docs/BUILD_LOG.md`.**

| Decision | Outcome |
|---|---|
| D1 | AI layer + resale deferred to V2, preserved behind feature flags |
| D2 | No unsubstantiated claims — plain audit log, no escrow, no RFID, no Merkle, no KYC |
| D4 | Mobile via approved reference-build workflow (6 templates) |
| Q6 | Email + password primary, OTP for verification, password reset, rate limits |

## Read in this order

| File | What it settles |
|---|---|
| `docs/PROJECT_PLAN.md` | scope, architecture, milestones, gates, risks, decisions log |
| `docs/SCREEN_MAP.md` | all 50 screens, routes, data, missing states, Stitch IDs |
| `docs/DESIGN_TOKENS.md` | colours, type scale, spacing, components, responsive derivation |
| `docs/DATABASE_PLAN.md` | Medusa-owned vs project tables, migrations, seeds |
| `docs/API_PLAN.md` | endpoints, payloads, auth, error and idempotency rules |
| `docs/ORDER_STATE_MACHINE.md` | the order/payment states and their invariants |
| `docs/INTEGRATIONS.md` | Razorpay, Shiprocket, email, OTP, storage, monitoring |
| `docs/QA_PLAN.md` | acceptance matrices, security checklist, release criteria |
| `docs/OPEN_QUESTIONS.md` | blocking decisions Q1–Q6, working assumptions |
| `agent/RULES.md` | standing instructions for the coding agent |
| `agent/PHASE_PROMPTS.md` | one paste-ready prompt per phase |
| `docs/PHASE_1_REPORT.md` | Phase 1 deliverables, verified checks, database blocker |

## Running it

```bash
pnpm install                 # Node >=22.22.0, pnpm 10.32.1

pnpm db:start                # PostgreSQL 18 on :5437 (no Docker, no admin needed)
# or: docker compose up -d   # postgres:18 on :5437, redis:7 on :6380

pnpm db:migrate              # Medusa schema from an empty database (151 tables)
pnpm db:seed                 # India/INR region, sales channel, publishable key, 3 products
                             # → prints MEDUSA_PUBLISHABLE_KEY for apps/storefront/.env.local

pnpm dev:backend             # Medusa on :9000
pnpm dev:storefront          # Next on :3000 — lists live products; /design shows the token gallery
```

Ports: Postgres **5437** · Redis **6380** · backend **9000** · storefront **3000**.

> Windows note: `scripts/dev-db.mjs` spawns PostgreSQL with a sanitized environment on purpose.
> An MSYS/Git-Bash environment makes every backend die with `0xC0000142` — see
> `docs/PHASE_1_REPORT.md` §2 before changing that code.

Checks: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm --filter @thl/storefront build`.

## Pinned versions

Node ≥ 22.22.0 · pnpm 10.32.1 · **Medusa 2.22.7** (all `@medusajs/*` lockstep) · Next 16.4.6 ·
TypeScript 5.9.3 · ESLint 9.39.5 · Vitest 3.2.4. Write all Medusa extensions against 2.22.7.

## Repository layout

```
apps/storefront   Next.js customer app (Phase 1: raw product list on real backend data)
apps/backend      Medusa 2.22.7 + src/scripts/seed.ts
packages/shared   Money/formatINR helpers, shared types, unit tests
packages/config   shared ESLint config
docs/             specification pack
agent/            coding-agent rules and phase prompts
```
