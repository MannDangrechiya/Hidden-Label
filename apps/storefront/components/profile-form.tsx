"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions/auth";

export interface ProfileFormProps {
  action: (formData: FormData) => Promise<ActionResult>;
  defaultValues: { first_name: string; last_name: string; phone: string };
}

export function ProfileForm({ action, defaultValues }: ProfileFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);

  function submit(formData: FormData) {
    setMessage(null);
    setFields({});
    startTransition(async () => {
      const result = await action(formData);
      setMessage(result.message ?? null);
      setFields(result.fields ?? {});
      setOk(result.ok);
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <Input label="First name" name="first_name" defaultValue={defaultValues.first_name} error={fields.first_name} />
      <Input label="Last name" name="last_name" defaultValue={defaultValues.last_name} error={fields.last_name} />
      <Input
        label="Phone"
        name="phone"
        type="tel"
        placeholder="+919876543210"
        defaultValue={defaultValues.phone}
        error={fields.phone}
      />
      {message ? (
        <p role={ok ? "status" : "alert"} className={`font-sans text-body-sm ${ok ? "text-on-surface-variant" : "text-error"}`}>
          {message}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" loading={pending} className="w-full">
        Save profile
      </Button>
    </form>
  );
}
