"use server";

import { revalidatePath } from "next/cache";
import { runOrderAction, updateOrderMetadata, type OrderAction } from "../../../lib/api/orders";
import { BackendError } from "../../../lib/backend";
import { BESPOKE_STAGES, isBespokeStage } from "../../../lib/bespoke";
import { REFUND_REASON_LABELS } from "../../../lib/refund-reasons";

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
  const reasonCode = String(formData.get("reason_code") ?? "").trim();
  const reasonDetail = String(formData.get("reason") ?? "").trim();
  const reason =
    action === "refund"
      ? [REFUND_REASON_LABELS[reasonCode] ?? reasonCode, reasonDetail].filter(Boolean).join(": ") ||
        undefined
      : reasonDetail || undefined;
  const amountRupees = formData.get("amount");

  if (action === "refund" && !reasonCode) {
    return { error: "A reason code is required to refund this order." };
  }
  if (action === "cancel" && !reason) {
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

export interface BespokeStageState {
  error?: string;
  success?: string;
}

/**
 * Advances the master tailor's pipeline. The stage is stored on the order's metadata
 * (`bespoke_stage`) so the storefront/atelier can read it without a new table, and the update
 * merges rather than replacing the rest of the order metadata.
 */
export async function setBespokeStageAction(
  _prev: BespokeStageState,
  formData: FormData,
): Promise<BespokeStageState> {
  const orderId = String(formData.get("order_id") ?? "");
  const stage = String(formData.get("stage") ?? "");

  if (!orderId) return { error: "Missing order reference." };
  if (!isBespokeStage(stage)) return { error: "Unknown tailoring stage." };

  const label = BESPOKE_STAGES.find((entry) => entry.key === stage)?.label ?? stage;

  try {
    await updateOrderMetadata(orderId, {
      bespoke_stage: stage,
      bespoke_stage_updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return {
      error:
        error instanceof BackendError
          ? error.message
          : "Could not update the tailoring stage.",
    };
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/audit");
  return { success: `Tailoring stage set to ${label}.` };
}
