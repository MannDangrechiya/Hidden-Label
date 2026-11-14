# THE HIDDEN LABEL — QA, Security & Release Criteria

No feature is complete because it renders. It is complete when the rows below that apply to it
have been executed and recorded. Results live in `docs/QA_REPORT.md` (created at G7), one row
per check with pass/fail and evidence.

---

## 1. Test layers

| Layer | Tool | Scope | Gate |
|---|---|---|---|
| Unit | Vitest | money helpers, discount rules, eligibility rules, status mappers, validators | every phase |
| Integration | Vitest + real Postgres/Redis (testcontainers or docker) | cart recalculation, reservation, order transitions, webhook handlers, RBAC | from G2 |
| Contract | schema snapshot tests | API response shapes from `API_PLAN.md` stay stable | from G2 |
| E2E | Playwright | the customer journey, admin journey, payment success/failure with a provider stub | from G3 |
| Manual/visual | human + token diff | screen fidelity against Stitch, responsive behaviour | G1, G7 |
| Security | checklist + scripted probes | authz, IDOR, webhook forgery, rate limits | G7 |
| Performance | Lighthouse + load probe | six core templates; PDP/catalog under concurrency | G7 |

CI must run typecheck, lint, unit and integration on every PR; E2E on PRs touching
storefront/checkout/backend. A red check blocks merge — no exceptions, no skipped tests added to
make a run green.

---

## 2. Customer journey acceptance

| # | Check | Expected |
|---|---|---|
| C1 | Homepage renders banners/drops from CMS | published + scheduled content only |
| C2 | Mega menu opens, keyboard navigable, Escape closes | focus trapped correctly |
| C3 | Brand directory lists all active brands with counts | counts match catalog |
| C4 | Brand vault filters (size, category, price, sort) | URL reflects state; back button restores |
| C5 | Catalog pagination | no duplicate or missing items across pages |
| C6 | Search typeahead | ≤80ms perceived, ≤8 results, no XSS from query echo |
| C7 | Search results, zero results | fallback with a route out |
| C8 | PDP: select size → price/stock/CTA update | sold-out sizes disabled **with reason** |
| C9 | Add to bag from PDP and quick view | drawer opens with correct line + total |
| C10 | Cart: quantity change, remove, promo apply/remove | totals recompute server-side |
| C11 | Cart: item goes out of stock while sitting | explicit "no longer available", cannot proceed |
| C12 | Guest checkout and signed-in checkout | both complete; guest sees order via secure link |
| C13 | Address create/edit/delete | validation, no partial saves |
| C14 | Shipping option selection changes total | matches server recalculation |
| C15 | Payment success | confirmation shows **only after** server verification |
| C16 | Payment failure | order not created as paid; retry path works |
| C17 | Abandoned payment | order expires, stock released, cart restorable |
| C18 | Double-click "Pay" | one order, one payment (idempotency) |
| C19 | Order history + order detail | correct orders, correct statuses |
| C20 | Tracking timeline | matches shipment events, monotonic |
| C21 | Return request | eligibility enforced, stepper works, AWB shown when issued |
| C22 | Wishlist add/remove/move-to-bag | persists across sessions |
| C23 | Auth: register, login, logout, forgot/reset, OTP | rate limits hold; no account enumeration |
| C24 | Account data isolation | user A cannot read user B's order/address/return by id |

---

## 3. Admin acceptance

| # | Check | Expected |
|---|---|---|
| A1 | Dashboard KPIs | match underlying orders within the stated period |
| A2 | Create product end-to-end | draft → variants → media → publish → visible on storefront |
| A3 | Publish blocked when required fields missing | weight/dims, price, at least one variant |
| A4 | Brand/category CRUD | reflected in nav and filters; in-use brand cannot be hard-deleted |
| A5 | Inventory adjust | requires reason, writes audit row, storefront stock updates |
| A6 | Order detail actions | capture/fulfil/cancel/refund each correct and audited |
| A7 | Refund partial + full | amounts reconcile, provider refund recorded |
| A8 | Shipment create/label/sync | AWB stored, tracking appears on customer order |
| A9 | Returns: approve/receive/refund | restock decision honoured |
| A10 | Promotions | usage limits, expiry, stacking rules behave as specified |
| A11 | CMS | banner scheduling changes storefront without deploy |
| A12 | Reports + CSV export | totals match orders |
| A13 | Roles | each role sees only permitted modules; server rejects the rest |
| A14 | Audit log | every mutation present, hash chain verifies |
| A15 | Admin API called with a customer session | 401/403 on **every** endpoint (scripted sweep) |

---

## 4. Security checklist (G7)

