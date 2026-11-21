import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Phase B logistics, reverse pickup and GST credit notes (2026-11-21):
 *
 * 1. `warehouse_pickup_location` — dynamic physical warehouse pickup configurations
 *    mapped to stock locations, providing Shiprocket pickup nicknames without hardcoding.
 * 2. `shipment_operation` — persisted shipment dispatch mutex and idempotency records
 *    preventing duplicate courier bookings, AWB generations, or concurrent dispatches.
 * 3. `credit_note_display_seq` — PostgreSQL sequence allocating atomic sequential
 *    credit note display numbers (CN-THL-1001, etc.).
 * 4. `credit_note` and `credit_note_item` — technical foundation for Indian GST credit
 *    notes tied to original orders, invoices, and RMA returns.
 */
export class Migration20261121150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "warehouse_pickup_location" (
        "id" text not null,
        "stock_location_id" text not null,
        "pickup_location_code" text not null,
        "pickup_location_nickname" text not null,
        "company_name" text not null,
        "contact_person" text not null,
        "email" text not null,
        "phone" text not null,
        "address_line1" text not null,
        "address_line2" text null,
        "city" text not null,
        "state" text not null,
        "pincode" text not null,
        "is_default" boolean not null default false,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "warehouse_pickup_location_pkey" primary key ("id"),
        constraint "warehouse_pickup_location_code_unique" unique ("pickup_location_code")
      );
    `);
    this.addSql(
      `create index if not exists "warehouse_pickup_stock_loc_idx" on "warehouse_pickup_location" ("stock_location_id");`,
    );
    this.addSql(
      `create index if not exists "warehouse_pickup_pincode_idx" on "warehouse_pickup_location" ("pincode");`,
    );
    this.addSql(
      `create index if not exists "warehouse_pickup_default_idx" on "warehouse_pickup_location" ("is_default") where "is_default" = true;`,
    );

    this.addSql(`
      create table if not exists "shipment_operation" (
        "id" text not null,
        "idempotency_key" text not null,
        "order_id" text not null,
        "fulfillment_id" text null,
        "shipment_id" text null,
        "provider_order_id" text null,
        "provider_shipment_id" text null,
        "awb" text null,
        "courier" text null,
        "status" text not null default 'pending',
        "error" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "shipment_operation_pkey" primary key ("id"),
        constraint "shipment_operation_key_unique" unique ("idempotency_key"),
        constraint "shipment_operation_status_check" check ("status" in ('pending', 'completed', 'failed'))
      );
    `);
    this.addSql(
      `create index if not exists "shipment_operation_order_idx" on "shipment_operation" ("order_id");`,
    );
    this.addSql(
      `create index if not exists "shipment_operation_shipment_idx" on "shipment_operation" ("shipment_id");`,
    );
    this.addSql(
      `create index if not exists "shipment_operation_awb_idx" on "shipment_operation" ("awb");`,
    );

    this.addSql(`
      create sequence if not exists "credit_note_display_seq" start with 1001;
    `);

    this.addSql(`
      create table if not exists "credit_note" (
        "id" text not null,
        "display_id" text not null,
        "order_id" text not null,
        "return_request_id" text null,
        "original_invoice_number" text not null,
        "reason" text not null,
        "currency_code" text not null default 'inr',
        "taxable_amount_paise" bigint not null,
        "cgst_paise" bigint not null default 0,
        "sgst_paise" bigint not null default 0,
        "igst_paise" bigint not null default 0,
        "total_tax_paise" bigint not null default 0,
        "total_amount_paise" bigint not null,
        "rate_percent" numeric not null default 18,
        "seller_gstin" text not null,
        "seller_legal_name" text not null,
        "seller_state_code" text not null,
        "buyer_state" text not null,
        "buyer_state_code" text not null,
        "buyer_gstin" text null,
        "is_mock" boolean not null default false,
        "status" text not null default 'issued',
        "metadata" jsonb null,
        "issued_at" timestamptz not null default now(),
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "credit_note_pkey" primary key ("id"),
        constraint "credit_note_display_id_unique" unique ("display_id"),
        constraint "credit_note_status_check" check ("status" in ('issued', 'void'))
      );
    `);
    this.addSql(
      `create index if not exists "credit_note_order_idx" on "credit_note" ("order_id");`,
    );
    this.addSql(
      `create index if not exists "credit_note_rma_idx" on "credit_note" ("return_request_id");`,
    );
    this.addSql(
      `create unique index if not exists "credit_note_order_rma_unique" on "credit_note" ("order_id", "return_request_id") where "return_request_id" is not null;`,
    );

    this.addSql(`
      create table if not exists "credit_note_item" (
        "id" text not null,
        "credit_note_id" text not null,
        "order_item_id" text not null,
        "title" text not null,
        "hsn" text not null,
        "quantity" integer not null default 1,
        "unit_price_paise" bigint not null,
        "taxable_amount_paise" bigint not null,
        "tax_amount_paise" bigint not null,
        "total_amount_paise" bigint not null,
        "created_at" timestamptz not null default now(),
        constraint "credit_note_item_pkey" primary key ("id"),
        constraint "credit_note_item_cn_fk" foreign key ("credit_note_id") references "credit_note" ("id") on delete cascade
      );
    `);
    this.addSql(
      `create index if not exists "credit_note_item_cn_idx" on "credit_note_item" ("credit_note_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "credit_note_item" cascade;`);
    this.addSql(`drop table if exists "credit_note" cascade;`);
    this.addSql(`drop sequence if exists "credit_note_display_seq";`);
    this.addSql(`drop table if exists "shipment_operation" cascade;`);
    this.addSql(`drop table if exists "warehouse_pickup_location" cascade;`);
  }
}
