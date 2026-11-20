# PHASE 1 — FINAL COMPLETION REPORT

**Date:** 2026-11-20
**Scope:** commit of the verified Phase 1 change set, plus closure of R-05, R-06 and R-07.
**Not in scope, untouched:** payment behaviour, business model, pricing, GST, checkout, catalogue, Phase 2. Nothing was pushed or deployed.

---

## 1. Commits

| Commit | Subject | Contents |
|---|---|---|
| `06df83b561b831ea7263235a77825b6aa46e920d` | `fix: close Phase 1 security, refund and inventory defects` | 58 files: the complete Phase 1 change set (RBAC, refund idempotency, inventory locking, RMA numbering, concierge ownership, env guard, web security, lint, migration, test harness, CI, three Phase 1 documents) |
| `4b3aa6d664e7a69c5baf3b132cbb90365821f72d` | `fix(backend): restock returns once and resolve stock locations by order` | 14 files: R-05, R-06 and R-07 fixes with their unit and database integration tests |

Branch `main`. Parent of `06df83b` is `9d7c5fe` ("reports"). Working tree is **clean** (`git status` → 0 entries). Neither commit was pushed; no tag, no deploy, no remote write of any kind.

The work is split into two commits on purpose: the first is exactly the change set that was independently re-verified in `PHASE_1_HANDOVER_REPORT.md` (so it can be reviewed or reverted as one unit), and the second is the defect closure with its own regression evidence.

---

## 2. Files changed

### 2.1 Commit `06df83b` — 58 files

**Modified (31)**

| Area | File |
|---|---|
| Backend | `src/lib/admin-auth.ts`, `src/lib/rate-limit.ts`, `src/api/middlewares.ts` |
| Backend | `src/api/admin/inventory/route.ts`, `src/api/admin/orders/[id]/actions/route.ts` |
| Backend | `src/api/store/return-requests/route.ts`, `src/api/store/concierge/chat/route.ts` |
| Backend | `src/modules/thl/models/concierge-thread.ts`, `medusa-config.ts`, `package.json` |
| Backend | `src/lib/admin-auth.test.ts` |
| Admin | `lib/roles.ts`, `lib/api/auth.ts`, `lib/api/uploads.ts`, `lib/roles.test.ts`, `app/(dashboard)/layout.tsx`, `next.config.ts` |
| Storefront | `next.config.ts`, `components/style-concierge.tsx`, `lib/resale.ts` |
| Repo | `package.json`, `.github/workflows/ci.yml`, `.env.example`, `.audit/*.mjs` (8 lint-only files) |

**Added (27)**

`apps/backend/src/lib/`: `stock-adjustment.ts`, `refund-operations.ts`, `rma-numbering.ts`, `concierge-session.ts`, `env-guard.ts`, `upload-validation.ts`, `write-rate-limit.ts` + their 6 unit test files and 3 lib integration tests;
`apps/backend/src/api/...`: inventory route + concierge chat route integration tests;
`apps/backend/test/integration-db.ts`, `vitest.config.mts`, `vitest.integration.config.mts`;
`apps/backend/src/modules/thl/migrations/Migration20261120100000.ts`;
`apps/admin/lib/upload-rules.ts`, `upload-rules.test.ts`;
`IMPLEMENTATION_PLAN.md`, `PHASE_1_SECURITY_FIXES_REPORT.md`, `PHASE_1_HANDOVER_REPORT.md`.

**Deleted:** none.

### 2.2 Commit `4b3aa6d` — 14 files

| Status | File | Purpose |
|---|---|---|
| added | `apps/backend/src/lib/money.ts` (+ `money.test.ts`) | exact paise arithmetic (R-06) |
| added | `apps/backend/src/lib/return-restock.ts` (+ `return-restock.test.ts`, `return-restock.integration.test.ts`) | exactly-once locked restock (R-05) |
| added | `apps/backend/src/lib/stock-location.ts` (+ `stock-location.test.ts`, `stock-location.integration.test.ts`) | location policy (R-07) |
| added | `apps/backend/src/lib/returns.integration.test.ts` | route-level R-05/R-07 tests |
| modified | `apps/backend/src/lib/returns.ts` | receive path uses the locked restock |
| modified | `apps/backend/src/lib/stock-adjustment.ts` | exports transaction-scoped `applyStockDelta` |
| modified | `apps/backend/src/api/admin/orders/[id]/actions/route.ts` | paise refund parsing, location-aware fulfilment |
| modified | `apps/backend/src/api/store/return-requests/route.ts` | paise refund computation |
| modified | `apps/backend/test/integration-db.ts` | return tables in the isolated schema |

