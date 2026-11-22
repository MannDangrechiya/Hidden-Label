import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { requireRole } from "../../../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../../../lib/audit";

interface PublishBody {
  location_id?: string;
}

/**
 * POST /admin/resale/asks/:id/publish-inventory — Bridges physical consignment intake into purchasable catalog stock (Phase 8).
 */
export async function POST(
  req: MedusaRequest<PublishBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const askId = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const ask = await pg("resale_ask").where({ id: askId }).first();

  if (!ask) {
    res.status(404).json({ type: "not_found", message: "Resale ask not found." });
    return;
  }

  // Must be authenticated to publish into store inventory
  if (ask.status !== "authenticated") {
    res.status(422).json({
      type: "invalid_state",
      message: `Only physically authenticated items can be published to store inventory. Current status: ${ask.status}.`,
    });
    return;
  }

  const locationId = req.body?.location_id ?? (await pg("stock_location").first("id"))?.id;
  if (!locationId) {
    res.status(422).json({ type: "no_location", message: "No active stock location found." });
    return;
  }

  const now = new Date();
  let updatedStock = 1;

  await pg.transaction(async (trx) => {
    // Map variant to inventory item
    const pvLink = await trx("product_variant_inventory_item")
      .where({ variant_id: ask.variant_id })
      .first("inventory_item_id");

    const inventoryItemId = pvLink?.inventory_item_id ?? `inv_${ask.variant_id}`;

    const level = await trx("inventory_level")
      .where({ inventory_item_id: inventoryItemId, location_id: locationId })
      .forUpdate()
      .first();

    if (!level) {
      await trx("inventory_level").insert({
        id: `il_${randomBytes(8).toString("hex")}`,
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        stocked_quantity: 1,
        reserved_quantity: 0,
        updated_at: now,
      });
      updatedStock = 1;
    } else {
      updatedStock = Number(level.stocked_quantity) + 1;
      await trx("inventory_level")
        .where({ id: level.id })
        .update({
          stocked_quantity: updatedStock,
          updated_at: now,
        });
    }

    // Record in stock movement ledger
    await trx("stock_movement").insert({
      id: `sm_${randomBytes(8).toString("hex")}`,
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      delta: 1,
      movement_type: "manual_adjustment",
      reference_id: askId,
      actor_id: actor.id,
      notes: `Consignment Ask ${askId} authenticated & published to inventory`,
      balance_after: updatedStock,
      created_at: now,
    });
  });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "resale.publish_inventory",
    entityType: "resale_ask",
    entityId: askId,
    summary: `Consignment ask ${askId} published to store inventory (1 unit credited)`,
    changes: { location_id: locationId, variant_id: ask.variant_id, balance_after: updatedStock },
    ...meta,
  });

  res.json({
    ok: true,
    message: "Consignment unit successfully credited to store inventory.",
    stocked_quantity: updatedStock,
  });
}
