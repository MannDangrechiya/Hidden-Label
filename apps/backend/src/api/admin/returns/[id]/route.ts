import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { processReturnAction } from "../../../../lib/returns";

/**
 * POST /admin/returns/:id — approve | reject | receive | refund.
 * Approval re-checks the eligibility window; the value stored at request time is not trusted.
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
