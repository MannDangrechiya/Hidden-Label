"use client";

import { moneyFromRupees } from "@thl/shared";
import { Button, Price } from "@thl/ui";
import { useState, useTransition } from "react";
import { selectShippingAction } from "@/app/actions/checkout";
import { PICKUP_LOCATION, type FulfilmentMode } from "@/lib/fulfilment";
import type { ShippingOption } from "@/lib/medusa";

function optionAmount(option: ShippingOption): number {
  return option.calculated_price?.calculated_amount ?? option.amount ?? 0;
}

/**
 * Delivery step with the two real omnichannel choices:
 *
 * - Home delivery — dispatched by courier across India (Shiprocket in production).
 * - Boutique collection — free, from Steller on Sindhu Bhavan Road, Bodakdev, ready in 2–4 hours
 *   for in-stock pieces.
 *
 * Medusa needs a shipping method to complete a cart, so collection is submitted against the
 * zero-priced fulfilment option and the choice itself is written to cart metadata
 * (`fulfilment_mode`) by `selectShippingAction` — nothing is described as shipped when it is not.
 */
export function CheckoutShippingForm({
  options,
  selectedId,
  initialMode = "home_delivery",
}: {
  options: ShippingOption[];
  selectedId?: string;
  initialMode?: FulfilmentMode;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<FulfilmentMode>(initialMode);

  const freeOptions = options.filter((option) => optionAmount(option) === 0);

  const [choice, setChoice] = useState(selectedId ?? options[0]?.id ?? "");
  const [pickupChoice, setPickupChoice] = useState(freeOptions[0]?.id ?? "");

  // Home delivery keeps every courier option (free standard and paid express). Collection reuses
  // the zero-priced fulfilment option so the order total stays honest — no delivery is charged.
  const visibleOptions = mode === "store_pickup" ? freeOptions : options;
  const activeChoice = mode === "store_pickup" ? pickupChoice : choice;
  const canContinue = mode === "store_pickup" ? Boolean(pickupChoice) : Boolean(choice);

  function submit() {
    setMessage(null);
    if (!canContinue) {
      setMessage(
        mode === "store_pickup"
          ? "No free collection option is available for this bag — choose home delivery instead."
          : "Select a delivery option to continue.",
      );
      return;
    }

    const formData = new FormData();
    formData.set("option_id", activeChoice);
    formData.set("delivery_mode", mode);

    startTransition(async () => {
      const result = await selectShippingAction(formData);
      if (result && !result.ok) setMessage(result.message ?? "Could not apply that delivery option.");
    });
  }

  if (options.length === 0) {
    return (
      <p role="alert" className="border border-error px-4 py-3 font-sans text-body-sm text-error">
        No delivery options are available for this address. Go back and check the PIN code, or
        contact the boutique on Sindhu Bhavan Road.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-sp-3">
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-mono text-label-caps uppercase text-on-surface-variant">
          How would you like to receive this order?
        </legend>

        <label
          className={[
            "flex cursor-pointer items-start gap-3 border px-4 py-3",
            mode === "home_delivery" ? "border-ink bg-surface-container/30" : "border-line",
          ].join(" ")}
        >
          <input
            type="radio"
            name="delivery_mode"
            value="home_delivery"
            checked={mode === "home_delivery"}
            onChange={() => setMode("home_delivery")}
            className="mt-1"
          />
          <span className="flex flex-col gap-1">
            <span className="font-sans text-body-md text-ink">Standard home delivery</span>
            <span className="font-sans text-body-sm text-muted">
              Dispatched by express courier across India. Tracking appears in your account once
              the parcel leaves the boutique.
            </span>
          </span>
        </label>

        <label
          className={[
            "flex cursor-pointer items-start gap-3 border px-4 py-3",
            mode === "store_pickup" ? "border-ink bg-surface-container/30" : "border-line",
          ].join(" ")}
        >
          <input
            type="radio"
            name="delivery_mode"
            value="store_pickup"
            checked={mode === "store_pickup"}
            onChange={() => setMode("store_pickup")}
            className="mt-1"
          />
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="font-sans text-body-md text-ink">In-store boutique pickup</span>
              <span className="font-mono text-label-caps uppercase text-ink">Free</span>
            </span>
            <span className="font-sans text-body-sm text-muted">
              {PICKUP_LOCATION.address}
            </span>
            <span className="font-mono text-label-caps uppercase text-muted">
              {PICKUP_LOCATION.hours} · {PICKUP_LOCATION.instagram}
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-mono text-label-caps uppercase text-on-surface-variant">
          {mode === "store_pickup" ? "Collection slot" : "Courier service"}
        </legend>

        {visibleOptions.length === 0 ? (
          <p className="border border-line px-4 py-3 font-sans text-body-sm text-muted">
            This bag has no free collection option at the moment. Choose standard home delivery to
            continue, or contact the boutique to reserve the piece in store.
          </p>
        ) : (
          visibleOptions.map((option) => {
            const amount = optionAmount(option);
            const checked = mode === "store_pickup" ? pickupChoice === option.id : choice === option.id;
            return (
              <label
                key={option.id}
                className={[
                  "flex cursor-pointer items-center justify-between gap-4 border px-4 py-3",
                  checked ? "border-ink" : "border-line",
                ].join(" ")}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={checked}
                    onChange={() =>
                      mode === "store_pickup" ? setPickupChoice(option.id) : setChoice(option.id)
                    }
                  />
                  <span className="flex flex-col">
                    <span className="font-sans text-body-md text-ink">
                      {mode === "store_pickup" ? "Collect from the boutique" : option.name}
                    </span>
                    <span className="font-sans text-body-sm text-muted">
                      {mode === "store_pickup"
                        ? "No courier leg on this order — nothing is shipped."
                        : "Delivered to the address on this order."}
                    </span>
                  </span>
                </span>
                <Price value={moneyFromRupees(amount)} />
              </label>
            );
          })
        )}
      </fieldset>

      {message ? (
        <p role="alert" className="border border-error bg-error-container px-3 py-2 font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}

      <Button type="button" onClick={submit} loading={pending} className="w-full" disabled={!canContinue}>
        Continue to payment
      </Button>
    </div>
  );
}
