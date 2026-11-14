"use server";

import { revalidatePath } from "next/cache";
import { runOrderAction, type OrderAction } from "../../../lib/api/orders";
import { BackendError } from "../../../lib/backend";

export interface OrderActionState {
  error?: string;
  success?: string;
}

export async function orderActionHandler(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const orderId = String(formData.get("order_id") ?? "");
  const action = String(formData.get("action") ?? "") as OrderAction;
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const amountRupees = formData.get("amount");

  if ((action === "cancel" || action === "refund") && !reason) {
    return { error: `A reason is required to ${action} this order.` };
  }

  try {
    await runOrderAction(orderId, action, {
      reason,
      amount: amountRupees ? Math.round(Number(amountRupees) * 100) : undefined,
    });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : `Could not ${action} the order.` };
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { success: `Order ${action}ed.` };
}
