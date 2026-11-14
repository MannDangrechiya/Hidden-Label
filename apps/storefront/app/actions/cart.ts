"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readCartId, writeCartId } from "@/lib/cart-cookie";
import {
  addLineItem,
  createCart,
  fetchCart,
  MedusaError,
  removeLineItem,
  updateLineItem,
} from "@/lib/medusa";

export interface CartActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Cart mutations run on the server so the cart id stays in an httpOnly cookie and money is never
 * computed in the browser (docs/ORDER_STATE_MACHINE.md §4).
 */
export async function addToCart(variantId: string, quantity = 1): Promise<CartActionResult> {
  try {
    let cartId = await readCartId();

    if (cartId) {
      const existing = await fetchCart(cartId);
      if (!existing) cartId = null;
    }

    if (!cartId) {
      const created = await createCart();
      cartId = created.id;
      await writeCartId(cartId);
    }

    await addLineItem(cartId, variantId, quantity);
    revalidatePath("/cart");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof MedusaError
        ? error.message
        : `Could not add to bag: ${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, message };
  }
}

export async function setLineQuantity(lineId: string, quantity: number): Promise<void> {
  const cartId = await readCartId();
  if (!cartId) redirect("/cart");
  if (quantity <= 0) {
    await removeLineItem(cartId, lineId);
  } else {
    await updateLineItem(cartId, lineId, quantity);
  }
  revalidatePath("/cart");
}

export async function removeFromCart(lineId: string): Promise<void> {
  const cartId = await readCartId();
  if (!cartId) redirect("/cart");
  await removeLineItem(cartId, lineId);
  revalidatePath("/cart");
}

/* Form-encoded wrappers so the cart page can stay a server component with plain <form>s. */

export async function setQuantityAction(formData: FormData): Promise<void> {
  const lineId = String(formData.get("lineId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  if (!lineId || Number.isNaN(quantity)) return;
  await setLineQuantity(lineId, quantity);
}

export async function removeLineAction(formData: FormData): Promise<void> {
  const lineId = String(formData.get("lineId") ?? "");
  if (!lineId) return;
  await removeFromCart(lineId);
}
