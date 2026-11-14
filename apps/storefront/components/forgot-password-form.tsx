"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(formData);
      setMessage(result.message ?? null);
      setOk(result.ok);
    });
  }

  if (ok) {
    return (
      <p role="status" className="border border-line px-4 py-3 font-sans text-body-sm text-ink">
        {message}
      </p>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-sp-3" noValidate>
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
