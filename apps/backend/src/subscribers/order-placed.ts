import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { sendOrderPlacedEmail } from "../lib/order-email";

/**
 * GAP-EML-02/GAP-EML-03: connects Medusa's `order.placed` event to the branded order email
 * that used to be orphaned code.
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await sendOrderPlacedEmail(container, data.id);
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
