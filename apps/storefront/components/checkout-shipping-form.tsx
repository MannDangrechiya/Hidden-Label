"use client";

import { moneyFromRupees } from "@thl/shared";
import { Button, Price } from "@thl/ui";
import { useState, useTransition } from "react";
import { selectShippingAction } from "@/app/actions/checkout";
import type { ShippingOption } from "@/lib/medusa";

export function CheckoutShippingForm({
  options,
  selectedId,
}: {
  options: ShippingOption[];
  selectedId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [choice, setChoice] = useState(selectedId ?? options[0]?.id ?? "");

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await selectShippingAction(formData);
      if (result && !result.ok) setMessage(result.message ?? "Could not apply that shipping option.");
    });
  }

  if (options.length === 0) {
    return (
      <p role="alert" className="border border-error px-4 py-3 font-sans text-body-sm text-error">
        No shipping options are available for this address. Go back and check the PIN code, or
        contact support.
      </p>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-md">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-mono text-label-caps uppercase text-on-surface-variant">
          Shipping method
        </legend>
        {options.map((option) => {
          const amount = option.calculated_price?.calculated_amount ?? option.amount ?? 0;
          return (
            <label
              key={option.id}
              className={[
                "flex cursor-pointer items-center justify-between gap-4 border px-4 py-3",
                choice === option.id ? "border-ink" : "border-line",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="option_id"
                  value={option.id}
                  checked={choice === option.id}
                  onChange={() => setChoice(option.id)}
                />
                <span className="font-sans text-body-md text-ink">{option.name}</span>
              </span>
              <Price value={moneyFromRupees(amount)} />
            </label>
          );
        })}
      </fieldset>

      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full" disabled={!choice}>
        Continue to payment
      </Button>
    </form>
  );
}
