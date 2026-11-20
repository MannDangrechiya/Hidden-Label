import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, resolveAdminRole, roleAtLeast, ROLE_RANK } from "./roles";

describe("Admin Role Hierarchy (apps/admin/lib/roles.ts)", () => {
  it("orders roles correctly: owner > manager > operations > support > readonly", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.manager);
    expect(ROLE_RANK.manager).toBeGreaterThan(ROLE_RANK.operations);
    expect(ROLE_RANK.operations).toBeGreaterThan(ROLE_RANK.support);
    expect(ROLE_RANK.support).toBeGreaterThan(ROLE_RANK.readonly);
  });

  it("evaluates roleAtLeast accurately", () => {
    expect(roleAtLeast("owner", "manager")).toBe(true);
    expect(roleAtLeast("manager", "operations")).toBe(true);
    expect(roleAtLeast("operations", "support")).toBe(true);
    expect(roleAtLeast("support", "readonly")).toBe(true);

    expect(roleAtLeast("readonly", "support")).toBe(false);
    expect(roleAtLeast("support", "operations")).toBe(false);
    expect(roleAtLeast("operations", "manager")).toBe(false);
    expect(roleAtLeast("manager", "owner")).toBe(false);
  });
});

describe("Admin role resolution (SEC-01)", () => {
  it("returns each documented role", () => {
    for (const role of ADMIN_ROLES) {
      expect(resolveAdminRole(role)).toBe(role);
    }
  });

  it("never defaults a missing role to owner or readonly", () => {
    expect(resolveAdminRole(undefined)).toBeNull();
    expect(resolveAdminRole(null)).toBeNull();
    expect(resolveAdminRole("")).toBeNull();
    expect(resolveAdminRole(undefined)).not.toBe("owner");
  });

  it("rejects unknown and mis-cased roles", () => {
    expect(resolveAdminRole("OWNER")).toBeNull();
    expect(resolveAdminRole("admin")).toBeNull();
    expect(resolveAdminRole("manager ")).toBeNull();
    expect(resolveAdminRole(1)).toBeNull();
    expect(resolveAdminRole(["owner"])).toBeNull();
  });
});
