import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLES,
  canWrite,
  decideAdminRequest,
  meetsRole,
  parseAdminRole,
  stripPrivilegedMetadata,
  type AdminRole,
} from "./admin-auth";

describe("Admin role parsing (SEC-01)", () => {
  it("accepts every documented role explicitly", () => {
    for (const role of ADMIN_ROLES) {
      expect(parseAdminRole(role)).toBe(role);
    }
  });

  it("returns null for a missing role", () => {
    expect(parseAdminRole(undefined)).toBeNull();
    expect(parseAdminRole(null)).toBeNull();
    expect(parseAdminRole("")).toBeNull();
  });

  it("returns null for an invalid or differently-cased role", () => {
    expect(parseAdminRole("OWNER")).toBeNull();
    expect(parseAdminRole("Owner")).toBeNull();
    expect(parseAdminRole("superadmin")).toBeNull();
    expect(parseAdminRole("admin")).toBeNull();
    expect(parseAdminRole(5)).toBeNull();
    expect(parseAdminRole({ role: "owner" })).toBeNull();
  });

  it("never resolves a missing role to owner", () => {
    expect(parseAdminRole(undefined)).not.toBe("owner");
    expect(parseAdminRole("nonsense")).not.toBe("owner");
  });
});

describe("Admin role hierarchy", () => {
  it("allows write access for owner, manager, operations, support", () => {
    const writeRoles: AdminRole[] = ["owner", "manager", "operations", "support"];
    for (const role of writeRoles) {
      expect(canWrite(role)).toBe(true);
    }
  });

  it("denies write access for readonly role", () => {
    expect(canWrite("readonly")).toBe(false);
  });

  it("orders roles strictly", () => {
    expect(meetsRole("owner", "manager")).toBe(true);
    expect(meetsRole("manager", "operations")).toBe(true);
    expect(meetsRole("operations", "support")).toBe(true);
    expect(meetsRole("support", "readonly")).toBe(true);

    expect(meetsRole("readonly", "support")).toBe(false);
    expect(meetsRole("support", "operations")).toBe(false);
    expect(meetsRole("operations", "manager")).toBe(false);
    expect(meetsRole("manager", "owner")).toBe(false);
  });
});

describe("Admin request decisions", () => {
  const base = { actorId: "user_owner", path: "/admin/orders", method: "GET" };

  it("lets support and above read operational records", () => {
    for (const role of ["support", "operations", "manager", "owner"] as AdminRole[]) {
      expect(decideAdminRequest({ ...base, role })).toEqual({
        allow: true,
        stripPrivilegedMetadata: false,
      });
    }
  });

  it("denies readonly access to operational records", () => {
    const decision = decideAdminRequest({ ...base, role: "readonly" });
    expect(decision.allow).toBe(false);
  });

  it("denies write actions to readonly on user management", () => {
    const decision = decideAdminRequest({
      ...base,
      role: "readonly",
      method: "POST",
      path: "/admin/users",
    });
    expect(decision.allow).toBe(false);
  });

  it("requires manager or owner for staff management", () => {
    expect(
      decideAdminRequest({ ...base, role: "support", path: "/admin/users" }).allow,
    ).toBe(false);
    expect(
      decideAdminRequest({ ...base, role: "operations", path: "/admin/invites" }).allow,
    ).toBe(false);
    expect(decideAdminRequest({ ...base, role: "manager", path: "/admin/users" }).allow).toBe(true);
    expect(decideAdminRequest({ ...base, role: "owner", path: "/admin/users" }).allow).toBe(true);
  });

  it("blocks a manager from changing roles", () => {
    const decision = decideAdminRequest({
      ...base,
      role: "manager",
      method: "POST",
      path: "/admin/users/user_1",
      body: { metadata: { role: "owner" } },
    });
    expect(decision).toEqual({
      allow: false,
      status: 403,
      message: "Only owner can modify roles.",
    });
  });

  it("blocks self role escalation for an owner", () => {
    const decision = decideAdminRequest({
      ...base,
      role: "owner",
      method: "POST",
      path: "/admin/users/user_owner",
      body: { metadata: { role: "manager" } },
    });
    expect(decision.allow).toBe(false);
    if (!decision.allow) expect(decision.message).toContain("Self-role escalation");
  });

  it("allows an owner to change another user's role", () => {
    expect(
      decideAdminRequest({
        ...base,
        role: "owner",
        method: "POST",
        path: "/admin/users/user_2",
        body: { metadata: { role: "support" } },
      }).allow,
    ).toBe(true);
  });

  it("refuses privileged metadata writes through the self identity route", () => {
    for (const body of [
      { metadata: { role: "owner" } },
      { metadata: { permissions: ["*"] } },
      { role: "owner" },
      { is_owner: true },
    ]) {
      const decision = decideAdminRequest({
        ...base,
        role: "owner",
        method: "POST",
        path: "/admin/users/me",
        body,
      });
      expect(decision.allow).toBe(false);
    }
  });

  it("allows a benign self-profile update and flags metadata stripping", () => {
    const decision = decideAdminRequest({
      ...base,
      role: "owner",
      method: "POST",
      path: "/admin/users/me",
      body: { metadata: { theme: "light" } },
    });
    expect(decision).toEqual({ allow: true, stripPrivilegedMetadata: true });
  });

  it("strips privileged keys from an otherwise allowed self update", () => {
    const body: Record<string, unknown> = { metadata: { theme: "dark", role: "owner" }, role: "owner" };
    stripPrivilegedMetadata(body);
    expect(body).toEqual({ metadata: { theme: "dark" } });
  });
});
