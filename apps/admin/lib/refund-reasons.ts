/** MF-31: a standard reason taxonomy for refunds, reported in the audit log and to finance. */
export const REFUND_REASON_CODES = [
  { value: "customer_request", label: "Customer request" },
  { value: "damaged_or_defective", label: "Damaged or defective item" },
  { value: "wrong_item_shipped", label: "Wrong item shipped" },
  { value: "price_adjustment", label: "Price adjustment / goodwill" },
  { value: "duplicate_charge", label: "Duplicate charge" },
  { value: "other", label: "Other" },
] as const;

export const REFUND_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REFUND_REASON_CODES.map((entry) => [entry.value, entry.label]),
);
