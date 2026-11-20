import "server-only";
import { backendFetch, BackendError } from "../backend";
import { resolveAdminRole, ROLE_RANK, roleAtLeast, type AdminRole } from "../roles";

export interface AdminActor {
  id: string;
  email: string | null;
  metadata: Record<string, unknown> | null;
}

export type { AdminRole };
export { ROLE_RANK, roleAtLeast, resolveAdminRole };

/**
 * SEC-01: thrown when the authenticated staff account has no explicit, valid role. Callers must
 * render an access-denied state. It deliberately does **not** fall back to `owner`.
 */
export class NoRoleAssignedError extends BackendError {
  constructor() {
    super(
      "This staff account has no role assigned. Ask an owner to assign one (owner, manager, operations, support or readonly).",
      403,
      "no_role_assigned",
    );
    this.name = "NoRoleAssignedError";
  }
}

export function isNoRoleAssigned(error: unknown): boolean {
  return (
    error instanceof NoRoleAssignedError ||
    (error instanceof BackendError && error.code === "no_role_assigned")
  );
}

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
  let payload: { user: AdminActor };
  try {
    payload = await backendFetch<{ user: AdminActor }>(
      "/admin/users/me?fields=id,email,metadata",
    );
  } catch (error) {
    // The backend answers 403 no_role_assigned for a signed-in staff user without a role.
    // Translate that into the typed denial so callers render an access-denied state.
    if (error instanceof BackendError && (error.code === "no_role_assigned" || error.status === 403)) {
      throw new NoRoleAssignedError();
    }
    throw error;
  }

  const role = resolveAdminRole(payload.user.metadata?.role);
  if (!role) throw new NoRoleAssignedError();

  return { user: payload.user, role };
}
