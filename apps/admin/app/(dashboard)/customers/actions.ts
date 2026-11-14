"use server";

import { revalidatePath } from "next/cache";
import { backendFetch, BackendError } from "../../../lib/backend";
import { fetchCustomer, type CustomerDetail } from "../../../lib/api/customers";

export interface CustomerNotesState {
  error?: string;
  success?: boolean;
}

/**
 * Tier and notes are kept on the native customer `metadata` bag — there is no bespoke tier/notes
 * column or custom module for it, and A-09 only calls for "notes, tier" on the standard
 * `PATCH :id` route. Medusa's update replaces the whole `metadata` object rather than merging
 * it, so the existing value is read first and merged client-side here.
 */
export async function updateCustomerNotesAction(
  _prev: CustomerNotesState,
  formData: FormData,
): Promise<CustomerNotesState> {
  const id = String(formData.get("id") ?? "");
  const tier = String(formData.get("tier") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  try {
    const existing = await fetchCustomer(id);
    const metadata = { ...(existing.metadata ?? {}), tier: tier || undefined, notes: notes || undefined };
    await backendFetch<{ customer: CustomerDetail }>(`/admin/customers/${id}`, {
      method: "POST",
      body: { metadata },
    });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not save." };
  }
  revalidatePath(`/customers/${id}`);
  return { success: true };
}
