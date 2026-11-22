import { model } from "@medusajs/framework/utils";

/**
 * Product Review: Customer ratings and reviews with purchase verification (Phase 5).
 * Table: product_review
 */
export const ProductReview = model.define("product_review", {
  id: model.id({ prefix: "rev" }).primaryKey(),
  product_id: model.text(),
  customer_id: model.text(),
  rating: model.number(),
  title: model.text(),
  body: model.text(),
  author_name: model.text(),
  verified_purchase: model.boolean().default(false),
  status: model.text().default("pending"),
  moderated_by: model.text().nullable(),
  moderated_at: model.dateTime().nullable(),
});
