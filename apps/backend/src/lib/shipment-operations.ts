import crypto from "node:crypto";
import type { Knex } from "knex";
import { generateEntityId } from "@medusajs/framework/utils";

export interface ShipmentOperationRow {
  id: string;
  idempotency_key: string;
  order_id: string;
  fulfillment_id: string | null;
  shipment_id: string | null;
  provider_order_id: string | null;
  provider_shipment_id: string | null;
  awb: string | null;
  courier: string | null;
  status: "pending" | "completed" | "failed";
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export type ClaimShipmentResult =
  | { state: "claimed"; operationId: string; idempotencyKey: string }
  | {
      state: "duplicate";
      shipmentId: string | null;
      awb: string | null;
      courier: string | null;
      idempotencyKey: string;
    }
  | { state: "in_progress"; idempotencyKey: string }
  | { state: "failed"; error: string | null; idempotencyKey: string };

export interface ClaimShipmentInput {
  orderId: string;
  fulfillmentId?: string | null;
  action?: string;
  allowRetry?: boolean;
  staleTimeoutMs?: number;
}

const DEFAULT_STALE_TIMEOUT_MS = 45_000;

/**
 * Derives a deterministic idempotency key for shipment dispatch intent.
 * Format: `ship_op_<sha256(orderId:fulfillmentId:action)>`.
 */
export function deriveShipmentIdempotencyKey(
  orderId: string,
  fulfillmentId: string = "default",
  action: string = "create_shipment",
): string {
  const normalised = [orderId.trim(), fulfillmentId.trim(), action.trim()].join(":");
  const hash = crypto.createHash("sha256").update(normalised).digest("hex");
  return `ship_op_${hash}`;
}

/**
 * Atomically claims the right to create a courier shipment for an order.
 * Prevents concurrent clicks or duplicate requests from generating multiple AWBs.
 */
export async function claimShipmentOperation(
  pg: Knex,
  input: ClaimShipmentInput,
): Promise<ClaimShipmentResult> {
  const fulfillmentId = input.fulfillmentId ?? "default";
  const idempotencyKey = deriveShipmentIdempotencyKey(
    input.orderId,
    fulfillmentId,
    input.action ?? "create_shipment",
  );
  const staleTimeoutMs = input.staleTimeoutMs ?? DEFAULT_STALE_TIMEOUT_MS;

  // 1. Authoritative check: If shipment already exists for this order/fulfillment in `shipment` table
  const existingShipment = (await pg("shipment")
    .where({ order_id: input.orderId })
    .whereNotNull("awb")
    .whereNull("deleted_at")
    .first()) as { id: string; awb: string; courier: string } | undefined;

  if (existingShipment) {
    return {
      state: "duplicate",
      shipmentId: existingShipment.id,
      awb: existingShipment.awb,
      courier: existingShipment.courier,
      idempotencyKey,
    };
  }

  // 2. Atomic claim via database transaction
  return pg.transaction(async (trx) => {
    const existing = (await trx("shipment_operation")
      .where({ idempotency_key: idempotencyKey })
      .forUpdate()
      .first()) as ShipmentOperationRow | undefined;

    if (existing) {
      if (existing.status === "completed") {
        return {
          state: "duplicate",
          shipmentId: existing.shipment_id,
          awb: existing.awb,
          courier: existing.courier,
          idempotencyKey,
        };
      }

      if (existing.status === "pending") {
        const ageMs = Date.now() - new Date(existing.created_at).getTime();
        if (ageMs > staleTimeoutMs) {
          // Stale lock recovery: Operation was interrupted or crashed; reclaim it safely
          await trx("shipment_operation")
            .where({ id: existing.id })
            .update({
              created_at: new Date(),
              updated_at: new Date(),
              error: null,
            });

          return {
            state: "claimed",
            operationId: existing.id,
            idempotencyKey,
          };
        }

        return { state: "in_progress", idempotencyKey };
      }

      if (existing.status === "failed") {
        if (input.allowRetry) {
          await trx("shipment_operation")
            .where({ id: existing.id })
            .update({
              status: "pending",
              error: null,
              created_at: new Date(),
              updated_at: new Date(),
            });

          return {
            state: "claimed",
            operationId: existing.id,
            idempotencyKey,
          };
        }

        return {
          state: "failed",
          error: existing.error,
          idempotencyKey,
        };
      }
    }

    // Insert new pending claim
    const id = generateEntityId(undefined, "shpop");
    try {
      await trx("shipment_operation").insert({
        id,
        idempotency_key: idempotencyKey,
        order_id: input.orderId,
        fulfillment_id: input.fulfillmentId ?? null,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      });

      return {
        state: "claimed",
        operationId: id,
        idempotencyKey,
      };
    } catch (insertError: unknown) {
      // Catch unique constraint race condition
      const isUniqueViolation =
        (insertError as { code?: string })?.code === "23505" ||
        String(insertError).includes("unique");

      if (isUniqueViolation) {
        return { state: "in_progress", idempotencyKey };
      }
      throw insertError;
    }
  });
}

/**
 * Marks a claimed shipment operation as successfully completed.
 */
export async function completeShipmentOperation(
  pg: Knex,
  operationId: string,
  details: {
    shipmentId: string;
    providerOrderId?: string | number | null;
    providerShipmentId?: string | number | null;
    awb?: string | null;
    courier?: string | null;
  },
): Promise<void> {
  await pg("shipment_operation")
    .where({ id: operationId })
    .update({
      status: "completed",
      shipment_id: details.shipmentId,
      provider_order_id: details.providerOrderId ? String(details.providerOrderId) : null,
      provider_shipment_id: details.providerShipmentId ? String(details.providerShipmentId) : null,
      awb: details.awb ?? null,
      courier: details.courier ?? null,
      updated_at: new Date(),
    });
}

/**
 * Marks a claimed shipment operation as failed, preserving the error message for retries.
 */
export async function failShipmentOperation(
  pg: Knex,
  operationId: string,
  errorMessage: string,
): Promise<void> {
  await pg("shipment_operation")
    .where({ id: operationId })
    .update({
      status: "failed",
      error: errorMessage,
      updated_at: new Date(),
    });
}
