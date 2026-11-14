# Open Questions & Blocking Decisions

Two classes. **BLOCKING** items stop the phase named in the last column. **ASSUMPTION** items
are proceeding on the stated assumption and only need a correction if it is wrong.

Answer format: append `A:` under the item, then record it in `PROJECT_PLAN.md` §8.

Status after Phase 0.5 (2026-11-14): **Q2, Q3, Q4 and Q6 are resolved** and moved to §3. Q1 and
Q5 remain open; neither blocks Phase 1.

---

## 1. Blocking

### Q1 — 50 screens vs 49 declared. Which is stale?
The Stitch manifest declares "Total Wired Screens: 49" but codes 50 artefacts
(`U-01..U-26` = 26, `SYS-00`, `A-01..A-17` = 17, `SYS-01`, `AI-01..AI-05` = 5).
**Blocks:** completeness of the inventory, not Phase 1.
**Recommendation:** treat 50 as authoritative; identify the duplicate while resolving the
remaining screen IDs in Phase 1, then correct the manifest.
**Note:** resolved-by-inspection during Phase 1 rather than by client answer; no action needed
from the client now.

### Q5 — Legal pages: who supplies the text?
`U-24` needs privacy, terms, shipping, cancellation and returns copy that reflects actual policy
(return window, refund timelines, GST handling). Policy copy is a legal position, not a design
decision.
**Blocks:** G8 (production deployment).
**Recommendation:** founder-supplied copy; the agent builds the templates and does not draft
binding policy language. Placeholder policy text is clearly marked as placeholder and must not
reach production.

---

## 2. Assumptions (proceeding unless corrected)

| # | Assumption | If wrong |
|---|---|---|
| A1 | Shiprocket is the shipping integration; BlueDart is one allocatable courier whose name the UI renders dynamically (decision D3 still to be formally confirmed) | Different aggregator changes Phase 6 only |
| A2 | Razorpay is the only payment gateway in v1 (the admin screen also mentions Stripe) | Adding a gateway is a Phase 6 delta, not a redesign |
| A3 | Currency is INR only; the header currency control is a static indicator, not a selector | Multi-currency changes pricing, cart and order schema |
| A4 | Single warehouse/pickup location in v1; inventory locations modelled but one active | Multi-location is additive |
| A5 | Guest checkout allowed; account required for order history, wishlist, returns | Guest-off changes checkout flow only |
| A6 | GST invoices are generated from order data; no separate ERP | ERP integration is out of scope |
| A7 | Product media lives in S3-compatible storage; Stitch imagery is placeholder only | Cloudinary is a storage-adapter swap |
| A8 | The "collector tier" is a stored field displayed on `U-18`/`A-09`, not a computed loyalty engine | A real loyalty engine is out of scope for v1 |
| A9 | Admin users are provisioned manually; no public admin signup | Fine for v1 |
| A10 | Analytics = privacy-respecting page analytics only; no consent design exists | Consent banner added if analytics is enabled |
| A11 | Returns window and rules follow the policy copy supplied for `U-24` | RMA eligibility logic keys off this |
| A12 | The installed Medusa major version is pinned in Phase 1 and all extension code is written against that version's docs | — |

---

## 3. Resolved

### Q2 — AI and resale layer in v1 or deferred? → **Resolved 2026-11-14 (D1)**
Deferred to V2: `AI-01`–`AI-05`, bidding, price index and resale. The Stitch screens and routes
are preserved. In v1 the features are disabled behind feature flags
(`NEXT_PUBLIC_FEATURE_AI_LAYER`, `NEXT_PUBLIC_FEATURE_INSPECTION`,
`NEXT_PUBLIC_FEATURE_FIT_STUDIO`, `NEXT_PUBLIC_FEATURE_BIDDING`), entry points are not rendered,
and deferred routes return 404. No mock behaviour.
Recorded in: `PROJECT_PLAN.md` §7 and §8, `SCREEN_MAP.md` §3, `API_PLAN.md` §1.

### Q3 — Which on-screen claims will the system honour? → **Resolved 2026-11-14 (D2)**
No claim the platform cannot technically substantiate.
- Audit log: a normal, reliable **append-only admin audit log**. No hash chain, no "Merkle", no
  tamper-evidence claim.
- Escrow: **not advertised**. Accurate payment and settlement terminology only.
- RFID authentication: **deferred** until a real serialisation and authentication process is
  approved. No certificate, no "verified" product badge in v1.
- Merkle ledger: **not claimed**.
- KYC: **not collected** unless the business confirms it is required.
Recorded in: `DATABASE_PLAN.md` §3 and §6, `SCREEN_MAP.md` (`U-14`, `U-26`), `QA_PLAN.md` §5,
`PROJECT_PLAN.md` §7 and §8.

### Q4 — Secondary-market pricing assumption → **Resolved 2026-11-14 (by D1)**
v1 has a **single sell price per variant**. No asks, no bids, no per-size price history, no
valuation feed, and no aftermarket language on the PDP, cards or cart. The resale data model is a
V2 item.
Recorded in: `SCREEN_MAP.md` §3, `DATABASE_PLAN.md` (no resale tables in the v1 chain).

### Q6 — Authentication method → **Resolved 2026-11-14**
Email + password is the primary authentication method. OTP verification is used for the
registered email or phone where required. Password reset and account verification are first-class
flows, with rate limiting on login, OTP send/verify and reset.
Recorded in: `INTEGRATIONS.md` §4, `API_PLAN.md` (auth group), `DATABASE_PLAN.md` §8,
`SCREEN_MAP.md` (`U-15`–`U-17`).

### Q7 — Mobile designs absent → **Resolved 2026-11-14 (D4)**
Approved: use the reference-build workflow. Build mobile for homepage, catalog, PDP, cart,
checkout and the admin table; obtain approval before applying the responsive system to the
remaining templates.
Recorded in: `DESIGN_TOKENS.md` §7, `PROJECT_PLAN.md` §8, `PHASE_PROMPTS.md` P2.
