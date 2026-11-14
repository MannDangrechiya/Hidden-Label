import { cookies } from "next/headers";

/**
 * The customer session is a Medusa JWT, stored httpOnly exactly like the cart id
 * (docs/API_PLAN.md §1: "session cookie ... never a token in localStorage"). The browser never
 * reads this value — every authenticated call is a server action or a Server Component that
 * reads the cookie and forwards it as an `Authorization: Bearer` header.
 */
export const AUTH_COOKIE = "thl_auth";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function readAuthToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value ?? null;
}

export async function writeAuthToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearAuthToken(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}
