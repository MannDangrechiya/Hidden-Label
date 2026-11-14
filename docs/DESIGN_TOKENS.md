# THE HIDDEN LABEL — Design Tokens & Visual Rules

Source: Stitch project `10766877595551018159`, `design_theme` (colour mode LIGHT,
variant FIDELITY, custom seed `#111111`) plus its embedded `design_md` brand guide.
This file is the authority. `packages/ui` and `packages/config/tailwind-preset.ts` are
generated from it. If a screen needs something not listed here, that is a finding — report
it, do not invent it.

---

## 1. Colour

### Overridden brand palette (the values that matter)

| Role | Hex | Use |
|---|---|---|
| Canvas / background | `#F8F7F4` | page backdrop (warm bone) |
| Surface | `#FAF9F6` | elevated sections, sticky nav on scroll |
| Surface container | `#EFEEEB` | product-card image bed |
| Surface low / high | `#F4F3F0` / `#E9E8E5` | alternating bands, table zebra |
| White | `#FFFFFF` | modal sheets, elevated cards |
| Primary | `#111111` | wordmark, headings, primary buttons, 1px rules |
| On-surface | `#1A1C1A` | body text on canvas |
| On-surface variant | `#444748` | secondary body text |
| Tertiary / muted | `#71717A` | metadata, SKUs, taxonomy, disabled text |
| Accent gold | `#C5A880` | verification seals, drop status, focus micro-interaction, primary-button hover |
| Border | `#E4E4E7` | default 1px structural border |
| Border warm | `#EFECE6` | softer interior framing |
| Error | `#BA1A1A` | validation, destructive |
| Error container | `#FFDAD6` | error banner fill |

Material role tokens also exist in the theme (`primary #000000`, `secondary #725B38`,
`tertiary #000000`, `outline #747878`, `outline-variant #C4C7C7`, the `surface-container-*`
ramp, `inverse-surface #2F312F`). Map them to the overridden brand values above for
components; do not introduce `#725B38` brown into the UI — the accent is `#C5A880`.

**Rule:** only one accent. Gold is never used for compensation framing, never as a
background for body text, never more than one gold element per viewport region.

---

## 2. Typography

Three families, three jobs. No exceptions.

| Family | Role | Weights used |
|---|---|---|
| **Syne** | display + all headlines, brand wordmark | 600, 700, 800 |
| **Hanken Grotesk** | body, descriptions, taxonomy, nav items | 400, 500, 600 |
| **JetBrains Mono** | currency (₹), SKUs, serials/auth codes, sizing matrices, uppercase micro-labels, countdowns | 500, 600 |

### Scale (desktop → mobile)

| Token | Family | Size / line-height | Letter-spacing | Weight | Mobile |
|---|---|---|---|---|---|
| `display-hero` | Syne | 64 / 68 | -0.04em | 800 | 38 / 42, -0.03em |
| `headline-lg` | Syne | 40 / 46 | -0.03em | 700 | 28 / 34, -0.02em |
| `headline-md` | Syne | 24 / 30 | -0.02em | 600 | same |
| `headline-sm` | Syne | 18 / 24 | -0.01em | 600 | same |
| `body-lg` | Hanken Grotesk | 18 / 28 | — | 400 | same |
| `body-md` | Hanken Grotesk | 15 / 22 | — | 400 | same |
| `body-sm` | Hanken Grotesk | 13 / 18 | — | 400 | same |
| `currency-lg` | JetBrains Mono | 20 / 24 | -0.02em | 600 | same |
| `currency-md` | JetBrains Mono | 15 / 18 | -0.01em | 500 | same |
| `label-caps` | JetBrains Mono | 11 / 14 | 0.12em | 500 | same, uppercase |
| `label-tag` | Hanken Grotesk | 12 / 14 | 0.04em | 600 | same |

`label-caps` is always uppercase and always tracked `0.12em` — this is the signature of the
design's "utility metadata" voice and the most common thing an agent gets wrong.

### Money formatting
Always `₹` + Indian digit grouping, JetBrains Mono, `font-variant-numeric: tabular-nums`.
`₹38,990` / `₹1,24,500`. Centralise in one `formatINR()` helper — never inline `toLocaleString`
per component, because inconsistency here is immediately visible in cart and checkout totals.

---

## 3. Spacing, grid, breakpoints

| Token | Value |
|---|---|
| `space-xs` / `sm` / `md` / `lg` / `xl` | 4 / 8 / 16 / 24 / 40 px |
| `gutter` (mobile) | 20px |
| `gutter-tablet` | 24px |
| `gutter-desktop` | 32px |
| `margin` (mobile) | 16px |
| `margin-tablet` | 32px |
| `margin-desktop` | 56px |
| max content width | 1680px |

All spacing is a multiple of 4px.

| Breakpoint | Columns | Notes |
|---|---|---|
| `< 768px` | 4 | product grid 2-up, edge-bleed hero |
| `768–1024px` | 8 | product grid 3-up |
| `> 1024px` | 12 | product grid 3- or 4-up; editorial spans 6 or 12 |

---

## 4. Shape and elevation

