"use server";

import { revalidatePath } from "next/cache";
import { updateSupportTicket } from "../../../lib/api/support";
import { BackendError } from "../../../lib/backend";

export async function updateSupportTicketAction(
  id: string,
  patch: { status?: string; priority?: string; resolution?: string },
) {
  try {
    await updateSupportTicket(id, patch);
    revalidatePath("/support");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof BackendError ? error.message : "Could not update support ticket.",
    };
  }
}
