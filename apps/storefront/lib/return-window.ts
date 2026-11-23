/**
 * The ready-to-wear return window shown to customers, in days after delivery.
 *
 * R-09: the enforced window lives in the backend (`RETURN_WINDOW_DAYS`). Every customer-facing
 * sentence used to restate "7 days" independently, so changing the backend value silently made
 * the storefront's policy copy wrong. Set `NEXT_PUBLIC_RETURN_WINDOW_DAYS` to the same number as
 * the backend's `RETURN_WINDOW_DAYS` and all copy follows.
 *
 * `NEXT_PUBLIC_` rather than a server-only name because the same value is rendered by client
 * components (the PDP buy panel); Next.js inlines it at build time.
 */
function readWindowDays(): number {
  const raw = Number(process.env.NEXT_PUBLIC_RETURN_WINDOW_DAYS ?? 7);
  if (!Number.isFinite(raw) || raw <= 0) return 7;
  return Math.floor(raw);
}

export const RETURN_WINDOW_DAYS = readWindowDays();
