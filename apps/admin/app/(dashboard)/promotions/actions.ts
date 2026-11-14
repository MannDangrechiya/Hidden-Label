"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  type PromotionInput,
} from "../../../lib/api/promotions";
import { BackendError } from "../../../lib/backend";

export interface PromotionFormState {
  error?: string;
}

function readInput(formData: FormData): PromotionInput {
  const amountType = String(formData.get("amount_type") ?? "percentage") as "fixed" | "percentage";
  const value = Number(formData.get("value"));
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    is_automatic: formData.get("is_automatic") === "on",
    type: "standard",
    status: (String(formData.get("status") ?? "active") as "draft" | "active" | "inactive"),
    application_method: {
      type: amountType,
      target_type: "order",
      value,
      currency_code: amountType === "fixed" ? "inr" : undefined,
    },
    usage_limit: formData.get("usage_limit") ? Number(formData.get("usage_limit")) : null,
  };
}

export async function createPromotionAction(
  _prev: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  const input = readInput(formData);
  if (!input.code) return { error: "A code is required." };
  if (!Number.isFinite(input.application_method.value) || input.application_method.value <= 0) {
    return { error: "A positive discount value is required." };
  }

  let id: string;
  try {
    const promotion = await createPromotion(input);
    id = promotion.id;
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not create the promotion." };
  }
  revalidatePath("/promotions");
  redirect(`/promotions/${id}`);
}

export async function updatePromotionAction(
  _prev: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  const id = String(formData.get("id") ?? "");
  const input = readInput(formData);

  try {
    await updatePromotion(id, input);
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not update the promotion." };
  }
  revalidatePath(`/promotions/${id}`);
  revalidatePath("/promotions");
  return {};
}

export async function deletePromotionAction(id: string): Promise<void> {
  await deletePromotion(id);
  revalidatePath("/promotions");
}
