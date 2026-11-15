"use server";

import { readAuthToken } from "@/lib/auth-cookie";
import { submitResaleBid, type SubmittedBid } from "@/lib/resale";

export interface PlaceBidResult {
  ok: boolean;
  message?: string;
  bid?: SubmittedBid;
}

const MAX_BID_RUPEES = 5_000_000;
const MIN_BID_RUPEES = 500;

/**
 * Places a buyer bid against a variant. The price is a plain rupee integer (₹21,999 => 21999) —
 * the backend stores `resale_bid.bid_price` in rupees too, so nothing is multiplied by 100 here.
 */
export async function placeBidAction(input: {
  variantId: string;
  bidPrice: number;
  expiresInDays?: number;
}): Promise<PlaceBidResult> {
  const token = await readAuthToken();
  if (!token) {
    return { ok: false, message: "Sign in to place a bid — your offer is tied to your account." };
  }

  const price = Math.round(Number(input.bidPrice));
  if (!Number.isFinite(price) || price < MIN_BID_RUPEES) {
    return { ok: false, message: `Enter a bid of at least ₹${MIN_BID_RUPEES.toLocaleString("en-IN")}.` };
  }
  if (price > MAX_BID_RUPEES) {
    return { ok: false, message: "That bid is above the platform limit. Contact the boutique directly." };
  }

  const days = input.expiresInDays && [7, 14, 30].includes(input.expiresInDays) ? input.expiresInDays : 30;

  const result = await submitResaleBid(token, {
    variant_id: input.variantId,
    bid_price: price,
    expires_in_days: days,
  });

  if (!result.success) {
    return { ok: false, message: result.error ?? "Could not place that bid." };
  }

  return { ok: true, message: "Your bid is live.", bid: result.bid };
}
