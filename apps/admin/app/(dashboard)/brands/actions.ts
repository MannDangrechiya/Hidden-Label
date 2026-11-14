"use server";

import { revalidatePath } from "next/cache";
import { createBrand, updateBrand, deleteBrand, type BrandInput } from "../../../lib/api/brands";
import { BackendError } from "../../../lib/backend";

export interface BrandFormState {
  error?: string;
  success?: boolean;
}

function readInput(formData: FormData): BrandInput {
  const sortOrderRaw = formData.get("sort_order");
  return {
    handle: String(formData.get("handle") ?? "").trim() || undefined,
    name: String(formData.get("name") ?? "").trim() || undefined,
    tagline: String(formData.get("tagline") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim() || null,
    partnership_tier: String(formData.get("partnership_tier") ?? "").trim() || null,
    hero_url: String(formData.get("hero_url") ?? "").trim() || null,
    logo_url: String(formData.get("logo_url") ?? "").trim() || null,
    is_active: formData.get("is_active") === "on",
    sort_order: sortOrderRaw ? Number(sortOrderRaw) : undefined,
  };
}

export async function createBrandAction(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  try {
    await createBrand(readInput(formData));
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not create the brand." };
  }
  revalidatePath("/brands");
  return { success: true };
}

export async function updateBrandAction(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const id = String(formData.get("id") ?? "");
  try {
    await updateBrand(id, readInput(formData));
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not update the brand." };
  }
  revalidatePath("/brands");
  return { success: true };
}

export async function deleteBrandAction(id: string): Promise<void> {
  await deleteBrand(id);
  revalidatePath("/brands");
}
