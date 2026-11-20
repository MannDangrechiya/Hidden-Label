# 10 — PERFORMANCE, BUILD AND DEVOPS AUDIT

## 1. Build, typecheck, lint, tests — measured

| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | **PASS** — exit 0, 6/6 packages (`@thl/shared`, `ui`, `config` n/a, `backend`, `storefront`, `admin`) |
| Unit tests | `pnpm test` | **PASS** — exit 0, **70/70** (shared 23, backend 45, admin 2) |
| Lint | `pnpm lint` | **FAIL** — exit 1, **15 errors, 0 warnings** |
| Production build (storefront) | — | **NOT RUN** — see note below |
| Production build (admin / backend) | — | **NOT RUN** |

**Lint failures (all 15 in committed audit scripts, none in application code):**
`.audit/analyze-tests.mjs`, `.audit/independent-workflow-gate.mjs`, `.audit/inspect-env-keys.mjs`, `.audit/test-all-roles-rbac.mjs`, `.audit/test-cod-forgery.mjs`, `.audit/test-inventory-gate.mjs`, `.audit/test-promo-rbac.mjs`, `.audit/test-users-me.mjs`.
Rules violated: `@typescript-eslint/no-unused-vars` (unused `path`/`fs` imports) and `no-empty` (empty `catch` blocks).

**Impact:** `.github/workflows/ci.yml` runs `pnpm lint` as a required step, so **CI is red on this commit**. `docs/BUILD_LOG.md` claims "repo-wide `pnpm typecheck` and `pnpm lint` are 100% clean" — that claim is **contradicted by measurement** as of this audit.

**Why the production build was not run:** the storefront dev server is live on `:3000` and shares the `.next` directory. Running `next build` in the same working tree would overwrite the dev server's build artifacts and can break the running environment, which the audit brief forbids ("preserve existing development state"). The CI workflow already defines the build command (`pnpm --filter @thl/storefront build`) and the correct place to verify it is CI or a separate worktree. **Storefront buildability is therefore NOT VERIFIED in this audit.**

## 2. Measured response times (local development, warm)

**Method:** `curl -w %{time_total}` against the running services. These are **development-mode** numbers (Turbopack dev server, no CDN, single process, local Postgres) and must not be read as production performance.

| Endpoint | Samples (s) | Observation |
|---|---|---|
| `GET :9000/store/products?limit=8` (with publishable key) | 0.402, 0.021, 0.021, 0.024, 0.020 | ~21 ms warm; first call 0.40 s (connection/plan warm-up) |
| `GET :3000/` | 1.816, 0.303, 0.291, 0.276, 0.318 | ~0.28–0.32 s warm; 1.8 s cold |
| `GET :3000/collections/all` | 0.368, 0.178, 0.146 | ~0.15–0.37 s |

No load test, no Lighthouse run, no database query plan analysis was performed, so **no performance score is reported**. The one prior measurement in the repo (`CURRENT_PROJECT_STATUS.md`: p50 2580 ms → 1542 ms for `/store/products` under 40 concurrent requests after raising the pool to 20) was **not** reproduced here.

## 3. Caching

| Layer | Status |
|---|---|
| Catalogue fetches | `cache: "no-store"` for mutations; `next: { revalidate: 0 }` for GETs → **effectively uncached**, by design ("stale product id after an admin edit produces confusing cart errors") |
| Regions | Intentionally cached 300 s in-process (`resolveRegionId`) |
| Categories / CMS / banners / activity | `revalidate: 60` / `30` |
| Redis | **Not configured** → no shared cache; each replica would cache independently |
| CDN / edge | None |
| Admin backend calls | `cache: "no-store"` everywhere |

**Assessment:** correctness-first caching is a defensible choice at this stage, but the storefront will hit the backend on every request. Before launch, catalogue reads need at least a short shared cache (or Redis/ISR) or the backend becomes the bottleneck.

## 4. Database performance

