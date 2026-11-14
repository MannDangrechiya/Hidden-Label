import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * OTP codes are hashed at rest with a server-side secret. Codes are 6 digits, expire in five
 * minutes and allow five attempts — the values from docs/INTEGRATIONS.md §4.
 */
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
export const OTP_MAX_SENDS = 3;

function secret(): string {
  return process.env.OTP_SECRET ?? process.env.MEDUSA_JWT_SECRET ?? "local_dev_otp_secret";
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(destination: string, code: string): string {
  return createHmac("sha256", secret()).update(`${destination.toLowerCase()}:${code}`).digest("hex");
}

export function codeMatches(destination: string, code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashCode(destination, code));
  const stored = Buffer.from(storedHash);
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/** Stable, non-reversible reference used in logs — never the destination itself. */
export function destinationRef(destination: string): string {
  return createHash("sha256").update(destination.toLowerCase()).digest("hex").slice(0, 12);
}