- **`border-radius: 0`** on cards, buttons, inputs, modals, badges, images, table cells.
  The only circles permitted: colour swatches, pagination dots, closed status indicators.
- **No drop shadows.** Hierarchy comes from 1px borders, tonal inversion, and negative space.
- Focus/active states invert tone: bone surface → `#111111` with white type; or border
  `#E4E4E7` → `#111111`.
- Modals/drawers: 1px border + backdrop `rgba(248,247,244,0.85)` with `backdrop-blur-md`.
  No dark scrim — the page stays visible behind.
- Exactly one shadow is allowed: `micro` = `0 8px 24px -4px rgba(17,17,17,0.06)` for quick-add
  popovers and the sticky nav only.

---

## 5. Component rules (from the brand guide)

**Global nav** — fixed, low profile. Wordmark `THE HIDDEN LABEL` in Syne bold caps, left or
centre. Utility links (`BRANDS`, `DROPS`, `FOOTWEAR`, `EDITORIAL`, `VAULT`) in `label-caps`.
Right cluster: wishlist, tabular cart count, INR indicator, account. Transparent over hero,
then solid `#F8F7F4` with a 1px `#111111` bottom rule on scroll.

**Product card** — 3:4 or 4:5 image on `#EFEEEB`/`#F4F4F5`; brand in `label-caps` `#71717A`;
title in Hanken Grotesk Medium `#111111`; price in `currency-md` JetBrains Mono. Hover does
**not** lift the card: it swaps to the alternate image and slides in a tabular size bar.

**Brand / category tiles** — monolithic blocks, logotype over campaign imagery, dark scrim
gradient, 1px interior bounding box.

**Badges** — *Verified/Deadstock*: `#111111` fill, white `label-tag`, gold dot.
*Pre-order/drop countdown*: 1px `#111111` border only, `label-caps` monospaced countdown.

**v1 constraint (D1/D2):** the Verified/Deadstock badge and the drop countdown are **V2 only**.
v1 has no verification data and must not use aftermarket language, so build the primitive for
fidelity and ship it **unrendered**. v1 badges come from real data only: `low_stock` (actual
quantity), `new_in` (publish date), `last_one`. Same shape, truthful content — gold dot only
where the backing field exists.

**Buttons** — Primary: `#111111` fill, white `label-caps` uppercase; hover inverts to `#C5A880`
fill with `#111111` text. Secondary: 1px `#111111` border, transparent, `#111111` label.
Disabled: `#E4E4E7` fill with `#71717A` text and no hover change.

**Inputs** — single underline or 1px frame, no radius, no shadow, monospaced floating label
for size/address/verification lookups. Focus = border to `#111111`.

**Footer** — monolithic `#111111` or bone, dense columns, currency/GST clarification line,
oversized wordmark bleeding along the baseline.

---

## 6. States that must exist on every data-driven component

`loading` (skeleton matching final layout, never a spinner in a card grid), `empty`
(with a route out — e.g. "browse all brands"), `error` (retryable, human sentence, never a
raw stack or HTTP code), `success`, `disabled` (with the *reason* visible: size sold out,
not just dimmed), `unavailable` (product archived / zero stock).

Design review checks these explicitly; a screen without them is not complete.

---

## 7. Mobile derivation rules (since no mobile frames exist)

Screens are desktop-only. Derive mobile as follows and get one reference build approved (D4)
per template family before applying across the rest:

1. Grid → 4 columns, margin 16px, gutter 20px.
2. `display-hero` → `display-hero-mobile`; `headline-lg` → `headline-lg-mobile`.
3. Two-column cart/checkout/PDP → single column, image gallery above, sticky bottom action bar
   containing the primary CTA + price.
4. Drawers and modals → bottom sheets, full width, 1px top border, same blur backdrop.
5. Data tables (admin) → **do not** collapse to cards silently; horizontal scroll with a sticky
   first column, or a purpose-built stacked row. Pick one per table and stay consistent.
6. Nav → hamburger opening the mega-menu as a full-height sheet with accordions.
7. Tap targets ≥ 44×44px; size selectors ≥ 48px tall.

---

## 8. Tailwind mapping sketch (implement in Phase 2)

```ts
colors: {
  canvas: '#F8F7F4', surface: '#FAF9F6', 'surface-container': '#EFEEEB',
  'surface-low': '#F4F3F0', 'surface-high': '#E9E8E5',
  ink: '#111111', 'on-surface': '#1A1C1A', 'on-surface-variant': '#444748',
  muted: '#71717A', accent: '#C5A880',
  border: '#E4E4E7', 'border-warm': '#EFECE6',
  error: '#BA1A1A', 'error-container': '#FFDAD6',
},
fontFamily: { display: ['Syne'], sans: ['Hanken Grotesk'], mono: ['JetBrains Mono'] },
borderRadius: { none: '0', DEFAULT: '0', full: '9999px' },   // circles only for swatches/dots
boxShadow: { none: 'none', micro: '0 8px 24px -4px rgba(17,17,17,0.06)' },
screens: { sm: '768px', lg: '1024px', xl: '1680px' },
```

Fonts are self-hosted via `next/font/local` (Syne, Hanken Grotesk, JetBrains Mono) — no
runtime CDN request, no layout shift.
