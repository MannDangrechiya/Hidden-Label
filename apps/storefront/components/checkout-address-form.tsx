"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { setCheckoutAddressAction } from "@/app/actions/checkout";

interface DefaultAddress {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
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

  function submit(formData: FormData) {
    setMessage(null);
    setFields({});
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
      <Input label="Address line 1" name="address_1" defaultValue={defaultValues?.address_1 ?? ""} required error={fields.address_1} />
      <Input label="Address line 2 (optional)" name="address_2" defaultValue={defaultValues?.address_2 ?? ""} error={fields.address_2} />
      <div className="grid grid-cols-2 gap-sp-3">
        <Input label="City" name="city" defaultValue={defaultValues?.city ?? ""} required error={fields.city} />
        <Input label="State" name="province" defaultValue={defaultValues?.province ?? ""} required error={fields.province} />
      </div>
      <Input
        label="PIN code"
        name="postal_code"
        inputMode="numeric"
        maxLength={6}
        defaultValue={defaultValues?.postal_code ?? ""}
        required
        error={fields.postal_code}
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
