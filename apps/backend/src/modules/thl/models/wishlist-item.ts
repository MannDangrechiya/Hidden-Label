import { model } from "@medusajs/framework/utils";

/** Saved variant for an authenticated customer. Table: wishlist_item. */
export const WishlistItem = model.define("wishlist_item", {
  id: model.id({ prefix: "wsh" }).primaryKey(),
  customer_id: model.text(),
  variant_id: model.text(),
});