- [ ] Session cookies: httpOnly, secure, sameSite; rotation on login; invalidation on logout
- [ ] Password hashing with the framework default (bcrypt/argon2); no plaintext anywhere
- [ ] Rate limits on login, OTP, search, promo apply, contact form
- [ ] CSRF: same-origin enforcement on all cookie mutations
- [ ] Authorisation sweep: every `/admin/*` route and every owner-scoped `/store/*` route hit
      with the wrong actor; expected 401/403/404 recorded
- [ ] IDOR probes on order, address, return, wishlist ids
- [ ] Webhook signature forgery rejected; replay rejected
- [ ] Input validation on every mutating route; no raw SQL string interpolation
- [ ] Upload restrictions: mime allowlist, size cap, EXIF stripped, no SVG uploads
- [ ] Secrets absent from client bundles (grep the built output for key patterns)
- [ ] Security headers: CSP, HSTS, X-Frame-Options/frame-ancestors, nosniff, referrer policy
- [ ] Dependency audit with no unresolved critical/high
- [ ] Admin app not indexed (`X-Robots-Tag: noindex`) and not linked from the storefront
- [ ] Deferred V2 features unreachable: no entry point rendered, `/sight-search`, `/price-index`,
      `/concierge`, `/fit-studio`, `/inspection/*` return 404, no mock payloads present
- [ ] Feature flags default off in the built bundle and are asserted off in production
- [ ] Error responses leak no stack traces, table names or provider payloads
- [ ] Logs contain no card data, OTPs, tokens or full addresses

---

## 5. Design consistency (the thing that quietly rots)

1. **Token diff** — for six core templates (home, catalog, PDP, cart, checkout, admin table),
   extract computed font-size/weight/tracking, colour, border-radius and shadow from the built
   page and compare against `DESIGN_TOKENS.md`. Any value not in the token file is a defect.
2. **Stitch comparison** — open the Stitch frame and the built page side by side at 1280 and
   2560. Compare structure, not pixels: same modules, same order, same emphasis.
3. **Responsive** — 375, 768, 1024, 1440, 1920 for the same six templates, against the mobile
   derivation rules. No horizontal scroll at 320px.
4. **State audit** — every data-driven component demonstrates loading, empty, error, success,
   disabled, unavailable.
5. **Copy honesty** — per approved D2, v1 may only state what the platform substantiates. For
   every claim on screen (tier, "only N left", delivery estimate, coupon terms, order status),
   name the backend field or service that makes it true. The following must **not appear
   anywhere in v1**, including alt text, meta descriptions and emails: escrow / "held in escrow",
   RFID, "Merkle", "tamper-evident ledger", KYC, "verified authentic" product badges,
   aftermarket / ask / bid / valuation language. If a component only makes sense with one of
   those claims, the component is removed from v1 — not softened, footnoted or asterisked.
   Release blocker.
6. **Typography check** — money renders in JetBrains Mono with tabular figures everywhere
   (including admin tables and emails); `label-caps` is uppercase and 0.12em tracked everywhere.

---

## 6. Performance & accessibility targets

| Metric | Target |
|---|---|
| LCP (mobile, 4G) | < 2.5s home/catalog/PDP |
| CLS | < 0.1 |
| INP | < 200ms |
| JS on PDP | budget agreed at G1; no client component above the fold that doesn't need it |
| Catalog query | p95 < 300ms server time |
| Typeahead | p95 < 80ms |
| Images | AVIF/WebP, explicit dimensions, priority only on hero |

Accessibility (WCAG 2.1 AA on the six core templates): keyboard-complete flows, visible focus
that matches the 1px-border design language (not a browser default outline), labelled form
controls and errors, `aria-live` for cart/toast updates, 4.5:1 contrast for body text (gold is
never body text), alt text on product imagery, no interaction that depends on hover alone
(the size-bar hover reveal needs a keyboard/tap equivalent).

---

## 7. Release criteria

Ship only when all of the following are true:

1. Every check in §2 and §3 passes, or has a written accepted-risk note with a date and owner.
2. Zero open critical issues; every high issue either fixed or explicitly accepted.
3. The 16-step order in `PROJECT_PLAN.md` §6 executed once in production with a real card and a
   real refund, evidenced in `QA_REPORT.md`.
4. Backups verified by an actual restore, not by looking at the backup list.
5. Rollback rehearsed: previous app version redeployed, migration rollback documented.
6. Copy-honesty sweep (§5.5) complete — no escrow, RFID, ledger, KYC or aftermarket claims in v1.
7. V2 feature flags verified off in production; every deferred route returns 404 and no nav
   entry point renders.
8. Admin users trained; runbook and credential ownership handed over.

Anything short of this is a preview, and must be described as one.
