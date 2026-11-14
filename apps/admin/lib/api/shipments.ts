import "server-only";
import { backendFetch } from "../backend";

export interface Shipment {
  id: string;
  order_id: string;
  order_display_id: string;
  provider: string;
  courier: string | null;
  awb: string | null;
  status: string;
  status_label: string;
  stale: boolean;
  shipped_at: string | null;
  delivered_at: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  event_key: string;
  status: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

/** GET /admin/shipments — backs A-11. */
export async function fetchShipments(): Promise<Shipment[]> {
  const { shipments } = await backendFetch<{ shipments: Shipment[] }>("/admin/shipments");
  return shipments;
}

export async function fetchShipment(
  id: string,
): Promise<{ shipment: Shipment; events: ShipmentEvent[] }> {
  return backendFetch<{ shipment: Shipment; events: ShipmentEvent[] }>(`/admin/shipments/${id}`);
}

export async function createShipment(orderId: string, courier?: string): Promise<Shipment> {
  const { shipment } = await backendFetch<{ shipment: Shipment }>("/admin/shipments", {
    method: "POST",
    body: { order_id: orderId, courier },
  });
  return shipment;
}

export async function updateShipment(
  id: string,
  input: { status?: string; awb?: string; courier?: string; note?: string },
): Promise<Shipment> {
  const { shipment } = await backendFetch<{ shipment: Shipment }>(`/admin/shipments/${id}`, {
    method: "POST",
    body: input,
  });
  return shipment;
}
