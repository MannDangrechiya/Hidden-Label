# Phase 1 — Foundation Report

Date: 2026-11-14 · Gate: **G1 ✅ CLOSED** · Author: agent

## Verdict

Phase 1 is complete and verified end to end. The storefront renders live products from Medusa
over a real PostgreSQL 18.6 database, with 151 tables created from an empty database by the
project's own migration command.

The "no PostgreSQL on this machine" blocker from the first attempt is **resolved**: the cause was
environment pollution from the MSYS/Git-Bash shell, not PostgreSQL and not the machine.

---

## 1. Verified (commands run, results observed)

| Check | Command | Result |
|---|---|---|
| Workspace install | `pnpm install` | ✅ |
| Typecheck (4 packages) | `pnpm typecheck` | ✅ exit 0 |
| Lint | `pnpm lint` | ✅ exit 0 |
| Unit tests | `pnpm test` | ✅ 8/8 |
| Storefront build | `pnpm --filter @thl/storefront build` | ✅ `/`, `/design`, `/api/health`, `/loading` |
| Medusa CLI | `pnpm exec medusa --version` | ✅ 2.22.7 |
| **Migrations from empty DB** | `medusa db:migrate` | ✅ **151 tables, 0 errors** |
| **Seed** | `medusa exec ./src/scripts/seed.ts` | ✅ India/INR region, sales channel, publishable key, 3 products |
| Backend health | `GET :9000/health` | ✅ 200 |
| **Store API with publishable key** | `GET :9000/store/products` | ✅ `count: 3` |
| **Storefront renders live data** | `GET :3000/` | ✅ 3 products with real INR prices |

Screenshot: `docs/screenshots/g1-live-products.png` (live data) and
`docs/screenshots/design-system.png` (token gallery).

---

## 2. Root cause of the database failure (and the fix)

Every PostgreSQL backend died with `0xC0000142` (STATUS_DLL_INIT_FAILED) and clients got
`ECONNRESET` — with the trimmed embedded build *and* with the official EnterpriseDB 18.6 build.

The trigger was **the inherited MSYS/Git-Bash environment**. Starting the postmaster with a
minimal Windows environment (`SYSTEMROOT`, `WINDIR`, a PATH containing the PostgreSQL `bin`
directory, `TEMP`/`TMP`) fixes it entirely:

```
env -i SYSTEMROOT=... PATH=... postgres -D .dev/pgdata -p 5437   →  CONCURRENT_OK
```

`scripts/dev-db.mjs` now spawns `initdb`/`pg_ctl` with exactly that sanitized environment
(`childEnv()`), so `pnpm db:start` works on this machine with no Docker and no admin rights. The
comment in that function is load-bearing — spreading `process.env` into the child breaks it.

Local ports (one URL everywhere): Postgres **5437**, Redis **6380**, backend **9000**, storefront **3000**.

---

## 3. Built

```
apps/storefront     Next.js 16.4.6 · live Medusa catalogue · loading/empty/error states · /design gallery
apps/backend        Medusa 2.22.7 · medusa-config.ts · src/scripts/seed.ts (idempotent)
packages/shared     integer-paise Money, formatINR (₹1,24,500), 8 unit tests
packages/config     shared ESLint flat config
packages/ui         design tokens + Button, Input, Price, Badge, ProductCard, Skeleton, states
docker-compose.yml  postgres:18-alpine :5437 · redis:7-alpine :6380
scripts/dev-db.mjs  portable cluster with sanitized env (no Docker needed)
.github/workflows/ci.yml  typecheck · lint · test · build · migrations-from-empty-db
```

Pinned (PROJECT_PLAN §8 D5): Node ≥22.22.0, pnpm 10.32.1, Medusa 2.22.7, Next 16.4.6,
TypeScript 5.9.3, ESLint 9.39.5, Vitest 3.2.4.

---

## 4. Fixes worth remembering (each was a real failure)

1. **`ts-node` missing** — the Medusa CLI loads `medusa-config.ts` through it; without it every
   command fails with "Error in loading config".
2. **Port 0** — `medusa develop` defaults `--port` to `0`, so the server bound to a random
   ephemeral port. The dev/start scripts now pass `--port 9000` explicitly.
3. **Pricing context** — `/store/products` returns 400 `Missing required pricing context -
   region_id` when calculating prices; `currency_code` is *not* an accepted query field in
   2.22.7. The storefront resolves the INR region once and sends `region_id`.
4. **`api_keys`** — `createApiKeysWorkflow` takes `api_keys`, not `apiKeys`.
5. **Mobile type step** — the 64 px hero overflowed at 375 px until `type-display-hero` encoded
   the documented mobile step (38/42).

---

## 5. Phase 2 progress (design system, built alongside)

- `packages/ui/src/styles/tokens.css` — every token from `DESIGN_TOKENS.md` as Tailwind v4
  `@theme`, plus responsive type classes.
- Primitives: `Button` (primary/secondary/disabled/loading, gold hover inversion), `Input`
  (label/hint/`aria`-wired error), `Price` (always `formatINR`, tabular), `Badge` (data-backed
  kinds only — no V2 authenticity badge, per D2), `ProductCard`, `Skeleton`/`SkeletonCard`,
  `EmptyState`, `ErrorState`.
- `/design` gallery at 375 / 768 / 1200, plus `app/loading.tsx`.
- Fonts (Syne, Hanken Grotesk, JetBrains Mono) self-hosted through `next/font`.

Open Phase 2 item: the six mobile reference builds for D4 approval need the real page templates
from Phase 4.

---

## 6. Next

Phase 3 (commerce modules: brand, CMS, wishlist, RMA, audit) against this live database, then
Phase 4 storefront pages, then Phase 5 admin.
