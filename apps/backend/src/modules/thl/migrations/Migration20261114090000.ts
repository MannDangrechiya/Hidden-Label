import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * P3 · migration 1 of 4 — brand + product_brand.
 * Brand is a navigational object, so it gets its own table; the link table allows a collab
 * product to belong to two brands (docs/DATABASE_PLAN.md §2).
 */
export class Migration20261114090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "brand" (
        "id" text not null,
        "handle" text not null,
        "name" text not null,
        "legal_name" text null,
        "logo_url" text null,
        "hero_url" text null,
        "tagline" text null,
        "description" text null,
        "country" text null,
        "partnership_tier" text null,
        "is_active" boolean not null default true,
        "sort_order" integer not null default 0,
        "seo_title" text null,
        "seo_description" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "brand_pkey" primary key ("id"),
        constraint "brand_handle_unique" unique ("handle")
      );
    `);
    this.addSql(
      `create index if not exists "brand_active_idx" on "brand" ("is_active", "sort_order") where "deleted_at" is null;`,
    );

    this.addSql(`
      create table if not exists "product_brand" (
        "product_id" text not null,
        "brand_id" text not null,
        constraint "product_brand_pkey" primary key ("product_id", "brand_id")
      );
    `);
    this.addSql(
      `create index if not exists "product_brand_brand_idx" on "product_brand" ("brand_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_brand" cascade;`);
    this.addSql(`drop table if exists "brand" cascade;`);
  }
}
