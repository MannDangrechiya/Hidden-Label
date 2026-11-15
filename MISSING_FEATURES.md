# Missing & Incomplete Features

Classified as **Missing** (no implementation), **Partial** (implementation exists but a required behaviour does not), or **Broken** (implemented but fails when executed). Cross-references: `BUG_REPORT.md`, `REFERENCE_COMPARISON.md`.

---

## 1. Launch-blocking (must exist before real orders)

| # | Feature | Ref | State | What is missing |
|---|---|---|---|---|
| MF-01 | Admin order fulfilment | A-08 | **Broken** | The action exists but always 422s (BUG-003). No working fulfil path from the custom admin UI. |
| MF-02 | Return lifecycle (approve/reject/receive/refund) | A-12 | **Broken** | Controls render but every action is rejected (BUG-004). No restock/refund transition, no audit events. |
| MF-03 | Customer returns history/status | U-21 | **Missing** | No `/account/returns`, no status timeline, no link from order detail (BUG-008). |
| MF-04 | Role enforcement | A-16 | **Broken** | Core admin resources ignore role; readonly can read orders/users and self-escalate (BUG-001/002). |
| MF-05 | Policy pages | U-24 | **Broken** | All four routes 404; footer legal links dead (BUG-006). |
| MF-06 | Promotion redemption | U-12/U-13 | **Missing** | No code input in cart or checkout (BUG-012), and admin creation is broken (BUG-007). |
| MF-07 | COD OTP at the API boundary | U-13 | **Partial** | OTP exists and is enforced in the storefront action only; direct completion bypasses it (BUG-005). |

---

## 2. Missing user-facing features (reference parity)

| # | Feature | Ref | State | Detail |
|---|---|---|---|---|
| MF-08 | Quick view | U-09 | **Missing** | No modal/sheet; cards navigate to PDP. |
| MF-09 | Cart drawer | U-11 | **Missing** | Header links to `/cart`; no slide-in drawer or add-to-bag confirmation. |
| MF-10 | Order cancellation | U-20 | **Missing** | No route or action; `/account/orders/:id/cancel` 404 (BUG-019). |
| MF-11 | Invoice download/print | U-20 | **Missing** | No customer or admin invoice route (BUG-020). |
| MF-12 | Return request stepper + reverse AWB | U-21 | **Partial** | Single form; eligibility gate works; no 3-step stepper/QR/reverse pickup tracking. |
| MF-13 | Tailoring stage tracker | Bespoke | **Partial** | Admin has a bespoke pipeline field; customer order page never shows it. |
| MF-14 | Move wishlist item to bag | U-10 | **Partial** | Wishlist lists/removes; no move-to-bag action. |
| MF-15 | Support ticket intake | U-22 | **Partial** | CMS FAQ page only; no contact/ticket form, no ticket model. |
| MF-16 | Contact form / store locator | U-23 | **Partial** | Address text only. |
| MF-17 | Mega menu | U-02 | **Partial** | Flat header links; no category/brand overlay. |
| MF-18 | Catalogue pagination / infinite scroll | U-05 | **Partial** | API caps at 48; no page controls, so larger catalogues become unreachable. |
| MF-19 | Real payment rails (UPI intent/QR, cards, EMI) | U-13 | **Missing** | COD only; other methods are copy, not gateway integrations. No Razorpay keys configured. |
| MF-20 | Partial-COD deposit | Blueprint | **Missing** | No ₹500–1,000 UPI token flow. |
| MF-21 | Order/inspection notifications (email/SMS/WhatsApp) | Blueprint | **Missing** | No provider integration; OTP uses dev echo; no order-status notifications. |
| MF-22 | Lookbook / editorial CMS blocks | U-01 | **Partial** | Homepage editorial is static, not CMS-driven. |
| MF-23 | Collector tier / loyalty | U-18 | **Partial** | Tier field exists on customers; no tier logic or display on dashboard. |
| MF-24 | SKU/code search in typeahead | U-06 | **Partial** | Product/handle search only (not exercised for SKU). |

---

## 3. Missing admin features

| # | Feature | Ref | State | Detail |
|---|---|---|---|---|
| MF-25 | Fit-rule create/edit/delete UI + DELETE API | A-20 | **Partial/Broken** | Read-only screen; POST exists, DELETE 404 (BUG-016). |
| MF-26 | Batch product actions / media upload | A-02/03 | **Partial** | Single-product create/edit; no bulk publish/delete, no image uploader (URLs/metadata only). |
| MF-27 | Category tree + banner management | A-05 | **Partial** | Flat category list. |
| MF-28 | Report exports | A-15 | **Partial** | CSV endpoint exists; not executed in this audit. No scheduled/emailed reports. |
| MF-29 | Return reverse-inspection + restock | A-12 | **Missing** | No condition grading, restock or disposal step. |
| MF-30 | Courier integration / label printing | A-11 | **Partial** | Manual provider + AWB only; no Shiprocket label/pickup. |
| MF-31 | Refund reason taxonomy / partial refund UI | A-10 | **Partial** | Full refund with note works; no partial-amount or reason-code UI. |
| MF-32 | Generic CMS page renderer | A-14 | **Partial** | Only hardcoded slugs (`about`, `support`, `size-guide`, `authenticity`); multi-segment slugs 404. |
| MF-33 | Customer risk/blacklist flags | A-09 | **Missing** | Notes and tier only. |
| MF-34 | WhatsApp/concierge handoff | AI-05 | **Missing** | AI chat only; no human handoff or WhatsApp channel. |

---

## 4. Explicitly out of scope / deferred by design

These were reviewed and are **not** counted as defects because the project documents them as deferred:

- Live Razorpay/Shiprocket/Resend keys (integration seams exist, credentials absent).
- Real vision model for sight search (honest keyword fallback is labelled).
- Full LLM concierge when Gemini is unavailable (template fallback is honest, but slow — BUG-017).
- Custom domain, analytics, SEO/social metadata, multi-language, dark mode (not requested by the reference).

---

## 5. Priority order for completion

1. **P0:** MF-01, MF-02, MF-04, MF-05, MF-07, MF-06.
2. **P1:** MF-03, MF-08/09, MF-10/11, MF-19 (at least one live gateway), MF-25.
3. **P2:** MF-12…MF-18, MF-23/24, MF-26…MF-34.

Each P0 item has a matching bug entry with a suggested fix and must be re-tested through both UI and API before sign-off.
