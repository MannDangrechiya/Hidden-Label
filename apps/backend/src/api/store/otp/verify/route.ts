import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { codeMatches, OTP_MAX_ATTEMPTS } from "../../../../lib/otp";
import { THL_MODULE } from "../../../../modules/thl";
import type ThlModuleService from "../../../../modules/thl/service";

interface Body {
  challenge_id?: string;
  code?: string;
}

/** POST /store/otp/verify — single-use, 5 attempts, 5 minute expiry, enforced server-side. */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const challengeId = req.body?.challenge_id;
  const code = (req.body?.code ?? "").trim();

  if (!challengeId || !/^\d{6}$/.test(code)) {
    res.status(400).json({
      type: "invalid_data",
      message: "Enter the six-digit code from your message.",
    });
    return;
  }

  const challenge = await thl.retrieveOtpChallenge(challengeId).catch(() => null);
  if (!challenge) {
    res.status(400).json({ type: "invalid_data", message: "This code is no longer valid." });
    return;
  }

  if (challenge.consumed_at) {
    res.status(400).json({ type: "invalid_data", message: "This code has already been used." });
    return;
  }

  if (new Date(challenge.expires_at as unknown as string).getTime() < Date.now()) {
    res.status(400).json({ type: "invalid_data", message: "This code has expired. Request a new one." });
    return;
  }

  if (challenge.attempts >= (challenge.max_attempts ?? OTP_MAX_ATTEMPTS)) {
    res.status(429).json({
      type: "rate_limited",
      message: "Too many attempts. Request a new code.",
    });
    return;
  }

  if (!codeMatches(challenge.destination, code, challenge.code_hash)) {
    await thl.updateOtpChallenges({ id: challenge.id, attempts: challenge.attempts + 1 });
    res.status(400).json({
      type: "invalid_data",
      message: `That code is not correct. ${Math.max(
        0,
        (challenge.max_attempts ?? OTP_MAX_ATTEMPTS) - challenge.attempts - 1,
      )} attempts remaining.`,
    });
    return;
  }

  await thl.updateOtpChallenges({ id: challenge.id, consumed_at: new Date() });
  res.json({ verified: true, destination: challenge.destination, purpose: challenge.purpose });
}
