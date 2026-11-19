/**
 * Checkout fulfilment constants shared by Server Actions and the client checkout UI.
 *
 * Kept out of `app/actions/checkout.ts` on purpose: a `"use server"` module may only export
 * async functions, so plain constants live here.
 */

/** Prepaid only: UPI and cards through Razorpay. Cash on Delivery is not offered. */
export const RAZORPAY_PROVIDER = "pp_razorpay_razorpay";

export type FulfilmentMode = "home_delivery" | "store_pickup";

export const PICKUP_LOCATION = {
  name: "The Hidden Label — Steller, Sindhu Bhavan Road",
  shortName: "Steller, Sindhu Bhavan Road",
  address: "Steller, 205, 2nd Floor, Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380059",
  hours: "Ready in 2–4 hours for in-stock items",
  instagram: "@thehiddenlabel.official",
} as const;

export function isFulfilmentMode(value: unknown): value is FulfilmentMode {
  return value === "home_delivery" || value === "store_pickup";
}
