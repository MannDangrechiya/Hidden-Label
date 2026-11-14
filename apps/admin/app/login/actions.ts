"use server";

import { redirect } from "next/navigation";
import { loginWithPassword } from "../../lib/api/auth";
import { setSessionToken } from "../../lib/session";
import { BackendError } from "../../lib/backend";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  let token: string;
  try {
    token = await loginWithPassword(email, password);
  } catch (error) {
    if (error instanceof BackendError) {
      return { error: error.message };
    }
    return { error: "Could not sign in. Try again." };
  }

  await setSessionToken(token);
  redirect(from.startsWith("/") ? from : "/");
}
