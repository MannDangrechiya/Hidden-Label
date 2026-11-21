import { describe, it, expect } from "vitest";
import { computeInclusiveGst, hsnForProduct } from "./gst";
import { toPaise, toRupeesNumber } from "./money";

describe("GST Credit Notes (Unit)", () => {
  it("computes intra-state GST breakdown (CGST + SGST) accurately", () => {
    // ₹10,000 total inclusive at 18% GST intra-state (Gujarat to Gujarat)
    const gst = computeInclusiveGst({
      totalInclusive: 10000,
      sellerStateCode: "24",
      buyerState: "Gujarat",
      fallbackRatePercent: 18,
    });

    expect(gst.intraState).toBe(true);
    expect(gst.taxable).toBe(8474.58);
    expect(gst.cgst).toBe(762.71);
    expect(gst.sgst).toBe(762.71);
    expect(gst.igst).toBe(0);
    expect(gst.totalTax).toBe(1525.42);
    expect(gst.taxable + gst.totalTax).toBeCloseTo(10000, 2);
  });

  it("computes inter-state GST breakdown (IGST) accurately", () => {
    // ₹10,000 total inclusive at 18% GST inter-state (Gujarat to Maharashtra)
    const gst = computeInclusiveGst({
      totalInclusive: 10000,
      sellerStateCode: "24",
      buyerState: "Maharashtra",
      fallbackRatePercent: 18,
    });

    expect(gst.intraState).toBe(false);
    expect(gst.taxable).toBe(8474.58);
    expect(gst.cgst).toBe(0);
    expect(gst.sgst).toBe(0);
    expect(gst.igst).toBe(1525.42);
    expect(gst.totalTax).toBe(1525.42);
  });

  it("derives correct HSN code by product category", () => {
    expect(hsnForProduct("Air Jordan 1 High OG")).toBe("6403"); // Footwear
    expect(hsnForProduct("Oversized Graphic Tee", "men")).toBe("6109"); // Men's tee
    expect(hsnForProduct("Silk Blend Evening Dress", "women")).toBe("6204"); // Women's dress
    expect(hsnForProduct("Aviator Sunglasses")).toBe("9004"); // Eyewear
    expect(hsnForProduct("Leather Crossbody Bag")).toBe("4202"); // Bags
    expect(hsnForProduct("Extrait De Parfum 100ml")).toBe("3303"); // Fragrance
  });

  it("converts exact integer paise to rupees string safely", () => {
    expect(toPaise(18878.82)).toBe(1887882);
    expect(toRupeesNumber(1887882)).toBe(18878.82);
  });
});
