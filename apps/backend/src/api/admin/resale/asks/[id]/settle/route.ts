import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { requireRole } from "../../../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../../../lib/audit";

interface SettleAskBody {
  sold_amount_rupees?: number;
  commission_rate?: number; // e.g. 0.10 for 10%
  payout_reference?: string;
  order_id?: string;
}

/**
 * POST /admin/resale/asks/:id/settle — Settle consignor payout and record platform commission (Phase 8).
 */
export async function POST(
  req: MedusaRequest<SettleAskBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const askId = req.params.id;
  const body = req.body ?? {};
  const soldAmount = Number(body.sold_amount_rupees);
  const commissionRate = Number(body.commission_rate ?? 0.10);

  if (!Number.isFinite(soldAmount) || soldAmount <= 0) {
    res.status(400).json({ type: "invalid_data", message: "A positive sold_amount_rupees is required." });
    return;
  }

  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 1) {
    res.status(400).json({ type: "invalid_data", message: "Commission rate must be a decimal between 0 and 1." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const ask = await pg("resale_ask").where({ id: askId }).first();

  if (!ask) {
    res.status(404).json({ type: "not_found", message: "Resale ask not found." });
    return;
  }

  const commissionRupees = Math.round(soldAmount * commissionRate);
  const payoutAmountRupees = soldAmount - commissionRupees;
  const settlementId = `cst_${randomBytes(8).toString("hex")}`;
  const now = new Date();
  const holdUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day return safety window

  await pg.transaction(async (trx) => {
    await trx("consignor_settlement").insert({
      id: settlementId,
      ask_id: askId,
      order_id: body.order_id ?? null,
      seller_id: ask.seller_id,
      sold_amount_rupees: soldAmount,
      commission_rate: commissionRate,
      commission_rupees: commissionRupees,
      payout_amount_rupees: payoutAmountRupees,
      hold_until: holdUntil,
      status: body.payout_reference ? "disbursed" : "pending",
      disbursed_at: body.payout_reference ? now : null,
      payout_reference: body.payout_reference ?? null,
      created_at: now,
      updated_at: now,
    });

    await trx("resale_ask").where({ id: askId }).update({
      status: "settled",
      updated_at: now,
    });
  });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "resale.settle",
    entityType: "resale_ask",
    entityId: askId,
    summary: `Settlement ${settlementId} recorded for ask ${askId} (Payout: ₹${payoutAmountRupees}, Commission: ₹${commissionRupees})`,
    changes: { sold_amount_rupees: soldAmount, commission_rupees: commissionRupees, payout_amount_rupees: payoutAmountRupees },
    ...meta,
  });

  const settlement = await pg("consignor_settlement").where({ id: settlementId }).first();
  res.json({ settlement, message: "Consignor settlement successfully logged." });
}
