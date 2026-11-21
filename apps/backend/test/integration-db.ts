import knexFactory, { type Knex } from "knex";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Database integration harness.
 *
 * Each suite gets its own schema inside a real PostgreSQL database, dropped afterwards. That
 * keeps concurrency tests honest (separate pooled connections, real row locks, real unique
 * constraints) without touching application data.
 *
 * Set `THL_TEST_DATABASE_URL` (CI does; locally it may fall back to `DATABASE_URL` or apps/backend/.env).
 * The tests fail loudly when neither is present rather than silently passing.
 */
export function testDatabaseUrl(): string {
  let url = process.env.THL_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    try {
      const candidates = [
        path.resolve(process.cwd(), "apps/backend/.env"),
        path.resolve(process.cwd(), ".env"),
        path.resolve(__dirname, "../.env"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, "utf8");
          const match = content.match(/^DATABASE_URL=(.+)$/m);
          if (match) {
            url = match[1].trim();
            break;
          }
        }
      }
    } catch {
      // Ignore errors reading local fallback .env files
    }
  }
  if (!url) {
    throw new Error(
      "Database integration tests need THL_TEST_DATABASE_URL (or DATABASE_URL) pointing at PostgreSQL.",
    );
  }
  return url;
}

export interface IsolatedDatabase {
  db: Knex;
  schema: string;
  dispose(): Promise<void>;
}

/**
 * Only the tables and constraints the code under test touches. The production DDL is applied by
 * the module migrations, and CI asserts the real migrations create the same objects.
 */
