import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { sendOrderShippedEmail } from "../lib/order-email";

/**
 * GAP-EML-02: dispatch notification. `order.fulfillment_created` fires when the warehouse
 * creates the fulfilment, which is the point the customer should be told the parcel is on its
 * way (the courier webhook later sends the delivery message).
 */
export default async function orderFulfillmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ order_id?: string; id?: string }>) {
  const orderId = data.order_id ?? data.id;
  if (!orderId) return;
  await sendOrderShippedEmail(container, orderId);
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
};
