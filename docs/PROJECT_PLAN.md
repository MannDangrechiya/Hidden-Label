# THE HIDDEN LABEL — Project Plan

Status: **Phase 0 + Phase 0.5 decisions recorded (D1, D2, D4, Q6) — awaiting G0 sign-off**
Last updated: 2026-11-14
Design source of truth: Google Stitch project `10766877595551018159`
(`https://stitch.google.com/projects/10766877595551018159`)

---

## 1. What is being built

A centralized multi-brand e-commerce platform: **one retailer selling many brands**.
Not a marketplace — no seller onboarding, seller dashboards, commissions or vendor payouts.

- Customer storefront (Next.js)
- Custom admin dashboard reproducing the approved Stitch admin screens
- Commerce backend (Medusa) over PostgreSQL
- Integrations: Razorpay, Shiprocket, transactional email, phone OTP, image storage
- Deployment, monitoring, documentation, handover

Stitch is the **visual** source of truth. It is not the application architecture, and the
generated markup is not production code.

---

## 2. Verified design inventory (Phase 0 finding)

| Item | Value |
|---|---|
| Wired screens declared by project manifest | 49 |
| Screen artefacts in the coded manifest | 50 (26 storefront `U-*`, `SYS-00`, 17 admin `A-*`, `SYS-01`, 5 `AI-*`) |
| Discrepancy to resolve | 50 vs 49 → one duplicate or unwired frame (see OPEN_QUESTIONS Q1) |
| Device frames present | **desktop only** (`DESKTOP`, 1280 and 2560 wide) |
| Design tokens | present and machine-readable (see `DESIGN_TOKENS.md`) |
| Mobile designs | **absent** → responsive behaviour must be derived from the documented grid |

Full inventory: `SCREEN_MAP.md`.

---

## 3. Approved baseline stack

| Layer | Choice | Notes |
|---|---|---|
| Storefront | Next.js (App Router), TypeScript, Tailwind | Server Components for catalog; client only for interaction |
| Components | Local `packages/ui` built to tokens | No third-party theme may override radius/shadow/accent |
| Backend | Medusa, TypeScript | **Validate the installed major version before writing any extension** — v1 and v2 have incompatible extension models |
| Database | PostgreSQL | Medusa migrations + project migrations, separate schemas tracked in `_migrations` ledger |
| Cache / jobs | Redis or Valkey | cart cache, OTP rate limits, BullMQ queues (webhooks, shipment sync, email) |
| Images | S3-compatible or Cloudinary | product + editorial assets |
| Payments | Razorpay | INR only |
| Shipping | Shiprocket | aggregator; courier name (BlueDart etc.) rendered from allocation, not hardcoded |
| Email | Resend | transactional only; marketing requires separate consent handling |
| Tests | Vitest (unit), Playwright (E2E) | see `QA_PLAN.md` |
| Hosting | Managed frontend + managed backend + managed PostgreSQL | no untested direct-to-prod deploys |

Everything is TypeScript. Any deviation from this table requires a recorded decision in §8.

---

## 4. Repository shape (created in Phase 1)

```
apps/
  storefront/        Next.js customer app
  admin/             Next.js admin app (separate deploy + auth boundary)
  backend/           Medusa instance + custom modules
packages/
  ui/                design system, built to DESIGN_TOKENS.md
  config/            tsconfig, eslint, prettier, tailwind preset
  shared/            zod schemas + types shared by apps and backend
docs/                this pack
agent/               rules + phase prompts for the coding agent
```

Admin is a **separate app with a separate auth boundary**, not a route group inside the
storefront. This is a security decision: a shared bundle makes it easy to leak admin
capability to the public app.

---

## 5. Milestones and approval gates

Each gate is a hard stop. No work starts on the next milestone until the previous gate is
signed off in writing (a dated line appended to §8).

| Gate | Milestone | Result required to pass |
|---|---|---|
| **G0** | M1 Design audit + blueprint | This pack reviewed; D1, D2, D4 and Q6 recorded (2026-11-14); Q1 and Q5 remain open and are **not** blocking G1 |
| **G1** | M2 Setup + design system | Both apps boot; `/design` route or Storybook renders every primitive; token diff review passes |
| **G2** | M3 Backend + database | Migrations run from empty DB; custom modules tested; admin API smoke tests green |
| **G3** | M4 Storefront connected | Browse → variant → cart → (login) → address → shipping option, against real data |
| **G4** | M5 Admin connected | An authorised admin can run a day of store operations without touching SQL |
| **G5** | M6 Integrations | Razorpay + Shiprocket + email + OTP working in sandbox with documented failure paths |
| **G6** | M7 Full order workflow | The 16-step flow in §6 passes end to end, including failure and duplicate cases |
| **G7** | M8 Security + QA | Critical/high issues closed; `QA_PLAN.md` matrix executed with results recorded |
| **G8** | M9 Deployment + handover | Production verified checkout; backups, monitoring, runbooks, credential ownership documented |

