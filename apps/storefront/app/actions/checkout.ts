"use server";

import { addressSchema, checkoutContactSchema } from "@thl/shared";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readAuthToken } from "@/lib/auth-cookie";
import { clearCartId, readCartId } from "@/lib/cart-cookie";
import { lookupPincode } from "@/lib/pincode";
import {
  attachCustomerToCart,
  completeCart,
  createPaymentCollection,
  createPaymentSession,
  fetchCart,
  fetchOrderByCart,
  MedusaError,
  selectShippingOption,
  setCartAddress,
  setCartMetadata,
  updatePaymentSession,
} from "@/lib/medusa";
// Cash on Delivery is not offered: every order is prepaid through Razorpay (UPI or card).
import type { ActionResult } from "@/app/actions/auth";
import { PICKUP_LOCATION, RAZORPAY_PROVIDER, type FulfilmentMode } from "@/lib/fulfilment";

function requireCartId(cartId: string | null): asserts cartId is string {
  if (!cartId) redirect("/cart");
}

export async function setCheckoutAddressAction(formData: FormData): Promise<ActionResult> {
  const cartId = await readCartId();
  requireCartId(cartId);

  const email = checkoutContactSchema.safeParse({ email: formData.get("email") });
  const address = addressSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone"),
    address_1: formData.get("address_1"),
    address_2: formData.get("address_2") || undefined,
    city: formData.get("city"),
    province: formData.get("province"),
    postal_code: formData.get("postal_code"),
    country_code: "in",
  });

  if (!email.success || !address.success) {
    const fields: Record<string, string> = {};
    for (const issue of email.success ? [] : email.error.issues) fields.email = issue.message;
    for (const issue of address.success ? [] : address.error.issues) fields[String(issue.path[0])] = issue.message;
    return { ok: false, message: "Check the highlighted fields.", fields };
  }

  // ADR-02: the postal directory is the serviceability gate. A PIN that does not exist cannot
  // be delivered to, so checkout stops here rather than taking payment for an undeliverable
  // parcel. If India Post is unreachable we let the address through instead of failing the sale.
  const pincode = await lookupPincode(address.data.postal_code);
  if (pincode.status === "not_found") {
    return {
      ok: false,
      message: "We don't deliver to this pincode yet. Please try another address.",
      fields: { postal_code: "Invalid PIN code" },
    };
  }

  const landmark = String(formData.get("landmark") ?? "").trim();
  const addressType = formData.get("address_type") === "work" ? "work" : "home";

  try {
    const token = await readAuthToken();
    if (token) {
      // Idempotent — ensures a cart started before login (or in another tab) still ends up
      // owned by the customer, so the resulting order appears in their order history
      // (GET /store/orders filters by customer_id; see docs/BUILD_LOG.md).
      await attachCustomerToCart(cartId, token).catch(() => undefined);
    }
    await setCartAddress(
      cartId,
      email.data.email,
      {
        ...address.data,
        metadata: { address_type: addressType, ...(landmark ? { landmark } : {}) },
      },
      token ?? undefined,
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not save the delivery address.",
    };
  }

  revalidatePath("/checkout");
  redirect("/checkout?step=shipping");
}

/**
 * Selects the shipping method and records the delivery choice.
 *
 * `delivery_mode` is `home_delivery` (Shiprocket express across India) or `store_pickup`
 * (free collection at the Sindhu Bhavan Road boutique). Medusa still needs a shipping option to
 * complete a cart, so for pickup the UI submits the free zero-priced option and the mode itself
 * is stored in cart metadata — the order carries the real choice rather than pretending the
 * courier option is a collection.
 */
