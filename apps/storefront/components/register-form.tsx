"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { registerAction } from "@/app/actions/auth";

export function RegisterForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function submit(formData: FormData) {
    setMessage(null);
    setFields({});
    startTransition(async () => {
      const result = await registerAction(formData);
      if (!result.ok) {
        setMessage(result.message ?? "Could not create your account.");
        setFields(result.fields ?? {});
      }
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-sp-3" noValidate>
      <div className="grid grid-cols-2 gap-sp-3">
        <Input label="First name" name="first_name" autoComplete="given-name" required error={fields.first_name} />
        <Input label="Last name" name="last_name" autoComplete="family-name" required error={fields.last_name} />
      </div>
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fields.email} />
      <Input
        label="Phone (optional)"
        name="phone"
        type="tel"
        placeholder="+919876543210"
        autoComplete="tel"
        error={fields.phone}
        hint={fields.phone ? undefined : "E.164 format, e.g. +919876543210."}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={fields.password}
        hint={fields.password ? undefined : "At least 8 characters."}
      />

      {/* GAP-REG-02: affirmative, unticked DPDP consent before the account is created. */}
      <label className="flex items-start gap-2">
        <input type="checkbox" name="accept_privacy" required className="mt-1" />
        <span className="font-sans text-body-sm text-on-surface-variant">
          I have read and accept the{" "}
          <a href="/policies/privacy" className="underline" target="_blank" rel="noreferrer">
            privacy notice
          </a>{" "}
          and the{" "}
          <a href="/policies/terms" className="underline" target="_blank" rel="noreferrer">
            terms of service
          </a>
          . I understand I can withdraw consent and request erasure of my account at any time.
        </span>
      </label>

      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
