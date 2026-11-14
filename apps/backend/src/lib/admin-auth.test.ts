import { describe, expect, it } from "vitest";
import { canWrite, type AdminRole } from "./admin-auth";

describe("Admin Roles and Authorization (apps/backend/src/lib/admin-auth.ts)", () => {
  it("allows write access for owner, manager, operations, support", () => {
    const writeRoles: AdminRole[] = ["owner", "manager", "operations", "support"];
    for (const role of writeRoles) {
      expect(canWrite(role)).toBe(true);
    }
  });

  it("denies write access for readonly role", () => {
    expect(canWrite("readonly")).toBe(false);
  });
});
