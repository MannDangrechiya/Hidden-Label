import crypto from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Knex } from "knex";
import { recordWebhookEvent } from "../../../lib/webhook-tracking";

interface RazorpayEvent {
  id?: string;
  event?: string;
  created_at?: number;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        status?: string;
        error_code?: string;
        error_description?: string;
      };
    };
  };
}

/**
 * POST /webhooks/razorpay — GAP-PAY-05 / Phase 2 payment webhook handling.
 *
 * Razorpay signs every delivery with HMAC-SHA256 over the **raw** request body
 * (`X-Razorpay-Signature`, secret = `RAZORPAY_WEBHOOK_SECRET`). The body parser for this route
 * preserves `req.rawBody` (see `src/api/middlewares.ts`), so the signature is checked against
 * exactly the bytes Razorpay signed — never against a re-serialised object.
 *
 * Implements strict idempotency via `webhook_event`:
 *  - Duplicate webhook deliveries (retries) are recognized by event id or payload hash.
 *  - Duplicate events are acknowledged (HTTP 200) with `duplicate: true` and not reprocessed.
 *  - Verified events leave an immutable audit trail in `audit_event`.
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
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  const eventId =
    (req.headers["x-razorpay-event-id"] as string | undefined) ||
    event.id ||
    `${event.event ?? "evt"}_${entity?.id ?? "pay"}_${payloadHash.slice(0, 16)}`;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;

  // Idempotency deduplication check
  const tracking = await recordWebhookEvent(pg, {
    eventId,
    provider: "razorpay",
    eventType: event.event ?? "unknown",
    entityId: entity?.id,
    payloadHash,
    status: "processed",
  });

  if (tracking.duplicate) {
    logger.info(`Razorpay webhook duplicate ignored: event=${eventId} type=${event.event}`);
    res.status(200).json({ received: true, duplicate: true, event: event.event ?? null });
    return;
  }

  // Audit event for newly verified webhook delivery
  await pg("audit_event").insert({
    actor_type: "webhook",
    actor_id: "razorpay",
    action: event.event ?? "unknown",
    entity_type: "payment",
    entity_id: entity?.id ?? "unknown",
    summary: `Razorpay webhook ${event.event ?? "unknown"} payment=${entity?.id ?? "n/a"} order=${entity?.order_id ?? "n/a"} status=${entity?.status ?? "n/a"}`,
    changes: JSON.stringify({
      amount: entity?.amount,
      order_id: entity?.order_id,
      status: entity?.status,
      error_code: entity?.error_code,
      error_description: entity?.error_description,
    }),
  });

  logger.info(
    `Razorpay webhook verified and recorded: ${event.event ?? "unknown"} payment=${entity?.id ?? "n/a"} order=${entity?.order_id ?? "n/a"} status=${entity?.status ?? "n/a"}`,
  );

  res.status(200).json({ received: true, duplicate: false, event: event.event ?? null });
}
