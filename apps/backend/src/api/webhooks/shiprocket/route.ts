import crypto from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { sendOrderDeliveredEmail } from "../../../lib/order-email";
import { applyShipmentUpdate } from "../../../lib/shipment-status";
import { recordWebhookEvent } from "../../../lib/webhook-tracking";
import { writeAudit } from "../../../lib/audit";
import { THL_MODULE } from "../../../modules/thl";
import type ThlModuleService from "../../../modules/thl/service";

interface ShiprocketWebhookBody {
  event_id?: string;
  awb?: string;
  current_status?: string;
  shipment_status?: string;
  order_id?: string | number;
  shipment_id?: string | number;
  scan_date?: string;
  courier_name?: string;
}

/**
 * Constant-time comparison to prevent timing side-channel attacks on webhook token.
 */
function verifyWebhookToken(configuredToken: string, providedToken?: string): boolean {
  if (!providedToken) return false;
  const a = Buffer.from(providedToken);
  const b = Buffer.from(configuredToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * POST /webhooks/shiprocket — real-time tracking updates from Shiprocket.
 *
 * SEC-05: Authenticated via constant-time token comparison on header `x-webhook-token`
 * (with fallback to query param `?token=`).
 *
 * Deduplicated via `webhook_event` unique constraint and `shipment_event` unique key,
 * preventing double status transitions and replay storms.
 *
 * Anti-regression: Status progression order is strictly enforced so delayed out-of-order scans
 * cannot revert a `delivered` shipment back to `in_transit`.
 */
export async function POST(req: MedusaRequest<ShiprocketWebhookBody>, res: MedusaResponse) {
  const configuredToken = process.env.SHIPROCKET_WEBHOOK_TOKEN || "secret_shiprocket_webhook_token";
  const providedToken =
    (req.headers["x-webhook-token"] as string | undefined) ??
    (req.query?.token as string | undefined);

  if (!verifyWebhookToken(configuredToken, providedToken)) {
    res.status(401).json({ type: "unauthorized", message: "Invalid or missing webhook token." });
    return;
  }

  const body = req.body ?? {};
  const awb = body.awb;
  const rawStatus = body.current_status ?? body.shipment_status;

  if (!awb || !rawStatus) {
    res.status(400).json({ type: "invalid_data", message: "awb and a status field are required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  // 1. Deduplicate webhook delivery at gateway level via `webhook_event`
  const rawPayloadStr = JSON.stringify(body);
  const payloadHash = crypto.createHash("sha256").update(rawPayloadStr).digest("hex");
  const eventId =
    body.event_id ||
    `sr_evt_${crypto.createHash("sha256").update(`${awb}:${rawStatus}:${body.scan_date || ""}:${payloadHash}`).digest("hex").slice(0, 24)}`;

  const webhookRecord = await recordWebhookEvent(pg, {
    eventId,
    provider: "shiprocket",
    eventType: `shipment.${rawStatus.toLowerCase().replace(/\s+/g, "_")}`,
    entityId: awb,
    payloadHash,
    status: "processed",
  });

  if (webhookRecord.duplicate) {
    logger.info(`Duplicate Shiprocket webhook delivery detected for event ${eventId}; skipping.`);
    res.status(200).json({ received: true, duplicate: true, event_id: eventId });
    return;
  }

  // 2. Locate matching shipment
  const matches = await thl.listShipments({ awb });
  const shipment = matches[0];
  if (!shipment) {
    logger.warn(`Shiprocket webhook for unknown AWB ${awb}; recorded.`);
    res.status(200).json({ received: true, matched: false, event_id: eventId });
    return;
  }

  const eventKey = `${rawStatus}-${body.scan_date ?? new Date().toISOString().slice(0, 19)}`;

  // 3. Apply shipment transition with anti-regression enforcement
  const result = await pg.transaction((trx) =>
    applyShipmentUpdate(trx, shipment, {
      status: rawStatus,
      eventKey,
      courier: body.courier_name ?? shipment.courier ?? undefined,
      source: "shiprocket_webhook",
      rawPayload: body,
    }),
  );

  // 4. If delivered, trigger the delivery notification. The Medusa fulfillment is already
  // marked delivered inside applyShipmentUpdate (shared with the admin path). Email failure
  // degrades gracefully: the scan is saved above, so the webhook must still answer 200 with
  // the skip logged — the same honest pattern as the order confirmation email.
  if (result.status === "delivered" && !result.deduped) {
    try {
      await sendOrderDeliveredEmail(req.scope, shipment.order_id);
    } catch (error) {
      logger.warn(
        `[notification:email:skipped] Order ${shipment.order_id} delivery email could not be sent: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // 5. Audit Event
  await writeAudit(pg, {
    actorType: "webhook",
    actorId: "shiprocket",
    action: `shipment.${result.status}`,
    entityType: "shipment",
    entityId: shipment.id,
    summary: `Shiprocket webhook AWB ${awb} status=${result.status} (regressed=${result.regressed})`,
    changes: {
      status: result.status,
      raw_status: rawStatus,
      regressed: result.regressed,
      event_key: eventKey,
    },
  });

  res.status(200).json({
    received: true,
    matched: true,
    status: result.status,
    regressed: result.regressed,
    deduped: result.deduped,
    event_id: eventId,
  });
}
