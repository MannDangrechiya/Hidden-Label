"use client";

import { Button } from "@thl/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { confirmCodOtpAction, placeOrderAction, sendCodOtpAction } from "@/app/actions/checkout";
import { COD_PROVIDER, RAZORPAY_PROVIDER, type FulfilmentMode } from "@/lib/fulfilment";

type Method = "upi" | "cards" | "emi" | "cod";

const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "CRED"] as const;
const CARD_NETWORKS = ["RuPay", "Visa", "Mastercard", "American Express"] as const;
const EMI_TENURES = [3, 6, 9] as const;

interface OptionProps {
  id: Method;
  title: string;
  subtitle: string;
  method: Method;
  disabled: boolean;
  disabledReason?: string;
  onSelect: (method: Method) => void;
  children?: React.ReactNode;
}

function PaymentOption({
  id,
  title,
  subtitle,
  method,
  disabled,
  disabledReason,
  onSelect,
  children,
}: OptionProps) {
  const active = method === id;
  return (
    <div
      className={[
        "border",
        active ? "border-ink" : "border-line",
        disabled ? "opacity-70" : "",
      ].join(" ")}
    >
      <label
        className={[
          "flex items-start gap-3 px-4 py-3",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <input
          type="radio"
          name="payment_method"
          checked={active}
          disabled={disabled}
          onChange={() => onSelect(id)}
          className="mt-1"
        />
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="font-sans text-body-md text-ink">{title}</span>
            {disabled && disabledReason ? (
              <span className="font-mono text-label-caps uppercase text-muted">{disabledReason}</span>
            ) : null}
          </span>
          <span className="font-sans text-body-sm text-muted">{subtitle}</span>
        </span>
      </label>
      {active && children ? <div className="border-t border-line px-4 py-3">{children}</div> : null}
    </div>
  );
}

/**
 * Payment step for the Indian stack: UPI (intent on mobile / dynamic QR on desktop), cards,
 * 0% cardless EMI and Cash on Delivery with phone OTP verification.
 *
 * Only methods the backend has actually listed for the region are selectable. UPI/Cards/EMI need
 * the Razorpay provider; until its keys are configured the row states that plainly instead of
 * offering a button that cannot work. Cash on Delivery is the live path and is gated behind a
 * verified phone — `placeOrderAction` re-checks that proof server-side.
 */
export function CheckoutPaymentForm({
  availableProviderIds,
  email,
  phone,
  totalRupees,
  fulfilmentMode,
}: {
  availableProviderIds: string[];
  email: string;
  phone: string;
  totalRupees: number;
  fulfilmentMode: FulfilmentMode;
}) {
  const router = useRouter();
  const gatewayAvailable = availableProviderIds.includes(RAZORPAY_PROVIDER);

  const [method, setMethod] = useState<Method>(gatewayAvailable ? "upi" : "cod");
  const [isMobile, setIsMobile] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  const [codPhone, setCodPhone] = useState(phone);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpChannel, setOtpChannel] = useState<"sms" | "email" | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [otpPending, setOtpPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const emiPlans = useMemo(
    () =>
      EMI_TENURES.map((months) => ({
        months,
        perMonth: totalRupees > 0 ? Math.ceil(totalRupees / months) : 0,
      })),
    [totalRupees],
  );

  function sendCode() {
    setMessage(null);
    setOtpPending(true);
    startTransition(async () => {
      const result = await sendCodOtpAction(codPhone, email);
      setOtpPending(false);
      if (result.ok && result.challengeId) {
        setChallengeId(result.challengeId);
        setOtpChannel(result.channel ?? null);
        setVerified(false);
        setMessage({
          text: result.devCode
            ? `${result.message ?? "Code generated."} Development code: ${result.devCode}`
            : result.message ?? "A verification code has been sent.",
          tone: "success",
        });
      } else {
        setMessage({ text: result.message ?? "Could not send the verification code.", tone: "error" });
      }
    });
  }

  function confirmCode() {
    if (!challengeId) {
      setMessage({ text: "Request a code first.", tone: "error" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await confirmCodOtpAction({ challengeId, code, phone: codPhone });
      if (result.ok) {
        setVerified(true);
        setMessage({ text: result.message ?? "Phone verified.", tone: "success" });
      } else {
        setMessage({ text: result.message ?? "That code could not be verified.", tone: "error" });
      }
    });
  }

  function placeOrder() {
    setMessage(null);

    if (method === "cod" && !verified) {
      setMessage({ text: "Verify your phone with the one-time code before placing this order.", tone: "error" });
      return;
    }
    if ((method === "upi" || method === "cards" || method === "emi") && !gatewayAvailable) {
      setMessage({ text: "Online payment is not configured on this environment.", tone: "error" });
      return;
    }

    startTransition(async () => {
      const providerId = method === "cod" ? COD_PROVIDER : RAZORPAY_PROVIDER;
      const result = await placeOrderAction(providerId, { fulfilmentMode });
      if (result.ok && result.orderId) {
        router.push(`/checkout/confirmation/${result.orderId}`);
      } else {
        setMessage({ text: result.message ?? "Could not place the order.", tone: "error" });
      }
    });
  }

  const codBlocked = !verified;

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
              ? isMobile
                ? "Opens Google Pay, PhonePe, Paytm or CRED through a UPI intent deep link."
                : "Scan a dynamic UPI QR with any UPI app; this page confirms automatically."
              : "Needs the online gateway, which is not configured on this environment."
          }
          disabled={!gatewayAvailable}
          disabledReason={gatewayAvailable ? undefined : "Unavailable"}
          onSelect={setMethod}
        >
          <div className="flex flex-col gap-2">
            <p className="font-mono text-label-caps uppercase text-muted">
              {isMobile ? "UPI intent" : "Dynamic UPI QR"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {UPI_APPS.map((app) => (
                <span key={app} className="border border-line px-2 py-1 font-mono text-label-caps uppercase text-on-surface-variant">
                  {app}
                </span>
              ))}
            </div>
            <p className="font-sans text-body-sm text-muted">
              {isMobile
                ? "Tapping place order hands off to your UPI app for the PIN (NPCI 2-factor). Nothing is charged until the gateway confirms it server-side."
                : "The dynamic QR is generated for this exact total and expires in 10 minutes. Payment confirmation arrives by webhook, not by this page."}
            </p>
          </div>
        </PaymentOption>

        <PaymentOption
          id="cards"
          method={method}
          title="Credit / debit card"
          subtitle={
            gatewayAvailable
              ? "RuPay, Visa, Mastercard and American Express with 3-D Secure OTP."
              : "Needs the online gateway, which is not configured on this environment."
          }
          disabled={!gatewayAvailable}
          disabledReason={gatewayAvailable ? undefined : "Unavailable"}
          onSelect={setMethod}
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {CARD_NETWORKS.map((network) => (
                <span key={network} className="border border-line px-2 py-1 font-mono text-label-caps uppercase text-on-surface-variant">
                  {network}
                </span>
              ))}
            </div>
            <p className="font-sans text-body-sm text-muted">
              Card details are entered on the gateway&rsquo;s PCI-compliant page — never in this
              storefront and never stored by us.
            </p>
          </div>
        </PaymentOption>

        <PaymentOption
          id="emi"
          method={method}
          title="0% cardless EMI"
          subtitle={
            gatewayAvailable
              ? "Snapmint / Simpl-style cardless financing, approved by the provider in their flow."
              : "Needs the online gateway, which is not configured on this environment."
          }
          disabled={!gatewayAvailable}
          disabledReason={gatewayAvailable ? undefined : "Unavailable"}
          onSelect={setMethod}
        >
          <div className="flex flex-col gap-2">
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {emiPlans.map((plan) => (
                <li key={plan.months} className="flex items-center justify-between border border-line px-3 py-2">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant">
                    {plan.months} months · 0% interest
                  </span>
                  <span className="font-mono text-currency-md tabular text-ink">
                    {totalRupees > 0 ? `${formatINR(moneyFromRupees(plan.perMonth))} / mo` : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="font-sans text-body-sm text-muted">
              Indicative schedule for the current total. Final tenure, eligibility and approval come
              from the financing provider; no interest is charged by The Hidden Label.
            </p>
          </div>
        </PaymentOption>

        <PaymentOption
          id="cod"
          method={method}
          title="Cash on Delivery"
          subtitle="Pay the courier in cash. Phone verification is required before the order is accepted."
          disabled={false}
          onSelect={setMethod}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-label-caps uppercase text-muted">Phone for the code</span>
              <input
                type="tel"
                value={codPhone}
                onChange={(event) => {
                  setCodPhone(event.target.value);
                  setVerified(false);
                  setChallengeId(null);
                }}
                placeholder="+919876543210"
                className="h-11 border border-line bg-surface px-3 font-mono text-body-md text-ink outline-none focus:border-ink"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendCode}
                disabled={otpPending || pending || verified}
                className="min-h-11 border border-ink px-4 font-mono text-label-caps uppercase tracking-[0.08em] text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-muted"
              >
                {otpPending ? "Sending…" : verified ? "Phone verified" : challengeId ? "Resend code" : "Send OTP"}
              </button>
              {otpChannel ? (
                <span className="flex items-center font-mono text-label-caps uppercase text-muted">
                  via {otpChannel === "sms" ? "SMS" : "email fallback"}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="font-mono text-label-caps uppercase text-muted">Six-digit code</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  className="h-11 w-full max-w-40 border border-line bg-surface px-3 font-mono text-currency-md tracking-[0.3em] text-ink outline-none focus:border-ink"
                />
              </label>
              <button
                type="button"
                onClick={confirmCode}
                disabled={code.length !== 6 || pending || verified}
                className="min-h-11 border border-ink bg-ink px-4 font-mono text-label-caps uppercase tracking-[0.08em] text-white transition-colors enabled:hover:bg-accent enabled:hover:text-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
              >
                {verified ? "Verified" : "Verify code"}
              </button>
            </div>

            <p className="font-sans text-body-sm text-muted">
              COD carries a higher return risk on high-value pieces, so the code confirms the number
              before the parcel is dispatched. Charges are never taken online for COD.
            </p>
          </div>
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

      <Button
        type="button"
        onClick={placeOrder}
        loading={pending}
        className="w-full"
        disabled={method === "cod" ? codBlocked : !gatewayAvailable}
      >
        {pending ? "Confirming with the server…" : "Place order"}
      </Button>

      <p className="font-sans text-body-sm text-muted">
        {fulfilmentMode === "store_pickup"
          ? "Collection order — nothing ships, and payment is settled before the piece leaves the boutique, except on COD."
          : "Your order is only confirmed once our server verifies it — this button never shows success on its own."}
      </p>
    </div>
  );
}
