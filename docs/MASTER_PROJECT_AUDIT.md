# THE HIDDEN LABEL — MASTER PROJECT AUDIT

**Audit date:** 23 November 2026
**Auditor:** Buffy (Freebuff)
**Type:** Investigation and planning only. No application code, configuration, database or deployment was changed by this audit. The only files added are this report and its companion audit documents, plus PNG screenshots captured from the locally running apps.

---

## 1. Executive summary

THE HIDDEN LABEL is a real, substantial three-application monorepo: a Medusa 2.22.7 commerce backend (`apps/backend`), a Next.js 16 customer storefront (`apps/storefront`), and a separate Next.js 16 staff console (`apps/admin`). It is not a prototype or a mock. It has 72 commits over ten days, 207 passing automated tests, a 187-table PostgreSQL schema, working server-side business logic for orders, refunds, returns and GST credit notes, and it typechecks, lints and builds cleanly. The latest CI run on GitHub passed.

The problems the owner is feeling are real, and they are not primarily "missing backend". They are:

1. **The product has two identities in conflict.** The repository README and older planning docs describe a CultureCircle-style resale/authentication marketplace with AI search, price indices and bidding. The last three commits deliberately hid those features and repositioned the storefront as "Luxury Retail & Bespoke Atelier". Both identities are still present in the code, the docs, and — on a developer machine — the UI. This is the single largest source of confusion.
2. **The storefront is a wireframe of a luxury store, not a luxury store.** Desktop screenshots show a large empty hero, no editorial imagery, inconsistent product photography, single-image product pages, a thin catalogue with a filter panel that mostly does not work as labelled, and a broken mobile layout (horizontal overflow at 390 px, headings overlapping, no mobile navigation).
3. **The admin has every backend capability exposed as a flat 19-item menu**, with orphaned screens (`Purchasing`, `Reviews`), duplicate surfaces (`Payments` vs. order detail), no navigation groups, and no responsive layout. The screenshot of the admin at narrow width shows the fixed sidebar consuming half the screen and content overflowing.
4. **The money path cannot currently complete in this environment.** Cash on Delivery was correctly removed, but no Razorpay key is configured, so checkout cannot be finished locally at all. The order history in the database is almost entirely `pending` orders created through the removed COD path.
5. **The storefront is not indexable and not deployed.** `metadata.robots` is `index: false, follow: false` globally, there is no sitemap or robots route, and `thehiddenlabel.com` resolves in DNS but does not answer HTTPS. There is no production deployment, no CD pipeline and no monitoring.
6. **Documentation is actively misleading.** `README.md` says "Multi-Brand E-Commerce & Resale Platform". `docs/HANDOFF.md` claims ~90% completion, "51 tests" and a verified COD checkout. `docs/BUILD_LOG.md` lists a COD checkout as verified. The code is prepaid-only and now has 207 tests. Trusting those documents would cause the next phase to be planned against a product that does not exist.

**Recommendation:** do not start a greenfield rebuild. The backend, data model, tax logic, refund/idempotency machinery, return workflow and RBAC are worth keeping. The correct next move is a **scope decision followed by a disciplined storefront and admin redesign**, with the resale/AI layer formally deferred out of the launch product rather than half-hidden inside it.

---

## 2. Exact repository state

| Item | Evidence |
|---|---|
| Working folder | `C:\Users\ASUS\Documents\Hidden Label` |
| Branch | `main` |
| Local HEAD | `478e7ec9676ec658554d17e913f926067ad4a9fd` — "polish: hide add-on resale/AI entry points and drop marketplace copy" |
| Remote `origin/main` | `a8127d9e41d6a797982e2b230273d15acaa277ef` — "chore: prune package.json and .env.example" |
| Divergence | Local is **1 commit behind** `origin/main` and 0 ahead. Fetch succeeded. The missing commit only prunes `package.json` and `.env.example`. |
| Working tree | Clean except two generated files: `apps/admin/next-env.d.ts`, `apps/storefront/next-env.d.ts` (modified by Next.js, not by this audit). |
| Commit count | 72, first commit 2026-11-14, latest 2026-11-23 |
| Branches | `main` only (local + remote) |
| Remote | `https://github.com/MannDangrechiya/Hidden-Label.git` |
| CI | `.github/workflows/ci.yml`; GitHub Actions run #29 for `a8127d9` concluded **success** |
| Tags / releases | None found |
| Monorepo | pnpm workspace: `apps/*`, `packages/*` |
| Node / pnpm | Node `>=22.22.0`, pnpm `10.32.1` |

**Important:** the audited code is the local checkout `478e7ec`. The remote has one additional commit touching only `package.json` and `.env.example`. All functional conclusions below apply to both unless stated.

---

## 3. Architecture overview

