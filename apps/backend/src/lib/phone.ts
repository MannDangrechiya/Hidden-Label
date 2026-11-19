/**
 * GAP-SMS-02: Indian shoppers type `9876543210`, `09876543210`, `91 98765 43210` or
 * `+91 98765 43210`. All of them normalise to E.164 `+919876543210`; only genuinely
 * invalid numbers are rejected.
 */
export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return null;

  // +91XXXXXXXXXX / 91XXXXXXXXXX / 0091XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 14 && digits.startsWith("0091")) return `+${digits.slice(2)}`;

  // 0XXXXXXXXXX (trunk prefix)
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;

  // Bare 10-digit Indian mobile
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;

  // Any other country in E.164 form
  if (hadPlus && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;

  return null;
}

export function isEmail(input: string | null | undefined): boolean {
  return Boolean(input && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim()));
}
