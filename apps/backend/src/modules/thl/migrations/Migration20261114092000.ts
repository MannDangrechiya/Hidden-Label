import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/** P3 · migration 3 of 4 — wishlist and OTP challenges. */
export class Migration20261114092000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "wishlist_item" (
        "id" text not null,
        "customer_id" text not null,
        "variant_id" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "wishlist_item_pkey" primary key ("id"),
        constraint "wishlist_item_customer_variant_unique" unique ("customer_id", "variant_id")
      );
    `);
    this.addSql(
      `create index if not exists "wishlist_customer_idx" on "wishlist_item" ("customer_id", "created_at" desc);`,
    );

    this.addSql(`
      create table if not exists "otp_challenge" (
        "id" text not null,
        "purpose" text not null,
        "channel" text not null,
        "destination" text not null,
        "code_hash" text not null,
        "attempts" integer not null default 0,
        "max_attempts" integer not null default 5,
        "expires_at" timestamptz not null,
        "consumed_at" timestamptz null,
        "ip" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "otp_challenge_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "otp_destination_idx" on "otp_challenge" ("destination", "purpose", "created_at" desc);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "otp_challenge" cascade;`);
    this.addSql(`drop table if exists "wishlist_item" cascade;`);
  }
}
