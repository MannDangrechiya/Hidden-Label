# IMPLEMENTATION ROADMAP — The Hidden Label

**Date:** 23 November 2026
**Basis:** findings in `MASTER_PROJECT_AUDIT.md` and companion documents.
**Rule:** no phase begins until the previous phase's acceptance criteria are met, except where dependencies are explicitly parallel.

Priority: **P0** blocking/critical · **P1** required for core operation · **P2** important improvement · **P3** optional/future.

---

## PHASE A — Scope and product decisions (P0)

**Objective:** one written scope of record, so design and engineering stop serving two products.

**Work items**
1. Owner approves retail + bespoke as the launch product; resale/inspection/AI/Fit Studio deferred.
2. Answer the 14 questions in `MASTER_PROJECT_AUDIT.md` §21 (positioning, payments, fulfilment, returns, legal identity, hosting, photography, launch assortment, staff roles, analytics, domain email).
3. Rewrite `README.md` to the agreed scope; mark `HANDOFF.md`, `MASTER_PLAN.md` §2–3 and `BUILD_LOG.md` COD claims as historical.
4. Create one `docs/PRODUCT_SCOPE.md` containing the feature matrix decisions (KEEP/FIX/REDESIGN/DEFER/REMOVE).
5. Choose a single feature-flag convention: `ENABLE_RESALE`, `ENABLE_AI`, `ENABLE_FIT_STUDIO`, each enforced server-side and read by both apps.

**Dependencies:** none.
**Risks:** scope creep back to resale; owner indecision on bespoke.
**Acceptance:** a signed one-page scope; no contradictory statements in README/docs; flags documented.
**Verification:** document review; grep for resale/AI claims in customer-facing surfaces.

---

## PHASE B — Remove approved complexity (P0)

**Objective:** stop showing customers and staff features that are not in the launch product.

**Work items**
1. Gate all resale/bidding CTAs behind `ENABLE_RESALE` (PDP "Place Bid", sell links, account bids/asks, footer).
2. Remove the floating concierge tab and `/verify` routes from the launch UI; hide `/inspection` and `/sell`.
3. Hide admin `/resale`, `/inspections`, `/fit-rules`; remove them from nav when flags are off (already partly done).
4. Decide `/purchasing` (hide POs, move stock ledger to Inventory) and `/reviews` (add to nav).
5. Move the GST export link to Reports; fold Payments under Finance.
6. Remove invoice authenticity sentence, PDP authentication reference, placeholder statutory values.
7. Consolidate policy copy to one source of truth.

**Dependencies:** Phase A decisions.
**Risks:** deleting too much; keep files and tables, hide routes.
**Acceptance:** a customer cannot reach any deferred feature; no dead CTA; no unsubstantiated claim on any screen.
**Verification:** link/route crawl of both apps with flags off; grep for claims; smoke test builds.

---

## PHASE C — Customer storefront redesign (P0/P1)

**Objective:** a premium, mobile-first storefront that can take money.

**Work items**
1. **Fix foundations:** global overflow, mobile header + drawer nav, z-index/layering, remove dev-only chrome.
2. **Design system:** semantic status tokens, typography scale, spacing audit, gallery/accordion/filter-sheet components, focus traps.
3. **Homepage:** editorial hero with real imagery, new-in grid, category tiles, brand strip, atelier story, service row.
4. **Catalogue:** server-side facets with true counts, brand data on cards, sold-out badges, server sort, mobile filter sheet.
5. **PDP:** multi-image gallery, brand, size guide beside sizes, delivery estimate near CTA, accordions for details/declarations, correct imagery.
6. **Cart/checkout:** reconcile totals, whole-rupee display, saved addresses, progress steps, GST breakdown, sticky mobile total, explicit payment states.
7. **Account:** sidebar IA, tracking timeline, invoice download, exchange CTA.
8. **Content:** product data requirements; consistent photography placeholders; remove fabricated fallbacks.
9. **SEO:** remove global `noindex`, add sitemap, robots, canonicals, OG images.

