import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { actorId } from "../../../../../lib/auth";

/**
 * DELETE /store/resale/asks/:id — Cancel/delist an active ask.
 */
export async function DELETE(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const sellerId = actorId(req);
  if (!sellerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to manage your listings." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const askId = req.params.id;

  const ask = await pg("resale_ask")
    .where({ id: askId, seller_id: sellerId })
    .whereNull("deleted_at")
    .first();

  if (!ask) {
    res.status(404).json({ type: "not_found", message: "Ask not found or unauthorized." });
    return;
  }

  if (ask.status !== "active") {
    res.status(400).json({ type: "invalid_state", message: `Cannot cancel an ask with status '${ask.status}'.` });
    return;
  }

  await pg("resale_ask")
    .where({ id: askId })
    .update({ status: "cancelled", updated_at: new Date() });

  res.json({ success: true, message: "Listing cancelled successfully." });
}