const SCHEMA_STATEMENTS = [
  `create table inventory_level (
     id text primary key,
     inventory_item_id text not null,
     location_id text not null,
     stocked_quantity integer not null default 0,
     reserved_quantity integer not null default 0,
     updated_at timestamptz not null default now()
   )`,
  `create table audit_event (
     id bigserial primary key,
     occurred_at timestamptz not null default now(),
     actor_type text not null,
     actor_id text null,
     action text not null,
     entity_type text not null,
     entity_id text not null,
     summary text not null,
     changes jsonb not null default '{}',
     ip text null,
     user_agent text null
   )`,
  `create table refund_operation (
     id text primary key,
     idempotency_key text not null unique,
     order_id text not null,
     payment_id text not null,
     amount numeric(12,2) not null,
     reason text not null,
     status text not null default 'pending'
       check (status in ('pending', 'completed', 'failed')),
     refund_id text null,
     error text null,
     actor_id text null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table payment_operation (
     id text primary key,
     idempotency_key text not null unique,
     cart_id text not null,
     order_id text null,
     razorpay_order_id text null,
     razorpay_payment_id text null,
     amount integer not null,
     currency_code text not null default 'INR',
     status text not null default 'pending'
       check (status in ('pending', 'completed', 'failed')),
     error text null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table webhook_event (
     id text primary key,
     event_id text not null unique,
     provider text not null,
     event_type text not null,
     entity_id text null,
     payload_hash text not null,
     status text not null default 'processed'
       check (status in ('processed', 'ignored', 'failed')),
     error text null,
     created_at timestamptz not null default now(),
     processed_at timestamptz not null default now()
   )`,
  `create table "order" (
     id text primary key,
     display_id integer null,
     currency_code text not null default 'inr',
     email text null,
     status text not null default 'pending',
     shipping_address_id text null,
     billing_address_id text null,
     total numeric(12,2) null,
     metadata jsonb null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     deleted_at timestamptz null,
     canceled_at timestamptz null
   )`,
  `create table order_cart (
     order_id text not null,
     cart_id text not null primary key
   )`,
  `create table order_address (
     id text primary key,
     first_name text null,
     last_name text null,
     address_1 text null,
     address_2 text null,
     city text null,
     province text null,
     postal_code text null,
     phone text null,
     created_at timestamptz not null default now()
   )`,
  `create table order_item (
     id text primary key,
     order_id text not null,
     item_id text null,
     title text null,
     quantity integer not null default 1,
     unit_price numeric(12,2) null,
     fulfilled_quantity integer not null default 0,
     deleted_at timestamptz null
   )`,
  `create sequence return_request_display_seq start with 1001`,
  `create table return_request (
     id text primary key,
     display_id text not null unique,
     order_id text null,
     customer_id text null,
     status text not null default 'requested',
     reason_code text null,
     reason_note text null,
     resolution text null,
     refund_amount numeric(12,2) null,
     requested_at timestamptz null,
     approved_at timestamptz null,
     received_at timestamptz null,
     condition text null,
     condition_note text null,
     closed_at timestamptz null,
     restocked_at timestamptz null,
     awb text null,
     courier text null,
     deleted_at timestamptz null,
     updated_at timestamptz not null default now()
   )`,
  `create table return_request_item (
     id text primary key,
     return_request_id text not null,
     order_item_id text not null,
     quantity integer not null
   )`,
  `create table order_line_item (
     id text primary key,
     order_id text null,
     variant_id text null,
     product_title text null,
     variant_sku text null,
     unit_price numeric(12,2) null,
     metadata jsonb null
   )`,
  `create table product_variant_inventory_item (
     variant_id text not null,
     inventory_item_id text not null
   )`,
  `create table stock_location (
     id text primary key,
     name text not null
   )`,
  `create table fulfillment (
     id text primary key,
     location_id text null,
     delivered_at timestamptz null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     deleted_at timestamptz null
   )`,
  `create table order_fulfillment (
     order_id text not null,
     fulfillment_id text not null,
     deleted_at timestamptz null
   )`,
  `create table shipment (
     id text primary key,
     order_id text not null,
     fulfillment_id text null,
     provider text not null default 'shiprocket',
     provider_shipment_id text null,
     awb text null,
     courier text null,
     status text not null default 'created',
     label_url text null,
     manifest_url text null,
     shipped_at timestamptz null,
     delivered_at timestamptz null,
     last_synced_at timestamptz null,
     raw_last_event jsonb null,
     deleted_at timestamptz null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table shipment_event (
     id text primary key,
     shipment_id text not null,
     event_key text not null,
     status text not null,
     occurred_at timestamptz not null default now(),
     payload jsonb null,
     constraint shipment_event_key_unique unique (shipment_id, event_key)
   )`,
  `create table warehouse_pickup_location (
     id text primary key,
     stock_location_id text not null,
     pickup_location_code text not null unique,
     pickup_location_nickname text not null,
     company_name text not null,
     contact_person text not null,
     email text not null,
     phone text not null,
     address_line1 text not null,
     address_line2 text null,
     city text not null,
     state text not null,
     pincode text not null,
     is_default boolean not null default false,
     is_active boolean not null default true,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table shipment_operation (
     id text primary key,
     idempotency_key text not null unique,
     order_id text not null,
     fulfillment_id text null,
     shipment_id text null,
     provider_order_id text null,
     provider_shipment_id text null,
     awb text null,
     courier text null,
     status text not null default 'pending'
       check (status in ('pending', 'completed', 'failed')),
     error text null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create sequence credit_note_display_seq start with 1001`,
  `create table credit_note (
     id text primary key,
     display_id text not null unique,
     order_id text not null,
     return_request_id text null,
     original_invoice_number text not null,
     reason text not null,
     currency_code text not null default 'inr',
     taxable_amount_paise bigint not null,
     cgst_paise bigint not null default 0,
     sgst_paise bigint not null default 0,
     igst_paise bigint not null default 0,
     total_tax_paise bigint not null default 0,
     total_amount_paise bigint not null,
     rate_percent numeric not null default 18,
     seller_gstin text not null,
     seller_legal_name text not null,
     seller_state_code text not null,
     buyer_state text not null,
     buyer_state_code text not null,
     buyer_gstin text null,
     is_mock boolean not null default false,
     status text not null default 'issued'
       check (status in ('issued', 'void')),
     metadata jsonb null,
     issued_at timestamptz not null default now(),
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     constraint credit_note_order_rma_unique unique (order_id, return_request_id)
   )`,
  `create table credit_note_item (
     id text primary key,
     credit_note_id text not null references credit_note(id) on delete cascade,
     order_item_id text not null,
     title text not null,
     hsn text not null,
     quantity integer not null default 1,
     unit_price_paise bigint not null,
     taxable_amount_paise bigint not null,
     tax_amount_paise bigint not null,
     total_amount_paise bigint not null,
     created_at timestamptz not null default now()
   )`,
  `create table concierge_thread (
     id text primary key,
     customer_id text null,
     session_token text not null,
     session_token_hash text null,
     title text not null default 'Personal Styling Session'
   )`,
  `create table concierge_message (
     id text primary key,
     thread_id text not null,
     sender text not null,
     content text not null,
     recommended_product_ids jsonb null
   )`,
  `create table "user" (
     id text primary key,
     email text null,
     metadata jsonb null
   )`,
  `create table product (
     id text primary key,
     title text not null,
     handle text not null,
     thumbnail text null,
     description text null,
     status text not null default 'published',
     deleted_at timestamptz null
   )`,
  `create table brand (
     id text primary key,
     name text not null
   )`,
  `create table product_brand (
     product_id text not null,
     brand_id text not null
   )`,
];

export async function createIsolatedDatabase(): Promise<IsolatedDatabase> {
  const url = testDatabaseUrl();
  const schema = `thl_test_${randomBytes(6).toString("hex")}`;

  const bootstrap = knexFactory({ client: "pg", connection: url, pool: { min: 0, max: 1 } });
  try {
    await bootstrap.raw(`create schema "${schema}"`);
  } finally {
    await bootstrap.destroy();
  }

  const db = knexFactory({
    client: "pg",
    connection: {
      connectionString: url,
      options: `-c search_path=${schema}`,
    } as unknown as string,
    pool: { min: 0, max: 12 },
  });

  try {
    await db.raw("select 1");
    for (const statement of SCHEMA_STATEMENTS) {
      await db.raw(statement);
    }
  } catch (error) {
    await db.destroy();
    throw error;
  }

  return {
    db,
    schema,
    async dispose() {
      await db.destroy();
      const cleanup = knexFactory({ client: "pg", connection: url, pool: { min: 0, max: 1 } });
      try {
        await cleanup.raw(`drop schema if exists "${schema}" cascade`);
      } finally {
        await cleanup.destroy();
      }
    },
  };
}
