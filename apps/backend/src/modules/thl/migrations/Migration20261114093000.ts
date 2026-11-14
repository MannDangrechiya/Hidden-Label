import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * P3 · migration 4 of 4 — returns, shipments and the append-only audit log.
 *
 * audit_event has no UPDATE/DELETE path: a trigger rejects both statements for every role, so
 * the log is insert-only even for a superuser. This is an ordinary reliable audit log, not a
 * hash chain (decision D2) — see docs/DATABASE_PLAN.md §6.
 */
export class Migration20261114093000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "return_request" (
        "id" text not null,
        "display_id" text not null,
        "order_id" text not null,
        "customer_id" text not null,
        "status" text not null default 'requested',
        "reason_code" text not null,
        "reason_note" text null,
        "resolution" text not null default 'refund',
        "awb" text null,
        "courier" text null,
        "refund_amount" numeric(12,2) null,
        "refund_payment_id" text null,
        "requested_at" timestamptz not null default now(),
        "approved_at" timestamptz null,
        "received_at" timestamptz null,
        "closed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "return_request_pkey" primary key ("id"),
        constraint "return_request_display_id_unique" unique ("display_id")
      );
    `);
    this.addSql(
      `create index if not exists "return_order_idx" on "return_request" ("order_id");`,
    );
    this.addSql(
      `create index if not exists "return_status_idx" on "return_request" ("status", "requested_at" desc);`,
    );

    this.addSql(`
      create table if not exists "return_request_item" (
        "id" text not null,
        "return_request_id" text not null,
        "order_item_id" text not null,
        "quantity" integer not null default 1,
        "restock_decision" text null,
        "condition_note" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "return_request_item_pkey" primary key ("id"),
        constraint "return_request_item_quantity_check" check ("quantity" > 0)
      );
    `);
    this.addSql(
      `create index if not exists "return_request_item_request_idx" on "return_request_item" ("return_request_id");`,
    );

    this.addSql(`
      create table if not exists "shipment" (
        "id" text not null,
        "order_id" text not null,
        "fulfillment_id" text null,
        "provider" text not null default 'shiprocket',
        "provider_shipment_id" text null,
        "awb" text null,
        "courier" text null,
        "status" text not null default 'created',
        "label_url" text null,
        "manifest_url" text null,
        "shipped_at" timestamptz null,
        "delivered_at" timestamptz null,
        "last_synced_at" timestamptz null,
        "raw_last_event" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "shipment_pkey" primary key ("id")
      );
    `);
    this.addSql(`create index if not exists "shipment_order_idx" on "shipment" ("order_id");`);
    this.addSql(`create index if not exists "shipment_awb_idx" on "shipment" ("awb");`);
    this.addSql(
      `create index if not exists "shipment_status_idx" on "shipment" ("status", "last_synced_at");`,
    );
    this.addSql(
      `create unique index if not exists "shipment_provider_shipment_id_unique" on "shipment" ("provider_shipment_id") where "provider_shipment_id" is not null;`,
    );

    this.addSql(`
      create table if not exists "shipment_event" (
        "id" text not null,
        "shipment_id" text not null,
        "event_key" text not null,
        "status" text not null,
        "occurred_at" timestamptz not null,
        "payload" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "shipment_event_pkey" primary key ("id"),
        constraint "shipment_event_key_unique" unique ("shipment_id", "event_key")
      );
    `);
    this.addSql(
      `create index if not exists "shipment_event_shipment_idx" on "shipment_event" ("shipment_id", "occurred_at" desc);`,
    );

    // Append-only admin audit log. bigserial + no model: writes happen through the audit helper,
    // which is also what admin routes use for their "same transaction" inserts.
    this.addSql(`
      create table if not exists "audit_event" (
        "id" bigserial primary key,
        "occurred_at" timestamptz not null default now(),
        "actor_type" text not null,
        "actor_id" text null,
        "action" text not null,
        "entity_type" text not null,
        "entity_id" text not null,
        "summary" text not null,
        "changes" jsonb not null default '{}',
        "ip" text null,
        "user_agent" text null
      );
    `);
    this.addSql(
      `create index if not exists "audit_entity_idx" on "audit_event" ("entity_type", "entity_id", "occurred_at" desc);`,
    );
    this.addSql(
      `create index if not exists "audit_actor_idx" on "audit_event" ("actor_id", "occurred_at" desc);`,
    );
    this.addSql(
      `create index if not exists "audit_action_idx" on "audit_event" ("action", "occurred_at" desc);`,
    );

    this.addSql(`
      create or replace function thl_audit_event_append_only() returns trigger as $$
      begin
        raise exception 'audit_event is append-only: % is not permitted', tg_op;
      end;
      $$ language plpgsql;
    `);
    this.addSql(`
      drop trigger if exists audit_event_append_only on "audit_event";
      create trigger audit_event_append_only
        before update or delete on "audit_event"
        for each row execute function thl_audit_event_append_only();
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "audit_event" cascade;`);
    this.addSql(`drop function if exists thl_audit_event_append_only() cascade;`);
    this.addSql(`drop table if exists "shipment_event" cascade;`);
    this.addSql(`drop table if exists "shipment" cascade;`);
    this.addSql(`drop table if exists "return_request_item" cascade;`);
    this.addSql(`drop table if exists "return_request" cascade;`);
  }
}
