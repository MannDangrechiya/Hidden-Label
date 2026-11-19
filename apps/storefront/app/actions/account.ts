"use server";

import { addressSchema, profileSchema } from "@thl/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAuthToken, readAuthToken } from "@/lib/auth-cookie";
import { addToCart } from "@/app/actions/cart";
import {
  addToWishlist,
  cancelMyOrder,
  createAddress,
  deleteAddress,
  deleteCustomerAccount,
  fetchMe,
  listAddresses,
  listMyOrders,
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

/**
 * GAP-REG-03: DPDP Act 2023 self-service erasure. The backend closes the account, redacts
 * direct identifiers and removes the login credentials; the customer is signed out here.
 */
export async function deleteAccountAction(): Promise<void> {
  const token = await readAuthToken();
  if (!token) redirect("/login");

  try {
    await deleteCustomerAccount(token);
  } catch {
    redirect("/account?delete=failed");
  }

  await clearAuthToken();
  revalidatePath("/", "layout");
  redirect("/?account=deleted");
}

/**
 * GAP-REG-03 / DPDP Act §11: data portability. Returns the customer's profile, saved addresses
 * and order history as a JSON document the account page downloads.
 */
export async function exportMyDataAction(): Promise<{ filename: string; json: string }> {
  const token = await readAuthToken();
  if (!token) redirect("/login");

  const [customer, addresses, orders] = await Promise.all([
    fetchMe(token),
    listAddresses(token),
    listMyOrders(token, { limit: 100 }),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: customer,
    addresses,
    orders: orders.orders,
  };

  return {
    filename: `the-hidden-label-data-${new Date().toISOString().slice(0, 10)}.json`,
    json: JSON.stringify(payload, null, 2),
  };
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

function addressMetadata(formData: FormData): Record<string, unknown> {
  const landmark = String(formData.get("landmark") ?? "").trim();
  const addressType = formData.get("address_type") === "work" ? "work" : "home";
  return { address_type: addressType, ...(landmark ? { landmark } : {}) };
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
    await createAddress(token, { ...parsed.data, metadata: addressMetadata(formData) });
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
    await updateAddress(token, addressId, { ...parsed.data, metadata: addressMetadata(formData) });
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

/** MF-14: saved item -> bag, then dropped from the wishlist so it doesn't sit in both lists. */
export async function moveWishlistItemToBagAction(formData: FormData): Promise<void> {
  const token = await readAuthToken();
  if (!token) redirect("/login");
  const variantId = String(formData.get("variant_id") ?? "");
  if (!variantId) return;

  const added = await addToCart(variantId, 1);
  if (added.ok) await removeFromWishlist(token, variantId).catch(() => undefined);

  revalidatePath("/account/wishlist");
  revalidatePath("/cart");
}

export async function cancelOrderAction(orderId: string, reason?: string): Promise<ActionResult> {
  const token = await readAuthToken();
  if (!token) redirect("/login");

  try {
    await cancelMyOrder(token, orderId, reason);
    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath("/account/orders");
    return { ok: true, message: "Order cancelled successfully." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not cancel this order.",
    };
  }
}