Estimated delivery window for the **v1 scope in §7**: 8–12 weeks from G1.
Refine after G2, when the real effort of the commerce model is visible.

---

## 6. The order that must work end to end

1. Customer lands on homepage
2. Browses a brand / searches
3. Opens product, selects size/variant
4. Adds an available variant to bag
5. Signs in or checks out as permitted by policy
6. Enters shipping address, selects shipping option
7. Backend validates stock, price, discounts, shipping cost
8. Payment initiated with Razorpay
9. **Backend verifies payment via server-side lookup or signed webhook**
10. Inventory and order records updated exactly once
11. Customer sees confirmation + order detail
12. Admin sees the order in the dashboard
13. Admin processes and dispatches
14. Shiprocket tracking syncs onto the order
15. Customer tracks from account
16. Delivered; returns/support remains available

Critical rule, restated because it is the single most common failure in this class of build:
**a success screen may never be shown merely because the customer returned from the payment
page.** State transitions are defined in `ORDER_STATE_MACHINE.md`.

---

## 7. Scope

### In scope for v1
- All 26 storefront screens (`U-01` … `U-26`) and `SYS-00`
- All 17 admin screens (`A-01` … `A-17`) and `SYS-01`
- Commerce model: brands, categories, products, variants, inventory, carts, orders,
  customers, addresses, payments, refunds, discounts, shipping, returns, CMS content,
  append-only admin audit log, admin roles
- Razorpay, Shiprocket, Resend, phone OTP, image storage
- Mobile/tablet layouts **derived** from the documented grid (requires G1 sign-off on reference builds)
- SEO basics, accessibility to WCAG 2.1 AA on the six core templates

### Deferred to V2 — approved decision D1 (2026-11-14)
The Stitch project contains an "AI retention layer" of five screens (`AI-01` … `AI-05`) and
resale mechanics (price index, size heatmaps, bids, aftermarket asks, 360° inspection, fit
engine, concierge chat). These imply a secondary-market data model and paid third-party AI
services beyond a retailer v1.

**Approved:** every deferred Stitch screen, its route and its frame is **preserved**; the
features are **disabled behind feature flags in v1**. Nothing is deleted, and nothing is faked:

| Flag | Covers | When off |
|---|---|---|
| `NEXT_PUBLIC_FEATURE_AI_LAYER` | `AI-01` Search by Sight, `AI-02` Price Index, `AI-05` Style Concierge | nav entry points not rendered; route 404s |
| `NEXT_PUBLIC_FEATURE_INSPECTION` | `AI-03` 360° Inspection | PDP shows static gallery only |
| `NEXT_PUBLIC_FEATURE_FIT_STUDIO` | `AI-04` Fit Studio | `U-25` size guide remains available |
| `NEXT_PUBLIC_FEATURE_BIDDING` | bid / ask / valuation CTAs | PDP shows one sell price per variant |

Flags default **off** in every environment and are asserted off in the production checks at G8.
Enabling a screen in V2 is therefore a flag change plus its backend work — not a rebuild, and
not a redesign. The Stitch frames remain the approved visual reference for that work.

### Explicitly out of scope for v1
- Multi-vendor marketplace mechanics of any kind
- Mobile apps
- Loyalty points engine (the "tier card" is display of a stored tier field only)
- Multi-currency (INR only; the header currency control must not lie)
- Warehouse/WMS integration beyond Shiprocket pickup locations
- **RFID authentication** — deferred until a real serialisation and authentication process is approved (D2)
- **Escrow** — not offered; payment and settlement terminology only (D2)
- **Hash-chained / "Merkle" audit ledger** — v1 uses a normal, reliable admin audit log (D2)
- **KYC document collection** — not implemented unless the business confirms it is required (D2)
- Bidding, price index, resale and aftermarket asks (D1)

---

## 8. Decisions log

Append-only. `D` = decision recorded, `G` = gate signed.

