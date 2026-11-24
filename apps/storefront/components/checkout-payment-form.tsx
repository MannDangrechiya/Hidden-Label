"use client";

import { Button } from "@thl/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  beginRazorpayPaymentAction,
  confirmRazorpayPaymentAction,
} from "@/app/actions/checkout";
import { RAZORPAY_PROVIDER, type FulfilmentMode } from "@/lib/fulfilment";

type Method = "upi" | "cards";

/**
 * Razorpay key ids that are dev-seeded template placeholders, not real credentials. A checkout
 * dialog opened with one of these fails inside the gateway, so the payment step must treat
 * them as "not configured" and say so honestly (same rule as the backend env-guard).
 */
const RAZORPAY_PLACEHOLDER_KEY_IDS = ["rzp_test_thl_sandbox", "rzp_live_PROD_KEY_ID"];

function razorpayKeyIsReal(keyId: string | null | undefined): keyId is string {
  if (!keyId) return false;
  return !RAZORPAY_PLACEHOLDER_KEY_IDS.includes(keyId.trim());
}

type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/** Loads Razorpay's hosted checkout exactly once per page. */
function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay]");
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "true";
    script.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
    script.addEventListener("error", () => resolve(false));
    document.body.appendChild(script);
  });
}

interface OptionProps {
  id: Method;
  title: string;
  subtitle: string;
  method: Method;
  disabled: boolean;
  onSelect: (method: Method) => void;
  children?: React.ReactNode;
}

function PaymentOption({ id, title, subtitle, method, disabled, onSelect, children }: OptionProps) {
  const active = method === id;
  return (
    <div className={["border", active ? "border-ink" : "border-line", disabled ? "opacity-70" : ""].join(" ")}>
      <label className={["flex items-start gap-3 px-4 py-3", disabled ? "cursor-not-allowed" : "cursor-pointer"].join(" ")}>
        <input
          type="radio"
          name="payment_method"
          checked={active}
          disabled={disabled}
          onChange={() => onSelect(id)}
          className="mt-1"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-sans text-body-md text-ink">{title}</span>
          <span className="font-sans text-body-sm text-muted">{subtitle}</span>
        </span>
      </label>
      {active && children ? <div className="border-t border-line px-4 py-3">{children}</div> : null}
    </div>
  );
}

/**
 * Payment step: UPI and cards only, both settled through Razorpay. Cash on Delivery is not
 * offered, so every order is prepaid and there is no COD verification step.
 *
 * The provider must be linked to the India region and the public key id must be present;
 * otherwise the methods are shown as unavailable instead of offering a button that cannot work.
 * The browser never confirms a payment on its own — the signed Razorpay result is posted to a
 * server action that verifies it and completes the cart (docs/PROJECT_PLAN.md §6).
 */
