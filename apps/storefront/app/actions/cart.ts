"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readAuthToken } from "@/lib/auth-cookie";
import { readCartId, writeCartId } from "@/lib/cart-cookie";
import {
  addCartPromotion,
  addLineItem,
  attachCustomerToCart,
  createCart,
  fetchCart,
  MedusaError,
  removeCartPromotion,
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
export async function addToCart(
  variantId: string,
  quantity = 1,
  metadata?: Record<string, unknown>,
): Promise<CartActionResult> {
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

    const token = await readAuthToken();
    if (token) {
      // Best-effort: an expired token should never block adding to the bag.
      await attachCustomerToCart(cartId, token).catch(() => undefined);
    }

    // `metadata` carries bespoke made-to-measure data (`custom_measurements`) onto the line
    // item so the master tailor sees it on the admin order sheet.
    await addLineItem(cartId, variantId, quantity, metadata);
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

export async function applyPromotionAction(
  _prev: CartActionResult | null,
  formData: FormData,
): Promise<CartActionResult> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { ok: false, message: "Enter a promotion code." };

  const cartId = await readCartId();
  if (!cartId) return { ok: false, message: "No active bag found." };

  try {
    await addCartPromotion(cartId, code);
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { ok: true, message: `Promotion code ${code} applied.` };
  } catch (error) {
    const message =
      error instanceof MedusaError
        ? error.message
        : "Invalid or expired promotion code.";
    return { ok: false, message };
  }
}

export async function removePromotionAction(
  _prev: CartActionResult | null,
  formData: FormData,
): Promise<CartActionResult> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { ok: false, message: "No promotion code specified." };

  const cartId = await readCartId();
  if (!cartId) return { ok: false, message: "No active bag found." };

  try {
    await removeCartPromotion(cartId, code);
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { ok: true, message: "Promotion code removed." };
  } catch {
    return { ok: false, message: "Could not remove promotion." };
  }
}
