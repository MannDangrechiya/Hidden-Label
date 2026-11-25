import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { actorId } from "./auth";

export type AdminRole = "owner" | "manager" | "operations" | "support" | "readonly";

export const ADMIN_ROLES: readonly AdminRole[] = [
  "owner",
  "manager",
  "operations",
  "support",
  "readonly",
] as const;

const RANK: Record<AdminRole, number> = {
  readonly: 1,
  support: 2,
  operations: 3,
  manager: 4,
  owner: 5,
};

export interface AdminActor {
  id: string;
  email: string | null;
  role: AdminRole;
}

/**
 * SEC-01: a staff user's role is only ever what `user.metadata.role` explicitly says.
 *
 * There is deliberately no default. A missing, empty, misspelled or unexpected role is `null`
 * — never `owner` and never `readonly` (readonly still reads operational records). The caller
 * must deny the request. The owner account is created with an explicit role by the bootstrap
 * script (`src/scripts/seed.ts` / `pnpm db:roles:audit` reports any user still lacking one).
 */
export function parseAdminRole(raw: unknown): AdminRole | null {
  if (typeof raw !== "string") return null;
  return (ADMIN_ROLES as readonly string[]).includes(raw) ? (raw as AdminRole) : null;
}

export function meetsRole(role: AdminRole, minimum: AdminRole): boolean {
  return RANK[role] >= RANK[minimum];
}

export function canWrite(role: AdminRole): boolean {
  return role !== "readonly";
}

export type AdminAccess =
  | { allowed: true; actor: AdminActor }
  | { allowed: false; status: 401 | 403; code: string; message: string };

/**
 * Resolve the authenticated admin and their explicit role.
 *
 * Returns `null` when there is no authenticated user **or** when the user has no valid role.
 * Use `adminAccess()` when you need to distinguish "not signed in" (401) from "signed in but
 * not authorised" (403).
 */
export async function resolveAdmin(req: MedusaRequest): Promise<AdminActor | null> {
  const userId = actorId(req);
  if (!userId) return null;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const user = await pg("user").select("id", "email", "metadata").where({ id: userId }).first();
  if (!user) return null;

  const metadata = (user.metadata ?? {}) as Record<string, unknown>;
  const role = parseAdminRole(metadata.role);
  if (!role) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    role,
  };
}

/** Same lookup as `resolveAdmin`, but every outcome is an explicit decision. */
export async function adminAccess(req: MedusaRequest): Promise<AdminAccess> {
  const userId = actorId(req);
  if (!userId) {
    return {
      allowed: false,
      status: 401,
      code: "unauthorized",
      message: "Admin authentication required.",
    };
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const user = await pg("user").select("id", "email", "metadata").where({ id: userId }).first();
  if (!user) {
    return {
      allowed: false,
      status: 401,
      code: "unauthorized",
      message: "Admin authentication required.",
    };
  }

  const metadata = (user.metadata ?? {}) as Record<string, unknown>;
  const role = parseAdminRole(metadata.role);
  if (!role) {
    return {
      allowed: false,
      status: 403,
      code: "no_role_assigned",
      message:
        "This staff account has no role assigned. An owner must assign an explicit role before access is granted.",
    };
  }

  return { allowed: true, actor: { id: user.id, email: user.email ?? null, role } };
}

export async function requireRole(
  req: MedusaRequest,
  res: MedusaResponse,
  minimum: AdminRole,
): Promise<AdminActor | null> {
  const access = await adminAccess(req);
  if (!access.allowed) {
    res.status(access.status).json({ type: access.code, code: access.code, message: access.message });
    return null;
  }
  if (!meetsRole(access.actor.role, minimum)) {
    res.status(403).json({
      type: "forbidden",
      message: `This action requires the ${minimum} role.`,
    });
    return null;
  }
  return access.actor;
}

const SELF_IDENTITY_PATH = /\/users\/me\/?$/;
const PRIVILEGED_METADATA_KEYS = ["role", "roles", "permissions", "is_owner", "owner", "is_admin"];

export interface AdminRequestDecisionInput {
  role: AdminRole;
  actorId: string;
  method: string;
  path: string;
  body?: Record<string, unknown> | null;
}

export type AdminRequestDecision =
  | { allow: true; stripPrivilegedMetadata: boolean }
  | { allow: false; status: 403; message: string };

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

/**
 * Pure RBAC decision for `/admin/*`, shared by the middleware and its regression tests.
 *
 * GAP-SEC-01: the `/admin/users/me` exemption is read-only. Medusa core exposes
 * `POST /admin/users/me` which accepts metadata updates, so a restricted staff member could
 * otherwise POST `{"metadata":{"role":"owner"}}` and become an owner. Non-GET requests that
 * carry a privileged key are refused, and any such key is stripped before the handler runs.
 */
export function decideAdminRequest(input: AdminRequestDecisionInput): AdminRequestDecision {
  const { role, actorId: actor, method, path } = input;

  if (SELF_IDENTITY_PATH.test(path)) {
    if (isReadMethod(method)) return { allow: true, stripPrivilegedMetadata: false };

    const body = input.body ?? {};
    const metadata = (body.metadata ?? {}) as Record<string, unknown>;
    const attempted = PRIVILEGED_METADATA_KEYS.filter((key) => key in metadata || key in body);
    if (attempted.length > 0) {
      return {
        allow: false,
        status: 403,
        message: "Roles and privileged metadata cannot be changed through your own profile.",
      };
    }
    return { allow: true, stripPrivilegedMetadata: true };
  }

  if (path.includes("/users") || path.includes("/invites")) {
    if (role !== "manager" && role !== "owner") {
      return {
        allow: false,
        status: 403,
        message: "User management requires at least manager role.",
      };
    }

    const body = input.body ?? {};
    const bodyMetadata = (body.metadata ?? {}) as Record<string, unknown>;
    if (bodyMetadata.role || body.role) {
      if (role !== "owner") {
        return { allow: false, status: 403, message: "Only owner can modify roles." };
      }

      const segments = path.split("/").filter(Boolean);
      const targetId = segments[2];
      if (targetId && targetId === actor) {
        return {
          allow: false,
          status: 403,
          message: "Self-role escalation is not permitted.",
        };
      }
    }

    if (!isReadMethod(method) && !canWrite(role)) {
      return {
        allow: false,
        status: 403,
        message: "Readonly role cannot perform write actions.",
      };
    }

    return { allow: true, stripPrivilegedMetadata: false };
  }

  // D3: readonly is read-only, not blind. GET/HEAD/OPTIONS on the operational read paths
  // (orders, products, inventory, customers, returns, payments, reports, audit, …) may pass;
  // every write stays 403. Staff management is still gate-kept to manager+ above, and the
  // self-profile POST above still refuses privileged metadata.
  if (role === "readonly") {
    if (isReadMethod(method)) {
      return { allow: true, stripPrivilegedMetadata: false };
    }
    return {
      allow: false,
      status: 403,
      message: "Readonly role cannot perform write actions.",
    };
  }

  if (!isReadMethod(method) && !canWrite(role)) {
    return {
      allow: false,
      status: 403,
      message: "Write operations not permitted for this role.",
    };
  }

  return { allow: true, stripPrivilegedMetadata: false };
}

/** Removes privileged metadata keys from a request body that passed the self-identity check. */
export function stripPrivilegedMetadata(body: Record<string, unknown> | undefined): void {
  if (!body || typeof body !== "object") return;
  const metadata = (body.metadata ?? {}) as Record<string, unknown>;
  for (const key of PRIVILEGED_METADATA_KEYS) delete metadata[key];
  delete body.roles;
  delete body.role;
}
