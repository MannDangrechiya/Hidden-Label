import { describe, expect, it } from "vitest";
import { createIsolatedDatabase } from "../../test/integration-db";
import { ensureIndiaPricePreference, ensureIndiaTaxSetup, GST_SLABS } from "./tax";

/**
 * Root-cause regression for the cart/checkout money reconciliation bug.
 *
 * The ₹8,490 × 2 = ₹16,980 line being charged as ₹20,036.40 happened because Medusa's pricing
 * module defaults `is_tax_inclusive` to false when no `price_preference` row exists for INR,
 * so the GST 18% slab was stacked on top of tax-inclusive prices. These tests assert that
 * `ensureIndiaTaxSetup` seeds (and keeps, idempotently) the tax-inclusive INR price preference
 * that makes the cart, checkout, order and Razorpay amount reconcile.
 */
describe("India tax setup seeds the tax-inclusive INR price preference", () => {
  it("creates the INR currency price preference with is_tax_inclusive = true", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const updated = await ensureIndiaPricePreference(db);
      expect(updated).toBe(true);

      const preference = await db("price_preference")
        .where({ attribute: "currency_code", value: "inr" })
        .whereNull("deleted_at")
        .first("attribute", "value", "is_tax_inclusive");

      expect(preference).toMatchObject({
        attribute: "currency_code",
        value: "inr",
        is_tax_inclusive: true,
      });

      // Re-running is a no-op, never a duplicate row (unique index + idempotent upsert).
      expect(await ensureIndiaPricePreference(db)).toBe(false);
      const count = await db("price_preference")
        .where({ attribute: "currency_code", value: "inr" })
        .whereNull("deleted_at")
        .count<{ total: string }>("id as total");
      expect(Number(count[0].total)).toBe(1);
    } finally {
      await dispose();
    }
  });

  it("corrects an existing INR preference stored as tax-exclusive", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      // A bad prior state: prices treated as tax-exclusive → GST stacked on top → ₹20,036.40 bug.
      await db("price_preference").insert({
        id: "prpref_wrong",
        attribute: "currency_code",
        value: "inr",
        is_tax_inclusive: false,
      });

      expect(await ensureIndiaPricePreference(db)).toBe(true);

      const preference = await db("price_preference")
        .where({ id: "prpref_wrong" })
        .first("is_tax_inclusive");
      expect(preference.is_tax_inclusive).toBe(true);
    } finally {
      await dispose();
    }
  });

  it("ensureIndiaTaxSetup seeds region, GST slabs and the price preference together, idempotently", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      // The pricing preference keys on the *sales* region (the id storefront contexts send),
      // not the tax_region row this setup manages.
      const SALES_REGION_ID = "reg_india_inr";
      await db("region").insert({
        id: SALES_REGION_ID,
        name: "India",
        currency_code: "inr",
      });

      const first = await ensureIndiaTaxSetup(db);
      expect(first.createdRates.sort()).toEqual(GST_SLABS.map((s) => s.code).sort());
      expect(first.pricePreferenceUpdated).toBe(true);

      const preference = await db("price_preference")
        .where({ attribute: "currency_code", value: "inr" })
        .first("is_tax_inclusive");
      expect(preference.is_tax_inclusive).toBe(true);

      const region = await db("tax_region")
        .where({ country_code: "in" })
        .whereNull("deleted_at")
        .first("id");
      const rates = await db("tax_rate")
        .where({ tax_region_id: region.id })
        .whereNull("deleted_at")
        .select("code", "rate");
      expect(rates).toHaveLength(GST_SLABS.length);
      expect(rates.map((r) => r.code).sort()).toEqual(GST_SLABS.map((s) => s.code).sort());

      // Second run: nothing created, nothing duplicated.
      const second = await ensureIndiaTaxSetup(db);
      expect(second.createdRates).toEqual([]);
      expect(second.pricePreferenceUpdated).toBe(false);
      const preferenceCount = await db("price_preference")
        .where({ attribute: "currency_code", value: "inr" })
        .whereNull("deleted_at")
        .count<{ total: string }>("id as total");
      expect(Number(preferenceCount[0].total)).toBe(1);

      // The INR *sales-region* preference is seeded too, and matches the currency preference.
      const regionPref = await db("price_preference")
        .where({ attribute: "region_id", value: SALES_REGION_ID })
        .whereNull("deleted_at")
        .first("is_tax_inclusive");
      expect(regionPref).toMatchObject({ is_tax_inclusive: true });
    } finally {
      await dispose();
    }
  });

  it("corrects a Medusa-seeded region preference stored as tax-exclusive (sale price-list landmine)", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const SALES_REGION_ID = "reg_india_inr";
      await db("region").insert({
        id: SALES_REGION_ID,
        name: "India",
        currency_code: "inr",
      });
      await ensureIndiaTaxSetup(db);

      // Medusa seeds the region row as false. If an operator later adds a region-scoped price
      // rule (sale price list), Medusa's isTaxInclusive resolves via the REGION preference —
      // flipping those prices back to tax-exclusive and stacking GST on top again.
      await db("price_preference")
        .where({ attribute: "region_id", value: SALES_REGION_ID })
        .update({ is_tax_inclusive: false });

      expect(await ensureIndiaTaxSetup(db)).toMatchObject({ pricePreferenceUpdated: true });

      const regionPref = await db("price_preference")
        .where({ attribute: "region_id", value: SALES_REGION_ID })
        .whereNull("deleted_at")
        .first("is_tax_inclusive");
      expect(regionPref.is_tax_inclusive).toBe(true);
    } finally {
      await dispose();
    }
  });
});
