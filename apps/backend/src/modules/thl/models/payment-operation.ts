import { model } from "@medusajs/framework/utils";

/**
 * Phase 2: Persisted payment operation identity for idempotent checkout and capture.
 * Table: payment_operation.
 */
export const PaymentOperation = model.define("payment_operation", {
  id: model.id({ prefix: "payop" }).primaryKey(),
  idempotency_key: model.text().unique(),
  cart_id: model.text(),
  order_id: model.text().nullable(),
  razorpay_order_id: model.text().nullable(),
  razorpay_payment_id: model.text().nullable(),
  amount: model.number(), // integer paise
  currency_code: model.text().default("INR"),
  status: model.text().default("pending"),
  error: model.text().nullable(),
});