**Dependencies:** B (flags/copy), product photography for hero (owner).
**Risks:** photography delays; scope creep into new features.
**Acceptance:** 390 px journey home → PDP → cart → checkout with no horizontal scroll; facet counts match DB; PDP shows correct images and brand; no page exposes a backend URL.
**Verification:** real browser pass at 360/390/768/1440; screenshot set; build + typecheck.

---

## PHASE D — Admin redesign (P1)

**Objective:** an operations console organised around daily work.

**Work items**
1. Grouped navigation (Overview, Commerce, Fulfilment, Customers, Content, Finance & Insights, Settings), collapsible rail, responsive drawer.
2. Needs-attention dashboard with linked queues.
3. Order cockpit (tabs, sticky actions, real error messages, bulk fulfil).
4. Orders/Returns queues with age/SLA, filters, saved views.
5. Products: stock/category columns, media-first editing, SEO fields, variant bulk edit.
6. Inventory: ledger + low stock + reorder; decide procurement.
7. Customers 360; Support SLA inbox; Reviews under Content.
8. Reports with date range + GST exports; Settings with store profile and staff MFA.
9. Command palette across orders/products/customers.

**Dependencies:** C design tokens (shared).
**Risks:** backend gaps for some queues (may require small API additions).
**Acceptance:** an operator can run a day (find order, fulfil, refund, approve return, adjust stock) without touching another screen or the database; every failure shows a cause.
**Verification:** scripted admin walkthrough with a real test order; screenshots at 1440 and 768.

---

## PHASE E — Backend and data corrections (P0/P1)

**Objective:** make the money and status model unambiguous.

**Work items**
1. Money convention: whole rupees at rest/API, paise only in provider adapters; single formatter; tests.
2. Fix cart/checkout totals to reconcile line ↔ subtotal ↔ tax ↔ total.
3. Align status vocabularies (`pickup_scheduled`, `picked_up`) across DB/API/UI.
4. Invoice numbering sequence (financial year, gap-free) and invoice/credit-note PDF or print view.
5. Payment reconciliation job + admin "orphan payments" view.
6. Cancellation guard after dispatch; partial refunds; exchange flow decision.
7. Data hygiene: separate/mark test data; purge synthetics before launch.
8. Indexes for admin search; structured logging with request IDs; redaction.
9. Tighten admin CORS; confirm cookie flags; MFA design.
10. Optional: move fulfilment mode from metadata to a column.

**Dependencies:** A/B decisions on returns/cancellation.
**Risks:** touching money code; mitigate with tests first.
**Acceptance:** no fractional rupee anywhere customer-facing; invoice and credit note valid; duplicate/reconciliation tests pass.
**Verification:** unit + integration tests, SQL checks, invoice review by accountant.

---

## PHASE F — Integrations and business workflows (P0/P1)

**Objective:** real external services, verified.

**Work items**
1. Razorpay: sandbox keys → test payment → refund; live key with ₹1 test before launch; webhook URL registered.
2. Shiprocket: credentials, pickup location, AWB, label, tracking webhook, reverse pickup; customer tracking UI.
3. Email (Resend): domain verification, templates for order placed/paid/shipped/delivered/cancelled/refunded/return/password reset.
4. SMS/OTP: DLT template, real send, rate-limit verification; disable dev echo.
5. Image storage: S3/R2 + migration of existing media.
6. Optional WhatsApp notifications.
7. Full failure-mode tests: payment failure, duplicate webhook, shipping failure, refund failure, out-of-stock.

**Dependencies:** credentials from owner; E for money fixes.
**Risks:** DLT/KYC lead times; courier account approval.
**Acceptance:** the 10 acceptance tests in `END_TO_END_WORKFLOWS.md` §4 pass with test credentials.
**Verification:** recorded test orders, webhook logs, provider dashboards.

---

