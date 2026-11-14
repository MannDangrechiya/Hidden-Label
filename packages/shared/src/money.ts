/**
 * Money is always an integer count of paise. Floats are never used for money anywhere in this
 * codebase (see docs/DATABASE_PLAN.md §13), and formatting happens only at the edges.
 *
 * The single formatter lives here so the storefront, admin app, backend and emails cannot
 * disagree about how a price looks — Indian digit grouping, ₹ prefix, tabular figures are a
 * CSS concern handled in Phase 2.
 */

export type Currency = "inr";

export interface Money {
  /** Integer paise. ₹38,990 => 3899000 */
  readonly amount: number;
  readonly currency: Currency;
}

const MINOR_UNITS: Record<Currency, number> = { inr: 100 };

export class MoneyError extends Error {
  override name = "MoneyError";
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer, received ${String(value)}`);
  }
}

/** Build Money from paise. */
export function money(amountInPaise: number, currency: Currency = "inr"): Money {
  assertSafeInteger(amountInPaise, "amount");
  if (amountInPaise < 0) {
    throw new MoneyError("amount must not be negative; use refunds for reversals");
  }
  return Object.freeze({ amount: amountInPaise, currency });
}

/** Build Money from a rupee value (string or number), rounding to the nearest paise. */
export function moneyFromRupees(rupees: number | string, currency: Currency = "inr"): Money {
  const value = typeof rupees === "string" ? Number(rupees) : rupees;
  if (!Number.isFinite(value)) {
    throw new MoneyError(`invalid rupee amount: ${String(rupees)}`);
  }
  return money(Math.round(value * MINOR_UNITS[currency]), currency);
}

/** Exact sum, so cart and order totals never drift through repeated float addition. */
export function sumMoney(items: readonly Money[], currency: Currency = "inr"): Money {
  const total = items.reduce((acc, item) => {
    if (item.currency !== currency) {
      throw new MoneyError(`cannot sum ${item.currency} and ${currency}`);
    }
    return acc + item.amount;
  }, 0);
  return money(total, currency);
}

/**
 * Format for display: `₹38,990` and `₹1,24,500` (Indian grouping).
 * Paise are shown only when non-zero, matching the approved designs.
 */
export function formatINR(value: Money): string {
  const rupees = Math.trunc(value.amount / MINOR_UNITS.inr);
  const paise = value.amount % MINOR_UNITS.inr;
  const grouped = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: paise === 0 ? 0 : 2,
    maximumFractionDigits: paise === 0 ? 0 : 2,
  }).format(rupees + paise / MINOR_UNITS.inr);
  return `₹${grouped}`;
}

/** Plain number of rupees for JSON-free contexts such as analytics payloads. */
export function toRupees(value: Money): number {
  return value.amount / MINOR_UNITS.inr;
}
