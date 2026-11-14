"use client";

import { useActionState } from "react";
import { Button, Input, Select, StatusChip, Table } from "@thl/ui";
import type { AdminUserRow, Invite } from "../../../lib/api/users";
import type { AdminRole } from "../../../lib/roles";
import {
  deleteAdminUserAction,
  inviteUserAction,
  revokeInviteAction,
  setUserRoleAction,
  type SettingsFormState,
} from "./actions";

const EMPTY_STATE: SettingsFormState = {};
const ROLES: AdminRole[] = ["readonly", "support", "operations", "manager", "owner"];

function RoleForm({ user }: { user: AdminUserRow }) {
  const [state, formAction, pending] = useActionState(setUserRoleAction, EMPTY_STATE);
  const currentRole = (user.metadata?.role as AdminRole | undefined) ?? "owner";

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={user.id} />
      <Select label="" aria-label="Role" name="role" defaultValue={currentRole} className="w-36">
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" loading={pending}>
        Save
      </Button>
      {state.error ? <span className="font-sans text-body-sm text-error">{state.error}</span> : null}
    </form>
  );
}

function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUserAction, EMPTY_STATE);
  return (
    <form action={formAction} className="flex items-end gap-3">
      <Input label="Invite by email" name="email" type="email" required />
      <Button type="submit" loading={pending}>
        Send invite
      </Button>
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      {state.success ? <p className="font-sans text-body-sm text-on-surface">Sent.</p> : null}
    </form>
  );
}

export function UserManager({
  users,
  invites,
  currentUserId,
  canManage,
}: {
  users: AdminUserRow[];
  invites: Invite[];
  currentUserId: string;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      {canManage ? <InviteForm /> : null}

      <div>
        <h2 className="mb-3 font-display text-headline-sm">Admin users</h2>
        <Table
          columns={[
            { key: "email", header: "Email", sticky: true, render: (u) => u.email },
            {
              key: "role",
              header: "Role",
              render: (u) => (canManage && u.id !== currentUserId ? <RoleForm user={u} /> : String(u.metadata?.role ?? "owner")),
            },
            {
              key: "actions",
              header: "",
              render: (u) =>
                canManage && u.id !== currentUserId ? (
                  <button
                    type="button"
                    className="font-mono text-label-caps uppercase text-error underline"
                    onClick={() => {
                      if (confirm(`Remove ${u.email}?`)) void deleteAdminUserAction(u.id);
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <StatusChip tone="neutral">You</StatusChip>
                ),
            },
          ]}
          rows={users}
          rowKey={(u) => u.id}
        />
      </div>

      <div>
        <h2 className="mb-3 font-display text-headline-sm">Pending invites</h2>
        {invites.filter((i) => !i.accepted).length === 0 ? (
          <p className="font-sans text-body-sm text-muted">No pending invites.</p>
        ) : (
          <Table
            columns={[
              { key: "email", header: "Email", sticky: true, render: (i) => i.email },
              { key: "expires", header: "Expires", render: (i) => new Date(i.expires_at).toLocaleDateString("en-IN") },
              {
                key: "actions",
                header: "",
                render: (i) =>
                  canManage ? (
                    <button
                      type="button"
                      className="font-mono text-label-caps uppercase text-error underline"
                      onClick={() => void revokeInviteAction(i.id)}
                    >
                      Revoke
                    </button>
                  ) : null,
              },
            ]}
            rows={invites.filter((i) => !i.accepted)}
            rowKey={(i) => i.id}
          />
        )}
      </div>
    </div>
  );
}
