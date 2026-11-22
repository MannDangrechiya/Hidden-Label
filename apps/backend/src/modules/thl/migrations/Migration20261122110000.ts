import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Migration20261122110000:
 *
 * 1. `product_review` — Customer reviews, 1-5 ratings, and purchase verification (Phase 5).
 * 2. `supplier` — Supplier records and luxury vendor profiles (Phase 6).
 * 3. `purchase_order` & `purchase_order_item` — Inbound purchase orders (Phase 6).
 * 4. `goods_receipt` — Goods received notes (GRN) against purchase orders (Phase 6).
 * 5. `stock_movement` — Immutable ledger of all stock mutations (Phase 6).
 * 6. `consignor_settlement` — Payout ledger and settlement tracking for resale (Phase 8).
 * 7. `consultation_booking` — Atelier styling and bespoke appointment bookings (Phase 7).
 * 8. `fabric_swatch` — Luxury textile swatch library with surcharge tiers (Phase 7).
 */
export class Migration20261122110000 extends Migration {
  override async up(): Promise<void> {
    // 1. product_review
    this.addSql(`
      create table if not exists "product_review" (
        "id" text not null,
        "product_id" text not null,
        "customer_id" text not null,
        "rating" integer not null check ("rating" between 1 and 5),
        "title" text not null,
        "body" text not null,
        "author_name" text not null,
        "verified_purchase" boolean not null default false,
        "status" text not null default 'pending' check ("status" in ('pending', 'approved', 'rejected')),
        "moderated_by" text null,
        "moderated_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "product_review_pkey" primary key ("id")
      );
    `);
    this.addSql(`create index if not exists "product_review_product_status_idx" on "product_review" ("product_id", "status");`);
    this.addSql(`create index if not exists "product_review_customer_idx" on "product_review" ("customer_id");`);

    // 2. supplier
    this.addSql(`
      create table if not exists "supplier" (
        "id" text not null,
        "name" text not null,
        "contact_email" text not null,
        "contact_phone" text null,
        "gstin" text null,
        "address" text null,
        "status" text not null default 'active' check ("status" in ('active', 'inactive')),
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "supplier_pkey" primary key ("id")
      );
    `);

    // 3. purchase_order & purchase_order_item
    this.addSql(`
      create sequence if not exists purchase_order_display_seq start with 1001;
      create table if not exists "purchase_order" (
        "id" text not null,
        "display_id" text not null,
        "supplier_id" text not null references "supplier"("id") on delete restrict,
        "status" text not null default 'draft' check ("status" in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
        "total_cost_rupees" numeric(12,2) not null default 0,
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "purchase_order_pkey" primary key ("id"),
        constraint "purchase_order_display_unique" unique ("display_id")
      );
    `);
    this.addSql(`create index if not exists "purchase_order_supplier_idx" on "purchase_order" ("supplier_id");`);

    this.addSql(`
      create table if not exists "purchase_order_item" (
        "id" text not null,
        "purchase_order_id" text not null references "purchase_order"("id") on delete cascade,
        "product_id" text not null,
        "variant_id" text not null,
        "quantity" integer not null check ("quantity" > 0),
        "received_quantity" integer not null default 0 check ("received_quantity" >= 0),
        "unit_cost_rupees" numeric(12,2) not null check ("unit_cost_rupees" >= 0),
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "purchase_order_item_pkey" primary key ("id")
      );
    `);
    this.addSql(`create index if not exists "poi_po_idx" on "purchase_order_item" ("purchase_order_id");`);

    // 4. goods_receipt
    this.addSql(`
      create sequence if not exists goods_receipt_display_seq start with 1001;
      create table if not exists "goods_receipt" (
        "id" text not null,
        "display_id" text not null,
        "purchase_order_id" text not null references "purchase_order"("id") on delete restrict,
        "received_by" text not null,
        "received_at" timestamptz not null default now(),
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "goods_receipt_pkey" primary key ("id"),
        constraint "goods_receipt_display_unique" unique ("display_id")
      );
    `);

    // 5. stock_movement
    this.addSql(`
      create table if not exists "stock_movement" (
        "id" text not null,
        "inventory_item_id" text not null,
        "location_id" text not null,
        "delta" integer not null,
        "movement_type" text not null check ("movement_type" in ('po_receipt', 'manual_adjustment', 'order_fulfillment', 'return_restock', 'damage_shrinkage')),
        "reference_id" text null,
        "actor_id" text null,
        "notes" text null,
        "balance_after" integer not null,
        "created_at" timestamptz not null default now(),
        constraint "stock_movement_pkey" primary key ("id")
      );
    `);
    this.addSql(`create index if not exists "stock_movement_item_idx" on "stock_movement" ("inventory_item_id");`);
    this.addSql(`create index if not exists "stock_movement_created_idx" on "stock_movement" ("created_at" desc);`);

    // 6. consignor_settlement
    this.addSql(`
      create table if not exists "consignor_settlement" (
        "id" text not null,
        "ask_id" text not null,
        "order_id" text null,
        "seller_id" text not null,
        "sold_amount_rupees" numeric(12,2) not null,
        "commission_rate" numeric(5,4) not null,
        "commission_rupees" numeric(12,2) not null,
        "payout_amount_rupees" numeric(12,2) not null,
        "hold_until" timestamptz not null,
        "status" text not null default 'pending' check ("status" in ('pending', 'cleared', 'disbursed', 'forfeited')),
        "disbursed_at" timestamptz null,
        "payout_reference" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "consignor_settlement_pkey" primary key ("id"),
        constraint "consignor_settlement_ask_unique" unique ("ask_id")
      );
    `);
    this.addSql(`create index if not exists "consignor_settlement_seller_idx" on "consignor_settlement" ("seller_id", "status");`);

    // 7. consultation_booking
    this.addSql(`
      create table if not exists "consultation_booking" (
        "id" text not null,
        "customer_id" text null,
        "customer_name" text not null,
        "customer_email" text not null,
        "customer_phone" text not null,
        "scheduled_at" timestamptz not null,
        "service_type" text not null default 'bespoke_fitting',
        "status" text not null default 'scheduled' check ("status" in ('scheduled', 'completed', 'cancelled', 'no_show')),
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "consultation_booking_pkey" primary key ("id")
      );
    `);
    this.addSql(`create index if not exists "consultation_booking_sched_idx" on "consultation_booking" ("scheduled_at");`);

    // 8. fabric_swatch
    this.addSql(`
      create table if not exists "fabric_swatch" (
        "id" text not null,
        "name" text not null,
        "code" text not null,
        "mill" text not null,
        "composition" text not null,
        "weight_gsm" integer not null,
        "color" text not null,
        "image_url" text null,
        "surcharge_tier" text not null default 'standard' check ("surcharge_tier" in ('standard', 'premium', 'ultra_luxury')),
        "surcharge_rupees" numeric(12,2) not null default 0,
        "is_available" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "fabric_swatch_pkey" primary key ("id"),
        constraint "fabric_swatch_code_unique" unique ("code")
      );
    `);
    this.addSql(`create index if not exists "fabric_swatch_tier_idx" on "fabric_swatch" ("surcharge_tier", "is_available");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fabric_swatch" cascade;`);
    this.addSql(`drop table if exists "consultation_booking" cascade;`);
    this.addSql(`drop table if exists "consignor_settlement" cascade;`);
    this.addSql(`drop table if exists "stock_movement" cascade;`);
    this.addSql(`drop table if exists "goods_receipt" cascade;`);
    this.addSql(`drop table if exists "purchase_order_item" cascade;`);
    this.addSql(`drop table if exists "purchase_order" cascade;`);
    this.addSql(`drop table if exists "supplier" cascade;`);
    this.addSql(`drop table if exists "product_review" cascade;`);
  }
}