```
Customer Storefront (Next.js 16, :3000)  ──┐
                                            ├── Medusa 2.22.7 REST (:9000) ── PostgreSQL 18.6 (:5437)
Staff Admin (Next.js 16, :7001)          ──┘        │                              │
                                                    ├── Razorpay (payment provider module)
                                                    ├── Shiprocket (custom module + webhook)
                                                    └── Redis (optional; in-memory fallback in dev)
```

### Applications

| App | Purpose | Routes | Code volume |
|---|---|---|---|
| `apps/storefront` | Customer commerce | 30 route folders | ~13.6k lines TS/TSX/CSS |
| `apps/admin` | Staff operations | 22 route folders | ~8.4k lines |
| `apps/backend` | Commerce + custom domain logic | 63 API routes, 5 subscribers, 1 job | ~25k lines |

### Shared packages

| Package | Purpose | Evidence |
|---|---|---|
| `packages/shared` | INR money helpers, GST calculation, Zod schemas | 2 test files, 23 tests |
| `packages/ui` | Design-system primitives + Tailwind v4 tokens | 16 components, `tokens.css` |
| `packages/config` | Shared TypeScript/ESLint config | — |

### Custom backend modules

- `src/modules/thl` — 32 models and 12 migrations: brands, CMS, wishlist, OTP challenges, returns, shipments/events/operations, stock movements, purchase orders/suppliers/goods receipts, credit notes, product reviews, support tickets, audit events, webhook events, payment/refund operations, bespoke consultation bookings and fabric swatches, plus resale asks/bids, price history, condition inspections, fit rules/profiles and concierge threads.
- `src/modules/razorpay` — payment provider with HMAC signature verification, webhook secret handling, sandbox server for local development.
- `src/modules/shiprocket` — API client, sandbox server, webhook event handling.
- No Medusa **workflows** directory: business flows are implemented in route handlers plus `src/lib/*` services, calling Medusa core flows where appropriate.

### Deployment assets

- `deploy/nginx/` — TLS, HSTS, CSP, rate-limit zones for storefront/admin/backend.
- `docker-compose.yml` — local Postgres + Redis.
- `docker-compose.prod.yml` — production multi-service stack with resource limits.
- `apps/*/Dockerfile` — backend only confirmed; admin/storefront production path is documented as Node/PM2 too.
- **No CD workflow, no IaC, no cloud account configuration in the repo.**

---

## 4. What the platform currently is (observed, not documented)

**Positioning in the code today:** a multi-brand luxury footwear/apparel retailer in Ahmedabad with an in-house made-to-measure atelier, prepaid Razorpay checkout, GST invoices, Shiprocket logistics, and a gated secondary-market/AI layer that is off by default server-side.

**Product identity contradictions found:**

| Document / surface | Says | Reality |
|---|---|---|
| `README.md` title | "Multi-Brand E-Commerce & **Resale** Platform" | Resale is disabled by default (`ENABLE_RESALE=false`) and its endpoints return 404 |
| `README.md` capabilities | Resale engine, price index, AI concierge as headline features | Those are gated add-ons, not part of the launch storefront |
| `docs/HANDOFF.md` | "~90% of total v1 scope", "51 tests", "COD checkout verified" | Tests are 207; COD has been deliberately removed; checkout needs Razorpay keys |
| `docs/BUILD_LOG.md` | COD checkout ✅, "51 tests" | Current code is prepaid-only; payment step is disabled without keys |
| `docs/MASTER_PLAN.md` | Resale/AI required for v1 (D7) | Last commits reverse that in practice |
| `docs/SCREEN_MAP.md` | 49/50 screens, some still unresolved | Several routes exist that are not in the map (`/purchasing`, `/reviews`, `/verify`) |

This drift is the root cause of "feature organization" dissatisfaction. The codebase needs one written scope of record and the docs need to be corrected before design work starts.

---

## 5. Verified working functionality

Verified in this audit by execution, not by reading docs:

| Area | Evidence |
|---|---|
| Install state | `node_modules` present, lockfile intact, workspace resolves 6 packages |
| Typecheck | `pnpm typecheck` → all 6 packages pass, exit 0 |
| Lint | `pnpm lint` → exit 0 |
| Unit/integration tests | `pnpm test` → **207 passing**: backend 153, shared 23, admin 10, scripts 21 |
| Storefront production build | `next build` → exit 0 |
| Admin production build | `next build` → exit 0 |
| Backend build | Passed in CI run #29 (not re-run locally to avoid disturbing the running dev backend) |
| Database | PostgreSQL 18.6 on `127.0.0.1:5437`, `the_hidden_label`, 187 public tables |
| Backend runtime | `:9000` `/health` → `OK`, `/healthz` → 200 |
| Storefront runtime | `:3000`, `/api/health` reports backend `up` (14 ms) |
| Admin runtime | `:7001`, `/` → 307 to `/login?from=/` (auth wall works) |
| RBAC | Admin routes are guarded by `authenticate` + `adminRbacMiddleware`; role (`owner/manager/operations/support/readonly`) is read from `user.metadata.role` with **no default**; 17 unit tests cover the decision function |
| Payment idempotency | `payment_operation` claim/complete/fail, unique idempotency key, 409 on in-progress, order lookup on duplicate |
| Refunds | `refundCapturedPayment` with `refund_operation` idempotency, provider refund via Medusa workflow, GST credit note issued, explicit outcomes (`refunded`, `already_refunded`, `no_payment`, `failed`) |
| Returns | Eligibility recomputed at approval from delivery date + window, final-sale/custom exclusions, reverse pickup via Shiprocket, reverse-inspection condition required before restock, restock once |
| Webhooks | Razorpay HMAC-SHA256 over raw body with `timingSafeEqual`, deduplication via `webhook_event`; Shiprocket webhook route present and tested |
| GST logic | Inclusive GST calculation, intra/inter-state split, HSN helper, credit-note records exist (2 rows) |
| Audit trail | Append-only `audit_event` with 299 rows; every admin mutation path examined writes one |
| Real data | 31 published products, 72 orders, 64 payments, 34 return requests, 18 shipments, 21 promotions, 65 resale asks, 29 inspections |

