import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = process.env.ADMIN_SESSION_COOKIE ?? "thl_admin_token";
const PUBLIC_PATHS = ["/login"];

/**
 * Redirects to /login when there is no session cookie. This is a UX convenience only — the
 * actual authorization boundary is server-side on every `/admin/*` backend route
 * (apps/backend/src/lib/admin-auth.ts). A missing or forged cookie here never grants access to
 * anything; it only decides whether this app shows a login form or a page that will itself fail
 * closed against the backend.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
