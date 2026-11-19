import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Remediation migration (audit phases 1, 3 and 7):
 *  - cod_verification: server-owned Cash-on-Delivery OTP proof (GAP-SEC-02).
 *  - support_ticket:   recorded customer grievance channel (GAP-SUP-01).
 *  - refund_account:   UPI / bank payout details for COD refunds (GAP-PAY-04).
 */
export class Migration20261117100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "cod_verification" (
        "id" text not null,
        "cart_id" text not null,
        "phone" text not null,
        "challenge_id" text not null,
        "verified_at" timestamptz not null,
        "consumed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cod_verification_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "cod_verification_cart_idx" on "cod_verification" ("cart_id", "verified_at" desc);`,
    );

    this.addSql(`
      create table if not exists "support_ticket" (
        "id" text not null,
        "display_id" text not null,
        "customer_id" text null,
        "name" text not null,
        "email" text not null,
        "phone" text null,
        "order_id" text null,
        "category" text not null default 'general',
        "subject" text not null,
        "message" text not null,
        "status" text not null default 'open',
        "priority" text not null default 'normal',
        "assigned_to" text null,
        "resolution" text null,
        "resolved_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "support_ticket_pkey" primary key ("id"),
        constraint "support_ticket_display_id_unique" unique ("display_id")
      );
    `);
    this.addSql(
      `create index if not exists "support_ticket_status_idx" on "support_ticket" ("status", "created_at" desc);`,
    );
    this.addSql(
      `create index if not exists "support_ticket_email_idx" on "support_ticket" ("email");`,
    );

    this.addSql(`
      create table if not exists "refund_account" (
        "id" text not null,
        "customer_id" text not null,
        "order_id" text not null,
        "return_request_id" text null,
        "method" text not null,
        "upi_id" text null,
        "account_name" text null,
        "account_number" text null,
        "ifsc" text null,
        "bank_name" text null,
        "verified_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "refund_account_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "refund_account_order_idx" on "refund_account" ("order_id");`,
    );
    this.addSql(
      `create index if not exists "refund_account_customer_idx" on "refund_account" ("customer_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "refund_account" cascade;`);
    this.addSql(`drop table if exists "support_ticket" cascade;`);
    this.addSql(`drop table if exists "cod_verification" cascade;`);
  }
}