## PHASE G — Testing, security and quality (P1)

**Objective:** confidence beyond unit tests.

**Work items**
1. Playwright suite: discover→buy, return, admin fulfil/refund, mobile viewport.
2. Contract tests between frontend client and API; schema snapshots.
3. Accessibility pass (axe + manual keyboard), performance budget, image optimisation.
4. Dependency patches (6 moderate), secret scanning, CSRF/cookie review.
5. Error monitoring (Sentry) + uptime checks; alert routing.
6. Backup schedule + restore drill; migration rollback runbook.

**Dependencies:** C–F substantially complete.
**Risks:** flaky E2E; budget for CI time.
**Acceptance:** E2E green on main; axe criticals zero; restore drill documented; alerts fire in a test.
**Verification:** CI artifacts, reports committed to `docs/`.

---

## PHASE H — Staging (P0)

**Objective:** a production-like environment for sign-off.

**Work items**
1. Provision host(s), Postgres, Redis, object storage; DNS for staging subdomains.
2. Deploy all three apps via Docker Compose or chosen platform; TLS; env guard passes.
3. Seed a clean catalogue (real products, images, prices, HSN, origin).
4. Run migrations, create owner account, configure staff roles.
5. Execute the full acceptance script on staging; fix defects.
6. Freeze scope; owner UAT.

**Dependencies:** F credentials (test), G.
**Risks:** environment drift; seed data leaking to production.
**Acceptance:** owner signs off UAT checklist; no P0/P1 defects open.
**Verification:** staging URL walkthrough, checklist signed.

---

## PHASE I — Production launch (P0)

**Work items**
1. Production secrets in host store; live provider keys; webhook URLs switched.
2. Domain/DNS/HTTPS live; admin restricted; robots/sitemap enabled.
3. Backups, monitoring, on-call rota.
4. Live low-value transaction + refund; real shipment; invoice issued.
5. Soft launch to a small audience; monitor for 72 hours.

**Acceptance:** a real customer can buy, receive, track, return and be refunded; owner can operate without engineering help.
**Verification:** production transaction evidence; monitoring dashboards; incident log empty.

---

## PHASE J — Post-launch (P2/P3)

| Priority | Item |
|---|---|
| P1 | Conversion/mobile analytics, abandoned checkout, search tuning, photography iteration |
| P2 | Exchange flow, loyalty/collector tier, wishlist alerts, reviews programme, WhatsApp support |
| P2 | Performance budgets, caching, image CDN |
| P3 | Fit Studio, inspection/authentication programme, resale orderbook, AI concierge — only with operational staffing and a business case |
| P3 | Multi-warehouse, international shipping, additional payment methods |

---

## Dependency graph

```
A ──► B ──► C ──► D
 │           │
 └──► E ─────┴──► F ──► G ──► H ──► I ──► J
```
E can start in parallel with C once A/B are settled; F depends on E for money correctness; G gates H; H gates I.

---

## Suggested sequencing (indicative)

| Week | Focus |
|---|---|
| 1 | A + B; mobile overflow fix; flag consolidation; statutory data collection |
| 2–3 | C storefront redesign (home, catalogue, PDP); E money fixes |
| 3–4 | C checkout/account; E invoice numbering; D admin IA start |
| 5 | D admin dashboard/orders/returns; F Razorpay test + Shiprocket |
| 6 | F email/SMS/storage; G E2E/security; staging provision |
| 7 | H staging UAT + fixes; legal pages; SEO |
| 8 | I production launch + hypercare |

---

## Definition of done for the launch

- The scope of record is implemented, with no visible deferred feature.
- A customer completes a real prepaid order on a phone in under 3 minutes.
- An operator fulfils, ships, refunds and reconciles without engineering help.
- Invoices and credit notes are lawful and reconcile to payments.
- The site is indexable, monitored, backed up, and has a tested restore.
- Every screen state (loading, empty, error, success) is designed and honest.
