"use server";

import { revalidatePath } from "next/cache";
import {
  publishAdminResaleAsk,
  settleAdminResaleAsk,
  updateAdminResaleAsk,
} from "../../../lib/api/resale";
import { BackendError } from "../../../lib/backend";

export async function updateResaleAskStatusAction(id: string, status: string) {
  try {
    await updateAdminResaleAsk(id, { status });
    revalidatePath("/resale");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof BackendError ? error.message : "Could not update ask status.",
    };
  }
}

export async function publishResaleAskAction(id: string, locationId?: string) {
  try {
    const res = await publishAdminResaleAsk(id, locationId);
    revalidatePath("/resale");
    revalidatePath("/inventory");
    return { success: true, stockedQuantity: res.stocked_quantity };
  } catch (error) {
    return {
      success: false,
      error: error instanceof BackendError ? error.message : "Could not publish ask to inventory.",
    };
  }
}

export async function settleResaleAskAction(
  id: string,
  soldAmountRupees: number,
  commissionRate?: number,
  payoutRef?: string,
) {
  try {
    const defaultRate = process.env.CONSIGNMENT_COMMISSION_RATE
      ? Number(process.env.CONSIGNMENT_COMMISSION_RATE)
      : process.env.THL_RESALE_COMMISSION_RATE
      ? Number(process.env.THL_RESALE_COMMISSION_RATE)
      : 0.15;
    const effectiveRate =
      typeof commissionRate === "number" && Number.isFinite(commissionRate)
        ? commissionRate
        : defaultRate;
    const res = await settleAdminResaleAsk(id, {
      sold_amount_rupees: soldAmountRupees,
      commission_rate: effectiveRate,
      payout_reference: payoutRef,
    });
    revalidatePath("/resale");
    return { success: true, message: res.message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof BackendError ? error.message : "Could not settle consignor payout.",
    };
  }
}
