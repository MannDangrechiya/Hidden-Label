import type { Knex } from "knex";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { linkProductBrand } from "./product-brand-link";

/**
 * D4 regression: products created through the admin carry their brand as free-text
 * `metadata.brand`; the product_brand link table must get a row when that brand matches an
 * existing brand (case-insensitive on name or handle) — and never invent brand rows.
 *
 * The harness schema does not include the brand tables (they belong to the THL module's own
 * migration), so the exact real columns are created inside the isolated schema here.
 */

let iso: IsolatedDatabase;

beforeAll(async () => {
  iso = await createIsolatedDatabase();
  // The harness ships simplified `product`/`brand` tables (brand: id+name only). Add the real
  // columns the subscriber queries so the harness mirrors the production schema.
  await iso.db.raw("alter table brand add column if not exists handle text");
  await iso.db.raw("alter table brand add column if not exists deleted_at timestamptz null");
  await iso.db.raw("alter table product add column if not exists metadata jsonb null");
  // `onConflict(...).ignore()` needs a unique constraint on the link pair.
  await iso.db.raw(
    "create unique index if not exists product_brand_test_unique on product_brand (product_id, brand_id)",
  );

  await iso.db("brand").insert([
    { id: "brand_nike", handle: "nike", name: "Nike" },
    { id: "brand_asics", handle: "asics", name: "ASICS" },
  ]);
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

async function brandLinks(productId: string): Promise<string[]> {
  const rows = await iso.db("product_brand")
    .where({ product_id: productId })
    .select("brand_id");
  return rows.map((row) => row.brand_id);
}

describe("Product → brand linking on metadata.brand (D4)", () => {
  it("links a product whose metadata.brand matches a brand name, case-insensitively", async () => {
    await iso.db("product").insert({
      id: "prod_case", title: "P", handle: "p-case",
      metadata: JSON.stringify({ brand: " NIKE " }),
    });

    expect(await linkProductBrand(iso.db, "prod_case")).toBe("brand_nike");
    expect(await brandLinks("prod_case")).toEqual(["brand_nike"]);
  }, 30_000);

  it("also matches a brand handle", async () => {
    await iso.db("product").insert({
      id: "prod_handle", title: "P", handle: "p-handle",
      metadata: JSON.stringify({ brand: "asics" }),
    });

    expect(await linkProductBrand(iso.db, "prod_handle")).toBe("brand_asics");
    expect(await brandLinks("prod_handle")).toEqual(["brand_asics"]);
  }, 30_000);

  it("never invents a brand row from product input", async () => {
    await iso.db("product").insert({
      id: "prod_unknown", title: "P", handle: "p-unknown",
      metadata: JSON.stringify({ brand: "Brand That Does Not Exist" }),
    });

    expect(await linkProductBrand(iso.db, "prod_unknown")).toBeNull();
    expect(await brandLinks("prod_unknown")).toEqual([]);

    const brands = await iso.db("brand").whereNotNull("handle").count("* as total").first();
    expect(Number(brands.total)).toBe(2);
  }, 30_000);

  it("is idempotent on product.updated replay", async () => {
    await iso.db("product").insert({
      id: "prod_replay", title: "P", handle: "p-replay",
      metadata: JSON.stringify({ brand: "Nike" }),
    });

    const first = await linkProductBrand(iso.db, "prod_replay");
    const second = await linkProductBrand(iso.db, "prod_replay");

    expect(first).toBe("brand_nike");
    expect(second).toBe("brand_nike");
    expect(await brandLinks("prod_replay")).toEqual(["brand_nike"]);
  }, 30_000);

  it("ignores products without a brand in metadata", async () => {
    await iso.db("product").insert({ id: "prod_nobrand", title: "P", handle: "p-nobrand", metadata: JSON.stringify({}) });

    expect(await linkProductBrand(iso.db, "prod_nobrand")).toBeNull();
    expect(await brandLinks("prod_nobrand")).toEqual([]);
  }, 30_000);
});
