import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { actorId } from "./auth";

export type AdminRole = "owner" | "manager" | "operations" | "support" | "readonly";

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
 * Resolve the authenticated admin user and their role.
 *
 * Roles are stored on `user.metadata.role` (set by the seed/bootstrap script). The check runs
 * server-side on every admin route — the admin UI hiding a button is never the control.
 */
export async function resolveAdmin(req: MedusaRequest): Promise<AdminActor | null> {
  const userId = actorId(req);
  if (!userId) return null;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const user = await pg("user").select("id", "email", "metadata").where({ id: userId }).first();
  if (!user) return null;

  const metadata = (user.metadata ?? {}) as Record<string, unknown>;
  const role = typeof metadata.role === "string" ? (metadata.role as AdminRole) : "owner";
  return {
    id: user.id,
    email: user.email ?? null,
    role: role in RANK ? role : "readonly",
  };
}

export async function requireRole(
  req: MedusaRequest,
  res: MedusaResponse,
  minimum: AdminRole,
): Promise<AdminActor | null> {
  const actor = await resolveAdmin(req);
  if (!actor) {
    res.status(401).json({ type: "unauthorized", message: "Admin authentication required." });
    return null;
  }
  if (RANK[actor.role] < RANK[minimum]) {
    res.status(403).json({
      type: "forbidden",
      message: `This action requires the ${minimum} role.`,
    });
    return null;
  }
  return actor;
}

export function canWrite(role: AdminRole): boolean {
  return role !== "readonly";
}
