import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { codeMatches, OTP_MAX_ATTEMPTS } from "../../../../../lib/otp";
import { THL_MODULE } from "../../../../../modules/thl";
import type ThlModuleService from "../../../../../modules/thl/service";

interface Body {
  challenge_id?: string;
  code?: string;
}

/**
 * POST /store/carts/:id/verify-cod — GAP-SEC-02 fix.
 *
 * The only writer of a Cash-on-Delivery verification proof. It requires a real, unconsumed,
 * unexpired `otp_challenge` row and its six-digit code, then records the proof in the
 * server-only `cod_verification` table. `POST /store/carts/:id/complete` checks that table,
 * so writing `cart.metadata.cod_otp_verified_at` through the public cart API no longer works
 * (the cart middleware also strips those keys).
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const cartId = (req.params as Record<string, string | undefined>)?.id;
  if (!cartId) {
    res.status(400).json({ type: "invalid_data", message: "A cart id is required." });
    return;
  }

  const challengeId = req.body?.challenge_id;
  const code = (req.body?.code ?? "").trim();
  if (!challengeId || !/^\d{6}$/.test(code)) {
    res.status(400).json({
      type: "invalid_data",
      message: "Enter the six-digit code from your message.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);

  const cart = await pg("cart").where({ id: cartId }).whereNull("deleted_at").first("id", "metadata");
  if (!cart) {
    res.status(404).json({ type: "not_found", message: "Cart not found." });
    return;
  }

  const challenge = await thl.retrieveOtpChallenge(challengeId).catch(() => null);
  if (!challenge || challenge.purpose !== "cod_verify") {
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

  const verifiedAt = new Date();

  await thl.updateOtpChallenges({ id: challenge.id, consumed_at: verifiedAt });

  await pg("cod_verification").insert({
    id: generateEntityId(undefined, "codv"),
    cart_id: cartId,
    phone: challenge.destination,
    challenge_id: challenge.id,
    verified_at: verifiedAt,
  });

  // Display-only copy on the cart. The client cannot write these keys (middleware strips
  // them) and the completion gate never reads them.
  await pg("cart")
    .where({ id: cartId })
    .update({
      metadata: pg.raw(
        `coalesce(metadata, '{}'::jsonb) || ?::jsonb`,
        [JSON.stringify({ cod_otp_verified_phone: challenge.destination, cod_otp_verified_at: verifiedAt.toISOString() })],
      ),
      updated_at: verifiedAt,
    });

  res.json({ verified: true, phone: challenge.destination, cart_id: cartId });
}
