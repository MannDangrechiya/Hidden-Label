import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Phase 2 payment lifecycle and idempotency (2026-11-21):
 *
 * 1. `payment_operation` — persisted payment operation identity. The unique `idempotency_key`
 *    (derived from cart_id, razorpay_order_id, razorpay_payment_id) ensures concurrent or repeated
 *    checkout confirmation requests resolve to exactly one order creation without duplicate orders.
 * 2. `webhook_event` — persisted log of verified external webhooks with unique `event_id`
 *    ensuring duplicate webhook deliveries from payment gateways are detected and processed exactly once.
 */
export class Migration20261121100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "payment_operation" (
        "id" text not null,
        "idempotency_key" text not null,
        "cart_id" text not null,
        "order_id" text null,
        "razorpay_order_id" text null,
        "razorpay_payment_id" text null,
        "amount" integer not null,
        "currency_code" text not null default 'INR',
        "status" text not null default 'pending',
        "error" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "payment_operation_pkey" primary key ("id"),
        constraint "payment_operation_key_unique" unique ("idempotency_key"),
        constraint "payment_operation_status_check" check ("status" in ('pending', 'completed', 'failed'))
      );
    `);
    this.addSql(
      `create index if not exists "payment_operation_cart_idx" on "payment_operation" ("cart_id");`,
    );
    this.addSql(
      `create index if not exists "payment_operation_order_idx" on "payment_operation" ("order_id");`,
    );
    this.addSql(
      `create index if not exists "payment_operation_rzp_order_idx" on "payment_operation" ("razorpay_order_id");`,
    );
    this.addSql(
      `create index if not exists "payment_operation_rzp_payment_idx" on "payment_operation" ("razorpay_payment_id");`,
    );

    this.addSql(`
      create table if not exists "webhook_event" (
        "id" text not null,
        "event_id" text not null,
        "provider" text not null,
        "event_type" text not null,
        "entity_id" text null,
        "payload_hash" text not null,
        "status" text not null default 'processed',
        "error" text null,
        "created_at" timestamptz not null default now(),
        "processed_at" timestamptz not null default now(),
        constraint "webhook_event_pkey" primary key ("id"),
        constraint "webhook_event_id_unique" unique ("event_id"),
        constraint "webhook_event_status_check" check ("status" in ('processed', 'ignored', 'failed'))
      );
    `);
    this.addSql(
      `create index if not exists "webhook_event_entity_idx" on "webhook_event" ("provider", "entity_id");`,
    );
    this.addSql(
      `create index if not exists "webhook_event_type_idx" on "webhook_event" ("event_type");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "webhook_event" cascade;`);
    this.addSql(`drop table if exists "payment_operation" cascade;`);
  }
}
