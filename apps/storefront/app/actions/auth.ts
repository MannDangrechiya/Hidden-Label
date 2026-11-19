"use server";

import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "@thl/shared";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearAuthToken, writeAuthToken } from "@/lib/auth-cookie";
import {
  authLogin,
  authRegister,
  confirmPasswordReset,
  createCustomerAccount,
  MedusaError,
  requestPasswordReset,
  sendOtp,
  verifyOtp,
} from "@/lib/medusa";

export interface ActionResult {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
}

/**
 * Registration is three Medusa calls (per docs/BUILD_LOG.md: verified against the installed
 * 2.22.7 package, there is no single "sign up" endpoint):
 *   1. POST /auth/customer/emailpass/register -> actorless token
 *   2. POST /store/customers with that token -> customer record
 *   3. POST /auth/customer/emailpass (login) -> a token with the customer attached
 * Then an OTP is sent to the registered email so `/verify` can confirm it, per decision Q6.
 */
export async function registerAction(formData: FormData): Promise<ActionResult> {
  // GAP-REG-02: DPDP Act 2023 requires an affirmative, specific consent — not a pre-ticked box
  // buried in the terms.
  const consent = formData.get("accept_privacy");
  if (consent !== "on" && consent !== "true") {
    return {
      ok: false,
      message: "Please accept the privacy notice and terms to create an account.",
      fields: { accept_privacy: "Required" },
    };
  }

  const parsed = registerSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
    return { ok: false, message: "Check the highlighted fields.", fields };
  }

  const { email, password, first_name, last_name, phone } = parsed.data;

  try {
    const registrationToken = await authRegister(email, password);
    await createCustomerAccount(registrationToken, {
      email,
      first_name,
      last_name,
      ...(phone ? { phone } : {}),
      // Stored proof of consent with the policy version (DPDP §6).
      metadata: {
        privacy_consent_at: new Date().toISOString(),
        privacy_policy_version: "2026-11",
      },
    });
    const sessionToken = await authLogin(email, password);
    await writeAuthToken(sessionToken);
  } catch (error) {
    const message =
      error instanceof MedusaError
        ? error.message
        : `Could not create your account: ${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, message };
  }

  revalidatePath("/", "layout");
  redirect("/verify?purpose=email_verify");
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
    return { ok: false, message: "Check the highlighted fields.", fields };
  }

  try {
    const token = await authLogin(parsed.data.email, parsed.data.password);
    await writeAuthToken(token);
  } catch {
    // A distinct message would reveal whether the email is registered.
    return { ok: false, message: "That email and password combination is not recognised." };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function logoutAction(): Promise<void> {
  await clearAuthToken();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }

  try {
    await requestPasswordReset(parsed.data.email);
  } catch {
    // Still report success — do not reveal whether the address has an account.
  }

  return { ok: true, message: "If that email has an account, a reset link is on its way." };
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
    return { ok: false, message: "Check the highlighted fields.", fields };
  }

  try {
    await confirmPasswordReset(parsed.data.token, parsed.data.password);
  } catch (error) {
    const message =
      error instanceof MedusaError
        ? error.message
        : "This reset link is invalid or has expired. Request a new one.";
    return { ok: false, message };
  }

  return { ok: true, message: "Your password has been reset. You can sign in now." };
}

export interface OtpSendActionResult extends ActionResult {
  challengeId?: string;
  /** Only present when `OTP_DEV_ECHO=true` outside production — never in a real environment. */
  devCode?: string;
}

export async function requestOtpAction(
  destination: string,
  purpose: string,
): Promise<OtpSendActionResult> {
  try {
    const result = await sendOtp({ destination, channel: "email", purpose });
    return {
      ok: true,
      challengeId: result.challenge_id,
      devCode: result.dev_code,
      message: result.delivered
        ? "A verification code has been sent."
        : `Code generated, but delivery is not configured (${result.delivery_note ?? "no email provider"}).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not send a verification code.",
    };
  }
}

export async function verifyOtpAction(formData: FormData): Promise<ActionResult> {
  const challengeId = String(formData.get("challenge_id") ?? "");
  const code = String(formData.get("code") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "/account");

  if (!challengeId) {
    return { ok: false, message: "Request a code first." };
  }

  try {
    await verifyOtp({ challenge_id: challengeId, code });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not verify that code.",
    };
  }

  redirect(redirectTo);
}
