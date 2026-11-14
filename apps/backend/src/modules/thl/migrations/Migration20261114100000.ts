import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Phase 5.5 Migration: Resale, Bidding, Price Index, Condition Inspection,
 * Fit Studio, and Style Concierge tables (docs/PHASE_5.5_PLAN.md).
 */
export class Migration20261114100000 extends Migration {
  override async up(): Promise<void> {
    // 1. Resale asks (consignor / seller listings)
    this.addSql(`
      create table if not exists "resale_ask" (
        "id" text not null,
        "variant_id" text not null,
        "seller_id" text not null,
        "ask_price" numeric(12,2) not null,
        "condition_grade" text not null default 'deadstock',
        "box_condition" text not null default 'perfect',
        "status" text not null default 'active',
        "expires_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "resale_ask_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "resale_ask_variant_idx" on "resale_ask" ("variant_id", "status", "ask_price" asc);`
    );
    this.addSql(
      `create index if not exists "resale_ask_seller_idx" on "resale_ask" ("seller_id", "status");`
    );

    // 2. Resale bids (buyer orderbook)
    this.addSql(`
      create table if not exists "resale_bid" (
        "id" text not null,
        "variant_id" text not null,
        "buyer_id" text not null,
        "bid_price" numeric(12,2) not null,
        "status" text not null default 'active',
        "payment_intent" text null,
        "expires_at" timestamptz not null default (now() + interval '30 days'),
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "resale_bid_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "resale_bid_variant_idx" on "resale_bid" ("variant_id", "status", "bid_price" desc);`
    );
    this.addSql(
      `create index if not exists "resale_bid_buyer_idx" on "resale_bid" ("buyer_id", "status");`
    );

    // 3. Price History Points (AI-02 The Price Index)
    this.addSql(`
      create table if not exists "price_history_point" (
        "id" text not null,
        "variant_id" text not null,
        "price_rupees" numeric(12,2) not null,
        "condition_grade" text not null default 'deadstock',
        "source" text not null default 'marketplace',
        "recorded_at" timestamptz not null default now(),
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "price_history_point_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "price_history_variant_date_idx" on "price_history_point" ("variant_id", "recorded_at" desc);`
    );

    // 4. Condition Inspection & Verification (AI-03 360° Inspection Viewer)
    this.addSql(`
      create table if not exists "condition_inspection" (
        "id" text not null,
        "variant_id" text not null,
        "unit_serial" text null,
        "inspector_id" text null,
        "status" text not null default 'pending',
        "condition_grade" text not null,
        "box_condition" text not null default 'perfect',
        "turntable_media" jsonb not null default '[]'::jsonb,
        "detail_photos" jsonb not null default '[]'::jsonb,
        "checklist" jsonb not null default '{}'::jsonb,
        "notes" text null,
        "inspected_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "condition_inspection_pkey" primary key ("id"),
        constraint "condition_inspection_unit_serial_unique" unique ("unit_serial")
      );
    `);
    this.addSql(
      `create index if not exists "inspection_variant_idx" on "condition_inspection" ("variant_id", "status");`
    );
    this.addSql(
      `create index if not exists "inspection_serial_idx" on "condition_inspection" ("unit_serial");`
    );

    // 5. Silhouette Fit Rules (AI-04 Fit Studio Engine)
    this.addSql(`
      create table if not exists "silhouette_fit_rule" (
        "id" text not null,
        "brand_id" text null,
        "silhouette_name" text not null,
        "fit_tendency" text not null default 'true_to_size',
        "recommended_size_delta" numeric(3,1) not null default 0.0,
        "width_profile" text not null default 'regular',
        "guidance_text" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "silhouette_fit_rule_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "silhouette_fit_idx" on "silhouette_fit_rule" ("silhouette_name");`
    );

    // 6. Customer Fit Profile (AI-04 Sizing recommendations)
    this.addSql(`
      create table if not exists "customer_fit_profile" (
        "id" text not null,
        "customer_id" text not null,
        "foot_length_cm" numeric(4,1) null,
        "foot_width" text not null default 'regular',
        "standard_uk_size" numeric(3,1) null,
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_fit_profile_pkey" primary key ("id"),
        constraint "customer_fit_profile_customer_unique" unique ("customer_id")
      );
    `);
    this.addSql(
      `create index if not exists "customer_fit_profile_customer_idx" on "customer_fit_profile" ("customer_id");`
    );

    // 7. Concierge Thread (AI-05 Aura-7 Style Concierge)
    this.addSql(`
      create table if not exists "concierge_thread" (
        "id" text not null,
        "customer_id" text null,
        "session_token" text not null,
        "title" text not null default 'Personal Styling Session',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "concierge_thread_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "concierge_thread_session_idx" on "concierge_thread" ("session_token");`
    );

    // 8. Concierge Message (AI-05 Message history and recommendations)
    this.addSql(`
      create table if not exists "concierge_message" (
        "id" text not null,
        "thread_id" text not null,
        "sender" text not null,
        "content" text not null,
        "recommended_product_ids" jsonb not null default '[]'::jsonb,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "concierge_message_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "concierge_message_thread_idx" on "concierge_message" ("thread_id", "created_at" asc);`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "concierge_message" cascade;`);
    this.addSql(`drop table if exists "concierge_thread" cascade;`);
    this.addSql(`drop table if exists "customer_fit_profile" cascade;`);
    this.addSql(`drop table if exists "silhouette_fit_rule" cascade;`);
    this.addSql(`drop table if exists "condition_inspection" cascade;`);
    this.addSql(`drop table if exists "price_history_point" cascade;`);
    this.addSql(`drop table if exists "resale_bid" cascade;`);
    this.addSql(`drop table if exists "resale_ask" cascade;`);
  }
}