**What "working" means here:** the code paths exist, are typed, tested at unit level, and run against a real database. It does **not** mean the full purchase journey has been completed in this audit (see §6).

---

## 6. Broken, incomplete and unverified functionality

### Blocking / high impact

| # | Finding | Evidence | Impact |
|---|---|---|---|
| B1 | **Checkout cannot complete locally.** Payment step is disabled unless `RAZORPAY_KEY_ID` is set and `pp_razorpay_razorpay` is linked. Only Razorpay is linked; no key exists. | `checkout-payment-form.tsx`; `/checkout` screenshot; `.env` flags | No end-to-end order can be placed today; COD was removed |
| B2 | **Mobile storefront is broken.** At 390 px the document is ~497 px wide, headings collide with the "View All" link, and there is no hamburger/nav. | Screenshot `audit-home-mobile.png`; `site-header.tsx` hides `<nav>` below `sm` with no replacement | Mobile is the majority of Indian fashion traffic; this is launch-blocking |
| B3 | **Resale add-on is half-on.** Local `.env.local` sets `FEATURE_BIDDING/FIT_STUDIO/AI_LAYER=true` while `ENABLE_RESALE=false`. PDP shows "Place Bid" and Fit Studio; the backend resale gate returns 404. | `product-buy-panel.tsx`, `price-index-card.tsx`, `middlewares.ts` `resaleGateMiddleware` | Customer can click an offer flow that cannot succeed |
| B4 | **Cart/checkout totals disagree.** Line shows ₹16,980 for "Ivory Linen Bespoke Shirt × 2"; subtotal/total show ₹20,036.40 (fractional rupees). | `audit-checkout-desktop.png` | Money display inconsistency; INR retail should be whole rupees and lines must reconcile |
| B5 | **Product photography is wrong.** AJ1 "Chicago" PDP displays a white/orange Air-Max-style shoe; description says "white, black and varsity red". | `audit-pdp-desktop.png` vs. `seed.ts` copy | Trust-destroying for a premium retailer |
| B6 | **Tax invoice prints invalid statutory fields.** GSTIN renders "Registration not configured"; country of origin on PDP renders "Declaration pending verification"; invoice carries an unconditional "Every luxury good is checked and certified for authenticity prior to shipment." | `invoice/page.tsx`, PDP, `.env` (GSTIN blank) | Legally non-compliant invoice and an unsubstantiated authenticity claim |
| B7 | **Live domain is not serving.** `thehiddenlabel.com` → AWS anycast IPs, HTTPS times out. | `curl -I`, `nslookup` | Not live; no production readiness |
| B8 | **Storefront is globally `noindex`.** `metadata.robots = { index: false, follow: false }` in root layout; no sitemap/robots. | `app/layout.tsx` | Zero organic acquisition if launched as-is |

### Functional gaps