| ID | Date | Decision | By |
|---|---|---|---|
| — | 2026-11-14 | Phase 0 audit delivered; baseline stack accepted as proposal | agent |
| D1 | 2026-11-14 | **AI and resale deferred to V2.** `AI-01`–`AI-05`, bidding, price index and resale are preserved in Stitch and in the route map but disabled behind the four feature flags in §7. No mock behaviour. | client |
| D2 | 2026-11-14 | **No unsubstantiated claims.** v1 uses a normal, reliable append-only admin audit log (no hash chain, no "Merkle"). No escrow — accurate payment/settlement wording only. RFID authentication deferred until a real serialisation process is approved. No KYC document collection unless the business confirms it is required. | client |
| D3 | — | Shiprocket as aggregator with dynamic courier name (resolves BlueDart copy) — proceeding under assumption **A1**, not blocking G1 | _pending confirmation_ |
| D4 | 2026-11-14 | **Mobile approved via the reference-build workflow.** Build mobile for homepage, catalog, PDP, cart, checkout and the admin table; obtain approval before applying the responsive system to all templates. | client |
| G0 | 2026-11-14 | Decisions D1, D2, D4 and Q6 recorded; documentation reconciled; Phase 0.5 approval summary issued (`docs/PHASE_0.5_APPROVAL.md`) | agent |
| G0 | 2026-11-14 | **Signed off by client** — “Approved, begin Phase 1.” | client |
| D5 | 2026-11-14 | **Versions pinned:** Node >= 22.22.0 (`.nvmrc` 22.22.0), pnpm 10.32.1, Medusa **2.22.7** (all `@medusajs/*` lockstep), Next 16.4.6, TypeScript 5.9.3, ESLint 9.39.5, Vitest 3.2.4. Extension code must be written against 2.22.7 docs. | agent |
| D6 | 2026-11-14 | **Local infrastructure pinned:** PostgreSQL **5437** (compose or `pnpm db:start`), Redis **6380**, backend **9000**, storefront **3000**. PostgreSQL must be spawned with a sanitized Windows environment — an MSYS/Git-Bash environment makes every backend die with `0xC0000142`. Implemented in `scripts/dev-db.mjs:childEnv()`. | agent |
| G1 | 2026-11-14 | **✅ CLOSED.** Monorepo, Medusa 2.22.7, Next storefront, shared/shared-UI packages, CI, env template and seed script built. Verified: typecheck ×4, lint, 8/8 tests, production build, **migrations from an empty DB (151 tables, 0 errors)**, **seed (3 products, India/INR, publishable key)**, backend health 200, `/store/products` count 3, storefront rendering live products with real INR prices. Evidence: `docs/PHASE_1_REPORT.md`, `docs/screenshots/g1-live-products.png`. | agent |
| D7 | 2026-11-14 | **D1 reversed — AI/resale layer is now IN SCOPE for v1.** Client confirmed the product vision is explicitly modelled on CultureCircle (sneaker/streetwear resale marketplace): `AI-01` Search by Sight, `AI-02` Price Index (per-size asks/price history), `AI-03` 360° Inspection + condition grading, `AI-04` Fit Studio, `AI-05` Style Concierge, and the bidding/ask mechanics are all required for v1, not deferred. Per `docs/SCREEN_MAP.md` §3's own note: "If D1 = build, this becomes a separate approved phase with its own data model (asks, bids, price history per variant, condition grades) and third-party AI spend. It is not a frontend-only feature." Treat this as a new phase (call it **P5.5 — Resale & authentication layer**) planned and executed after the core storefront/admin (P4/P5) are verified, not bolted on ad hoc. Feature flags (`NEXT_PUBLIC_FEATURE_AI_LAYER`, `_INSPECTION`, `_FIT_STUDIO`, `_BIDDING`) stay in the code as the rollout mechanism — default off until each sub-feature is actually built and tested, then flipped on. D2 (no unsubstantiated claims) still applies in full: authentication/condition-grading copy must map to a real backend record (actual grading workflow, actual photos) before it ships, same for any "verified"/"deadstock" language. | client |

---

## 9. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Medusa version mismatch with extension docs | Days lost on incompatible patterns | Pin and record the version in Phase 1; check docs for *that* version before coding |
| AI-layer screens expand scope silently | 30–50% schedule overrun | **Re-opened by D7** — AI/resale layer is now in-scope for v1 (client confirmed CultureCircle-style vision). Mitigation: build as its own planned phase (P5.5) with its own data model and third-party AI/vision-API cost estimate, not folded silently into P4/P5. Flags stay as the per-sub-feature rollout gate. |
| Untruthful UI claims (escrow, RFID, ledger, KYC) | Legal/consumer risk, rework | **Closed by D2** — claims removed from v1; copy-honesty sweep in QA blocks release |
| No mobile designs | "Matches Stitch" unverifiable on phones | **Mitigated by D4** — six reference builds approved before the responsive system is applied everywhere |
| Dev database unusable on Windows | Blocks every phase | **Closed** — root cause was MSYS environment pollution; `pnpm db:start` now spawns PostgreSQL with a sanitized env (D6) |
| Payment/stock races | Overselling, double charges | Explicit state machine + concurrency tests in Phase 7 |
| Webhook duplication | Duplicate orders/refunds | Idempotency keys, replay tests |
| Admin authz leaking to storefront | Full compromise | Separate app + per-route server-side checks + penetration list |
| Token drift across dozens of screens | Visual inconsistency | `packages/ui` is the only styling surface; token diff in QA |
| Razorpay test-vs-live key confusion at launch | Failed payments | Explicit env separation, launch checklist |

---

## 10. Working agreement

- One phase at a time, gate by gate. No phase is "done" without its tests.
- Weekly milestone review (scheduled Mondays) checks the gate table in §5.
- Every phase closes with a report: files created/changed, functionality, tests run,
  open issues, next step. Recorded as a dated entry in §8.
- Ambiguity that changes business behaviour stops work and becomes an `OPEN_QUESTIONS.md` item.
  Ambiguity that is internal implementation detail gets a documented assumption and proceeds.
