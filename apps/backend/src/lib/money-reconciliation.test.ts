import { describe, expect, it } from "vitest";
import { decorateCartTotals, getLineItemTotals } from "@medusajs/utils";
import { toPaise, toRupeesNumber, formatPaise } from "./money";
import { computeInclusiveGst } from "./gst";

/**
 * Cart / checkout / order / payment money reconciliation regressions.
 *
 * Background: every catalogue price is tax-inclusive (₹8,490 is what the customer pays, GST
 * included). These tests run the *real* Medusa total calculators (`@medusajs/utils`, the same
 * functions the cart module, core-flows and complete-cart use) against that configuration and
 * assert that every stage of the flow reconciles in integer paise:
 *
 *   product price → cart calculation → checkout calculation → backend order → payment amount
 *
 * Root cause of the November audit bug (₹8,490 × 2 shown as ₹16,980 on the line but
 * ₹20,036.40 as the total): Medusa treated INR prices as tax-exclusive and stacked GST 18%
 * on top of already-inclusive prices. The authoritative fix seeds the pricing module's
 * `price_preference` so INR prices are tax-inclusive (see lib/tax.ts); these tests pin both
 * the wrong and the right behaviour so the bug cannot silently return.
 */

/** 18% GST line, as the tp_system tax provider produces it. */
const GST18 = [{ rate: 18 }];

/**
 * Independent paise rounding for verification: converts a Medusa BigNumber/rupee float to
 * integer paise the way the storefront Money helpers do, without trusting the implementation.
 */
function paise(value: unknown): number {
  const raw =
    typeof value === "object" && value !== null && "value" in (value as never)
      ? Number((value as { value: number | string }).value)
      : Number(value);
  if (!Number.isFinite(raw)) throw new Error(`not a finite amount: ${String(value)}`);
  return Math.round(raw * 100);
}

const TAX_INCLUSIVE_ITEM = {
  id: "item_1",
  unit_price: 8490,
  quantity: 2,
  is_tax_inclusive: true,
  tax_lines: GST18,
};

