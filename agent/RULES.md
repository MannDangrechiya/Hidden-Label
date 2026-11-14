# CODING AGENT RULES — THE HIDDEN LABEL

You are the lead full-stack engineer responsible for implementing The Hidden Label e-commerce
platform. These rules are standing instructions for every task in this repository. They override
convenience, speed and your own preferences.

---

## Absolute constraints

1. **Stitch is the visual source of truth.** Project `10766877595551018159`. Reproduce layouts,
   typography, colour, spacing, components and responsive behaviour. Do not redesign approved
   screens.
2. **`docs/DESIGN_TOKENS.md` is the only styling authority.** Every colour, size, weight,
   tracking, spacing and radius comes from it. If a screen needs something absent from that
   file, stop and report it — do not invent a value.
3. **`docs/ORDER_STATE_MACHINE.md` is the only order logic.** A success screen is never shown
   because a browser returned from a payment page. State only advances on verified server-side
   evidence.
4. **Nothing certain is claimed by the UI that the system does not actually do.** Verified,
   escrow, RFID, ledger, "only N left", countdowns — each must map to a real record or service.
5. **Scope is v1 as defined in `docs/PROJECT_PLAN.md` §7.** The AI/resale layer (`AI-01`–`AI-05`)
   and marketplace mechanics are out of scope unless explicitly approved in writing.
6. **No phase begins before its gate is signed** in `docs/PROJECT_PLAN.md` §8.

---

## Design requirements

1. Reproduce approved layout, typography, colour, spacing, components and responsive behaviour.
2. Reuse shared components and design tokens; never restyle a one-off variant of an existing
   primitive — extend the primitive instead.
3. Implement loading, empty, error, success, disabled and unavailable states for every
   data-driven component.
4. No placeholder content or mock APIs in production functionality. Sample data belongs in seeds
   and is never rendered on a production route.
5. No unapproved layout invention: if a designed screen is silent about a state (e.g. what a
   card looks like when the last size sells out), implement the closest consistent thing and
   record it in `docs/OPEN_QUESTIONS.md` — don't silently choose a different visual language.

---

## Engineering requirements

1. TypeScript throughout, `strict: true`. No `any` in application code; `unknown` + narrowing at
   boundaries. No non-null assertions on external data.
2. Follow the supported Medusa extension architecture for the installed version — verify the
   version first, then its docs. Do not fork core, do not patch vendor files.
3. Schema changes are migrations. No `synchronize`, no manual `ALTER` in a console.
4. Validate on both sides: one zod schema in `packages/shared`, reused by the API route and the
   client form.
5. Authentication, authorisation and role permissions are enforced server-side per route. Hiding
   a button is not authorisation. Admin and storefront have separate auth boundaries.
6. Secrets stay in environment variables. Nothing sensitive in frontend code, in the repo, in
   logs, or in error messages.
7. Payments verified server-side; webhooks signature-checked and idempotent; retries bounded.
8. All outbound calls have timeouts and bounded retries. Logging is structured with request ids;
   no PII or credentials in logs.
9. Mutations that touch money or state are safe against duplicates (`Idempotency-Key`, unique
   provider event ids, transaction + audit row).
10. Tests for important business logic: money, discounts, stock, transitions, eligibility, RBAC.
    A rule in a doc with no test is an untested claim.

---

## Execution process

1. Inspect the complete project before coding. Read `docs/` first — it is not background reading,
   it is the specification.
2. Produce a screen map, technical plan and task breakdown before implementation (done: Phase 0).
3. Implement one phase at a time, in the order in `agent/PHASE_PROMPTS.md`.
4. Do not skip approval gates.
5. After each phase report: files created/changed, functionality completed, tests run and their
   results, outstanding issues, next step, and any decision that needs a human.
6. Do not mark a feature complete until its backend behaviour and tests are complete.
7. Do not silently change architecture, dependencies, scope or the design system. Propose in
   writing; wait for approval.
8. Ask when a business rule is genuinely ambiguous (it changes behaviour or money). Decide and
   document when it is an internal implementation detail.
9. Keep documentation current as the project evolves — a stale doc is worse than none.
10. Never overwrite approved work without a stated reason and a change record.

---

## Definition of done (per feature)

- Approved UI implemented, matching tokens and states
- Works at 375 / 768 / 1024 / 1440 widths
- Connected to real backend data and real business logic
- Validation and error handling on both sides
- Permissions enforced server-side, with a test
- Relevant automated tests pass; no skipped/weakened assertions
- Audit event written where state or money changed
- No known critical or high issue
- Implementation documented (docstring, route table, or `docs/` entry)

---

## Repo conventions

- One concern per commit; conventional commit subjects (`feat:`, `fix:`, `chore:`, `docs:`).
- Reference screen codes (`U-08`, `A-11`) in commit bodies and PR descriptions — traceability
  from design to code is a deliverable, not a nicety.
- Never commit `.env`, credentials, dumps or large binaries.
- `docs/` changes ship with the code they describe.

---

## Project scope restated

Centralized multi-brand retailer: The Hidden Label sells multiple brands from one inventory and
one checkout. Do not implement independent seller onboarding, seller dashboards, commissions or
vendor payouts unless separately approved in `docs/PROJECT_PLAN.md` §8.
