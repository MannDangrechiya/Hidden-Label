# 15 — RECOMMENDED IMPLEMENTATION ROADMAP

**Constraint for this document:** the roadmap is a recommendation only. Nothing in it has been implemented; the audit changed no source files, no schema, no dependency and no configuration.

**Sequencing principle:** *prove money moves, then make operations real, then make merchandising better.* Do not start new feature domains (loyalty, marketplace, mobile) until a paid order has been fulfilled, returned and refunded end-to-end.

---

## Phase A — Unblock and stabilise (should already have been done; ~1 week)

Goal: a green release gate and no known high-severity defects.

| # | Task | Files | Done when |
|---|---|---|---|
| A1 | Enable Razorpay in **test mode** and link it to the INR region | `apps/backend/.env`, `apps/storefront/.env.local`, `pnpm db:setup-payments` | `GET /store/payment-providers?region_id=<inr>` lists `pp_razorpay_razorpay` |
| A2 | Fix the lint gate | `eslint.config.mjs` (ignore `.audit/**`, or move scripts out of lint scope) | `pnpm lint` exits 0 |
| A3 | Fix default-owner role | `apps/backend/src/lib/admin-auth.ts`, `apps/admin/lib/api/auth.ts` | A user without `metadata.role` gets 403, never owner |
| A4 | Stable refund idempotency key | `apps/backend/src/api/admin/orders/[id]/actions/route.ts` | Same refund request twice ⇒ one refund |
| A5 | Atomic inventory adjustment | `apps/backend/src/api/admin/inventory/route.ts` | Concurrent +1/−1 leaves a correct level |
| A6 | RMA numbering via sequence | new migration + `store/return-requests/route.ts` | No collision under concurrency |
| A7 | Concierge thread ownership check | `store/concierge/chat/route.ts` | A different session cannot append to a thread |
| A8 | Deterministic verification: run one sandbox purchase | — | A recorded order id, a captured payment, and an order confirmation email (A9) |
| A9 | Configure Resend + verified sender domain | `apps/backend/.env` | Verification, reset, order and RMA emails actually arrive |

**Exit criteria:** `typecheck`, `lint`, `test` green; one complete sandbox purchase; no High finding open.

---

## Phase B — Close the commerce loop (2–4 weeks)

Goal: a real customer can buy, receive, track, and return — with every step evidenced.

| # | Task | Depends on |
|---|---|---|
| B1 | Shiprocket credentials + one sandbox AWB + webhook transition to `delivered` | A8 |
| B2 | Replace hardcoded return destination in `lib/shiprocket.ts` with env config | B1 |
| B3 | Harden the Shiprocket webhook (IP allowlist or HMAC per current docs) | B1 |
| B4 | Full RMA run: request → approve(with reverse pickup) → receive(condition) → refund → credit note | B1 |
| B5 | GST credit-note document + numbering | B4 |
| B6 | Refund reconciliation view (payment ↔ refund ↔ settlement CSV import) | A8 |
| B7 | Courier cost capture per shipment | B1 |
| B8 | Duplicate-submit guard on the pay button | A1 |
| B9 | Staff walkthrough of every admin module with four role accounts (owner/manager/operations/support + readonly denial) | A3 |
| B10 | Set `BUSINESS_GSTIN`, `BUSINESS_CIN`, `GRIEVANCE_OFFICER_*`, `SUPPORT_*` | — |

**Exit criteria:** a second sandbox purchase is delivered, tracked, returned and refunded; every step has an audit row; a credit note exists; role boundaries were demonstrated, not asserted.

---

## Phase C — Production infrastructure (2–3 weeks, parallel to B)

| # | Task |
|---|---|
| C1 | Containerise backend/storefront/admin (three Dockerfiles) |
| C2 | Provision managed PostgreSQL + Redis; set `REDIS_URL`, `DB_POOL_*` per replica |
| C3 | Object storage for uploads (S3-compatible) and remove local `uploads/` |
| C4 | Secret store + fail-fast startup assertions (no `local_dev_*` fallback in production) |
| C5 | Error monitoring (Sentry or equivalent) + structured logs + uptime alerting |
| C6 | Automated backups + a **rehearsed** restore |
| C7 | Deploy pipeline with staging and one-command rollback |
| C8 | Admin app security headers to match the storefront |
| C9 | `pnpm audit` + Dependabot in CI; pin Actions by SHA |
| C10 | Staging dataset: fresh seed with **no audit fixtures** |

