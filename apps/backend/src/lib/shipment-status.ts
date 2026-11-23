import type { Knex } from "knex";
import { generateEntityId } from "@medusajs/framework/utils";

/**
 * The single courier-status mapper. Admin A-11 and customer U-20 both read through this, so the
 * two can never disagree (docs/ORDER_STATE_MACHINE.md §6).
 */
export type ShipmentStatus =
  | "created"
  | "pickup_scheduled"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "rto"
  | "cancelled";

export const STATUS_RANK: Record<ShipmentStatus, number> = {
  created: 1,
  pickup_scheduled: 2,
  picked_up: 3,
  in_transit: 4,
  out_for_delivery: 5,
  delivered: 6,
  rto: 7,
  cancelled: 7,
};

const SHIPROCKET_MAP: Record<string, ShipmentStatus> = {
  // A Shiprocket order exists but no AWB has been assigned yet: the parcel is not in transit.
  CREATED: "created",
  "AWAITING AWB": "created",
  NEW: "pickup_scheduled",
  "PICKUP SCHEDULED": "pickup_scheduled",
  "PICKUP QUEUED": "pickup_scheduled",
  "PICKED UP": "picked_up",
  "IN TRANSIT": "in_transit",
  "OUT FOR DELIVERY": "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RTO: "rto",
  "RTO INITIATED": "rto",
  "RTO DELIVERED": "rto",
};

export function mapProviderStatus(status: string): ShipmentStatus {
  const normalized = status.trim().toUpperCase();
  if (normalized.startsWith("RTO")) return "rto";
  return SHIPROCKET_MAP[normalized] ?? "in_transit";
}

const CUSTOMER_COPY: Record<ShipmentStatus, string> = {
  created: "Preparing your order",
  pickup_scheduled: "Preparing for pickup",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rto: "Returning to origin",
  cancelled: "Shipment cancelled",
};

export function customerStatus(status: string): string {
  return CUSTOMER_COPY[status as ShipmentStatus] ?? "In transit";
}

/** A shipment with no provider update for 12 hours is flagged stale, not silently trusted. */
export function isStale(lastSyncedAt: string | Date | null | undefined): boolean {
  if (!lastSyncedAt) return false;
  const at = new Date(lastSyncedAt).getTime();
  return Date.now() - at > 12 * 60 * 60 * 1000;
}

export interface ShipmentRow {
  id: string;
  status: string;
  awb: string | null;
  courier: string | null;
  shipped_at: string | Date | null;
  delivered_at: string | Date | null;
}

/**
 * Checks whether an incoming status update is a valid forward progression
 * and avoids invalid status regressions from out-of-order webhook delivery.
 */
export function shouldUpdateShipmentStatus(
  currentStatus: string,
  incomingStatus: ShipmentStatus,
): boolean {
  const currentRank = STATUS_RANK[currentStatus as ShipmentStatus] ?? 0;
  const incomingRank = STATUS_RANK[incomingStatus] ?? 0;

  // Terminal states cannot be reverted by out-of-order scans
  if (currentStatus === "delivered" && incomingStatus !== "delivered") {
    return false;
  }
  if (currentStatus === "rto" && incomingStatus !== "rto") {
    return false;
  }
  if (currentStatus === "cancelled" && incomingStatus !== "cancelled") {
    return false;
  }

  // Allow progression forward or equal rank
  return incomingRank >= currentRank;
}

/**
 * The single place that writes a shipment status transition + its append-only event, used by
 * both the admin manual-update route and the real Shiprocket webhook — so the two can never
 * disagree and a replayed webhook never double-counts (the (shipment_id, event_key) unique
 * constraint makes this idempotent; `source` records who actually triggered it).
 */
export async function applyShipmentUpdate(
  trx: Knex.Transaction,
  shipment: ShipmentRow,
  input: {
    status?: string;
    awb?: string;
    courier?: string;
    eventKey?: string;
    source: "admin" | "shiprocket_webhook";
    note?: string | null;
    rawPayload?: unknown;
  },
) {
  const mappedStatus = input.status ? mapProviderStatus(input.status) : (shipment.status as ShipmentStatus);
  const eventKey = input.eventKey ?? `${mappedStatus}-${new Date().toISOString().slice(0, 19)}`;

  // Determine whether to update main shipment status or keep existing status (anti-regression)
  const canProgress = shouldUpdateShipmentStatus(shipment.status, mappedStatus);
  const targetStatus = canProgress ? mappedStatus : shipment.status;

  const [row] = await trx("shipment")
    .where({ id: shipment.id })
    .update({
      status: targetStatus,
      awb: input.awb ?? shipment.awb,
      courier: input.courier ?? shipment.courier,
      last_synced_at: new Date(),
      shipped_at:
        targetStatus === "picked_up" || targetStatus === "in_transit"
          ? (shipment.shipped_at ?? new Date())
          : shipment.shipped_at,
      delivered_at: targetStatus === "delivered" ? (shipment.delivered_at ?? new Date()) : shipment.delivered_at,
      updated_at: new Date(),
    })
    .returning("*");

  const inserted = await trx("shipment_event")
    .insert({
      id: generateEntityId(undefined, "shpe"),
      shipment_id: shipment.id,
      event_key: eventKey,
      status: mappedStatus,
      occurred_at: new Date(),
      payload: JSON.stringify({
        source: input.source,
        note: input.note ?? null,
        regressed: !canProgress,
        raw: input.rawPayload ?? null,
      }),
    })
    .onConflict(["shipment_id", "event_key"])
    .ignore()
    .returning("id");

  return {
    shipment: row ?? shipment,
    status: targetStatus,
    regressed: !canProgress,
    deduped: inserted.length === 0,
  };
}
