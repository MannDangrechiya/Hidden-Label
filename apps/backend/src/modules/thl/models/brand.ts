import { model } from "@medusajs/framework/utils";

/**
 * Brand is a first-class navigation object (U-03, U-04, mega menu, A-04), not a tag.
 * Table: brand — see docs/DATABASE_PLAN.md §2.
 */
export const Brand = model.define("brand", {
  id: model.id({ prefix: "brd" }).primaryKey(),
  handle: model.text().unique(),
  name: model.text(),
  legal_name: model.text().nullable(),
  logo_url: model.text().nullable(),
  hero_url: model.text().nullable(),
  tagline: model.text().nullable(),
  description: model.text().nullable(),
  country: model.text().nullable(),
  partnership_tier: model.text().nullable(),
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
  metadata: model.json().nullable(),
});
