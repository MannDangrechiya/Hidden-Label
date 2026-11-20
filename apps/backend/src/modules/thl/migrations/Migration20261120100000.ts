import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Phase 1 remediation (2026-11-20):
 *
 * 1. `refund_operation` — a persisted refund identity. The unique `idempotency_key` is a digest
 *    of (order, payment, amount, reason), so concurrent or repeated refund requests resolve to
 *    one row and therefore one financial operation.
 * 2. `return_request_display_seq` — replaces count-based RMA numbering. Backfilled past every
 *    existing `RMA-<n>` value so a number is never reused.
 * 3. `concierge_thread.session_token_hash` — guest threads are bound to a backend-issued,
 *    HMAC-signed session; only its hash is stored. Legacy rows have no hash and are therefore
 *    inaccessible (fail closed) rather than open to any caller.
 */
export class Migration20261120100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "refund_operation" (
        "id" text not null,
        "idempotency_key" text not null,
        "order_id" text not null,
        "payment_id" text not null,
        "amount" numeric(12,2) not null,
        "reason" text not null,
        "status" text not null default 'pending',
        "refund_id" text null,
        "error" text null,
        "actor_id" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "refund_operation_pkey" primary key ("id"),
        constraint "refund_operation_key_unique" unique ("idempotency_key"),
        constraint "refund_operation_status_check" check ("status" in ('pending', 'completed', 'failed'))
      );
    `);
    this.addSql(
      `create index if not exists "refund_operation_order_idx" on "refund_operation" ("order_id");`,
    );
    this.addSql(
      `create index if not exists "refund_operation_status_idx" on "refund_operation" ("status", "updated_at" desc);`,
    );

    this.addSql(`create sequence if not exists "return_request_display_seq" start with 1001;`);
    this.addSql(`
      select setval(
        'return_request_display_seq',
        greatest(
          1000,
          coalesce(
            max((regexp_replace("display_id", '\\D', '', 'g'))::bigint),
            1000
          )
        ),
        true
      )
      from "return_request"
      where "display_id" ~ '^RMA-[0-9]+$';
    `);

    this.addSql(
      `alter table "concierge_thread" add column if not exists "session_token_hash" text null;`,
    );
    this.addSql(
      `create index if not exists "concierge_thread_session_hash_idx" on "concierge_thread" ("session_token_hash");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "concierge_thread_session_hash_idx";`);
    this.addSql(`alter table "concierge_thread" drop column if exists "session_token_hash";`);
    this.addSql(`drop sequence if exists "return_request_display_seq";`);
    this.addSql(`drop table if exists "refund_operation" cascade;`);
  }
}
