"use server";

import { revalidatePath } from "next/cache";
import {
  fetchAdminUsers,
  inviteAdminUser,
  revokeInvite,
  setUserRole,
  deleteAdminUser,
} from "../../../lib/api/users";
import type { AdminRole } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";

export interface SettingsFormState {
  error?: string;
  success?: boolean;
}

export async function inviteUserAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "An email is required." };

  try {
    await inviteAdminUser(email);
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not send the invite." };
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function revokeInviteAction(id: string): Promise<void> {
  await revokeInvite(id);
  revalidatePath("/settings");
}

export async function setUserRoleAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as AdminRole;

  try {
    const users = await fetchAdminUsers();
    const user = users.find((u) => u.id === id);
    await setUserRole(id, role, user?.metadata ?? null);
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not update the role." };
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteAdminUserAction(id: string): Promise<void> {
  await deleteAdminUser(id);
  revalidatePath("/settings");
}
