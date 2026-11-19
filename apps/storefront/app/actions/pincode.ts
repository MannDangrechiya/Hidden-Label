"use server";

import { lookupPincode } from "@/lib/pincode";

export type PincodeLookupResult =
  | { ok: true; city: string; state: string }
  | { ok: false; message: string };

/**
 * ADR-01: called by the address and checkout forms once six digits are typed. The postal
 * directory decides the city and state, so a customer can no longer pair PIN 110001 with
 * "Mumbai, Gujarat".
 */
export async function lookupPincodeAction(pin: string): Promise<PincodeLookupResult> {
  if (!/^\d{6}$/.test(pin)) return { ok: false, message: "Enter a 6-digit PIN code." };

  const result = await lookupPincode(pin);
  if (result.status === "found") return { ok: true, city: result.city, state: result.state };
  if (result.status === "not_found") return { ok: false, message: "Invalid PIN code" };

  return {
    ok: false,
    message: "PIN lookup is unavailable right now — enter city and state manually.",
  };
}