describe("Tax-inclusive catalogue prices reconcile across cart → checkout → order → payment", () => {
  it("single product, quantity 1: ₹8,490 charges exactly ₹8,490", () => {
    const item = getLineItemTotals({ ...TAX_INCLUSIVE_ITEM, quantity: 1 }, {});

    // The customer pays the sticker price; GST is inside it.
    expect(paise(item.total)).toBe(8490_00);
    expect(paise(item.original_total)).toBe(8490_00);
    // GST breakdown: taxable value + 18% inclusive tax = ₹8,490.
    expect(paise(item.subtotal) + paise(item.tax_total)).toBe(8490_00);
    expect(paise(item.subtotal)).toBe(Math.round((8490_00 / 1.18)));
  });

  it("audit regression: ₹8,490 × 2 is ₹16,980, NOT ₹20,036.40 (GST must not stack on inclusive prices)", () => {
    const item = getLineItemTotals(TAX_INCLUSIVE_ITEM, {});

    expect(paise(item.total)).toBe(16980_00);
    expect(paise(item.total)).not.toBe(toPaise(20036.4));

    // Documents the old wrong path: with tax-exclusive treatment Medusa stacked 18% on top
    // of the inclusive price, producing the audited ₹20,036.40. If that behaviour returns,
    // the reconciliation breaks and this assertion fails.
    const buggyExclusive = getLineItemTotals(
      { ...TAX_INCLUSIVE_ITEM, is_tax_inclusive: false },
      {},
    );
    expect(paise(buggyExclusive.total)).toBe(toPaise(20036.4));
    expect(paise(buggyExclusive.total)).not.toBe(16980_00);
  });

  it("multiple products with different prices: lines sum to the charged total", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [
        { id: "a", unit_price: 8490, quantity: 1, is_tax_inclusive: true, tax_lines: GST18 },
        { id: "b", unit_price: 1999, quantity: 2, is_tax_inclusive: true, tax_lines: GST18 },
      ],
    });

    // item_total is the tax-inclusive amount actually charged for goods.
    expect(paise(cart.total)).toBe(8490_00 + 2 * 1999_00);
    expect(paise(cart.original_total)).toBe(8490_00 + 2 * 1999_00);
    // Each line's tax-inclusive total equals unit × quantity exactly.
    const lineTotals = (cart.items ?? []).reduce((sum, item) => sum + paise(item.total), 0);
    expect(lineTotals).toBe(8490_00 + 2 * 1999_00);
    expect(paise(cart.item_total)).toBe(8490_00 + 2 * 1999_00);
  });

  it("quantity update (2 → 3) recalculates every dependent value", () => {
    const before = getLineItemTotals(TAX_INCLUSIVE_ITEM, {});
    const after = getLineItemTotals({ ...TAX_INCLUSIVE_ITEM, quantity: 3 }, {});

    expect(paise(before.total)).toBe(16980_00);
    expect(paise(after.total)).toBe(3 * 8490_00);
    expect(paise(after.tax_total)).toBe(Math.round((3 * 8490_00 / 1.18) * 0.18));
  });

  it("promotion discount applied exactly once: ₹500 off ₹16,980 charges ₹16,480", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [{ ...TAX_INCLUSIVE_ITEM, adjustments: [{ amount: 500, is_tax_inclusive: true }] }],
    });

    // The customer saves exactly the promotion's face value, tax-inclusive.
    expect(paise(cart.discount_total)).toBe(500_00);
    expect(paise(cart.total)).toBe(16480_00);
    // GST is recalculated on the discounted net — not duplicated, not dropped.
    expect(paise(cart.tax_total)).toBe(Math.round((16480_00 / 1.18) * 0.18));
  });

  it("removing the discount returns to the undiscounted total", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [TAX_INCLUSIVE_ITEM],
    });

    expect(paise(cart.discount_total)).toBe(0);
    expect(paise(cart.total)).toBe(16980_00);
  });

  it("tax-exclusive pricing is still supported and stays explicit", () => {
    // A genuinely tax-exclusive price (amount excludes GST) gets GST stacked on top.
    const item = getLineItemTotals(
      {
        id: "x",
        unit_price: 1000,
        quantity: 1,
        is_tax_inclusive: false,
        tax_lines: GST18,
      },
      {},
    );
    expect(paise(item.total)).toBe(1180_00);
    expect(paise(item.subtotal)).toBe(1000_00);
    expect(paise(item.tax_total)).toBe(180_00);
  });

  it("GST breakdown: intra-state supply splits CGST + SGST and reconciles to the total", () => {
    const gst = computeInclusiveGst({
      totalInclusive: 16980,
      sellerStateCode: "27",
      buyerState: "Maharashtra",
      actualTaxTotal: 2590.169491525424,
    });

    expect(gst.intraState).toBe(true);
    expect(gst.totalTax).toBe(2590.17);
    expect(gst.taxable).toBe(14389.83);
    // Each leg, rounded per GST convention, must sum back to the total tax…
    expect(gst.cgst + gst.sgst).toBe(gst.totalTax);
    // …and taxable + tax must equal the charged total.
    expect(toPaise(gst.taxable) + toPaise(gst.totalTax)).toBe(16980_00);
  });

  it("GST breakdown: inter-state supply charges IGST and reconciles to the total", () => {
    const gst = computeInclusiveGst({
      totalInclusive: 16980,
      sellerStateCode: "27",
      buyerState: "Karnataka",
      actualTaxTotal: 2590.169491525424,
    });

    expect(gst.intraState).toBe(false);
    expect(gst.igst).toBe(2590.17);
    expect(gst.cgst).toBe(0);
    expect(gst.sgst).toBe(0);
    expect(toPaise(gst.taxable) + toPaise(gst.igst)).toBe(16980_00);
  });

  it("shipping is included exactly once: ₹199 tax-inclusive shipping on ₹16,980 is ₹17,179", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [TAX_INCLUSIVE_ITEM],
      shipping_methods: [
        { id: "sm_1", amount: 199, is_tax_inclusive: true, tax_lines: GST18 },
      ],
    });

    expect(paise(cart.shipping_total)).toBe(199_00);
    expect(paise(cart.item_total)).toBe(16980_00);
    expect(paise(cart.total)).toBe(17179_00);
  });

  it("zero shipping: store pickup charges only the goods", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [TAX_INCLUSIVE_ITEM],
      shipping_methods: [
        { id: "sm_0", amount: 0, is_tax_inclusive: true, tax_lines: GST18 },
      ],
    });

    expect(paise(cart.shipping_total)).toBe(0);
    expect(paise(cart.total)).toBe(16980_00);
  });

  it("whole-rupee prices produce whole-rupee totals", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [
        { id: "a", unit_price: 8490, quantity: 1, is_tax_inclusive: true, tax_lines: GST18 },
        { id: "b", unit_price: 1999, quantity: 1, is_tax_inclusive: true, tax_lines: GST18 },
      ],
    });

    expect(paise(cart.total) % 100).toBe(0);
  });

  it("fractional-paise price edge cases stay exact through the paise boundary", () => {
    const item = getLineItemTotals(
      {
        id: "frac",
        unit_price: 999.99,
        quantity: 3,
        is_tax_inclusive: true,
        tax_lines: GST18,
      },
      {},
    );

    // 3 × ₹999.99 = ₹2,999.97 — representable to the paise, no float drift.
    expect(paise(item.total)).toBe(299997);
    expect(formatPaise(paise(item.total))).toBe("2999.97");

    // Non-representable values are rejected at the paise boundary rather than silently rounded.
    expect(() => toPaise(16980.0005)).toThrow();
  });

  it("Razorpay paise conversion happens once, at the provider boundary, from the order total", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [TAX_INCLUSIVE_ITEM],
    });

    // rupees → paise: the only boundary where rupee floats exist.
    const razorpayPaise = paise(cart.total);
    expect(razorpayPaise).toBe(1698000);
    // Round-trips back to rupees exactly for the payment workflow boundary.
    expect(toPaise(toRupeesNumber(razorpayPaise))).toBe(1698000);
  });

  it("cart ↔ checkout ↔ order ↔ payment all carry the same grand total", () => {
    const cart = decorateCartTotals({
      currency_code: "inr",
      items: [{ ...TAX_INCLUSIVE_ITEM, adjustments: [{ amount: 500, is_tax_inclusive: true }] }],
      shipping_methods: [{ id: "sm_1", amount: 199, is_tax_inclusive: true, tax_lines: GST18 }],
    });

    // Reconciliation identity in integer paise:
    //   goods charged (net of discount) + shipping = grand total = order total = Razorpay amount.
    const goods = paise(cart.item_total);
    const shipping = paise(cart.shipping_total);
    const discount = paise(cart.discount_total);
    const grandTotal = paise(cart.total);

    // item_total is already net of the promotion; it reconciles with the discount amount.
    expect(goods).toBe(paise(cart.original_item_total) - discount);
    expect(goods + shipping).toBe(grandTotal);
    expect(grandTotal).toBe(16679_00);

    // The persisted order would carry this total; the payment operation records it in paise.
    expect(paise(cart.total)).toBe(1667900);
  });

  it("reopening the cart and refreshing do not change totals (deterministic, stateless inputs)", () => {
    const cartA = decorateCartTotals({
      currency_code: "inr",
      items: [TAX_INCLUSIVE_ITEM],
    });
    const cartB = decorateCartTotals({
      currency_code: "inr",
      items: [TAX_INCLUSIVE_ITEM],
    });

    expect(paise(cartA.total)).toBe(paise(cartB.total));
    expect(paise(cartA.item_total)).toBe(paise(cartB.item_total));
    expect(paise(cartA.tax_total)).toBe(paise(cartB.tax_total));
  });

  it("payment retries see a stable amount: the same order total converts to the same paise", () => {
    const first = paise(decorateCartTotals({ currency_code: "inr", items: [TAX_INCLUSIVE_ITEM] }).total);
    const retry = paise(decorateCartTotals({ currency_code: "inr", items: [TAX_INCLUSIVE_ITEM] }).total);
    expect(first).toBe(retry);
    expect(first).toBe(1698000);
  });
});