| # | Finding | Evidence |
|---|---|---|
| F1 | Catalogue facets are computed from only the loaded page (24 items), not the full result set, so counts and brand lists are wrong/incomplete; brand facet renders no chips because list payloads lack `metadata.brand`. | `catalog-client.tsx`; live snapshot shows "BRANDS (ALL)" with no buttons |
| F2 | Catalogue cards omit brand and only show size count; no sold-out state on card. | screenshot + `catalog-client.tsx` |
| F3 | PDP has a single image, no gallery/zoom, no brand label, no size-guide link, no delivery estimate until below the fold. | `products/[handle]/page.tsx` |
| F4 | Return policy copy on PDP says "see the authentication report above (when available)" while resale/inspection is off. | PDP |
| F5 | Admin `Purchasing` and `Reviews` pages have **no navigation entry** (0 inbound links). GST export exists only inside Purchasing, not in Reports. | nav item list; link scan |
| F6 | Storefront `/verify` and `/inspection/[serial]` have 0 inbound links; `/verify` is not gated and not in the map. | link scan |
| F7 | Admin has no procurement/supplier screens even though POs exist in the API; purchase orders table is empty (0 rows). | admin route list, DB counts |
| F8 | Orders in DB are 71 `pending` + 1 `canceled`; no delivered/completed order from a real prepaid flow. | SQL |
| F9 | Support tickets: 0 rows; flow exists (`/support` form → `/store/support/tickets`) but unexercised. | SQL |
| F10 | Reviews: 0 rows; storefront UI and admin moderation exist, unexercised. | SQL |
| F11 | Shipment tracking is via webhook/sandbox; no live courier credentials, no customer tracking page beyond order detail. | `.env`, `shiprocket` module |
| F12 | Email/SMS/WhatsApp: code paths exist; no keys; `OTP_DEV_ECHO=true` locally. | `.env` |
| F13 | Production environment template has only 7 keys and still contains `PROD_` placeholders; env guard would refuse to boot. | `.env.production`, `env-guard.ts` |
| F14 | No error monitoring wired (`SENTRY_DSN` referenced only in env template; no SDK). | grep |
| F15 | No E2E/browser test suite; only unit/integration tests. Playwright appears only transitively in the lockfile. | `package.json`s |

### Unverified in this audit

- The admin **interior** was not visually inspected: only two staff accounts exist (`admin@…` owner, `audit.readonly@…`) and no credentials are available. The login screen was verified. An existing 15 Nov screenshot of an admin order page was reviewed as secondary evidence.
- Hosted third-party calls (Razorpay, Shiprocket, Resend, MSG91, Gemini) were **not** exercised; no credentials are configured. The local Razorpay sandbox process answers on `:9099` but was not driven through a payment.

---

## 7. Customer storefront assessment

Full detail: [`docs/STORE_FRONTEND_AUDIT.md`](STORE_FRONTEND_AUDIT.md). Evidence screenshots are in `docs/screenshots/`.

### What exists
Home, mega menu, search overlay + results, brands directory, brand pages, collections (all + handle), PDP, quick view, cart drawer, cart page, 3-step checkout, login/register/OTP/forgot/reset, account dashboard, orders, order detail, cancel, return, invoice, returns list, wishlist, addresses, support, policies, grievance, size guide, about, authenticity, 404/500, plus gated sell/bids/asks/fit-studio/inspection/verify.

### Visual judgement (desktop)
- **Identity:** brutalist, 0-radius, Syne display + Hanken body + JetBrains mono. Consistent and deliberate, but applied uniformly, so it reads as "admin dashboard" aesthetics on a luxury storefront.
- **Homepage:** a ~60 % empty hero with no image, a text-only wordmark, and a size-chip row that occupies more visual weight than the products. Product imagery in the grid is visually inconsistent (studio grey, pastel, saturated red, black). The bottom "Aura-7" floating tab and Next.js dev badge compete with content.
- **Catalogue:** usable but under-designed. Full-width filter slab dominates above the fold; no editorial framing; all cards same size; no hover imagery; no brand line.
- **PDP:** strong type hierarchy on the title, but one image, wrong image, and a suspiciously generic layout. The buy block is the clearest part of the site.
- **Checkout:** best-structured flow (3 steps, order review), but arithmetic inconsistency and disabled payment undermine it.
- **Trust surfaces** are text-heavy and partially untrue (authenticity, declarations).

### Visual judgement (mobile, 390 px)
Horizontal overflow, no navigation, clipped headings, floating elements covering CTAs. Historical mobile screenshots (15 Nov) show the same class of defects in account/catalogue, so this is systemic, not a one-off.

### Accessibility / performance
Positive: semantic landmarks, labelled controls, `aria-pressed` on filters, focus styles on some elements, real error/empty states.
Gaps: no skip link, no focus trap in drawers/modals, raw `<img>` instead of `next/image` on most commerce imagery (no width/height → CLS), heading order mixes `h1/h2/h3` inside cards, colour contrast of `text-muted` on canvas is borderline for small mono text, and the floating concierge tab overlaps content.

---

## 8. Admin assessment

Full detail: [`docs/ADMIN_AUDIT.md`](ADMIN_AUDIT.md).

**Observed:** 19-item flat sidebar, all gated at `support` except Settings (`manager`); fixed 240 px dark rail; no grouping, no collapse, no mobile layout. The 15 Nov screenshot at ~520 px shows content overflowing horizontally and an order action failing with only "The action failed."

**Modules present:** Dashboard, products (list/new/edit/media/variants/bulk), brands, categories, inventory, orders (list/detail/actions/bespoke pipeline), customers (list/detail/notes), payments, shipments, returns, support inbox, promotions, content/CMS, reports + CSV/GST exports, audit, settings (staff/invites), plus gated resale/inspections/fit-rules, and orphaned purchasing + reviews.