**Deleted:** none.

Pre-commit checks on both commits: full diff inspected, no `.env`/`.pem`/`.key` file staged (the guard only ever matched `.env.example`, which is a tracked, value-free template), no build artefacts (`dist/`, `.next/`, logs, images), no `console.log`/`debugger`/`FIXME` left in application code, no accidental deletions (`--diff-filter=D` → 0), and a credential-pattern scan of the diff (Razorpay, Stripe, AWS, GitHub, Slack, PEM, JWT, inline `password=`/`api_key=`) returned no matches.

---

## 3. Migrations

**No new migration was required for R-05, R-06 or R-07.** Each fix works with the schema that already exists, which is deliberate — inventing columns would have added risk without adding a guarantee:

| Defect | Why no schema change |
|---|---|
| R-05 | `return_request.restocked_at` (timestamptz) and `inventory_level.stocked_quantity` already exist and are sufficient: `UPDATE … WHERE restocked_at IS NULL` is an atomic compare-and-set, and the row locks come from PostgreSQL, not from new tables. |
| R-06 | `return_request.refund_amount` is already `numeric(12,2)`, which preserves exactly the precision the code now produces. Changing it to an integer column would have rewritten existing rows and broken records that legitimately hold paise. |
| R-07 | `fulfillment.location_id` already records the source location of every fulfilment (36 of them in the development database) and `stock_location` already lists them. The fix reads what Medusa already stores. |

The Phase 1 migration from commit `06df83b` — `Migration20261120100000` — remains the latest project migration and is committed.

**Migration status:** applied and recorded (`mikro_orm_migrations` id 203, executed 2026-11-20T12:09:52Z); re-running `pnpm db:migrate` after the code changes exits 0 with no pending module migrations. Live schema objects verified: `refund_operation` (+ unique `refund_operation_key_unique`), sequence `return_request_display_seq` (`last_value 1028`), `concierge_thread.session_token_hash`.

---

## 4. R-05 — concurrent return restocking

### Failure scenario (before)

`apps/backend/src/lib/returns.ts`, receive action, condition `resellable`:

```ts
const location = await trx("stock_location").first("id");
const level = await trx("inventory_level").where({...}).first();
await trx("inventory_level").where({ id: level.id }).update({
  stocked_quantity: Number(level.stocked_quantity) + quantity,
});
...
if (restockedAny) await trx("return_request").where({ id }).update({ restocked_at: new Date() });
```

1. **Double receive / double click.** Two requests mark the same RMA `receive`. Both read `restocked_at = null`, both add the units. Stock rises by 2× the returned quantity, and `restocked_at` is set twice with no guard at all.
2. **Repeated receive.** An operator receives the same RMA again (UI retry, browser refresh, second operator). Nothing stops the increment: the units are added a third and fourth time.
3. **Two different RMAs, same SKU, same time.** `level.stocked_quantity` is read outside any lock and the new value computed in application memory, so the later write discards the earlier one — the same lost update already fixed for manual adjustments (BUG-05), left behind on this path.
4. The restock location was `stock_location.first("id")`, an unordered `LIMIT 1`.

### Change

- `stock-adjustment.ts` now exports `applyStockDelta(trx, input, audit)` — the one locked implementation (`SELECT … FOR UPDATE`, negative bound re-checked under the lock, audit row in the same transaction). `adjustStock` is a transaction around it, so manual adjustments and return restocks share identical semantics.
- `return-restock.ts` adds `restockReturn(trx, …)`:
  - merges return lines per inventory item (two lines can point at one item) and sorts them, so lock order is deterministic and one row is never contested by the same transaction;
  - applies each increment through `applyStockDelta` (locked);
  - then performs `UPDATE return_request SET restocked_at = now() WHERE id = ? AND restocked_at IS NULL` and **throws if it affects no row**, rolling back its own increments. The once-only guarantee is therefore enforced by the database, not by caller discipline.
- `returns.ts` locks the `return_request` row (`forUpdate`) before restocking, on top of that compare-and-set, and reports the outcome (`restock.reason = "already_restocked"` with an explicit note) instead of silently doing nothing.

No inventory, refund or return policy changed: only `resellable` units are restocked, damaged/disposed returns still never touch stock, and `restocked_at` still only records an actual restock.

