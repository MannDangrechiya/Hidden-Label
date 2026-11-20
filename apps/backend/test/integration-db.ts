import knexFactory, { type Knex } from "knex";
import { randomBytes } from "node:crypto";

/**
 * Database integration harness.
 *
 * Each suite gets its own schema inside a real PostgreSQL database, dropped afterwards. That
 * keeps concurrency tests honest (separate pooled connections, real row locks, real unique
 * constraints) without touching application data.
 *
 * Set `THL_TEST_DATABASE_URL` (CI does; locally it may fall back to `DATABASE_URL`). The tests
 * fail loudly when neither is present rather than silently passing.
 */
export function testDatabaseUrl(): string {
  const url = process.env.THL_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
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
 * the module migration (`Migration20261120100000`), and CI asserts the real migration creates the
 * same objects (`refund_operation`, `return_request_display_seq`, `concierge_thread.session_token_hash`).
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
     unit_price numeric(12,2) null
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
     created_at timestamptz not null default now()
   )`,
  `create table order_fulfillment (
     order_id text not null,
     fulfillment_id text not null
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
