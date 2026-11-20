/**
 * Return eligibility is computed from the order and re-checked at approval
 * (docs/ORDER_STATE_MACHINE.md §5). A stored eligibility result is never trusted.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "./admin-auth";
import { requestMeta, writeAudit } from "./audit";
import { computePackage } from "./package";
import { createShiprocketReturn, isConfigured as shiprocketConfigured } from "./shiprocket";
import { mergeRestockLines, restockReturn, type RestockLine, type RestockOutcome } from "./return-restock";
import { resolveStockLocation } from "./stock-location";

export const RETURN_WINDOW_DAYS = 7;

export interface ReturnEligibilityInput {
  /** The order's *fulfillment* status (Medusa's OrderFulfillmentStatus) — "delivered" lives
   * here, never on `order.status` (OrderStatus has no such value). */
  orderStatus: string;
  deliveredAt: string | Date | null;
  itemQuantity: number;
  alreadyReturned: number;
  finalSale?: boolean;
}

export interface ReturnEligibility {
  eligible: boolean;
  reason?: string;
}

export function checkReturnEligibility(input: ReturnEligibilityInput): ReturnEligibility {
  if (input.finalSale) {
    return { eligible: false, reason: "Final-sale items cannot be returned." };
  }
  if (input.orderStatus !== "delivered") {
    return {
      eligible: false,
      reason: "Returns open once the order has been delivered.",
    };
  }
  if (!input.deliveredAt) {
    return { eligible: false, reason: "The delivery date is not recorded on this order." };
  }
  const delivered = new Date(input.deliveredAt).getTime();
  const days = (Date.now() - delivered) / (24 * 60 * 60 * 1000);
  if (days > RETURN_WINDOW_DAYS) {
    return {
      eligible: false,
      reason: `The ${RETURN_WINDOW_DAYS}-day return window has closed.`,
    };
  }
  const remaining = input.itemQuantity - input.alreadyReturned;
  if (remaining <= 0) {
    return { eligible: false, reason: "Every unit on this line has already been returned." };
  }
  return { eligible: true };
}

const ACTIONS = ["approve", "reject", "receive", "refund"] as const;
export type Action = (typeof ACTIONS)[number];

/** MF-29: the reverse-inspection grade recorded when a returned unit is received back. */
const CONDITIONS = ["resellable", "damaged", "disposed"] as const;
export type Condition = (typeof CONDITIONS)[number];

