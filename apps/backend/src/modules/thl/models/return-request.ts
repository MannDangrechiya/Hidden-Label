import { model } from "@medusajs/framework/utils";

/** RMA header. Table: return_request — docs/DATABASE_PLAN.md §5. */
export const ReturnRequest = model.define("return_request", {
  id: model.id({ prefix: "rma" }).primaryKey(),
  display_id: model.text().unique(),
  order_id: model.text(),
  customer_id: model.text(),
  status: model.text().default("requested"),
  reason_code: model.text(),
  reason_note: model.text().nullable(),
  resolution: model.text().default("refund"),
  awb: model.text().nullable(),
  courier: model.text().nullable(),
  refund_amount: model.number().nullable(),
  refund_payment_id: model.text().nullable(),
  requested_at: model.dateTime().nullable(),
  approved_at: model.dateTime().nullable(),
  received_at: model.dateTime().nullable(),
  closed_at: model.dateTime().nullable(),
});
