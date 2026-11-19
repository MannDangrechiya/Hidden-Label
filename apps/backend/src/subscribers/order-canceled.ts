import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { sendOrderCanceledEmail } from "../lib/order-email";

/** GAP-EML-02: cancellation confirmation email. */
export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string; order_id?: string }>) {
  const orderId = data.order_id ?? data.id;
  if (!orderId) return;
  await sendOrderCanceledEmail(container, orderId);
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