export async function processReturnAction(
  req: MedusaRequest,
  res: MedusaResponse,
  returnId: string,
): Promise<boolean> {
  const body = (req.body ?? {}) as {
    action?: Action;
    note?: string;
    condition?: Condition;
    /** R-07: optional explicit location for a restock when the business has more than one. */
    location_id?: string;
  };
  const action = body.action;
  if (!action || !ACTIONS.includes(action)) {
    return false;
  }

  const actor = await requireRole(req, res, "operations");
  if (!actor) return true;

  if (action === "receive" && (!body.condition || !CONDITIONS.includes(body.condition))) {
    res.status(400).json({
      type: "invalid_data",
      message: `A reverse-inspection condition is required: ${CONDITIONS.join(", ")}.`,
    });
    return true;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const request = await pg("return_request")
    .where({ id: returnId })
    .whereNull("deleted_at")
    .first();
  if (!request) {
    res.status(404).json({ type: "not_found", message: "Return request not found." });
    return true;
  }

  if (action === "approve") {
    const delivered = await pg("fulfillment as f")
      .join("order_fulfillment as fo", "fo.fulfillment_id", "f.id")
      .where("fo.order_id", request.order_id)
      .whereNotNull("f.delivered_at")
      .max("f.delivered_at as delivered_at")
      .first();

    const items = await pg("return_request_item").where({ return_request_id: request.id });
    let itemQuantity = 0;
    for (const item of items) {
      const orderItem = await pg("order_item").where({ id: item.order_item_id }).first("quantity");
      itemQuantity += Number(orderItem?.quantity ?? 0);
    }

    const eligibility = checkReturnEligibility({
      orderStatus: delivered?.delivered_at ? "delivered" : "not_fulfilled",
      deliveredAt: delivered?.delivered_at ?? null,
      itemQuantity: itemQuantity || 1,
      alreadyReturned: 0,
    });

    if (!eligibility.eligible) {
      res.status(422).json({
        type: "not_eligible",
        message: eligibility.reason ?? "This return is no longer eligible.",
      });
      return true;
    }
  }

  // R-07: resolve the destination location *before* any state changes, so an ambiguous or
  // unknown location refuses the request instead of silently skipping the restock.
  let restockPlan: { locationId: string; lines: RestockLine[] } | null = null;
  if (action === "receive" && body.condition === "resellable") {
    const rows = (await pg("return_request_item as rri")
      .join("order_line_item as oli", "oli.id", "rri.order_item_id")
      .where("rri.return_request_id", request.id)
      .select("oli.variant_id as variant_id", "rri.quantity as quantity")) as {
      variant_id: string | null;
      quantity: number | string;
    }[];

    const variantIds = [
      ...new Set(rows.map((row) => row.variant_id).filter((id): id is string => Boolean(id))),
    ];

    const links = variantIds.length
      ? ((await pg("product_variant_inventory_item")
          .whereIn("variant_id", variantIds)
          .select("variant_id", "inventory_item_id")) as {
          variant_id: string;
          inventory_item_id: string;
        }[])
      : [];
    const inventoryByVariant = new Map(
      links.map((link) => [link.variant_id, link.inventory_item_id]),
    );

    const lines = mergeRestockLines(
      rows.map((row) => ({
        inventoryItemId: row.variant_id ? (inventoryByVariant.get(row.variant_id) ?? "") : "",
        quantity: Number(row.quantity) || 0,
      })),
    );

    if (lines.length > 0) {
      const decision = await resolveStockLocation(pg, {
        orderId: request.order_id,
        requestedLocationId: body.location_id ?? null,
      });

      if (!decision.ok) {
        res.status(decision.status).json({ type: decision.code, message: decision.message });
        return true;
      }

      restockPlan = { locationId: decision.locationId, lines };
    }
  }

  // Held in an object so TypeScript does not narrow it to `null` for code that runs after the
  // transaction callback (it cannot know the callback always executes).
  const restockState: { outcome: RestockOutcome | null } = { outcome: null };

  const nextStatus =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : action === "receive"
          ? "received"
          : "refunded";

  const updated = await pg.transaction(async (trx) => {
    const patch: Record<string, unknown> = { status: nextStatus, updated_at: new Date() };
    if (action === "approve") patch.approved_at = new Date();
    if (action === "receive") {
      patch.received_at = new Date();
      patch.condition = body.condition;
      patch.condition_note = body.note ?? null;
    }
    if (action === "refund" || action === "reject") patch.closed_at = new Date();

    const [row] = await trx("return_request")
      .where({ id: request.id })
      .update(patch)
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: `return.${action}`,
      entityType: "return_request",
      entityId: request.id,
      summary: `${request.display_id} ${action}d by ${actor.email ?? actor.id}`,
      changes: {
        from: request.status,
        to: nextStatus,
        note: body.note ?? null,
        ...(action === "receive" ? { condition: body.condition } : {}),
      },
      ...meta,
    });

    // MF-29: only a unit graded resellable goes back into sellable stock — a damaged or
    // disposed return closes the loop without ever touching inventory.
    //
    // R-05: the row is locked here and `restockReturn` compare-and-sets `restocked_at`, so two
    // concurrent receives cannot both add the returned units, and a retried receive never adds
    // them again. Each increment goes through the locked `applyStockDelta`.
    if (action === "receive" && restockPlan) {
      const locked = (await trx("return_request")
        .where({ id: request.id })
        .forUpdate()
        .first("id", "restocked_at")) as { id: string; restocked_at: Date | null } | undefined;

      if (locked?.restocked_at) {
        restockState.outcome = {
          restocked: false,
          reason: "already_restocked",
          locationId: restockPlan.locationId,
          units: 0,
          skipped: [],
        };
      } else {
        restockState.outcome = await restockReturn(trx, {
          returnRequestId: request.id,
          displayId: request.display_id,
          locationId: restockPlan.locationId,
          lines: restockPlan.lines,
          audit: { actorId: actor.id, ip: meta.ip, userAgent: meta.userAgent },
        });

        if (restockState.outcome.restocked) {
          row.restocked_at = new Date();
        }
      }
    }

    return row;
  });

  // GAP-LOG-04: an approved return gets a real reverse pickup. A provider failure never
  // blocks the approval — operations simply receive no AWB and arrange the pickup manually.
  let reversePickupNote: string | undefined;
  if (action === "approve" && shiprocketConfigured()) {
    try {
      const order = (await pg("order")
        .where({ id: request.order_id })
        .first("display_id", "email", "shipping_address_id", "metadata")) as
        | { display_id: number | string; email: string | null; shipping_address_id: string | null; metadata?: Record<string, unknown> | null }
        | undefined;

      const address = order?.shipping_address_id
        ? ((await pg("order_address").where({ id: order.shipping_address_id }).first()) as Record<
            string,
            unknown
          > | undefined)
        : undefined;

      const items = (await pg("return_request_item as rri")
        .join("order_line_item as oli", "oli.id", "rri.order_item_id")
        .leftJoin("product as p", "p.id", "oli.product_id")
        .where("rri.return_request_id", request.id)
        .select(
          "oli.product_title",
          "oli.variant_sku",
          "rri.quantity",
          "oli.unit_price",
          "p.metadata as product_metadata",
        )) as Record<string, unknown>[];

      if (order && address && items.length > 0) {
        const pkg = computePackage(
          items.map((item) => {
            const meta = (item.product_metadata ?? {}) as Record<string, unknown>;
            return {
              quantity: Number(item.quantity ?? 1),
              category: typeof meta.category === "string" ? meta.category : null,
              metadata: meta,
            };
          }),
        );

        const reverse = await createShiprocketReturn({
          rmaNumber: String(request.display_id),
          originalOrderDisplayId: String(order.display_id),
          pickupCustomerName: `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim() || "Customer",
          pickupAddressLine1: String(address.address_1 ?? ""),
          pickupAddressLine2: address.address_2 ? String(address.address_2) : undefined,
          pickupCity: String(address.city ?? ""),
          pickupState: String(address.province ?? ""),
          pickupPincode: String(address.postal_code ?? ""),
          pickupPhone: String(address.phone ?? ""),
          pickupEmail: order.email ?? "",
          items: items.map((item) => ({
            name: String(item.product_title ?? "Item"),
            sku: String(item.variant_sku ?? item.product_title ?? "SKU"),
            units: Number(item.quantity ?? 1),
            selling_price: Number(item.unit_price ?? 0),
          })),
          subTotalRupees: items.reduce(
            (sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.quantity ?? 1),
            0,
          ),
          weightKg: pkg.chargeableWeightKg,
          lengthCm: pkg.lengthCm,
          breadthCm: pkg.breadthCm,
          heightCm: pkg.heightCm,
        });

        await pg("return_request")
          .where({ id: request.id })
          .update({
            awb: reverse.awb,
            courier: reverse.courierName,
            updated_at: new Date(),
          });

        reversePickupNote = reverse.awb
          ? `Reverse pickup booked with ${reverse.courierName ?? "the courier"} (AWB ${reverse.awb}).`
          : "Reverse pickup created; the courier AWB will appear once assigned.";
      }
    } catch (error) {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
      logger.warn(
        `Reverse pickup failed for ${request.display_id}, arrange manually: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      reversePickupNote =
        "Reverse pickup could not be booked automatically — arrange a manual pickup. See server logs.";
    }
  }

  const restockOutcome: RestockOutcome | null = restockState.outcome;
  const restockNote =
    restockOutcome?.reason === "already_restocked"
      ? "Stock was already restocked for this return; nothing was added twice."
      : restockOutcome?.reason === "nothing_to_restock" && restockOutcome.skipped.length > 0
        ? "Return received, but no matching inventory level was found, so stock was not changed."
        : undefined;

  res.json({
    return: updated,
    restock: restockOutcome ?? undefined,
    note:
      restockNote ??
      (action === "refund" && request.refund_amount
        ? "Refund recorded. Manual payments are settled offline; card payments refund through the provider."
        : reversePickupNote),
  });
  return true;
}
