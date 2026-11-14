/**
 * Plain constants shared by server-only API wrappers and Client Components. Kept separate from
 * `lib/api/inventory.ts` (which has `import "server-only"`) so a Client Component can read the
 * reason list without pulling a server-only module — and therefore `next/headers` — into the
 * browser bundle.
 */
export const ADJUST_REASONS = [
  "count_correction",
  "damaged",
  "lost",
  "return_restock",
  "sample",
  "transfer",
] as const;

export type AdjustReason = (typeof ADJUST_REASONS)[number];
