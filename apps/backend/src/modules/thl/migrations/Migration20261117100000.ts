import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Remediation migration (audit phase 7):
 *  - support_ticket: recorded customer grievance channel (GAP-SUP-01).
 */
export class Migration20261117100000 extends Migration {
  override async up(): Promise<void> {
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
      `create index if not exists "support_ticket_status_idx" on "support_ticket" (status, created_at desc);`,
    );
    this.addSql(
      `create index if not exists "support_ticket_email_idx" on "support_ticket" (email);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "support_ticket" cascade;`);
  }
}