**Assessment:** the backend capability is ahead of the interface. The admin is organised by *backend entity*, not by *daily workflow*: no "today" queue, no "needs attention" (unpaid, unfulfilled, return awaiting approval), no cross-linking between order → shipment → return → refund → credit note. There is no global search. Tables are paginated by offset links, not sortable, and filter state is lost when paging in some views. Payments has no refund action (correctly delegated to order detail) but remains a top-level item, creating a dead end.

**Recommendation:** regroup into 6 workflow groups (see §16), promote "Needs attention" to the dashboard, fold Payments into Finance/Reports, move Purchasing under Inventory until POs are real, surface Reviews under Content, and make the rail responsive with a command bar.

---

## 9. Backend and database assessment

Full detail: [`docs/BACKEND_DATABASE_AUDIT.md`](BACKEND_DATABASE_AUDIT.md).

- **Strengths:** real domain model, transaction and idempotency discipline on money, explicit RBAC, audit logging, GST/credit-note modelling, rate limiting, upload validation, env guard, CSP/HSTS, typed clients.
- **Weaknesses:** route handlers contain substantial business logic (no Medusa workflows folder), so reuse/testability is weaker than it looks; several UI-visible features depend on off-flag endpoints; a handful of orphan routes; admin CORS includes the storefront origin; rate limiter Redis dependency is best-effort; logging is unstructured (`console`/Medusa logger) with no request correlation; no queue workers verified.
- **Data:** 187 tables, 31 published products. Test/seed data is mixed with "real" customer rows (68 non-audit emails), which makes analytics unreliable and must be cleaned before launch.

---

## 10. Integration readiness

| Integration | Classification | Evidence |
|---|---|---|
| Razorpay payment provider | **B — implemented, requires credentials** (sandbox emulator exists, no keys) | `modules/razorpay`, `sandbox-server.ts`, `RAZORPAY_API_URL` pointing to `:9099` |
| Razorpay webhooks | **A/B — implemented with signature + dedupe, not exercised live** | `webhooks/razorpay/route.ts`, 17 stored webhook events |
| Shiprocket shipping | **B/D — real client + webhook + sandbox, not verified live**; AWB creation returns real failure rather than fake | `modules/shiprocket`, `lib/shipping-operations.ts` |
| Email (Resend) | **B — implemented, no key; logs instead of sending** | `lib/email.ts`, subscribers |
| SMS/OTP (MSG91/Twilio) | **B/D — adapter + dev echo; DLT templates unverified** | `lib/sms.ts`, `OTP_DEV_ECHO=true` |
| WhatsApp notifications | **D — code path, templates must be approved externally** | `.env.example`, order subscribers |
| GST / HSN / invoice | **A — logic implemented and unit-tested; statutory identity blank** | `packages/shared/gst.ts`, invoice page, `.env` |
| Credit notes | **A — implemented, 2 records** | `lib/credit-notes.ts` |
| Pincode/phone validation | **A** | `lib/pincode.ts`, `lib/phone.ts`, Zod schemas |
| INR precision/format | **A in shared helpers, but presentation bug in checkout** | `money.ts`, screenshot |
| Gemini AI | **E/B — mocked in tests; no key** | `lib/gemini.ts`, `gemini.test.ts` |
| Image storage (S3) | **F — no credentials; backend local uploads** | env template |
| Payments live transaction | **F — never verified** | 0 captured prepaid end-to-end orders |

---

## 11. Security, performance and quality findings

