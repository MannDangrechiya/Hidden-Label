"use server";

import { revalidatePath } from "next/cache";
import { updateAdminInspection } from "../../../lib/api/resale";

export async function updateInspectionStatusAction(id: string, status: "approved" | "rejected") {
  try {
    await updateAdminInspection(id, { status });
    revalidatePath("/inspections");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update inspection" };
  }
}
