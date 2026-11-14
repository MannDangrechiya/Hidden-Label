"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions/auth";
import type { StoreAddress } from "@/lib/medusa";

export interface AddressFormProps {
  action: (formData: FormData) => Promise<ActionResult>;
  defaultValues?: Partial<StoreAddress>;
  addressId?: string;
  onSaved?: () => void;
  submitLabel?: string;
}

export function AddressForm({ action, defaultValues, addressId, onSaved, submitLabel = "Save address" }: AddressFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function submit(formData: FormData) {
    setMessage(null);
    setFields({});
    if (addressId) formData.set("address_id", addressId);
    startTransition(async () => {
      const result = await action(formData);
      setMessage(result.message ?? null);
      setFields(result.fields ?? {});
      if (result.ok) onSaved?.();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-md" noValidate>
      <div className="grid grid-cols-2 gap-md">
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
      <div className="grid grid-cols-2 gap-md">
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
        {submitLabel}
      </Button>
    </form>
  );
}
