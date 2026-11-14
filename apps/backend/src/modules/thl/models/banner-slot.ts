import { model } from "@medusajs/framework/utils";

/** Homepage / nav banner with server-evaluated scheduling. Table: banner_slot. */
export const BannerSlot = model.define("banner_slot", {
  id: model.id({ prefix: "ban" }).primaryKey(),
  placement: model.text(),
  page_id: model.text().nullable(),
  image_url: model.text().nullable(),
  headline: model.text().nullable(),
  subhead: model.text().nullable(),
  cta_label: model.text().nullable(),
  cta_href: model.text().nullable(),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),
});
