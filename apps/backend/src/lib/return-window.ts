/**
 * The ready-to-wear return window, in days after delivery.
 *
 * R-09: the window is configuration (`RETURN_WINDOW_DAYS`, default 7). It previously existed only
 * inside `lib/returns.ts`, so customer emails and the seeded returns policy restated "7 days"
 * independently and would silently contradict the enforced window once the env value changed.
 * Everything that talks about the window now reads this module.
 *
 * Kept free of Medusa imports so notification/seed code does not have to pull in the return
 * workflow machinery just to print a number.
 */
function readWindowDays(): number {
  const raw = Number(process.env.RETURN_WINDOW_DAYS ?? 7);
  if (!Number.isFinite(raw) || raw <= 0) return 7;
  return Math.floor(raw);
}

export const RETURN_WINDOW_DAYS = readWindowDays();

/** "7 days" / "1 day" — ready for prose without callers re-deriving pluralisation. */
export const RETURN_WINDOW_LABEL = `${RETURN_WINDOW_DAYS} ${RETURN_WINDOW_DAYS === 1 ? "day" : "days"}`;