### Tests

| Test | File | Assertion |
|---|---|---|
| 5 concurrent receives of one RMA | `returns.integration.test.ts` | 1 restock, 4 `already_restocked`, stock +2 once, 1 audit row, status `received` |
| receive the same RMA twice | `returns.integration.test.ts` | stock unchanged, note says nothing was added twice |
| 5 racing restock transactions on one RMA | `return-restock.integration.test.ts` | 1 fulfilled, 4 rejected with `ReturnAlreadyRestockedError`, stock +2 |
| repeated restock of a restocked RMA | `return-restock.integration.test.ts` | rejected, stock unchanged |
| 6 concurrent restocks of different RMAs, same item | `return-restock.integration.test.ts` | all applied, stock +12, no lost update |
| nothing to restock (no level) | `return-restock.integration.test.ts` | `restocked: false`, `restocked_at` stays `NULL` |
| damaged return never restocks | `returns.integration.test.ts` | stock unchanged, `restocked_at` `NULL` |
| line merging / lock ordering | `return-restock.test.ts` | sums per item, deterministic order, drops invalid lines |

Status: **UNIT TESTED + INTEGRATION TESTED (route level and data layer).**

---

## 5. R-06 — `refund_amount` numeric handling

### Failure scenario (before)

- `apps/backend/src/api/store/return-requests/route.ts`: `lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)` then `refundAmount.toFixed(2)`, where `unit_price` came from `Number(row.unit_price)` — a `numeric(12,2)` string converted to a binary float. For example `21.15 × 3` is `63.449999999999996` in floating point; a multi-line return accumulates such error before `toFixed` rounds it to a paise that is not the sum of the line amounts.
- `apps/backend/src/api/admin/orders/[id]/actions/route.ts`: `req.body.amount ?? Number(payment.amount)` — the captured amount was likewise parsed as a float, and a client could submit an amount with more decimals than the column can hold (`1500.005`), which silently rounds.

### Change

`money.ts` parses every amount into **integer paise** from its decimal representation (digit by digit for strings; numbers accepted only when exactly representable, otherwise rejected), all arithmetic is integer, and `formatPaise` produces the 2-decimal string the column stores. `toRupeesNumber` is the single, explicit boundary conversion for Medusa's workflow, which takes rupees.

- Return creation sums `unit_price_paise × quantity` and stores `formatPaise(total)`; a line whose price cannot be represented exactly is refused with 422 rather than mis-refunded.
- Admin refunds parse both the captured amount and the operator's amount in paise, reject unrepresentable values with 400, and pass the exact rupee value to `refundPaymentWorkflow` while the idempotency key keeps deriving from the same amount as before (whole-rupee keys are byte-identical, so existing `refund_operation` rows still resolve).

**Existing records are untouched.** There is no data migration and no column change: values already stored as `numeric(12,2)` are read exactly. No historical value was rewritten or "corrected", because that would be inventing data.

Status: **UNIT TESTED + INTEGRATION TESTED** (the route-level receive tests and the existing return flow run against real `numeric` columns; 6 dedicated money unit tests, including the float-drift cases).

---

## 6. R-07 — single-stock-location assumptions

### Failure scenario (before)

Two places did `stock_location.first("id")` — an unordered `LIMIT 1`:

- `api/admin/orders/[id]/actions/route.ts` (fulfil) told `createOrderFulfillmentWorkflow` to ship from whichever row PostgreSQL returned first;
- `lib/returns.ts` (restock) put returned units into that same arbitrary row.

With one location this is correct by accident. With two it silently ships from, or restocks into, the wrong warehouse — no error, wrong stock. The development database has one location today (`The Hidden Label Warehouse`) and 36 fulfilments that already record `location_id`, so the correct source of truth was available and unused.

### Change

`stock-location.ts` implements one explicit policy and is used by both paths:

1. a location supplied in the request body (`location_id`) wins;
2. otherwise the location of the order's most recent fulfilment — returned goods go back where they came from, and a split shipment continues from the same warehouse;
3. otherwise the only location, when the business genuinely has one;
4. otherwise **fail closed** with 422 `location_required` / `no_location` / `location_not_found` and an actionable message, instead of guessing.

`receive` resolves the location **before** any state change, so an ambiguous request leaves the return untouched. Fulfilment and receive both accept an optional `location_id`; existing single-location callers behave exactly as before.

