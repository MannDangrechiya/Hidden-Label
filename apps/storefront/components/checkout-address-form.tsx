"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { setCheckoutAddressAction } from "@/app/actions/checkout";
import { usePincodeLookup } from "@/components/use-pincode-lookup";

interface DefaultAddress {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function CheckoutAddressForm({
  defaultEmail,
  defaultValues,
}: {
  defaultEmail: string;
  defaultValues?: DefaultAddress;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const pincode = usePincodeLookup({
    postal_code: defaultValues?.postal_code,
    city: defaultValues?.city,
    province: defaultValues?.province,
  });

  const landmark =
    typeof defaultValues?.metadata?.landmark === "string" ? defaultValues.metadata.landmark : "";
  const addressType = defaultValues?.metadata?.address_type === "work" ? "work" : "home";

  function submit(formData: FormData) {
    setMessage(null);
    setFields({});

    // ADR-01: a PIN that is not in the postal directory never reaches the server.
    if (pincode.pin.length !== 6) {
      setFields({ postal_code: "Enter a 6-digit PIN code." });
      return;
    }
    if (pincode.error === "Invalid PIN code") {
      setFields({ postal_code: "Invalid PIN code" });
      setMessage("We don't deliver to this pincode yet. Please try another address.");
      return;
    }

    startTransition(async () => {
      const result = await setCheckoutAddressAction(formData);
      if (result && !result.ok) {
        setMessage(result.message ?? "Could not save the delivery address.");
        setFields(result.fields ?? {});
      }
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-sp-3" noValidate>
      <Input label="Email" name="email" type="email" defaultValue={defaultEmail} required error={fields.email} />
      <div className="grid grid-cols-2 gap-sp-3">
        <Input label="First name" name="first_name" defaultValue={defaultValues?.first_name ?? ""} required error={fields.first_name} />
        <Input label="Last name" name="last_name" defaultValue={defaultValues?.last_name ?? ""} required error={fields.last_name} />
      </div>
      <Input
        label="Phone"
        name="phone"
        type="tel"
        placeholder="+919876543210"
        defaultValue={defaultValues?.phone ?? ""}
        required
        error={fields.phone}
      />

      {/* ADR-03: building-level and street-level lines are separate fields. */}
      <Input
        label="Flat / House / Office No."
        name="address_1"
        placeholder="Flat 402, Block B"
        defaultValue={defaultValues?.address_1 ?? ""}
        required
        error={fields.address_1}
      />
      <Input
        label="Building / Street / Locality"
        name="address_2"
        placeholder="The Orchid Residency, Sindhu Bhavan Road"
        defaultValue={defaultValues?.address_2 ?? ""}
        required
        error={fields.address_2}
      />
      <Input
        label="Landmark (optional)"
        name="landmark"
        placeholder="Opposite Taj Skyline"
        defaultValue={landmark}
        error={fields.landmark}
      />

      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="font-mono text-label-caps uppercase text-on-surface-variant">
          Address type
        </legend>
        <div className="flex gap-sp-3">
          {[
            { value: "home", label: "Home" },
            { value: "work", label: "Work" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 font-sans text-body-sm text-ink">
              <input
                type="radio"
                name="address_type"
                value={option.value}
                defaultChecked={addressType === option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-sp-3">
        <Input
          label="City"
          name="city"
          value={pincode.city}
          onChange={(event) => pincode.setCity(event.target.value)}
          hint="Auto-filled from your PIN code."
          required
          error={fields.city}
        />
        <Input
          label="State"
          name="province"
          value={pincode.province}
          onChange={(event) => pincode.setProvince(event.target.value)}
          required
          error={fields.province}
        />
      </div>
      <Input
        label="PIN code"
        name="postal_code"
        inputMode="numeric"
        maxLength={6}
        value={pincode.pin}
        onChange={(event) => {
          // A new PIN supersedes the previous rejection: the hook raises its own error if the
          // new one is unknown, so the old form-level message must not linger.
          pincode.changePin(event.target.value);
          setMessage(null);
          setFields((current) => (current.postal_code ? { ...current, postal_code: "" } : current));
        }}
        hint={pincode.looking ? "Looking up…" : undefined}
        required
        error={pincode.error ?? fields.postal_code}
      />

      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full">
        Continue to shipping
      </Button>
    </form>
  );
}
