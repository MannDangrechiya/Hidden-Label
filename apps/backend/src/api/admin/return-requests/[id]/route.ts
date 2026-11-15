import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { processReturnAction } from "../../../../lib/returns";

/**
 * POST /admin/return-requests/:id — approve | reject | receive | refund.
 * Non-colliding route for project RMA actions (matching /store/return-requests).
 */
export async function POST(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const handled = await processReturnAction(req, res, req.params.id);
  if (!handled) {
    res.status(400).json({ type: "invalid_data", message: "A valid action is required." });
  }
}
