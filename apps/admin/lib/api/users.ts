import "server-only";
import { backendFetch } from "../backend";
import type { AdminRole } from "./auth";

export interface AdminUserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Invite {
  id: string;
  email: string;
  accepted: boolean;
  expires_at: string;
  created_at: string;
}

/** GET /admin/users — native Medusa resource. A-16 surfaces whatever admin-auth.ts supports:
 * an admin `user` row plus a `role` kept in `metadata.role` (apps/backend/src/lib/admin-auth.ts).
 * There is no separate permissions-matrix table in this backend — this screen does not invent one.
 */
export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { users } = await backendFetch<{ users: AdminUserRow[] }>(
    "/admin/users?limit=200&fields=id,email,first_name,last_name,metadata,created_at",
  );
  return users;
}

export async function fetchInvites(): Promise<Invite[]> {
  const { invites } = await backendFetch<{ invites: Invite[] }>("/admin/invites?limit=200");
  return invites;
}

export async function inviteAdminUser(email: string): Promise<Invite> {
  const { invite } = await backendFetch<{ invite: Invite }>("/admin/invites", {
    method: "POST",
    body: { email },
  });
  return invite;
}

export async function revokeInvite(id: string): Promise<void> {
  await backendFetch(`/admin/invites/${id}`, { method: "DELETE" });
}

export async function setUserRole(id: string, role: AdminRole, existingMetadata: Record<string, unknown> | null): Promise<AdminUserRow> {
  const { user } = await backendFetch<{ user: AdminUserRow }>(`/admin/users/${id}`, {
    method: "POST",
    body: { metadata: { ...(existingMetadata ?? {}), role } },
  });
  return user;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await backendFetch(`/admin/users/${id}`, { method: "DELETE" });
}
