import "server-only";
import { backendFetch, BackendError } from "../backend";
import { ROLE_RANK, roleAtLeast, type AdminRole } from "../roles";

export interface AdminActor {
  id: string;
  email: string | null;
  metadata: Record<string, unknown> | null;
}

export type { AdminRole };
export { ROLE_RANK, roleAtLeast };

/**
 * POST /auth/user/emailpass — Medusa's standard admin credential exchange. Returns a signed
 * JWT; this app stores it in its own httpOnly cookie (lib/session.ts) rather than a Medusa
 * session cookie, because the admin app and the backend are different origins/ports
 * (docs/PROJECT_PLAN.md §4: admin is a separate app with a separate auth boundary).
 */
export async function loginWithPassword(email: string, password: string): Promise<string> {
  const result = await backendFetch<{ token?: string }>("/auth/user/emailpass", {
    method: "POST",
    body: { email, password },
    anonymous: true,
  }).catch((error: unknown) => {
    if (error instanceof BackendError && (error.status === 401 || error.status === 400)) {
      throw new BackendError("Incorrect email or password.", 401);
    }
    throw error;
  });

  if (!result.token) {
    throw new BackendError("The backend did not return a session token.", 500);
  }
  return result.token;
}

/** GET /admin/users/me — current admin identity, including `metadata.role`. */
export async function fetchCurrentAdmin(): Promise<{ user: AdminActor; role: AdminRole }> {
  const { user } = await backendFetch<{ user: AdminActor }>(
    "/admin/users/me?fields=id,email,metadata",
  );
  const rawRole = user.metadata?.role;
  const role: AdminRole =
    typeof rawRole === "string" &&
    ["owner", "manager", "operations", "support", "readonly"].includes(rawRole)
      ? (rawRole as AdminRole)
      : "owner";
  return { user, role };
}
