import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import { orderEmailHtml, sendEmail } from "./email";
import { isWhatsappConfigured, sendWhatsappTemplate } from "./whatsapp";

/**
 * GAP-EML-02/03: the lifecycle emails all render through `orderEmailHtml`, which previously
 * existed but was never called. Every helper below is best-effort: a mail failure is logged and
 * never blocks an order transition.
 */
function inr(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

interface OrderRow {
  id: string;
  display_id: number | string;
  email: string | null;
  total: number | string;
  shipping_address_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** The lifecycle channel alongside email. Looked up once per message so a missing phone or an
 *  unconfigured account never touches the order's own state. */
async function notifyWhatsapp(
  container: MedusaContainer,
  order: OrderRow,
  template: string,
  params: string[],
): Promise<void> {
  if (!isWhatsappConfigured()) return;
  if (!order.shipping_address_id) return;

  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const address = (await pg("order_address")
    .where({ id: order.shipping_address_id })
    .first("phone")) as { phone: string | null } | undefined;
  if (!address?.phone) return;

  const result = await sendWhatsappTemplate(address.phone, template, params);
  if (!result.sent) {
    logger.info(`WhatsApp (${template}) skipped for order ${order.id}: ${result.reason ?? "not configured"}`);
  }
}

interface OrderLine {
  product_title: string | null;
  title: string | null;
  quantity: number | string;
  unit_price: number | string;
}

export async function sendOrderPlacedEmail(container: MedusaContainer, orderId: string): Promise<void> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const order = (await pg("order").where({ id: orderId }).first(
    "id",
    "display_id",
    "email",
    "total",
    "shipping_address_id",
    "metadata",
  )) as OrderRow | undefined;
  if (!order?.email) return;

  await notifyWhatsapp(
    container,
    order,
    process.env.WHATSAPP_TEMPLATE_ORDER_PLACED ?? "thl_order_placed",
    [`THL-${order.display_id}`, inr(Number(order.total))],
  );

  const lines = (await pg("order_line_item as oli")
    .join("order_item as oi", "oi.item_id", "oli.id")
    .where("oi.order_id", orderId)
    .whereNull("oli.deleted_at")
    .select("oli.product_title", "oli.title", "oi.quantity", "oli.unit_price")) as OrderLine[];

  const result = await sendEmail({
    to: order.email,
    subject: `Order THL-${order.display_id} confirmed — The Hidden Label`,
    html: orderEmailHtml({
      heading: "Your order is confirmed",
      intro:
        "Thank you for your order. We are preparing it now; you will receive another message when it ships.",
      orderDisplayId: `THL-${order.display_id}`,
      total: inr(Number(order.total)),
      lines: lines.map((line) => ({
        title: line.product_title ?? line.title ?? "Item",
        quantity: Number(line.quantity),
        price: inr(Number(line.unit_price) * Number(line.quantity)),
      })),
    }),
    text: `Your order THL-${order.display_id} is confirmed. Total ${inr(Number(order.total))}.`,
  });

  if (!result.sent) {
    logger.info(`order.placed email skipped: ${result.reason ?? "not configured"}`);
  }
}

export async function sendOrderCanceledEmail(container: MedusaContainer, orderId: string): Promise<void> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const order = (await pg("order")
    .where({ id: orderId })
    .first("id", "display_id", "email", "total", "shipping_address_id")) as OrderRow | undefined;
  if (!order?.email) return;

  await notifyWhatsapp(
    container,
    order,
    process.env.WHATSAPP_TEMPLATE_ORDER_CANCELED ?? "thl_order_canceled",
    [`THL-${order.display_id}`],
  );

  await sendEmail({
    to: order.email,
    subject: `Order THL-${order.display_id} cancelled — The Hidden Label`,
    html: orderEmailHtml({
      heading: "Your order was cancelled",
      intro:
        "This order has been cancelled. If a payment was captured, the refund is issued to the original payment method within 5–7 working days.",
      orderDisplayId: `THL-${order.display_id}`,
      total: inr(Number(order.total)),
      lines: [],
    }),
    text: `Order THL-${order.display_id} was cancelled.`,
  });
}

export async function sendOrderShippedEmail(container: MedusaContainer, orderId: string): Promise<void> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const order = (await pg("order")
    .where({ id: orderId })
    .first("id", "display_id", "email", "total", "shipping_address_id")) as OrderRow | undefined;
  if (!order?.email) return;

  await notifyWhatsapp(
    container,
    order,
    process.env.WHATSAPP_TEMPLATE_ORDER_SHIPPED ?? "thl_order_shipped",
    [`THL-${order.display_id}`],
  );

  const shipment = (await pg("shipment")
    .where({ order_id: orderId })
    .whereNull("deleted_at")
    .orderBy("created_at", "desc")
    .first("awb", "courier", "status")) as
    | { awb: string | null; courier: string | null; status: string }
    | undefined;

  const tracking = shipment?.awb
    ? `Track it with ${shipment.courier ?? "our courier"} using AWB ${shipment.awb}.`
    : "Tracking details will appear in your account as soon as the courier scans the parcel.";

  await sendEmail({
    to: order.email,
    subject: `Order THL-${order.display_id} is on its way — The Hidden Label`,
    html: orderEmailHtml({
      heading: "Your order has shipped",
      intro: tracking,
      orderDisplayId: `THL-${order.display_id}`,
      total: inr(Number(order.total)),
      lines: [],
    }),
    text: `Order THL-${order.display_id} shipped. ${tracking}`,
  });
}

export async function sendOrderDeliveredEmail(container: MedusaContainer, orderId: string): Promise<void> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const order = (await pg("order")
    .where({ id: orderId })
    .first("id", "display_id", "email", "total", "shipping_address_id")) as OrderRow | undefined;
  if (!order?.email) return;

  await notifyWhatsapp(
    container,
    order,
    process.env.WHATSAPP_TEMPLATE_ORDER_DELIVERED ?? "thl_order_delivered",
    [`THL-${order.display_id}`],
  );

  await sendEmail({
    to: order.email,
    subject: `Order THL-${order.display_id} delivered — The Hidden Label`,
    html: orderEmailHtml({
      heading: "Delivered",
      intro:
        "Your order has been delivered. Returns are accepted within 7 days of delivery if the piece is unworn with its tags and original box.",
      orderDisplayId: `THL-${order.display_id}`,
      total: inr(Number(order.total)),
      lines: [],
    }),
    text: `Order THL-${order.display_id} delivered.`,
  });
}