- Pool: `min 2 / max 20`, configurable via `DB_POOL_*`.
- Indexes present on all high-traffic paths reviewed: order `deleted_at`/status, inventory level, shipment order/status/AWB, return status, resale variant/seller/buyer, OTP destination, audit entity.
- **Unbounded `audit_event`** — no retention/partitioning; at 256 rows today this is irrelevant, but it will need archiving.
- Dashboard summary runs six aggregate queries per load (counts, sums, recent orders) — fine at current volume, will need materialised views or a reporting table at scale.

## 5. Error monitoring and observability

| Capability | Status |
|---|---|
| Structured logging | **Partial** — Medusa logger to stdout; `LOG_LEVEL=info` |
| Error tracking | **MISSING** — no Sentry/OpenTelemetry; `SENTRY_DSN` unset and no SDK installed |
| Request tracing | **MISSING** |
| Health endpoints | **Present** — `GET :9000/health` and `GET :3000/api/health` (the latter reports backend reachability + latency) |
| Uptime/alerting | **MISSING** |
| Log aggregation | **MISSING** — dev logs go to `.dev/*.log` and `backend-dev.log` |

This is the weakest engineering area after payments: a production incident would be diagnosed from whatever happens to be on stdout.

## 6. Backup and recovery

- **No backup configuration exists** for local or any hosted database.
- No restore procedure, no documented RPO/RTO, no dump script in `package.json`.
- `docker-compose.yml` uses a named volume (`thl-pgdata`) but no backup sidecar.
- The portable Postgres cluster lives in `.dev/pgdata` (gitignored) — a disk failure loses everything.

## 7. CI/CD and deployment

**What exists** — `.github/workflows/ci.yml`:
- Job `checks`: ubuntu, Node 22.22.0, pnpm 10.32.1, `install --frozen-lockfile` → typecheck → lint → unit tests → storefront build.
- Job `migrations`: Postgres 18 service, runs `medusa db:migrate` from empty and asserts ≥50 tables.

**What is missing:**
- **No deploy job, no environment promotion, no rollback strategy.**
- **No Dockerfile** for backend/storefront/admin.
- **No IaC** (Terraform/Pulumi), no manifests, no hosting config.
- **No secret management** integration for CI.
- No smoke test after deploy.
- No dependency or container vulnerability scanning.
- **As of this commit the `checks` job would fail at the lint step** (BUG-02).

## 8. Environment separation

- Single `.env` / `.env.local` per app; no `.env.production` template, no documented per-environment variable matrix beyond `.env.example`.
- No staging environment exists.
- `apps/admin` has **no** env file at all, relying on hardcoded localhost defaults.

## 9. Windows/dev-experience notes (relevant to reliability)

- `scripts/dev-db.mjs` deliberately sanitises the environment because an MSYS/Git Bash environment makes Postgres die with `0xC0000142`. This is a real, documented constraint and should be preserved.
- `.bat` launchers exist for start/stop; they are the documented entry point for non-technical operators.
- `apps/admin` must run with `--webpack` because Turbopack does not link the compiled `globals.css` chunk (documented in `docs/BUILD_LOG.md`). This is a workaround, and any Next upgrade must re-test it.

## 10. DevOps findings summary

| ID | Finding | Severity |
|---|---|---|
| DEV-01 | Lint gate fails ⇒ CI red | **P0 for release process** |
| DEV-02 | No deployment pipeline, no Dockerfile, no hosting | **P0 for launch** |
| DEV-03 | No error monitoring or alerting | **P1** |
| DEV-04 | No backup or restore procedure | **P0 for launch** |
| DEV-05 | Redis absent ⇒ in-memory queues/events, per-replica rate limits | **P1** |
| DEV-06 | No staging environment | **P1** |
| DEV-07 | Production build not verified in this audit | **P1 (unverified)** |
| DEV-08 | Local file storage for uploads | **P1** |
| DEV-09 | No dependency/vulnerability scanning | **P2** |
| DEV-10 | Catalogue effectively uncached | **P2** |
