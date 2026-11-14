"use server";

import { revalidatePath } from "next/cache";
import { adjustInventory, type AdjustReason } from "../../../lib/api/inventory";
import { BackendError } from "../../../lib/backend";

export interface AdjustFormState {
  error?: string;
  success?: boolean;
}

export async function adjustInventoryAction(
  _prev: AdjustFormState,
  formData: FormData,
): Promise<AdjustFormState> {
  const inventory_item_id = String(formData.get("inventory_item_id") ?? "");
  const location_id = String(formData.get("location_id") ?? "");
  const delta = Number(formData.get("delta"));
  const reason = String(formData.get("reason") ?? "") as AdjustReason;

  if (!inventory_item_id || !location_id || !Number.isInteger(delta) || delta === 0 || !reason) {
    return { error: "A non-zero whole-number delta and a reason are required." };
  }

  try {
    await adjustInventory({ inventory_item_id, location_id, delta, reason });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not adjust stock." };
  }
  revalidatePath("/inventory");
  return { success: true };
}
