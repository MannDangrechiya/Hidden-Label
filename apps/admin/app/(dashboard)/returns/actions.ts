"use server";

import { revalidatePath } from "next/cache";
import { actOnReturn, type ReturnAction } from "../../../lib/api/returns";
import { BackendError } from "../../../lib/backend";

export interface ReturnActionState {
  error?: string;
  success?: boolean;
}

export async function actOnReturnAction(
  _prev: ReturnActionState,
  formData: FormData,
): Promise<ReturnActionState> {
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "") as ReturnAction;
  const note = String(formData.get("note") ?? "").trim() || undefined;

  try {
    await actOnReturn(id, action, note);
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : `Could not ${action} this return.` };
  }
  revalidatePath(`/returns/${id}`);
  revalidatePath("/returns");
  return { success: true };
}