export async function selectShippingAction(formData: FormData): Promise<ActionResult> {
  const cartId = await readCartId();
  requireCartId(cartId);

  const optionId = String(formData.get("option_id") ?? "");
  const rawMode = String(formData.get("delivery_mode") ?? "");
  const mode: FulfilmentMode = rawMode === "store_pickup" ? "store_pickup" : "home_delivery";

  if (!optionId) return { ok: false, message: "Select a shipping option." };

  try {
    await selectShippingOption(cartId, optionId);
    await setCartMetadata(cartId, {
      fulfilment_mode: mode,
      ...(mode === "store_pickup"
        ? {
            pickup_location: PICKUP_LOCATION.name,
            pickup_address: PICKUP_LOCATION.address,
          }
        : { pickup_location: null, pickup_address: null }),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not apply that shipping option.",
    };
  }

  revalidatePath("/checkout");
  redirect("/checkout?step=payment");
}

export interface PlaceOrderResult {
  ok: boolean;
  message?: string;
  orderId?: string;
}

export interface RazorpayBeginResult {
  ok: boolean;
  message?: string;
  keyId?: string;
  razorpayOrderId?: string;
  amountPaise?: number;
  collectionId?: string;
  sessionId?: string;
}

/**
 * GAP-PAY-01: creates the payment collection + Razorpay session server-side and returns only
 * the public checkout parameters. The Razorpay order id comes from the provider's
 * `initiatePayment`, so the browser never invents an amount or an order.
 */
export async function beginRazorpayPaymentAction(options: {
  fulfilmentMode?: FulfilmentMode;
  privacyConsent?: boolean;
}): Promise<RazorpayBeginResult> {
  if (!options.privacyConsent) {
    return { ok: false, message: "Please accept the privacy notice and terms before paying." };
  }

  const cartId = await readCartId();
  if (!cartId) return { ok: false, message: "Your bag could not be found. Start again from the cart." };

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    return { ok: false, message: "Online payment is not configured on this environment." };
  }

  try {
    const cart = await fetchCart(cartId);
    if (!cart || cart.items.length === 0) return { ok: false, message: "Your bag is empty." };
    if (!cart.shipping_methods || cart.shipping_methods.length === 0) {
      return { ok: false, message: "Choose a delivery method before paying." };
    }

    await setCartMetadata(cartId, {
      ...(options.fulfilmentMode ? { fulfilment_mode: options.fulfilmentMode } : {}),
      payment_method: "razorpay",
      privacy_consent_at: new Date().toISOString(),
      privacy_policy_version: "2026-11",
    });

    const collection = await createPaymentCollection(cartId);
    const withSession = await createPaymentSession(collection.id, RAZORPAY_PROVIDER);
    const razorpaySessions =
      withSession.payment_sessions?.filter((s) => s.provider_id === RAZORPAY_PROVIDER) ?? [];
    const session = razorpaySessions[razorpaySessions.length - 1];
    if (!session) {
      return { ok: false, message: "Could not start a Razorpay payment session." };
    }

    const razorpayOrderId = session.data?.razorpay_order_id;
    if (typeof razorpayOrderId !== "string" || !razorpayOrderId) {
      return { ok: false, message: "The payment gateway did not return an order reference." };
    }
    // The razorpay module stores the order amount in paise on the session data.
    const rawSessionAmount = (session.data as { amount?: unknown } | undefined)?.amount;
    const sessionAmountPaise =
      typeof rawSessionAmount === "number" && Number.isSafeInteger(rawSessionAmount) && rawSessionAmount > 0
        ? rawSessionAmount
        : null;

    return {
      ok: true,
      keyId,
      razorpayOrderId,
      // GAP-PAY-02: the paise amount is set by the backend razorpay module when it created the
      // Razorpay order (parseAmountToPaise at the provider boundary). Reuse that exact value
      // instead of re-deriving paise from `cart.total` here, so the gateway checkout dialog,
      // the Razorpay order and the persisted order total can never disagree.
      amountPaise: sessionAmountPaise ?? Math.round((cart.total ?? 0) * 100),
      collectionId: collection.id,
      sessionId: session.id,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not start the online payment.",
    };
  }
}

/**
 * Called from the Razorpay handler with the signed checkout result. The provider verifies the
 * HMAC signature server-side during `completeCart`; a forged signature fails the payment session
 * and no order is created.
 *
 * Implements strict idempotency: if the order was already completed (e.g. concurrent submission
 * or double click), returns the existing order ID instead of throwing.
 */
export async function confirmRazorpayPaymentAction(input: {
  collectionId: string;
  sessionId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<PlaceOrderResult> {
  const cartId = await readCartId();
  if (!cartId) return { ok: false, message: "Your bag could not be found." };

  try {
    // Check if cart was already completed into an order (idempotent lookup)
    const existing = await fetchOrderByCart(cartId);
    if (existing?.id) {
      await clearCartId();
      revalidatePath("/cart");
      return { ok: true, orderId: existing.id };
    }

    await updatePaymentSession(input.collectionId, input.sessionId, {
      razorpay_order_id: input.razorpay_order_id,
      razorpay_payment_id: input.razorpay_payment_id,
      razorpay_signature: input.razorpay_signature,
    });

    const result = await completeCart(cartId);
    if (result.type === "cart") {
      return {
        ok: false,
        message:
          result.error?.message ??
          "The payment could not be confirmed. No order was created — please try again.",
      };
    }

    await clearCartId();
    revalidatePath("/cart");
    return { ok: true, orderId: result.order.id };
  } catch (error) {
    // If completed concurrently by a racing callback, retrieve the created order
    if (
      (error instanceof Error &&
        (error.message.includes("already completed") ||
          error.message.includes("in progress") ||
          error.message.includes("conflict"))) ||
      (error instanceof MedusaError &&
        (error.status === 409 || error.message.includes("already completed")))
    ) {
      await new Promise((r) => setTimeout(r, 500));
      const existing = await fetchOrderByCart(cartId);
      if (existing?.id) {
        await clearCartId();
        revalidatePath("/cart");
        return { ok: true, orderId: existing.id };
      }
    }

    return {
      ok: false,
      message:
        error instanceof MedusaError
          ? error.message
          : `Could not confirm the payment: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
