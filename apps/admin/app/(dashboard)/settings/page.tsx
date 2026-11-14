import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchAdminUsers, fetchInvites } from "../../../lib/api/users";
import { fetchCurrentAdmin } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";
import { UserManager } from "./user-manager";

export const metadata: Metadata = { title: "Settings" };

/**
 * A-16 — Settings & Governance. Surfaces exactly what apps/backend/src/lib/admin-auth.ts
 * supports: a native Medusa `user` plus a role kept in `metadata.role`. There is no separate
 * store-config or permissions-matrix screen here because the backend has no such module —
 * this does not invent a bigger RBAC system than the one that actually runs.
 */
export default async function SettingsPage() {
  let users;
  let invites;
  let actor;
  try {
    [users, invites, actor] = await Promise.all([fetchAdminUsers(), fetchInvites(), fetchCurrentAdmin()]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load settings.";
    return <ErrorState message={message} />;
  }

  const canManage = actor.role === "owner";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Settings &amp; governance</h1>
      {!canManage ? (
        <p className="font-sans text-body-sm text-muted">
          Only the owner role can invite, remove or change the role of admin users.
        </p>
      ) : null}
      <UserManager users={users} invites={invites} currentUserId={actor.user.id} canManage={canManage} />
    </div>
  );
}