### Security — what is good
- Admin RBAC is enforced server-side on every `/admin/*` route, with no default role; self-escalation paths are explicitly handled and unit-tested.
- Customer-only endpoints (wishlist, returns, account, order cancel, resale writes, fit profile) require a customer bearer token.
- Razorpay webhook verifies HMAC over the raw body with constant-time comparison; duplicate events are recorded and acknowledged, not reprocessed.
- Refunds/payment completion are protected by unique idempotency records, not by UI disabling.
- Production env guard rejects weak/dev secrets, HTTP origins and test keys; staging rejects live keys.
- CSP, HSTS, `X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP/CORP are set in both Next apps.
- Upload size/type guards server-side; image optimiser allowlist denies wildcards.
- Password login rate-limited by IP+email; OTP/support/resale writes rate-limited; account deletion rate-limited.
- Registration does not disclose whether an email exists.

### Security — gaps and risks
1. **No CSRF token on server actions** beyond Next's built-in origin checks; acceptable for same-site forms but should be confirmed for the admin app.
2. **Admin CORS includes the storefront origin** (`adminCors: ADMIN_ORIGIN,STOREFRONT_ORIGIN`); an XSS on the storefront could attempt admin API calls if a token were ever exposed. Tokens are httpOnly, so risk is limited — still tighten.
3. **No MFA** for staff, no session revocation UI, sessions are bearer cookies with default Medusa lifetimes.
4. **No account lockout** beyond rate limiting; no CAPTCHA/bot defence on registration or OTP.
5. **Admin invite flow** creates invites but the acceptance path and email delivery were not verified.
6. **Logging** may include order/customer identifiers; no redaction policy documented; no central sink.
7. **`pnpm audit`:** 6 moderate advisories, 0 high/critical (run 2026-11-23).
8. **Secrets:** `.env` files are gitignored; production template is placeholder-only. No secret is committed as far as inspected.

### Performance / quality
- Storefront is `force-dynamic` on almost every commerce route; every request fans out to multiple backend calls (products + stock + brands + cart + session + reviews + resale). This is correct for live stock but expensive; no caching or request dedupe layer.
- Raw `<img>` tags on cards, PDP, cart, drawer → no responsive sizing, no lazy sizing metadata.
- No bundle analysis; no Lighthouse run in this audit (would need a production build served).
- Tests: strong on backend money/auth logic (153), weak on UI (10 admin utility tests, 0 storefront tests).
- CI: build + unit + integration + audit on push/PR. No E2E, no visual regression, no deploy.
- No Sentry/uptime/alerting; no structured logs; no metrics.

---

## 12. Live deployment status

| Question | Answer |
|---|---|
| Source builds? | **Yes** — typecheck, lint, 207 tests, storefront and admin builds all pass locally; CI green |
| Database operational? | **Yes locally** (187 tables, seeded) |
| Migrations current? | **Yes for local** — 12 project migrations applied, schema matches models (API queries succeed) |
| Backend operational? | **Yes locally** on `:9000` |
| Admin accessible? | **Yes locally** on `:7001`, behind auth |
| Storefront accessible? | **Yes locally** on `:3000` |
| External services configured? | **No** — no Razorpay, Shiprocket, Resend, MSG91, Gemini, S3 credentials |
| Production secrets configured? | **No** — `.env.production` has 7 keys and 2 `PROD_` placeholders; env guard would abort |
| Deployment configured? | **Partially** — Docker Compose, nginx, Dockerfiles, PM2 instructions exist; no CD, no host |
| Live domain operational? | **No** — DNS resolves, HTTPS times out |
| HTTPS / backups / monitoring? | nginx TLS config exists; `scripts/db-backup.sh` and `db-restore.sh` exist; no scheduled backup, no monitoring |
| Production transaction verified? | **No** |

**Verdict: staging-capable code, zero production deployment.** The previous docs' "90 % complete" figure counts code written, not a launchable business.

---

## 13. Unused and redundant feature candidates

Full detail: [`docs/REMOVAL_CANDIDATES.md`](REMOVAL_CANDIDATES.md). Headlines:

- **Hide, do not delete:** resale asks/bids, price index, inspection certificates, sell/consign, admin resale/inspections/fit-rules, AI search/concierge, Fit Studio. They are real, DB-backed and tested, but outside the stated launch product. Keep code + migrations, keep server gate, remove every entry point.
- **Remove from UI / consolidate:** Payments top-level nav (fold into Finance), `/verify` (unlinked, redundant with inspection), duplicate return-policy copy, "Aura-7" floating tab position, market ticker if it cannot be kept truthful.
- **Fix or remove:** `/purchasing` and `/reviews` admin screens with no navigation (either wire them or 404 them); GST export link placed only inside Purchasing.
- **Never delete blindly:** migrations, `return_request`, `payment_operation`, `credit_note`, `audit_event` — they carry financial and statutory history.

---

## 14. Missing requirements for a launchable Indian fashion business

| Area | Missing |
|---|---|
| Mobile | Navigation (hamburger + drawer), sticky filter/sort, responsive PDP gallery, thumb-friendly checkout |
| Catalogue | Working server-side facets, real brand data on cards, product media pipeline (multi-image, alt text, consistent ratios), merchandising (new-in, collections, editorial) |
| Product content | Size charts per brand, fabric/care, country of origin, MRP, HSN, wash/care, returnability badge |
| Checkout | A working payment path in every environment (test keys or a documented sandbox), address book reuse, saved phone, delivery estimate, GST breakup |
| Post-purchase | Customer tracking page, notification emails/SMS, invoice download in account, cancellation window clarity |
| Admin | Needs-attention queue, grouped navigation, global search, purchase/supplier workflow, reviews moderation, GST export discoverability, staff MFA |
| Marketing | SEO (robots/sitemap/canonicals/OG), analytics with consent, abandoned-cart/email capture, discount governance |
| Ops | Monitoring, backups schedule + restore test, error alerting, runbooks, on-call ownership |
| Legal | GSTIN/CIN, legal name, grievance officer details, final policy copy, privacy/DPDP notices, IT Rules compliance |

---

## 15. Proposed simplified product scope

### KEEP (launch core)
Multi-brand catalogue with sizes and live stock; brands/collections; cart; prepaid Razorpay checkout (UPI + cards); customer accounts, addresses, wishlist; orders, cancellation before dispatch, returns/exchanges with reverse pickup; GST invoices and credit notes; Shiprocket fulfilment and tracking; email/SMS notifications; promotions; admin operations (orders, products, inventory, customers, returns, content, support, reports, staff, audit); in-house bespoke tailoring as a distinct service with its own order pipeline.

### FIX (must work before launch)
Mobile layout and navigation; catalogue facets and brand data; product media and content; checkout totals and payment availability; invoice statutory fields; authenticity/declaration copy; production configuration and deployment; SEO basics.

### REDESIGN
Storefront home/catalogue/PDP/cart/checkout/account visual system; admin navigation, dashboard, tables, order detail as a single workflow cockpit.

### DEFER (keep code, hide UI, server-gated)
Resale orderbook and bidding; price index; inspection/authentication certificates; AI search-by-sight; AI concierge; Fit Studio; WhatsApp notifications; multi-warehouse.

### REMOVE from the shipping product (not from git history)
`/verify` dead route; duplicate/incorrect policy copy; any claim not backed by a record; CultureCircle/resale positioning in README and marketing surfaces; "Aura-7" naming if the AI layer is deferred.

### One-sentence scope of record
> The Hidden Label is a premium Indian multi-brand footwear and apparel retailer with an in-house made-to-measure atelier, selling prepaid online and from its Ahmedabad boutique, with GST-compliant invoicing, courier fulfilment, and a staff console for daily retail operations.

---

## 16. Proposed customer navigation

**Desktop header:** `New In` · `Footwear` · `Apparel` · `Accessories` · `Bespoke` · `Brands` · `Journal` (optional) · Search · Wishlist · Account · Bag.

**Mega menu:** three columns — Shop by category (with subcategories), Featured collections, Brands (top 8 + View all). One promotional image tile.

**Mobile:** hamburger drawer with the same hierarchy, search icon, bag; sticky bottom bar on PDP only (Buy / size). Remove the floating concierge.

**Footer:** Shop, Client Care (shipping, returns, size guide, track order, contact), The House (about, bespoke, boutique), Legal (terms, privacy, grievance), statutory identifiers.

**Account:** Orders · Returns · Addresses · Wishlist · Profile · Sign out, with invoice and tracking reachable from each order.

---

## 17. Proposed admin navigation

| Group | Items |
|---|---|
| **Overview** | Dashboard (needs-attention queue + KPIs) |
| **Commerce** | Orders · Returns · Products · Inventory · Brands · Categories · Promotions |
| **Fulfilment** | Shipments (or fulfilment tab inside Orders) |
| **Customers** | Customers · Support inbox |
| **Content** | Content & CMS · Reviews |
| **Finance & Insights** | Reports · GST exports · Payments (read-only) · Audit log |
| **Settings** | Store profile · Staff & roles · Integrations status |

Rules: group headers, collapsible rail, command palette (`⌘K`) for order/product/customer lookup, role-aware visibility server-enforced, `Purchasing` hidden until POs are actually used (then under Commerce), no flat 19-item list.

---

## 18. Proposed design system direction

- **Keep** the type pairing (Syne/Hanken/JetBrains) and 0-radius brutalism as *brand accents*, not as the whole language.
- **Add** a calm luxury layer: generous white space, 12-column editorial grid, large imagery, restrained borders (use hairlines only where they carry meaning), consistent 8-pt spacing, one accent (champagne) used sparingly.
- **Type scale:** raise body to 16 px minimum on mobile, 15–16 px desktop; limit display sizes to two steps; use mono only for labels, prices, and order numbers.
- **Components:** product card with brand line, image, name, price, sold-out/“made to measure” badge, hover second image; PDP gallery with thumbnails/zoom; sticky buy panel; accordion details; consistent form field with label/hint/error; toast + inline errors; skeleton and empty states per template.
- **Accessibility:** visible focus ring on every interactive element, focus trap in drawer/modal, 44 px targets on mobile, contrast ≥ 4.5:1 for body, skip link, reduced-motion support.
- **Admin:** dense but calm data UI — grouped nav, 32–36 px rows, right-aligned numerics, status chips with semantic tones, inline row actions, saved filter views, consistent empty/error/loading states.

---

## 19. Prioritised implementation roadmap (summary)

Full phase plan with acceptance criteria: [`docs/IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md).

