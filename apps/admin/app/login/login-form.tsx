"use client";

import { useActionState } from "react";
import { Button, Input } from "@thl/ui";
import { loginAction, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = {};

export function LoginForm({ from }: { from: string }) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="from" value={from} />
      <Input label="Email" name="email" type="email" autoComplete="username" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      {state.error ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
