import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Knex } from "knex";

/**
 * GET /store/carts/:id/order
 *
 * Looks up the order created from a completed cart.
 * Enables idempotent checkout confirmation so concurrent or repeated checkout
 * attempts gracefully retrieve the created order.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;

  const link = (await pg("order_cart")
    .where({ cart_id: cartId })
    .first("order_id")) as { order_id: string } | undefined;

  if (!link?.order_id) {
    res.status(404).json({
      type: "not_found",
      message: `No order has been completed for cart ${cartId}.`,
    });
    return;
  }

  const order = await pg("order")
    .where({ id: link.order_id })
    .first("id", "display_id", "status", "currency_code", "created_at");

  res.status(200).json({ order });
}
