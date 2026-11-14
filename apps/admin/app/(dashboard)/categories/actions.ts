"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryInput,
} from "../../../lib/api/categories";
import { BackendError } from "../../../lib/backend";

export interface CategoryFormState {
  error?: string;
  success?: boolean;
}

function readInput(formData: FormData): CategoryInput {
  const parent = String(formData.get("parent_category_id") ?? "");
  return {
    name: String(formData.get("name") ?? "").trim() || undefined,
    handle: String(formData.get("handle") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || null,
    is_active: formData.get("is_active") === "on",
    is_internal: formData.get("is_internal") === "on",
    parent_category_id: parent || null,
  };
}

export async function createCategoryAction(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  try {
    await createCategory(readInput(formData));
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not create the category." };
  }
  revalidatePath("/categories");
  return { success: true };
}

export async function updateCategoryAction(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const id = String(formData.get("id") ?? "");
  try {
    await updateCategory(id, readInput(formData));
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not update the category." };
  }
  revalidatePath("/categories");
  return { success: true };
}

export async function deleteCategoryAction(id: string): Promise<void> {
  await deleteCategory(id);
  revalidatePath("/categories");
}