Status: **UNIT TESTED + INTEGRATION TESTED** (7 policy unit tests; 5 DB-backed resolution tests including split shipments and archived locations; route-level tests proving restock lands in the fulfilling warehouse, an explicit location overrides it, and an ambiguous order gets 422 with no stock change).

---

## 7. Tests and actual results

All commands run in this session on the committed tree.

```
pnpm typecheck         → exit 0
pnpm lint              → exit 0   0 errors, 0 warnings
pnpm test              → exit 0   148 tests / 20 files
pnpm test:integration  → exit 0    36 tests /  8 files  (real PostgreSQL)
```

**Unit suite**

| Package | Files | Tests |
|---|---|---|
| `@thl/backend` | 16 | 115 |
| `@thl/shared` | 2 | 23 |
| `@thl/admin` | 2 | 10 |
| **Total** | **20** | **148** |

**Integration suite**

| File | Tests |
|---|---|
| `lib/returns.integration.test.ts` (R-05, R-07) | 5 |
| `lib/return-restock.integration.test.ts` (R-05) | 4 |
| `lib/stock-location.integration.test.ts` (R-07) | 5 |
| `lib/rma-numbering.integration.test.ts` | 2 |
| `lib/stock-adjustment.integration.test.ts` | 3 |
| `lib/refund-operations.integration.test.ts` | 4 |
| `api/store/concierge/chat/route.integration.test.ts` | 7 |
| `api/admin/inventory/route.integration.test.ts` | 6 |
| **Total** | **36** |

Progression: 70 unit / 0 integration (pre-Phase 1) → 132 unit / 22 integration (Phase 1 handover) → **148 unit / 36 integration** now. Every pre-existing test still passes, including all 22 earlier integration tests, so existing behaviour is intact.

---

## 8. Remaining defects

| ID | Severity | Item | Status after this work |
|---|---|---|---|
| R-01 | Low | No HTTP-level E2E test for the refund route (needs a Medusa process + payment provider) | NOT VERIFIED |
| R-02 | Low | Per-file MIME enforced by the admin app; Medusa core `/admin/uploads` guard checks multipart + size only | PARTIAL |
| R-03 | Low | `apps/admin` and storefront production builds not run this phase (typecheck only) | NOT VERIFIED |
| R-04 | Low | Admin CSP/HSTS/COOP verified by reading config, not a live HTTP response | NOT VERIFIED |
| R-08 | Medium | Razorpay webhook topology and payment state unexercised — no keys | BLOCKED |
| R-05 | Medium | Return restock concurrency / double restock | **CLOSED** |
| R-06 | Low | `refund_amount` numeric handling | **CLOSED** |
| R-07 | Low | Single-stock-location assumption | **CLOSED** |

No open High defect remains. R-05, R-06 and R-07 each have unit **and** database integration regression tests on the committed tree.

---

## 9. External blockers

Still absent from this environment; none blocked this phase:

Razorpay test keys · `RESEND_API_KEY` + verified sending domain · `SHIPROCKET_*` credentials · `S3_*` credentials · `SENTRY_DSN` · `BUSINESS_*` / `GRIEVANCE_OFFICER_*` identity · production Redis (local runs use Medusa's fake in-memory instance, printed as a warning by `db:migrate`).

Owner decisions still open and unchanged: **BD-1** (fixed-price resale vs StockX-style bidding) and **BD-2** (sneaker/streetwear vs broader premium fashion). Nothing in this phase depended on them.

---

## 10. Phase 2 readiness verdict

**READY** for Phase 2 work that is not payment implementation.

- Phase 1 is committed (`06df83b`), the defect closure is committed (`4b3aa6d`), and the working tree is clean, so Phase 2 branches from a reverted-able, reproducible state.
- All four gates pass on the committed tree, including 36 database integration tests that exercise real locks and real `numeric` columns.
- The three carry-over defects the handover report named as Phase 2 entry conditions are closed with regression coverage.
- No payment, pricing, GST, checkout or business-model behaviour was changed; no migration was added; nothing was pushed or deployed.

Conditions that remain outside this phase, unchanged from the handover verdict:

1. Payment-path work still needs owner-supplied **test-mode** Razorpay keys; R-01 and R-08 stay open until then.
2. R-03 (production builds of admin/storefront) and R-04 (live header check) should be run once in whichever phase first touches those surfaces.
3. BD-1 and BD-2 are still required before catalogue/resale/pricing phases.

