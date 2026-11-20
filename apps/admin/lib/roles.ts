/**
 * Pure, client-safe role helpers. Deliberately has no "server-only" dependency (no fetch, no
 * cookies) so Client Components (e.g. components/nav.tsx) can import it directly without pulling
 * `lib/api/auth.ts` — and therefore `next/headers` — into the browser bundle.
 *
 * This is cosmetic nav gating only; the real authorization boundary is server-side on every
 * `/admin/*` backend route (apps/backend/src/lib/admin-auth.ts).
 */
export type AdminRole = "owner" | "manager" | "operations" | "support" | "readonly";

export const ADMIN_ROLES: readonly AdminRole[] = [
  "owner",
  "manager",
  "operations",
  "support",
  "readonly",
] as const;

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

/**
 * SEC-01: no default role. Missing, empty or unrecognised metadata yields `null`, which the
 * caller must treat as "no access". The backend enforces the same rule, so a role-less account
 * is denied by the API regardless of what this app renders.
 */
export function resolveAdminRole(raw: unknown): AdminRole | null {
  if (typeof raw !== "string") return null;
  return (ADMIN_ROLES as readonly string[]).includes(raw) ? (raw as AdminRole) : null;
}
