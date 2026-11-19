import { model } from "@medusajs/framework/utils";

/**
 * GAP-SUP-01: interactive support channel behind the storefront contact form.
 * Consumer Protection (E-Commerce) Rules, 2020 require a real, recorded grievance
 * channel — not a static FAQ page.
 *
 * Table: support_ticket.
 */
export const SupportTicket = model.define("support_ticket", {
  id: model.id({ prefix: "tkt" }).primaryKey(),
  display_id: model.text().unique(),
  customer_id: model.text().nullable(),
  name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  order_id: model.text().nullable(),
  category: model.text().default("general"),
  subject: model.text(),
  message: model.text(),
  status: model.text().default("open"),
  priority: model.text().default("normal"),
  assigned_to: model.text().nullable(),
  resolution: model.text().nullable(),
  resolved_at: model.dateTime().nullable(),
});
