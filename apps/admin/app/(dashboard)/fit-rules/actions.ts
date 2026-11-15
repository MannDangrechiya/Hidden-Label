"use server";

import { revalidatePath } from "next/cache";
import { createAdminFitRule, deleteAdminFitRule } from "../../../lib/api/resale";
import { BackendError } from "../../../lib/backend";

export interface FitRuleFormState {
  error?: string;
  success?: boolean;
}

export async function createFitRuleAction(
  _prev: FitRuleFormState,
  formData: FormData,
): Promise<FitRuleFormState> {
  const silhouette_name = String(formData.get("silhouette_name") ?? "").trim();
  const guidance_text = String(formData.get("guidance_text") ?? "").trim();
  const fit_tendency = String(formData.get("fit_tendency") ?? "true_to_size").trim();
  const width_profile = String(formData.get("width_profile") ?? "regular").trim();
  const sizeDeltaRaw = formData.get("recommended_size_delta");
  const recommended_size_delta = sizeDeltaRaw ? Number(sizeDeltaRaw) : 0;

  if (!silhouette_name || !guidance_text) {
    return { error: "Silhouette name and guidance text are required." };
  }

  try {
    await createAdminFitRule({
      silhouette_name,
      guidance_text,
      fit_tendency,
      width_profile,
      recommended_size_delta,
    });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not create fit rule." };
  }

  revalidatePath("/fit-rules");
  return { success: true };
}

export async function deleteFitRuleAction(id: string): Promise<void> {
  await deleteAdminFitRule(id);
  revalidatePath("/fit-rules");
}
