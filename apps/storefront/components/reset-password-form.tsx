"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { resetPasswordAction } from "@/app/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function submit(formData: FormData) {
    setMessage(null);
    setFields({});
    startTransition(async () => {
      const result = await resetPasswordAction(formData);
      setMessage(result.message ?? null);
      setFields(result.fields ?? {});
      setDone(result.ok);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-md">
        <p role="status" className="border border-line px-4 py-3 font-sans text-body-sm text-ink">
          {message}
        </p>
        <Button type="button" onClick={() => (window.location.href = "/login")}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-md" noValidate>
      <input type="hidden" name="token" value={token} />
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={fields.password}
        hint={fields.password ? undefined : "At least 8 characters."}
      />
      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full" disabled={!token}>
        Reset password
      </Button>
    </form>
  );
}
