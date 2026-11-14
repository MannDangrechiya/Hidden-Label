import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/** P3 · migration 2 of 4 — CMS pages and scheduled banner slots. */
export class Migration20261114091000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "cms_page" (
        "id" text not null,
        "slug" text not null,
        "kind" text not null,
        "title" text not null,
        "body_md" text null,
        "blocks" jsonb null,
        "is_published" boolean not null default false,
        "published_at" timestamptz null,
        "seo_title" text null,
        "seo_description" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cms_page_pkey" primary key ("id"),
        constraint "cms_page_slug_unique" unique ("slug")
      );
    `);
    this.addSql(
      `create index if not exists "cms_page_kind_idx" on "cms_page" ("kind", "is_published");`,
    );

    this.addSql(`
      create table if not exists "banner_slot" (
        "id" text not null,
        "placement" text not null,
        "page_id" text null,
        "image_url" text null,
        "headline" text null,
        "subhead" text null,
        "cta_label" text null,
        "cta_href" text null,
        "starts_at" timestamptz null,
        "ends_at" timestamptz null,
        "is_active" boolean not null default true,
        "sort_order" integer not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "banner_slot_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "banner_slot_placement_idx" on "banner_slot" ("placement", "is_active", "sort_order");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "banner_slot" cascade;`);
    this.addSql(`drop table if exists "cms_page" cascade;`);
  }
}