**Exit criteria:** staging deploys from `main` on merge; a deliberately broken release is rolled back; a backup is restored into a scratch database.

---

## Phase D — Storefront quality that pays for itself (2–3 weeks)

| # | Task | Why first |
|---|---|---|
| D1 | Server-side pagination + filtering | The catalogue silently caps at 24 today |
| D2 | Unify category model (real `product_category` everywhere) | Consistency between menu and catalogue |
| D3 | Product image gallery + multi-image seed | Core premium-retail expectation |
| D4 | Product reviews (verified purchase, moderated) | Cheapest trust lever |
| D5 | CMS-driven homepage (brands, banners) | Removes a deploy to change the homepage |
| D6 | Honest availability labels + in-stock facet | Removes a false claim |
| D7 | PDP SEO: description, OG, canonical, JSON-LD | Discoverability |
| D8 | Related products / complete-the-look | AOV |

---

## Phase E — Retail back office (4–6 weeks)

| # | Task | Why |
|---|---|---|
| E1 | Supplier records | Foundation for purchasing |
| E2 | Purchase orders + goods-received notes | Controlled inbound stock |
| E3 | Purchase/landed cost per variant | Enables margin and valuation |
| E4 | Stock movement ledger | Ageing, transfers, reconciliation |
| E5 | Margin / profitability report | Pricing decisions |
| E6 | Inventory valuation | Balance sheet |
| E7 | GST output report (rate × state) | Compliance workload |
| E8 | Multi-location operations | Only when a second location exists |

---

## Phase F — Bespoke atelier (4–6 weeks)

Consultation booking → measurement profile with revisions → fabric catalogue → structured customisation → quote → customer approval → job card + tailor assignment → production milestones (already partly built) → fitting → alteration → garment QC → delivery.

Sequence: F1 measurement profile → F2 quote/approval → F3 fabric catalogue → F4 job cards → F5 fittings/alterations.

---

## Phase G — Resale & authentication completion (4–6 weeks)

Intake → ownership declaration → intake reference → authentication (already built) linked to the intake → price/terms acceptance → listing → sale → settlement ledger → payout → dispute handling.

Sequence: G1 intake & declaration → G2 link inspections to asks → G3 settlement ledger → G4 payout details (DPDP-compliant) → G5 disputes → G6 bid→order conversion **only if the business model keeps bidding**.

---

## Phase H — Deferred / explicitly not now

Loyalty & membership · customer segmentation · marketplace third-party sellers · mobile app · advanced AI merchandising · price comparison against named retailers (requires a real data source; the previous implementation invented numbers and was correctly removed) · subscription/repeat-purchase programme.

---

## Ordering rationale

1. **Every phase before D produces or protects revenue; every phase after D improves it.**
2. **A and B are sequential** because logistics verification needs a real order, and a real order needs payments.
3. **C runs in parallel with B** and must finish before any public traffic.
4. **E precedes G**: you cannot settle a consignor fairly without knowing cost and margin.
5. **F and G are differentiators** and should not start until the core retail loop is proven — otherwise the project accumulates partially built domains, which is exactly the pattern the previous rounds exhibited.

---

## Definition of "launch ready" (proposed)

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green in CI on `main`
- [ ] One real (test-mode) purchase completed, fulfilled, delivered, returned and refunded with audit rows for each step
- [ ] Duplicate payment webhook proved idempotent
- [ ] No High/Critical security finding open
- [ ] Staging deploy + rollback demonstrated; backup restored
- [ ] All integration credentials configured and one successful call observed per provider
- [ ] Legal values filled (GSTIN, CIN, grievance officer, support contacts) and policies reviewed by counsel
- [ ] Admin walkthrough recorded for all four roles
- [ ] Monitoring and alerting live; on-call contact documented
