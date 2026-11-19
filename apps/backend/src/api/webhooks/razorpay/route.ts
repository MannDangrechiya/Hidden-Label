import crypto from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface RazorpayEvent {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } };
  };
}

/**
 * POST /webhooks/razorpay — GAP-PAY-05.
 *
 * Razorpay signs every delivery with HMAC-SHA256 over the **raw** request body
 * (`X-Razorpay-Signature`, secret = `RAZORPAY_WEBHOOK_SECRET`). The body parser for this route
 * preserves `req.rawBody` (see `src/api/middlewares.ts`), so the signature is checked against
 * exactly the bytes Razorpay signed — never against a re-serialised object.
 *
 * Payment state itself is still advanced by the registered payment provider's canonical hook
 * (`/hooks/payment/razorpay_razorpay`), which runs the same signature verification and the
 * Medusa payment workflow. This endpoint exists so the Razorpay dashboard can be pointed at a
 * dedicated, verifiable URL for every event, and so unverifiable traffic is rejected instead of
 * silently ignored.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    res.status(503).json({
      type: "not_configured",
      message: "Razorpay webhooks are not configured on this environment.",
    });
    return;
  }

  const signature = (req.headers["x-razorpay-signature"] as string | undefined) ?? "";
  const rawBody = (req as MedusaRequest & { rawBody?: Buffer }).rawBody;

  if (!rawBody || !signature) {
    res.status(400).json({ type: "invalid_data", message: "Missing signature or body." });
    return;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    logger.warn("Razorpay webhook rejected: signature mismatch.");
    res.status(401).json({ type: "unauthorized", message: "Invalid webhook signature." });
    return;
  }

  const event = (req.body ?? {}) as RazorpayEvent;
  const entity = event.payload?.payment?.entity;

  logger.info(
    `Razorpay webhook verified: ${event.event ?? "unknown"} payment=${entity?.id ?? "n/a"} order=${entity?.order_id ?? "n/a"} status=${entity?.status ?? "n/a"}`,
  );

  res.status(200).json({ received: true, event: event.event ?? null });
}
