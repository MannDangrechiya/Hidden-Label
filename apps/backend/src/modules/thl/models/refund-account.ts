import { model } from "@medusajs/framework/utils";

/**
 * GAP-PAY-04: a COD order has no payment instrument to refund to, so the customer
 * must supply a UPI VPA or bank account. Stored against the return/order and shown to
 * operations before a manual payout is released.
 *
 * Table: refund_account.
 */
export const RefundAccount = model.define("refund_account", {
  id: model.id({ prefix: "rfa" }).primaryKey(),
  customer_id: model.text(),
  order_id: model.text(),
  return_request_id: model.text().nullable(),
  method: model.text(), // "upi" | "bank"
  upi_id: model.text().nullable(),
  account_name: model.text().nullable(),
  account_number: model.text().nullable(),
  ifsc: model.text().nullable(),
  bank_name: model.text().nullable(),
  verified_at: model.dateTime().nullable(),
});