| Priority | Work |
|---|---|
| **P0** | Scope decision and doc cleanup; fix mobile overflow/navigation; make checkout completable with test payment keys; correct totals; fix invoice GSTIN and remove unsubstantiated claims; align feature flags so no dead CTA is visible; choose and configure hosting |
| **P1** | Storefront redesign (home/catalogue/PDP/cart/checkout); admin IA redesign + dashboard needs-attention; product media/content pipeline; SEO basics; notifications; production secrets, backups, monitoring |
| **P2** | Bespoke workflow polish; promotions governance; reviews; support SLAs; analytics; performance work; accessibility audit |
| **P3** | Fit Studio, resale, inspection, AI concierge — only after launch metrics justify the operational cost |

---

## 20. Blocking risks

1. **Scope ambiguity** — building resale/AI UI while the business runs retail inflates cost and confuses customers. Decide before design.
2. **No working payment path** — nothing can be sold until Razorpay test keys exist in dev and live keys in production.
3. **Mobile experience** — a broken mobile storefront is a revenue blocker in India.
4. **Statutory data** — GSTIN/CIN/legal name/grievance details and product declarations are incomplete; invoices cannot be issued lawfully.
5. **Photography and product truth** — wrong images and unverified authenticity claims create consumer-law and brand risk.
6. **No production operations** — no host, secrets, backups, monitoring or tested restore.
7. **Data hygiene** — test customers/orders mixed into the database; analytics and support will be polluted unless separated.
8. **Documentation drift** — the next engineer or agency will plan against false claims unless docs are corrected now.

