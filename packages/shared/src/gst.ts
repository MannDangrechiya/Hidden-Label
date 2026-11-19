/**
 * Indian GST helpers shared by the storefront invoice, checkout copy and tests.
 *
 * GAP-TAX-02 / GAP-TAX-04: an invoice may only charge CGST + SGST when the supplier and the
 * place of supply are in the same state. Every other supply is IGST. HSN classification comes
 * from the product, never from a single hardcoded footwear code.
 */

/** GST state codes (first two digits of a GSTIN), keyed by lower-case state name. */
export const GST_STATE_CODES: Record<string, string> = {
  "andaman and nicobar islands": "35",
  "andhra pradesh": "37",
  "arunachal pradesh": "12",
  assam: "18",
  bihar: "10",
  chandigarh: "04",
  chhattisgarh: "22",
  "dadra and nagar haveli and daman and diu": "26",
  delhi: "07",
  goa: "30",
  gujarat: "24",
  haryana: "06",
  "himachal pradesh": "02",
  "jammu and kashmir": "01",
  jharkhand: "20",
  karnataka: "29",
  kerala: "32",
  ladakh: "38",
  lakshadweep: "31",
  "madhya pradesh": "23",
  maharashtra: "27",
  manipur: "14",
  meghalaya: "17",
  mizoram: "15",
  nagaland: "13",
  odisha: "21",
  puducherry: "34",
  punjab: "03",
  rajasthan: "08",
  sikkim: "11",
  "tamil nadu": "33",
  telangana: "36",
  tripura: "16",
  "uttar pradesh": "09",
  uttarakhand: "05",
  "west bengal": "19",
};

/** Two-letter codes occasionally stored by address pickers. */
const STATE_ABBREVIATIONS: Record<string, string> = {
  ap: "37", ar: "12", as: "18", br: "10", ch: "04", ct: "22", dl: "07", ga: "30",
  gj: "24", hr: "06", hp: "02", jk: "01", jh: "20", ka: "29", kl: "32", mp: "23",
  mh: "27", mn: "14", ml: "17", mz: "15", nl: "13", od: "21", or: "21", py: "34",
  pb: "03", rj: "08", sk: "11", tn: "33", ts: "36", tg: "36", tr: "16", up: "09",
  uk: "05", ua: "05", wb: "19", la: "38", ld: "31", an: "35", dn: "26", dd: "26",
};

/** Resolves a state name or abbreviation to its GST state code, or null when unknown. */
export function gstStateCode(state: string | null | undefined): string | null {
  if (!state) return null;
  const key = state.trim().toLowerCase().replace(/\s+/g, " ");
  if (GST_STATE_CODES[key]) return GST_STATE_CODES[key];
  if (STATE_ABBREVIATIONS[key]) return STATE_ABBREVIATIONS[key];
  if (/^\d{2}$/.test(key)) return key;
  return null;
}

export interface GstBreakdown {
  /** Value before tax. */
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  /** 9 for CGST/SGST legs, 18 for IGST — displayed on the invoice. */
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  intraState: boolean;
  /** Effective rate applied, e.g. 18. */
  ratePercent: number;
}

export interface ComputeGstInput {
  /** Order total as charged, tax inclusive (Medusa stores INR prices tax-inclusive). */
  totalInclusive: number;
  sellerStateCode: string;
  buyerState: string | null | undefined;
  /** Real `order.tax_total` when the tax engine produced one; falls back to 18% inclusive. */
  actualTaxTotal?: number | null;
  /** Fallback rate when there is no tax engine total. */
  fallbackRatePercent?: number;
}

/**
 * Splits an inclusive total into taxable value + the correct GST legs.
 *
 * When the Medusa tax engine has produced an `order.tax_total`, that figure is authoritative
 * and only the leg split is decided here. Otherwise the historical 18% inclusive assumption is
 * used, clearly reported as `ratePercent`.
 */
export function computeInclusiveGst(input: ComputeGstInput): GstBreakdown {
  const total = Math.max(0, Number(input.totalInclusive) || 0);
  const buyerCode = gstStateCode(input.buyerState) ?? input.sellerStateCode;
  const intraState = buyerCode === input.sellerStateCode;

  const ratePercent = input.fallbackRatePercent ?? 18;
  const engineTax = typeof input.actualTaxTotal === "number" && input.actualTaxTotal > 0
    ? Number(input.actualTaxTotal)
    : null;

  const totalTax = engineTax !== null
    ? round2(engineTax)
    : round2(total - total / (1 + ratePercent / 100));
  const taxable = round2(total - totalTax);

  if (intraState) {
    const cgst = round2(totalTax / 2);
    return {
      taxable,
      cgst,
      sgst: round2(totalTax - cgst),
      igst: 0,
      totalTax,
      cgstPercent: round2(ratePercent / 2),
      sgstPercent: round2(ratePercent / 2),
      igstPercent: 0,
      intraState,
      ratePercent,
    };
  }

  return {
    taxable,
    cgst: 0,
    sgst: 0,
    igst: totalTax,
    totalTax,
    cgstPercent: 0,
    sgstPercent: 0,
    igstPercent: round2(ratePercent),
    intraState,
    ratePercent,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * HSN classification used when an order line does not carry its own `hsn` metadata.
 * Apparel is 6203/6204 by gender, footwear 6403, eyewear 9004, bags 4202, fragrance 3303.
 */
export function hsnForProduct(title: string, gender?: string | null): string {
  const text = title.toLowerCase();
  if (/sneaker|shoe|footwear|jordan|samba|dunk|gazelle|kayano|xt-6|990v6|boot|loafer/.test(text)) {
    return "6403";
  }
  if (/sunglass|eyewear|frame/.test(text)) return "9004";
  if (/parfum|perfume|oud|fragrance|eau de/.test(text)) return "3303";
  if (/bag|backpack|tote|wallet|belt/.test(text)) return "4202";
  if (/t-shirt|tee|jersey|hoodie|sweatshirt|pullover/.test(text)) {
    return gender === "women" ? "6110" : "6109";
  }
  if (gender === "women") return "6204";
  return "6203";
}
