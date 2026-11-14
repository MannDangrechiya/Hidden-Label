"use server";

import { revalidatePath } from "next/cache";
import { createShipment, updateShipment } from "../../../lib/api/shipments";
import { BackendError } from "../../../lib/backend";

export interface ShipmentFormState {
  error?: string;
  success?: boolean;
}

export async function createShipmentAction(
  _prev: ShipmentFormState,
  formData: FormData,
): Promise<ShipmentFormState> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const courier = String(formData.get("courier") ?? "").trim() || undefined;
  if (!orderId) return { error: "An order id is required." };

  try {
    await createShipment(orderId, courier);
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not create the shipment." };
  }
  revalidatePath("/shipments");
  return { success: true };
}

export async function updateShipmentAction(
  _prev: ShipmentFormState,
  formData: FormData,
): Promise<ShipmentFormState> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "").trim() || undefined;
  const awb = String(formData.get("awb") ?? "").trim() || undefined;
  const courier = String(formData.get("courier") ?? "").trim() || undefined;
  const note = String(formData.get("note") ?? "").trim() || undefined;

  try {
    await updateShipment(id, { status, awb, courier, note });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not update the shipment." };
  }
  revalidatePath(`/shipments/${id}`);
  revalidatePath("/shipments");
  return { success: true };
}
