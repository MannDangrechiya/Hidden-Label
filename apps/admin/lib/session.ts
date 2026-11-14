import "server-only";
import { cookies } from "next/headers";

/**
 * The admin app's own httpOnly session cookie. It stores the Medusa admin JWT (obtained from
 * `POST /auth/user/emailpass`) so the browser never sees it and nothing admin-related lives in
 * localStorage. Every backend call is made server-side (Server Components, Server Actions, Route
 * Handlers) with this token forwarded as `Authorization: Bearer <token>` — see lib/backend.ts.
 *
 * This cookie is a convenience for routing (so the UI can redirect to /login); it is never the
 * authorization boundary. Every `/admin/*` route on the backend re-checks the token and the
 * actor's role itself (apps/backend/src/lib/admin-auth.ts) — see docs/API_PLAN.md and
 * agent/RULES.md "Hiding a button is not authorisation."
 */
const COOKIE_NAME = process.env.ADMIN_SESSION_COOKIE ?? "thl_admin_token";

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setSessionToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Admin JWTs are short-lived (Medusa default ~24h); the cookie should not outlive it.
    maxAge: 60 * 60 * 24,
  });
}

export async function clearSessionToken(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
