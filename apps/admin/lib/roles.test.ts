import { describe, expect, it } from "vitest";
import { roleAtLeast, ROLE_RANK } from "./roles";

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
