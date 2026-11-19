/**
 * ADR-01 / ADR-02: Indian PIN code intelligence.
 *
 * India Post's public directory is the authority for whether a PIN exists and which district and
 * state it belongs to. It is only ever called from the server, so the browser CSP stays closed
 * and a slow lookup never blocks rendering. Next's data cache keeps the answer for 30 days —
 * PIN boundaries and district names do not move often.
 *
 * A network failure is reported as `unavailable`, not `not_found`: checkout must not reject a
 * real customer because a public API is down.
 */

export type PincodeResult =
  | { status: "found"; city: string; state: string }
  | { status: "not_found" }
  | { status: "unavailable" };

interface IndiaPostOffice {
  Name?: string | null;
  Block?: string | null;
  District?: string | null;
  State?: string | null;
}

interface IndiaPostResponse {
  Status?: string;
  PostOffice?: IndiaPostOffice[] | null;
}

const LOOKUP_URL = "https://api.postalpincode.in/pincode";

export async function lookupPincode(pin: string): Promise<PincodeResult> {
  if (!/^\d{6}$/.test(pin)) return { status: "not_found" };

  let response: Response;
  try {
    response = await fetch(`${LOOKUP_URL}/${pin}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
  } catch {
    return { status: "unavailable" };
  }
  if (!response.ok) return { status: "unavailable" };

  try {
    const body = (await response.json()) as IndiaPostResponse[];
    const entry = Array.isArray(body) ? body[0] : undefined;
    const offices = entry?.PostOffice ?? [];
    // Prefer an office with a district: that is the city customers recognise on an address.
    const office = offices.find((candidate) => candidate.District) ?? offices[0];
    if (entry?.Status !== "Success" || !office) return { status: "not_found" };

    const city = (office.District || office.Block || office.Name || "").trim();
    const state = (office.State || "").trim();
    if (!city || !state) return { status: "not_found" };

    return { status: "found", city, state };
  } catch {
    return { status: "unavailable" };
  }
}
