/**
 * Exact money arithmetic for the backend.
 *
 * R-06: `return_request.refund_amount` is `numeric(12,2)`, and Medusa hands money columns back
 * to us as numeric *strings* ("21999.00"). Converting those to `number` and multiplying by a
 * quantity mixes binary floating point into a currency calculation (0.1 + 0.2 !== 0.3), so a
 * refund can be a paise off after rounding, or drift once several lines are summed.
 *
 * Every amount is therefore parsed into an integer count of paise straight from its decimal
 * representation, all arithmetic is integer arithmetic, and only the persistence/transport edge
 * converts back to a 2-decimal string. No `parseFloat`, no `toFixed` on a computed float.
 *
 * `packages/shared/src/money.ts` states the same convention for the storefront; the backend
 * keeps its own copy because it compiles as CommonJS and must not import that ESM-only package.
 */

export class MoneyParseError extends Error {
  override name = "MoneyParseError";
}

/** A plain decimal with at most two fractional digits — what `numeric(12,2)` can hold. */
const DECIMAL_AMOUNT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

function assertSafe(paise: number, source: unknown): number {
  if (!Number.isSafeInteger(paise)) {
    throw new MoneyParseError(`amount is out of the safe integer range: ${String(source)}`);
  }
  return paise;
}

/**
 * Parse a rupee amount (numeric string or number) into integer paise.
 *
 * Strings are parsed digit by digit, so "0.07" is exactly 7 paise. Numbers are only accepted
 * when they are exactly representable as paise; a value such as `1.005` is rejected rather than
 * silently rounded, because it never came from a `numeric(12,2)` column.
 *
 * @throws {MoneyParseError} when the value is not a finite amount with at most 2 decimals.
 */
export function toPaise(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new MoneyParseError(`invalid amount: ${String(value)}`);
    }
    const paise = Math.round(value * 100);
    if (Math.abs(paise / 100 - value) > 1e-9) {
      throw new MoneyParseError(`amount has more than 2 decimal places: ${String(value)}`);
    }
    return assertSafe(paise, value);
  }

  const raw = value.trim();
  const match = DECIMAL_AMOUNT.exec(raw);
  if (!match) {
    throw new MoneyParseError(`invalid amount: ${JSON.stringify(value)}`);
  }

  const negative = match[1] === "-";
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? "").padEnd(2, "0"));
  const paise = whole * 100 + fraction;

  return assertSafe(negative ? -paise : paise, value);
}

/** Format integer paise as the 2-decimal string a `numeric(12,2)` column expects. */
export function formatPaise(paise: number): string {
  assertSafe(paise, paise);
  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const rupees = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  return `${negative ? "-" : ""}${rupees}.${String(fraction).padStart(2, "0")}`;
}

/**
 * Boundary conversion for APIs that take a rupee `number` (Medusa's payment workflows do).
 * Exact for every safe-integer paise amount, and the only place a float is produced.
 */
export function toRupeesNumber(paise: number): number {
  assertSafe(paise, paise);
  return paise / 100;
}

/** `true` when the value can be represented exactly, used to reject bad input with a 400. */
export function isAmountRepresentable(value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  try {
    toPaise(value);
    return true;
  } catch {
    return false;
  }
}
