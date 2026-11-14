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
      // Money is a plain rupee integer everywhere in this project (docs/DATABASE_PLAN.md §13) —
      // never multiply by 100 here. The backend's own default (no amount given) refunds
      // Number(payment.amount) unmultiplied; sending a *100 amount for a custom partial refund
      // would refund 100x the intended value.
      amount: amountRupees ? Math.round(Number(amountRupees)) : undefined,
    });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : `Could not ${action} the order.` };
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");

  const PAST_TENSE: Record<OrderAction, string> = {
    capture: "captured",
    fulfill: "fulfilled",
    cancel: "canceled",
    refund: "refunded",
  };
  return { success: `Order ${PAST_TENSE[action]}.` };
}
