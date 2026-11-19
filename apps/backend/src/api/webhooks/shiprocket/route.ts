import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { sendOrderDeliveredEmail } from "../../../lib/order-email";
import { applyShipmentUpdate } from "../../../lib/shipment-status";
import { THL_MODULE } from "../../../modules/thl";
import type ThlModuleService from "../../../modules/thl/service";

interface ShiprocketWebhookBody {
  awb?: string;
  current_status?: string;
  shipment_status?: string;
  order_id?: string | number;
  shipment_id?: string | number;
  scan_date?: string;
}

/**
 * POST /webhooks/shiprocket — real-time tracking updates from Shiprocket.
 *
 * Not covered by the `/admin/*` auth middleware (see `src/api/middlewares.ts`) — this route is
 * intentionally public, because Shiprocket's own servers call it, not a signed-in admin. It is
 * instead protected by a shared token, since Shiprocket's webhook delivery does not sign
 * requests with an HMAC the way Razorpay's does. Configure the same value as
 * `SHIPROCKET_WEBHOOK_TOKEN` here and as the webhook URL's query string / custom header when you
 * register the webhook URL in Shiprocket's dashboard — verify against their current docs
 * (https://apidocs.shiprocket.in/) before activating, since this has not been exercised against
 * a real webhook delivery.
 *
 * Idempotent via `applyShipmentUpdate`'s (shipment_id, event_key) unique constraint, so a
 * replayed webhook (Shiprocket retries on non-2xx) never double-counts a status transition.
 */
export async function POST(req: MedusaRequest<ShiprocketWebhookBody>, res: MedusaResponse) {
  const configuredToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  const providedToken =
    (req.query?.token as string | undefined) ?? (req.headers["x-webhook-token"] as string | undefined);

  if (!configuredToken || providedToken !== configuredToken) {
    res.status(401).json({ type: "unauthorized", message: "Invalid or missing webhook token." });
    return;
  }

  const body = req.body ?? {};
  const awb = body.awb;
  const status = body.current_status ?? body.shipment_status;

  if (!awb || !status) {
    res.status(400).json({ type: "invalid_data", message: "awb and a status field are required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const matches = await thl.listShipments({ awb });
  const shipment = matches[0];
  if (!shipment) {
    // Shiprocket may retry for an AWB we haven't linked yet (race with order creation) — ack
    // with 200 so it doesn't retry forever, but log it since it may need manual reconciliation.
    logger.warn(`Shiprocket webhook for unknown AWB ${awb}; ignoring.`);
    res.status(200).json({ received: true, matched: false });
    return;
  }

  const eventKey = `${status}-${body.scan_date ?? new Date().toISOString().slice(0, 19)}`;

  const result = await pg.transaction((trx) =>
    applyShipmentUpdate(trx, shipment, {
      status,
      eventKey,
      source: "shiprocket_webhook",
      rawPayload: body,
    }),
  );

  /*
   * GAP-LOG-03: a carrier `delivered` scan used to stop at our own `shipment` table, leaving
   * Medusa's fulfilment (and therefore the customer's order page) on "shipped" forever.
   * Reflect the transition into Medusa core, then send the delivery email.
   */
  if (result.status === "delivered" && !result.deduped) {
    try {
      await pg.transaction(async (trx) => {
        const link = (await trx("order_fulfillment")
          .where({ order_id: shipment.order_id })
          .whereNull("deleted_at")
          .first("fulfillment_id")) as { fulfillment_id: string } | undefined;

        if (link?.fulfillment_id) {
          await trx("fulfillment")
            .where({ id: link.fulfillment_id })
            .update({ delivered_at: new Date(), updated_at: new Date() });
        }
      });
    } catch (error) {
      logger.warn(
        `Delivered scan could not be reflected into Medusa fulfilment for order ${shipment.order_id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await sendOrderDeliveredEmail(req.scope, shipment.order_id);
  }

  res.status(200).json({ received: true, matched: true, status: result.status, deduped: result.deduped });
}
