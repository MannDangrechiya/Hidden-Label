import "server-only";
import { redirect } from "next/navigation";
import { getSessionToken } from "./session";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:9000";

export class BackendError extends Error {
  override name = "BackendError";
  readonly status: number;
  readonly code: string | undefined;
  readonly fields: Record<string, unknown> | undefined;

  constructor(message: string, status: number, code?: string, fields?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RequestInit {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Pass an explicit token (e.g. during login, before the cookie exists). */
  token?: string | null;
  /** Skip the session cookie lookup entirely (unauthenticated calls, e.g. login itself). */
  anonymous?: boolean;
}

/**
 * Server-side fetch against the Medusa backend. Never called from a Client Component — the
 * admin JWT never reaches the browser. No mock or fallback data: an unreachable backend or a
 * non-2xx response always raises `BackendError`, which callers render as a retryable error
 * state (docs/DESIGN_TOKENS.md §6).
 */
export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = init?.anonymous ? null : (init?.token ?? (await getSessionToken()));

  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (init?.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new BackendError(
      `Cannot reach the backend at ${BACKEND_URL}. Is it running? (${
        error instanceof Error ? error.message : String(error)
      })`,
      0,
    );
  }

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const body = (json ?? {}) as { message?: string; code?: string; fields?: Record<string, unknown> };
    throw new BackendError(
      body.message ?? `The backend returned ${response.status} for ${path}.`,
      response.status,
      body.code,
      body.fields,
    );
  }

  return json as T;
}

/**
 * Guard for Server Components / layouts that require a logged-in admin. Redirects to /login
 * when there is no session cookie. This is a UX convenience only — the real authorization check
 * happens on every backend route (see apps/backend/src/lib/admin-auth.ts).
 */
export async function requireSessionToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  return token;
}

/** True when the error means "no/expired session" — callers use this to bounce to /login. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof BackendError && error.status === 401;
}
