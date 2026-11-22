import { model } from "@medusajs/framework/utils";

/**
 * FabricSwatch: Atelier luxury textile and fabric swatch catalogue (Phase 7).
 * Table: fabric_swatch
 */
export const FabricSwatch = model.define("fabric_swatch", {
  id: model.id({ prefix: "fab" }).primaryKey(),
  name: model.text(),
  code: model.text().unique(),
  mill: model.text(),
  composition: model.text(),
  weight_gsm: model.number(),
  color: model.text(),
  image_url: model.text().nullable(),
  surcharge_tier: model.text().default("standard"),
  surcharge_rupees: model.number().default(0),
  is_available: model.boolean().default(true),
});
