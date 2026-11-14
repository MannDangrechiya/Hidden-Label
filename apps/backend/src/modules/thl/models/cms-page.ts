import { model } from "@medusajs/framework/utils";

/** CMS page / policy / FAQ / drop. Table: cms_page — docs/DATABASE_PLAN.md §4. */
export const CmsPage = model.define("cms_page", {
  id: model.id({ prefix: "cms" }).primaryKey(),
  slug: model.text().unique(),
  kind: model.text(),
  title: model.text(),
  body_md: model.text().nullable(),
  blocks: model.json().nullable(),
  is_published: model.boolean().default(false),
  published_at: model.dateTime().nullable(),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
});
