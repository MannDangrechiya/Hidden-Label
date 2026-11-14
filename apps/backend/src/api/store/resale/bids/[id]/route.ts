import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { actorId } from "../../../../../lib/auth";

/**
 * DELETE /store/resale/bids/:id — Cancel an active bid.
 */
export async function DELETE(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to manage your bids." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const bidId = req.params.id;

  const bid = await pg("resale_bid")
    .where({ id: bidId, buyer_id: customerId })
    .whereNull("deleted_at")
    .first();

  if (!bid) {
    res.status(404).json({ type: "not_found", message: "Bid not found or unauthorized." });
    return;
  }

  if (bid.status !== "active") {
    res.status(400).json({ type: "invalid_state", message: `Cannot cancel a bid with status '${bid.status}'.` });
    return;
  }

  await pg("resale_bid")
    .where({ id: bidId })
    .update({ status: "cancelled", updated_at: new Date() });

  res.json({ success: true, message: "Bid cancelled successfully." });
}
