/**
 * Return eligibility is computed from the order and re-checked at approval
 * (docs/ORDER_STATE_MACHINE.md §5). A stored eligibility result is never trusted.
 */
export const RETURN_WINDOW_DAYS = 7;

export interface ReturnEligibilityInput {
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
