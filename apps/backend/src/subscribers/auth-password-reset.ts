import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { sendEmail } from "../lib/email";

interface PasswordResetEventData {
  entity_id: string;
  actor_type: string;
  token: string;
}

/**
 * Listens for Medusa's built-in `auth.password_reset` event (emitted by
 * `generateResetPasswordTokenWorkflow`, triggered from
 * `POST /auth/customer/emailpass/reset-password`) and delivers the reset link by email.
 *
 * There is no notification-module provider configured in this project, so the link is sent
 * through the same `sendEmail` helper used for OTP and order mail (Resend when configured,
 * logged otherwise — docs/BUILD_LOG.md records what to supply to activate it).
 */
export default async function authPasswordResetHandler({
  event: { data },
}: SubscriberArgs<PasswordResetEventData>) {
  if (data.actor_type !== "customer") return;

  const storefrontOrigin = process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000";
  const resetUrl = `${storefrontOrigin}/reset-password?token=${encodeURIComponent(data.token)}&email=${encodeURIComponent(
    data.entity_id,
  )}`;

  await sendEmail({
    to: data.entity_id,
    subject: "Reset your The Hidden Label password",
    html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 15 minutes. If you did not request this, you can ignore this message.</p>`,
    text: `Reset your password: ${resetUrl} (expires in 15 minutes)`,
  });
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
};
