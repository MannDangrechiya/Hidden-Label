import { NextResponse } from "next/server";
import { readCartId } from "@/lib/cart-cookie";
import { fetchCart, MedusaError } from "@/lib/medusa";

/**
 * Thin proxy so the cart drawer (a client component) can refetch the live, server-priced cart
 * after a mutation without needing the publishable key or a cross-origin call — same pattern as
 * `/api/search`.
 */
export async function GET() {
  try {
    const cartId = await readCartId();
    const cart = cartId ? await fetchCart(cartId) : null;
    return NextResponse.json({ cart }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof MedusaError ? error.message : "The bag is unavailable.";
    return NextResponse.json({ cart: null, error: message }, { status: 502 });
  }
}
