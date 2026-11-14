# Phase 0.5 — Approval Summary

Date: 2026-11-14 · Prepared by: agent · **Status: awaiting client sign-off (gate G0)**

Purpose: record the four decisions taken after the documentation pack was reviewed, confirm what
they changed, and state plainly what is now in v1, what is preserved for V2, and what Phase 1
will and will not do.

---

## 1. Decisions recorded

### D1 — AI and resale → **deferred to V2**
`AI-01` Search by Sight, `AI-02` Price Index, `AI-03` 360° Inspection, `AI-04` Fit Studio,
`AI-05` Style Concierge, plus bidding, price index and resale are removed from v1 scope.
The Stitch screens, their routes and their place in the screen map are **preserved**. In v1 they
are disabled behind flags that default off in every environment:

| Flag | Effect when off |
|---|---|
| `NEXT_PUBLIC_FEATURE_AI_LAYER` | nav entries for sight search / price index / concierge not rendered; routes 404 |
| `NEXT_PUBLIC_FEATURE_INSPECTION` | PDP shows a static gallery only |
| `NEXT_PUBLIC_FEATURE_FIT_STUDIO` | `U-25` size guide remains the only sizing aid |
| `NEXT_PUBLIC_FEATURE_BIDDING` | one sell price per variant; no ask/bid/valuation CTAs |

### D2 — No claim the platform cannot substantiate
| Claim in the designs | v1 treatment |
|---|---|
| "Escrow settlement" | **removed**; accurate payment and settlement wording only |
| RFID authenticity certificate | **deferred** until a real serialisation + authentication process is approved; no certificate, no product "verified authentic" badge |
| SHA-256 Merkle ledger | **not implemented and not claimed**; `A-17` is a normal activity log |
| Tamper-evident audit | **replaced** by a plain, reliable, append-only admin audit log (same-transaction writes, UPDATE/DELETE revoked, retention policy) |
| KYC flags at registration | **not implemented** unless the business confirms it is required |

### D4 — Mobile → **approved via reference builds**
Build homepage, catalog, PDP, cart, checkout and admin-table mobile layouts first; obtain approval
before applying the responsive system to the remaining templates. Derivation rules live in
`DESIGN_TOKENS.md` §7.

### Q6 — Authentication → **resolved**
Email + password is primary. OTP verifies the registered email or phone where required. Password
reset and account verification are first-class flows. Rate limiting on login, OTP send/verify and
reset. No OTP-only login in v1.

---

## 2. What changed in the documentation

| Document | Change |
|---|---|
| `PROJECT_PLAN.md` | decisions log D1–D4 + G0 entry; scope rewritten (V2 deferral, flag table, out-of-scope additions); G0 gate criteria; two risks closed |
| `SCREEN_MAP.md` | §3 rewritten as "preserved, deferred to V2" with flags and V2 backlog; `U-14` and `U-26` no longer reference RFID/verification records |
| `DATABASE_PLAN.md` | audit log de-hashed and de-claimed; `authentication_record` moved to V2 (DDL preserved); migration order updated; relationships annotated |
| `API_PLAN.md` | `/admin/audit/verify-chain` removed; feature-flagged route section added (404 when off, no mock payloads) |
| `INTEGRATIONS.md` | §4 rewritten around email+password with OTP verification, reset and rate limits |
| `QA_PLAN.md` | copy-honesty list updated to forbid escrow/RFID/Merkle/KYC/aftermarket language; flag and deferred-route checks added to security and release criteria |
| `OPEN_QUESTIONS.md` | Q2, Q3, Q4, Q6, Q7 moved to Resolved; Q1 and Q5 remain open with owners and phase impact |
| `PHASE_PROMPTS.md` | P2 reference builds; P3 excludes `authentication_record` and hash chaining; P5 audit framing; P6 auth framing; standing note about deferred-claim handling |
| `README.md` | status, decision table, next step |

**Nothing was removed from the design.** All 50 Stitch screens remain in the map; the five AI
screens and the three resale-adjacent behaviours are deferred, not deleted.

---

## 3. v1 scope — confirmed

**Storefront (26 screens + `SYS-00`)**
Homepage · mega menu · brand directory · brand vault · catalog · search overlay + results ·
PDP · quick view · wishlist · cart drawer + cart page · checkout · order confirmation ·
login · register · OTP · account dashboard · order history · order detail · return request ·
support · about · policies · size guide · authenticity **content page**

**Admin (17 screens + `SYS-01`)**
Dashboard · products · add product · brands · categories · inventory · orders · order detail ·
customers · payments & refunds · shipping · returns · promotions · CMS · reports ·
settings & roles · audit log

**Backend and data**
Medusa commerce core · PostgreSQL · Redis · brand module · CMS module · wishlist · OTP
challenges · returns/RMA · shipment mirror · plain audit log

**Integrations**
Razorpay · Shiprocket · transactional email · email/phone OTP · S3-compatible image storage ·
error tracking + uptime

---

## 4. Consistency verification

| Check | Result |
|---|---|
| Every screen in the map has a route, a data requirement and an actor | yes — 26 + 17 + 3 system screens, 5 deferred |
| Deferred screens still present in `SCREEN_MAP.md` | yes — §3 with flags and V2 backlog |
| Database plan supports every v1 screen (no orphan screen, no unused table) | yes — auth-record table removed from v1, audit log simplified |
| API plan matches database plan | yes — no `verify-chain`, no authentication-record endpoints, flagged routes 404 |
| QA plan can verify every decision | yes — copy-honesty list and flag/deferred-route checks |
| Phase prompts stop before building deferred features | yes — P3 and P5 explicitly forbid them |
| Architecture unchanged (Next.js, Medusa, PostgreSQL, Redis) | yes |
| No approved screen silently removed | yes |

Two items remain open and **do not block Phase 1**: Q1 (50 vs 49 screens — resolved by
inspection during Phase 1) and Q5 (legal policy text — due before G8).

---

## 5. What Phase 1 will do on sign-off

1. Monorepo: `apps/storefront`, `apps/admin`, `apps/backend`, `packages/{ui,config,shared}`
2. TypeScript strict, shared lint/format/ts config, CI (typecheck + lint + unit)
3. Pin the Medusa version and record it; read that version's docs before any extension code
4. Docker Postgres + Redis; migrations from empty DB in one command
5. `.env.example` for every integration, health endpoints, structured logging, error tracking hook
6. Idempotent seed (2 brands, 3 products) that refuses to run in production
7. A raw unstyled list proving the storefront reads real backend data

Phase 1 does **not** include design-system components, page layouts, deferred features, or any
production deployment.

---

## 6. Sign-off

| Item | State |
|---|---|
| D1 AI/resale deferral | recorded |
| D2 claim honesty | recorded |
| D4 mobile reference builds | recorded |
| Q6 authentication | recorded |
| Documentation reconciled | yes (2026-11-14) |
| **Client approval to begin Phase 1** | **pending** |

Approved by: ______________  Date: __________

On approval, Phase 1 begins and gate G1 is set to "in progress" in `PROJECT_PLAN.md` §5.
