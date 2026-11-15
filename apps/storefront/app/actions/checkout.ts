"use server";

import { addressSchema, checkoutContactSchema } from "@thl/shared";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readAuthToken } from "@/lib/auth-cookie";
import { clearCartId, readCartId } from "@/lib/cart-cookie";
import {
  attachCustomerToCart,
  completeCart,
  createPaymentCollection,
  createPaymentSession,
  fetchCart,
  MedusaError,
  selectShippingOption,
  sendOtp,
  setCartAddress,
  setCartMetadata,
  verifyOtp,
} from "@/lib/medusa";
import type { ActionResult } from "@/app/actions/auth";
import { COD_PROVIDER, PICKUP_LOCATION, type FulfilmentMode } from "@/lib/fulfilment";

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

  try {
    const token = await readAuthToken();
    if (token) {
      // Idempotent — ensures a cart started before login (or in another tab) still ends up
      // owned by the customer, so the resulting order appears in their order history
      // (GET /store/orders filters by customer_id; see docs/BUILD_LOG.md).
      await attachCustomerToCart(cartId, token).catch(() => undefined);
    }
    await setCartAddress(cartId, email.data.email, address.data, token ?? undefined);
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

export interface CodOtpSendResult extends ActionResult {
  challengeId?: string;
  channel?: "sms" | "email";
  /** Present only when the backend has `OTP_DEV_ECHO=true` outside production. */
  devCode?: string;
}

/**
 * Dispatches the Cash-on-Delivery verification code to the customer's phone.
 *
 * SMS needs a provider (`OTP_PROVIDER`); when this environment has none, the backend answers
 * `501 not_configured` and this falls back to an email code *and says so*, rather than dropping
 * the verification step and letting a high-value COD order through unverified.
 */
export async function sendCodOtpAction(phone: string, email: string): Promise<CodOtpSendResult> {
  const destination = phone.trim();

  if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
    return {
      ok: false,
      message: "Enter the phone number in international format, for example +919876543210.",
    };
  }

  try {
    const sms = await sendOtp({ destination, channel: "sms", purpose: "cod_verify" });
    return {
      ok: true,
      challengeId: sms.challenge_id,
      channel: "sms",
      devCode: sms.dev_code,
      message: sms.delivered
        ? "A six-digit code has been sent to your phone."
        : "Code generated. This environment has no SMS provider configured, so delivery is simulated.",
    };
  } catch (error) {
    const notConfigured = error instanceof MedusaError && error.status === 501;
    if (!notConfigured) {
      return {
        ok: false,
        message: error instanceof MedusaError ? error.message : "Could not send the verification code.",
      };
    }
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {
      ok: false,
      message: "SMS codes are not configured here and no valid email is on this order for the fallback code.",
    };
  }

  try {
    const mail = await sendOtp({ destination: email, channel: "email", purpose: "cod_verify" });
    return {
      ok: true,
      challengeId: mail.challenge_id,
      channel: "email",
      devCode: mail.dev_code,
      message: mail.delivered
        ? "SMS is not configured here, so we sent the code to your email instead."
        : `SMS is not configured here and email delivery is off (${mail.delivery_note ?? "no provider"}).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not send the verification code.",
    };
  }
}

/**
 * Confirms the COD code and records the proof on the cart. `placeOrderAction` refuses a COD
 * order without it, so this cannot be skipped by calling the order endpoint directly.
 */
export async function confirmCodOtpAction(input: {
  challengeId: string;
  code: string;
  phone: string;
}): Promise<ActionResult> {
  const cartId = await readCartId();
  requireCartId(cartId);

  if (!input.challengeId) return { ok: false, message: "Request a code first." };

  try {
    const result = await verifyOtp({ challenge_id: input.challengeId, code: input.code.trim() });
    if (!result.verified) {
      return { ok: false, message: "That code could not be verified." };
    }
    await setCartMetadata(cartId, {
      cod_otp_verified_phone: input.phone.trim(),
      cod_otp_verified_at: new Date().toISOString(),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not verify that code.",
    };
  }

  return { ok: true, message: "Phone verified for Cash on Delivery." };
}

export interface PlaceOrderResult {
  ok: boolean;
  message?: string;
  orderId?: string;
}

/**
 * The only function in the storefront allowed to create an order. `providerId` is either
 * `pp_system_default` (Cash on Delivery — always available) or `pp_razorpay_razorpay` (only
 * offered once the backend has real keys and the region lists it — see checkout/page.tsx).
 *
 * This calls Medusa's own cart-complete workflow server-side and returns only once Medusa has
 * actually created the order; a `{ type: "cart" }` response (stock short, payment not
 * authorized, etc.) is surfaced as an error and the customer stays on the payment step —
 * nothing here ever renders a success state from the browser's own belief that it "paid"
 * (docs/PROJECT_PLAN.md §6, the single most important rule in this codebase).
 *
 * Cash on Delivery additionally requires the phone OTP proof written by `confirmCodOtpAction`.
 */
export async function placeOrderAction(
  providerId: string,
  options?: { fulfilmentMode?: FulfilmentMode },
): Promise<PlaceOrderResult> {
  const cartId = await readCartId();
  if (!cartId) return { ok: false, message: "Your bag could not be found. Start again from the cart." };

  try {
    const cart = await fetchCart(cartId);
    if (!cart || cart.items.length === 0) {
      return { ok: false, message: "Your bag is empty." };
    }

    if (!cart.shipping_methods || cart.shipping_methods.length === 0) {
      return { ok: false, message: "Choose a delivery method before paying." };
    }

    if (providerId === COD_PROVIDER && !cart.metadata?.cod_otp_verified_at) {
      return {
        ok: false,
        message: "Verify your phone with the one-time code before placing a Cash on Delivery order.",
      };
    }

    if (options?.fulfilmentMode) {
      await setCartMetadata(cartId, { fulfilment_mode: options.fulfilmentMode });
    }

    const collection = await createPaymentCollection(cartId);
    const withSession = await createPaymentSession(collection.id, providerId);
    const session = withSession.payment_sessions?.find((s) => s.provider_id === providerId);

    if (!session) {
      return { ok: false, message: "Could not start a payment session for that method." };
    }

    const result = await completeCart(cartId);

    if (result.type === "cart") {
      return {
        ok: false,
        message:
          result.error?.message ??
          "We could not confirm payment for this order. No charge has been made — please try again.",
      };
    }

    // Order exists and is confirmed server-side. Clear the cart cookie so a fresh visit starts
    // a new cart instead of reopening the one that just became an order.
    await clearCartId();
    revalidatePath("/cart");
    return { ok: true, orderId: result.order.id };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof MedusaError
          ? error.message
          : `Could not place the order: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
