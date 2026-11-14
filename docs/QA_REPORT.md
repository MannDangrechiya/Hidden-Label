# QA Report — THE HIDDEN LABEL

Filled in at **G7** by executing `docs/QA_PLAN.md`. Empty rows are unexecuted checks, not passes.
Add the date, the environment (commit SHA + URL) and one evidence note per row
(screenshot path, test name, or command output reference).

Environment: `TBD` · Commit: `TBD` · Date: `TBD` · Tester: `TBD`

Legend: ✅ pass · ❌ fail · ⚠️ accepted risk (needs owner + date) · ⬜ not run

---

## 1. Customer journey (`QA_PLAN.md` §2)

| # | Check | Result | Evidence |
|---|---|---|---|
| C1 | Homepage renders CMS banners/drops | ⬜ | |
| C2 | Mega menu keyboard/Escape behaviour | ⬜ | |
| C3 | Brand directory counts match catalog | ⬜ | |
| C4 | Brand vault filters + URL state | ⬜ | |
| C5 | Catalog pagination has no duplicates/gaps | ⬜ | |
| C6 | Search typeahead latency + XSS-safe echo | ⬜ | |
| C7 | Search zero-result fallback | ⬜ | |
| C8 | PDP size selection, sold-out reason visible | ⬜ | |
| C9 | Add to bag from PDP + quick view | ⬜ | |
| C10 | Cart quantity, remove, promo apply/remove | ⬜ | |
| C11 | Out-of-stock while in cart | ⬜ | |
| C12 | Guest checkout + signed-in checkout | ⬜ | |
| C13 | Address CRUD validation | ⬜ | |
| C14 | Shipping option changes total correctly | ⬜ | |
| C15 | Confirmation only after server verification | ⬜ | |
| C16 | Payment failure path | ⬜ | |
| C17 | Abandoned payment expiry + stock release | ⬜ | |
| C18 | Double-click Pay → one order | ⬜ | |
| C19 | Order history + detail correctness | ⬜ | |
| C20 | Tracking timeline monotonic | ⬜ | |
| C21 | Return request eligibility + stepper | ⬜ | |
| C22 | Wishlist persistence | ⬜ | |
| C23 | Auth + OTP rate limits, no enumeration | ⬜ | |
| C24 | Account data isolation (IDOR) | ⬜ | |

## 2. Admin (`QA_PLAN.md` §3)

| # | Check | Result | Evidence |
|---|---|---|---|
| A1 | Dashboard KPIs match orders | ⬜ | |
| A2 | Create product → publish → live | ⬜ | |
| A3 | Publish blocked on missing fields | ⬜ | |
| A4 | Brand/category CRUD + in-use protection | ⬜ | |
| A5 | Inventory adjust writes audit + updates store | ⬜ | |
| A6 | Order actions capture/fulfil/cancel/refund | ⬜ | |
| A7 | Partial + full refund reconciliation | ⬜ | |
| A8 | Shipment create/label/sync | ⬜ | |
| A9 | Returns approve/receive/refund | ⬜ | |
| A10 | Promotions limits/expiry/stacking | ⬜ | |
| A11 | CMS scheduling without deploy | ⬜ | |
| A12 | Reports + CSV match orders | ⬜ | |
| A13 | Role permissions enforced visibly + server-side | ⬜ | |
| A14 | Audit log complete + chain verifies | ⬜ | |
| A15 | Customer session rejected on all admin routes | ⬜ | |

## 3. Security (`QA_PLAN.md` §4)

| Item | Result | Evidence |
|---|---|---|
| Session cookie flags + rotation + logout invalidation | ⬜ | |
| Password hashing | ⬜ | |
| Rate limits (login, OTP, search, promo, contact) | ⬜ | |
| CSRF same-origin enforcement | ⬜ | |
| Authorisation sweep on every route | ⬜ | |
| IDOR probes (order/address/return/wishlist) | ⬜ | |
| Webhook forgery + replay rejected | ⬜ | |
| Input validation / no SQL interpolation | ⬜ | |
| Upload restrictions (mime, size, EXIF, no SVG) | ⬜ | |
| No secrets in built client bundles | ⬜ | |
| Security headers | ⬜ | |
| Dependency audit clean of critical/high | ⬜ | |
| Admin app noindex and unlinked | ⬜ | |
| No stack traces / table names in errors | ⬜ | |
| No PII, OTPs or tokens in logs | ⬜ | |

## 4. Design consistency (`QA_PLAN.md` §5)

| Check | Result | Evidence |
|---|---|---|
| Token diff — home | ⬜ | |
| Token diff — catalog | ⬜ | |
| Token diff — PDP | ⬜ | |
| Token diff — cart | ⬜ | |
| Token diff — checkout | ⬜ | |
| Token diff — admin table | ⬜ | |
| Stitch side-by-side at 1280 / 2560 | ⬜ | |
| Responsive 375/768/1024/1440/1920, no h-scroll at 320 | ⬜ | |
| State audit (loading/empty/error/success/disabled/unavailable) | ⬜ | |
| **Copy-honesty sweep** — every claim maps to a record/service | ⬜ | |
| Typography: money in mono/tabular, `label-caps` casing + tracking | ⬜ | |

## 5. Performance & accessibility (`QA_PLAN.md` §6)

| Metric | Target | Result |
|---|---|---|
| LCP mobile home/catalog/PDP | < 2.5s | ⬜ |
| CLS | < 0.1 | ⬜ |
| INP | < 200ms | ⬜ |
| Catalog query p95 | < 300ms | ⬜ |
| Typeahead p95 | < 80ms | ⬜ |
| WCAG 2.1 AA — six core templates | pass | ⬜ |

## 6. Bug list

| ID | Severity | Screen/Route | Description | Status | Owner |
|---|---|---|---|---|---|
| | | | | | |

## 7. Release statement

- Criticals open: `TBD`
- Highs open (with accepted-risk note + date + owner): `TBD`
- Known limitations at release: `TBD`
- Verdict: `not yet assessed`