export function CheckoutPaymentForm({
  availableProviderIds,
  email,
  phone,
  totalRupees,
  fulfilmentMode,
  razorpayKeyId,
}: {
  availableProviderIds: string[];
  email: string;
  phone: string;
  totalRupees: number;
  fulfilmentMode: FulfilmentMode;
  /** Public Razorpay key id; the provider must also be linked to the India region. */
  razorpayKeyId?: string | null;
}) {
  const router = useRouter();
  const providerLinked = availableProviderIds.includes(RAZORPAY_PROVIDER);
  const gatewayAvailable = providerLinked && razorpayKeyIsReal(razorpayKeyId);

  const [method, setMethod] = useState<Method>("upi");
  const [consent, setConsent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  function placeOrder() {
    setMessage(null);

    if (!gatewayAvailable) {
      setMessage({
        text: "Online payment is not configured on this environment. UPI and card payments are unavailable right now.",
        tone: "error",
      });
      return;
    }
    if (!consent) {
      setMessage({
        text: "Please accept the privacy notice and terms before placing the order.",
        tone: "error",
      });
      return;
    }

    startTransition(async () => {
      const begun = await beginRazorpayPaymentAction({ fulfilmentMode, privacyConsent: consent });
      if (
        !begun.ok ||
        !begun.keyId ||
        !begun.razorpayOrderId ||
        !begun.collectionId ||
        !begun.sessionId
      ) {
        setMessage({ text: begun.message ?? "Could not start the online payment.", tone: "error" });
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setMessage({
          text: "The payment page could not load. Check your connection and try again.",
          tone: "error",
        });
        return;
      }

      const collectionId = begun.collectionId;
      const sessionId = begun.sessionId;
      const RazorpayCheckout = window.Razorpay;

      const checkout = new RazorpayCheckout({
        key: begun.keyId,
        amount: begun.amountPaise,
        currency: "INR",
        name: "The Hidden Label",
        description: "Order payment",
        order_id: begun.razorpayOrderId,
        // Preselects the method chosen here; the gateway still offers its own UPI/card flow.
        method: method === "upi" ? "upi" : "card",
        prefill: { email, contact: phone },
        notes: { fulfilment_mode: fulfilmentMode, checkout_method: method },
        theme: { color: "#111111" },
        handler: (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          startTransition(async () => {
            const confirmed = await confirmRazorpayPaymentAction({
              collectionId,
              sessionId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (confirmed.ok && confirmed.orderId) {
              router.push(`/checkout/confirmation/${confirmed.orderId}`);
            } else {
              setMessage({
                text: confirmed.message ?? "The payment could not be confirmed.",
                tone: "error",
              });
            }
          });
        },
        modal: {
          ondismiss: () =>
            setMessage({
              text: "Payment was cancelled. Nothing has been charged.",
              tone: "error",
            }),
        },
      });

      checkout.open();
    });
  }

  return (
    <div className="flex flex-col gap-sp-3">
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-mono text-label-caps uppercase text-on-surface-variant">
          Payment method
        </legend>

        <PaymentOption
          id="upi"
          method={method}
          title="UPI — instant pay"
          subtitle={
            gatewayAvailable
              ? "Google Pay, PhonePe, Paytm, CRED or any UPI app with your PIN (NPCI 2-factor)."
              : "Online payment is not configured on this environment."
          }
          disabled={!gatewayAvailable}
          onSelect={setMethod}
        >
          <p className="font-sans text-body-sm text-muted">
            Nothing is charged until the gateway confirms the payment server-side.
          </p>
        </PaymentOption>

        <PaymentOption
          id="cards"
          method={method}
          title="Credit / debit card"
          subtitle={
            gatewayAvailable
              ? "RuPay, Visa, Mastercard and American Express with 3-D Secure OTP."
              : "Online payment is not configured on this environment."
          }
          disabled={!gatewayAvailable}
          onSelect={setMethod}
        >
          <p className="font-sans text-body-sm text-muted">
            Card details are entered on the gateway&rsquo;s PCI-compliant page — never in this
            storefront and never stored by us.
          </p>
        </PaymentOption>
      </fieldset>

      {message ? (
        <p
          role="alert"
          className={[
            "border px-3 py-2 font-sans text-body-sm",
            message.tone === "error"
              ? "border-error bg-error-container text-error"
              : "border-ink bg-surface-container text-ink",
          ].join(" ")}
        >
          {message.text}
        </p>
      ) : null}

      {/* GAP-REG-02: affirmative DPDP consent — never pre-ticked, required to continue. */}
      <label className="flex items-start gap-2 border border-line px-3 py-2">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1"
          required
        />
        <span className="font-sans text-body-sm text-on-surface-variant">
          I consent to The Hidden Label processing my name, contact details and order information
          to fulfil this order, as described in the{" "}
          <a href="/policies/privacy" className="underline" target="_blank" rel="noreferrer">
            privacy notice
          </a>{" "}
          and{" "}
          <a href="/policies/terms" className="underline" target="_blank" rel="noreferrer">
            terms
          </a>
          . I can withdraw consent and request erasure from my account.
        </span>
      </label>

      <Button
        type="button"
        onClick={placeOrder}
        loading={pending}
        className="w-full"
        disabled={!consent || !gatewayAvailable}
      >
        {pending ? "Confirming with the server…" : `Pay ₹${totalRupees.toLocaleString("en-IN")}`}
      </Button>

      <p className="font-sans text-body-sm text-muted">
        {fulfilmentMode === "store_pickup"
          ? "Collection order — payment is settled before the piece leaves the boutique."
          : "Your order is only confirmed once our server verifies the payment — this button never shows success on its own."}
      </p>
    </div>
  );
}
