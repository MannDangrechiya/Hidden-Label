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

const SHIPROCKET_MAP: Record<string, ShipmentStatus> = {
  NEW: "pickup_scheduled",
  "PICKUP SCHEDULED": "pickup_scheduled",
  "PICKUP QUEUED": "pickup_scheduled",
  "PICKED UP": "picked_up",
  "IN TRANSIT": "in_transit",
  "OUT FOR DELIVERY": "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
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
