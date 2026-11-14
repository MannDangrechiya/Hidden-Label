"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { requestOtpAction, verifyOtpAction } from "@/app/actions/auth";

export interface VerifyFormProps {
  destination: string;
  purpose: string;
  redirectTo: string;
}

/**
 * U-17 OTP Verification. Decision Q6: OTP verifies the registered email/phone, it is not the
 * primary login method. `sendOtp`/`verifyOtp` map 1:1 to the custom `/store/otp/send` and
 * `/store/otp/verify` routes, including their rate limit (3/15min) and attempt limit (5).
 */
export function VerifyForm({ destination, purpose, redirectTo }: VerifyFormProps) {
  const [pending, startTransition] = useTransition();
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  function sendCode() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestOtpAction(destination, purpose);
      setMessage(result.message ?? null);
      if (result.ok) {
        setChallengeId(result.challengeId ?? null);
        setDevCode(result.devCode ?? null);
        setCooldown(true);
        setTimeout(() => setCooldown(false), 30_000);
      }
    });
  }

  function submit(formData: FormData) {
    setMessage(null);
    if (challengeId) formData.set("challenge_id", challengeId);
    formData.set("redirect_to", redirectTo);
    startTransition(async () => {
      const result = await verifyOtpAction(formData);
      if (result && !result.ok) setMessage(result.message ?? "Could not verify that code.");
    });
  }

  return (
    <div className="flex flex-col gap-sp-3">
      <p className="font-sans text-body-sm text-on-surface-variant">
        We send a six-digit code to <strong>{destination}</strong>.
      </p>

      <Button type="button" variant="secondary" onClick={sendCode} loading={pending} disabled={cooldown}>
        {cooldown ? "Code sent — wait to resend" : "Send verification code"}
      </Button>

      {devCode ? (
        <p className="font-mono text-label-caps uppercase text-accent">
          Dev-only echo (OTP_DEV_ECHO): {devCode}
        </p>
      ) : null}

      <form
        action={(formData) => {
          const codeFromForm = String(formData.get("code") ?? "");
          if (!challengeId && !codeFromForm) return;
          submit(formData);
        }}
        className="flex flex-col gap-sp-3"
      >
        <input type="hidden" name="challenge_id" value={challengeId ?? ""} />
        <Input
          label="Six-digit code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
        {message ? (
          <p role="alert" className="font-sans text-body-sm text-error">
            {message}
          </p>
        ) : null}
        <Button type="submit" loading={pending} className="w-full">
          Verify
        </Button>
      </form>
    </div>
  );
}