---

## 21. Questions requiring owner decisions

1. **Positioning:** is the launch product *retail + bespoke* only, with resale/AI deferred? (Recommended: yes.)
2. **Bespoke depth:** keep made-to-measure as a first-class line with its own pipeline, or launch ready-to-wear only and add bespoke later?
3. **Multi-brand vs. curated house:** how many external brands at launch, and is there exclusivity/consignment complexity to model?
4. **Payments:** Razorpay only, prepaid only? Any plan for COD, EMI, or PayLater at launch?
5. **Fulfilment:** single boutique pickup location plus Shiprocket, or multi-warehouse from day one?
6. **Returns:** final return window and whether exchanges are offered (currently configurable 7 days).
7. **Legal identity:** GSTIN, CIN, registered legal name, registered address, grievance officer name/phone/email.
8. **Photography:** who produces consistent product and editorial imagery, and by when?
9. **Hosting:** which provider/region, who owns the accounts, and what monthly budget?
10. **Go-live date and launch assortment:** how many SKUs, which brands, which categories.
11. **Staff roles:** who needs owner/manager/operations/support/readonly, and is MFA required?
12. **Analytics/consent:** which analytics tool, and is a consent banner required for DPDP?
13. **Resale/AI:** confirm deferral, and whether the code should be archived on a branch or left dormant behind flags.
14. **Domain email:** which addresses are live (orders@, concierge@, grievance@) and where are they hosted?

---

## Appendix A — Commands actually run in this audit

```
git rev-parse --abbrev-ref HEAD            -> main
git rev-parse HEAD                          -> 478e7ec…
git status --porcelain                      -> 2 generated next-env.d.ts files
git log --oneline -40; git rev-list --count HEAD -> 72 commits
git fetch origin; git log origin/main       -> a8127d9… (1 ahead)
pnpm typecheck                              -> pass (6 packages)
pnpm lint                                   -> pass
pnpm test                                   -> 207 passed
pnpm --filter @thl/storefront build         -> pass
pnpm --filter @thl/admin build              -> pass
pnpm audit --audit-level=high               -> 6 moderate, 0 high/critical
pnpm db:status                              -> PostgreSQL 18.6 running on 127.0.0.1:5437
curl :9000/health, /healthz                 -> OK, 200
curl :3000/api/health                       -> backend up (14 ms)
curl :7001/                                 -> 307 /login?from=/
curl -I https://thehiddenlabel.com          -> timeout
nslookup thehiddenlabel.com                 -> 13.248.169.48, 76.223.54.146
SQL counts (read-only)                      -> 187 tables, 31 published products, 72 orders,
                                               64 payments, 34 returns, 18 shipments,
                                               21 promotions, 2 credit notes, 0 reviews,
                                               0 support tickets, 65 resale asks,
                                               29 inspections, 299 audit events
```

## Appendix B — Screens reviewed visually

Captured during this audit (in `docs/screenshots/`):
`audit-home-desktop.png`, `audit-home-mobile.png`, `audit-catalog-desktop.png`, `audit-pdp-desktop.png`, `audit-checkout-desktop.png`, `audit-admin-login.png`.

Reviewed from earlier work (secondary evidence): `audit-admin-fulfil-error.png`, `audit-mobile-account.png`, `audit-mobile-catalogue.png`.

Not visually reviewed: the admin dashboard and module interiors (no staff credentials available). Findings for those screens are based on source and API inspection and are marked as such in `ADMIN_AUDIT.md`.

## Appendix C — Companion documents

- `docs/FEATURE_INVENTORY.md`
- `docs/STORE_FRONTEND_AUDIT.md`
- `docs/ADMIN_AUDIT.md`
- `docs/BACKEND_DATABASE_AUDIT.md`
- `docs/END_TO_END_WORKFLOWS.md`
- `docs/UI_UX_REDESIGN_PLAN.md`
- `docs/REMOVAL_CANDIDATES.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/IMPLEMENTATION_ROADMAP.md`
