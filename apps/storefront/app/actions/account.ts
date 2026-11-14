"use server";

import { addressSchema, profileSchema } from "@thl/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readAuthToken } from "@/lib/auth-cookie";
import {
  addToWishlist,
  createAddress,
  deleteAddress,
  MedusaError,
  removeFromWishlist,
  updateAddress,
  updateMe,
} from "@/lib/medusa";
import type { ActionResult } from "@/app/actions/auth";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[String(issue.path[0])] = issue.message;
  return fields;
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const token = await readAuthToken();
  if (!token) redirect("/login");

  const parsed = profileSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fields: fieldErrors(parsed.error.issues) };
  }

  try {
    await updateMe(token, parsed.data);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not update your profile.",
    };
  }

  revalidatePath("/account");
  return { ok: true, message: "Profile updated." };
}

function addressPayload(formData: FormData) {
  return {
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone"),
    address_1: formData.get("address_1"),
    address_2: formData.get("address_2") || undefined,
    city: formData.get("city"),
    province: formData.get("province"),
    postal_code: formData.get("postal_code"),
    country_code: "in",
    company: formData.get("company") || undefined,
    is_default_shipping: formData.get("is_default_shipping") === "on",
    is_default_billing: formData.get("is_default_shipping") === "on",
  };
}

export async function createAddressAction(formData: FormData): Promise<ActionResult> {
  const token = await readAuthToken();
  if (!token) redirect("/login");

  const parsed = addressSchema.safeParse(addressPayload(formData));
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fields: fieldErrors(parsed.error.issues) };
  }

  try {
    await createAddress(token, parsed.data);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not save that address.",
    };
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, message: "Address saved." };
}

export async function updateAddressAction(formData: FormData): Promise<ActionResult> {
  const token = await readAuthToken();
  if (!token) redirect("/login");

  const addressId = String(formData.get("address_id") ?? "");
  if (!addressId) return { ok: false, message: "Missing address." };

  const parsed = addressSchema.safeParse(addressPayload(formData));
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fields: fieldErrors(parsed.error.issues) };
  }

  try {
    await updateAddress(token, addressId, parsed.data);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not update that address.",
    };
  }

  revalidatePath("/account/addresses");
  return { ok: true, message: "Address updated." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const token = await readAuthToken();
  if (!token) redirect("/login");
  const addressId = String(formData.get("address_id") ?? "");
  if (!addressId) return;
  await deleteAddress(token, addressId);
  revalidatePath("/account/addresses");
}

export async function toggleWishlistAction(
  variantId: string,
  inWishlist: boolean,
): Promise<ActionResult> {
  const token = await readAuthToken();
  if (!token) return { ok: false, message: "Sign in to save items." };

  try {
    if (inWishlist) {
      await removeFromWishlist(token, variantId);
    } else {
      await addToWishlist(token, variantId);
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not update your saved list.",
    };
  }

  revalidatePath("/account/wishlist");
  return { ok: true };
}

export async function removeWishlistAction(formData: FormData): Promise<void> {
  const token = await readAuthToken();
  if (!token) redirect("/login");
  const variantId = String(formData.get("variant_id") ?? "");
  if (!variantId) return;
  await removeFromWishlist(token, variantId);
  revalidatePath("/account/wishlist");
}
