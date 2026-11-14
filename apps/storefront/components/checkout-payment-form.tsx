"use client";

import { Button } from "@thl/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrderAction } from "@/app/actions/checkout";

const COD_PROVIDER = "pp_system_default";
const RAZORPAY_PROVIDER = "pp_razorpay_razorpay";

/**
 * U-13 Payment & Settlement step. Cash on Delivery (`pp_system_default`) is always offered and
 * is the only method that can actually complete an order today — see docs/BUILD_LOG.md for
 * exactly what COD does under the hood (authorize now, capture on delivery) and what is still
 * missing for Razorpay (the backend provider and webhook verification exist; the client-side
 * Razorpay Checkout widget that collects `razorpay_payment_id`/`signature` does not, so
 * selecting it before that is built fails safely instead of faking a success).
 */
export function CheckoutPaymentForm({ availableProviderIds }: { availableProviderIds: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const razorpayAvailable = availableProviderIds.includes(RAZORPAY_PROVIDER);
  const [method, setMethod] = useState<"cod" | "razorpay">("cod");

  function placeOrder() {
    setMessage(null);
    startTransition(async () => {
      const providerId = method === "razorpay" ? RAZORPAY_PROVIDER : COD_PROVIDER;
      const result = await placeOrderAction(providerId);
      if (result.ok && result.orderId) {
        router.push(`/checkout/confirmation/${result.orderId}`);
      } else {
        setMessage(result.message ?? "Could not place the order.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-md">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-mono text-label-caps uppercase text-on-surface-variant">
          Payment method
        </legend>

        <label
          className={[
            "flex cursor-pointer items-center gap-3 border px-4 py-3",
            method === "cod" ? "border-ink" : "border-line",
          ].join(" ")}
        >
          <input type="radio" name="method" checked={method === "cod"} onChange={() => setMethod("cod")} />
          <span className="flex flex-col">
            <span className="font-sans text-body-md text-ink">Cash on Delivery</span>
            <span className="font-sans text-body-sm text-muted">
              Pay with cash when your order arrives.
            </span>
          </span>
        </label>

        <label
          className={[
            "flex items-center gap-3 border px-4 py-3",
            razorpayAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-60",
            method === "razorpay" ? "border-ink" : "border-line",
          ].join(" ")}
        >
          <input
            type="radio"
            name="method"
            disabled={!razorpayAvailable}
            checked={method === "razorpay"}
            onChange={() => setMethod("razorpay")}
          />
          <span className="flex flex-col">
            <span className="font-sans text-body-md text-ink">Card / UPI (Razorpay)</span>
            <span className="font-sans text-body-sm text-muted">
              {razorpayAvailable
                ? "Pay online via Razorpay."
                : "Not available yet — Razorpay test keys have not been configured."}
            </span>
          </span>
        </label>
      </fieldset>

      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}

      <Button type="button" onClick={placeOrder} loading={pending} className="w-full">
        {pending ? "Confirming with the server…" : "Place order"}
      </Button>
      <p className="font-sans text-body-sm text-muted">
        Your order is only confirmed once our server verifies it — this button never shows
        success on its own.
      </p>
    </div>
  );
}
