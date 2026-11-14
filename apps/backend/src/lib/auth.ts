import type { MedusaRequest } from "@medusajs/framework/http";

export interface AuthContext {
  actor_id?: string;
  actor_type?: string;
  auth_identity_id?: string;
}

/**
 * The auth middleware augments the request at runtime, but the base MedusaRequest type does not
 * declare `auth_context`. This is the one typed access point.
 */
export function authContext(req: MedusaRequest): AuthContext | undefined {
  return (req as unknown as { auth_context?: AuthContext }).auth_context;
}

export function actorId(req: MedusaRequest): string | undefined {
  return authContext(req)?.actor_id;
}
