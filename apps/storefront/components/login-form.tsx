"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function submit(formData: FormData) {
    setMessage(null);
    setFields({});
    startTransition(async () => {
      const result = await loginAction(formData);
      if (!result.ok) {
        setMessage(result.message ?? "Could not sign in.");
        setFields(result.fields ?? {});
      }
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-md" noValidate>
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fields.email} />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fields.password}
      />

      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
