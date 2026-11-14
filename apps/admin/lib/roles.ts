/**
 * Pure, client-safe role helpers. Deliberately has no "server-only" dependency (no fetch, no
 * cookies) so Client Components (e.g. components/nav.tsx) can import it directly without pulling
 * `lib/api/auth.ts` — and therefore `next/headers` — into the browser bundle.
 *
 * This is cosmetic nav gating only; the real authorization boundary is server-side on every
 * `/admin/*` backend route (apps/backend/src/lib/admin-auth.ts).
 */
export type AdminRole = "owner" | "manager" | "operations" | "support" | "readonly";

export const ROLE_RANK: Record<AdminRole, number> = {
  readonly: 1,
  support: 2,
  operations: 3,
  manager: 4,
  owner: 5,
};

export function roleAtLeast(role: AdminRole, minimum: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
