import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../test/integration-db";
import { POST } from "./route";

/**
 * Route-level regression tests for POST /admin/inventory against a real PostgreSQL schema.
 *
 * These call the exported handler directly with a minimal request/response shim and the real
 * knex connection, so the RBAC check, the validation and the transactional adjustment all run
 * as they do in the server — without booting a Medusa process.
 */

let iso: IsolatedDatabase;

const ITEM = "iitem_route";
const LOCATION = "sloc_route";

interface CapturedResponse {
  statusCode: number;
  body: Record<string, unknown> | null;
}

function makeResponse(capture: CapturedResponse): MedusaResponse {
  const res = {
    status(code: number) {
      capture.statusCode = code;
      return res;
    },
    json(payload: Record<string, unknown>) {
      capture.body = payload;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return res as unknown as MedusaResponse;
}

function makeRequest(
  actorId: string | undefined,
  body: Record<string, unknown>,
): MedusaRequest {
  const scope = {
    resolve(key: string) {
      if (key === "pgConnection" || String(key).toLowerCase().includes("pg")) return iso.db;
      return iso.db;
    },
  };
  return {
    body,
    auth_context: actorId ? { actor_id: actorId, actor_type: "user" } : undefined,
    scope,
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
  } as unknown as MedusaRequest;
}

async function callRoute(
  actorId: string | undefined,
  body: Record<string, unknown>,
): Promise<CapturedResponse> {
  const capture: CapturedResponse = { statusCode: 200, body: null };
  await POST(makeRequest(actorId, body), makeResponse(capture));
  return capture;
}

beforeAll(async () => {
  iso = await createIsolatedDatabase();
  await iso.db("user").insert([
    { id: "user_ops", email: "ops@example.test", metadata: JSON.stringify({ role: "operations" }) },
    { id: "user_readonly", email: "ro@example.test", metadata: JSON.stringify({ role: "readonly" }) },
    { id: "user_norole", email: "norole@example.test", metadata: JSON.stringify({}) },
  ]);
  await iso.db("inventory_level").insert({
    id: "il_route",
    inventory_item_id: ITEM,
    location_id: LOCATION,
    stocked_quantity: 10,
    reserved_quantity: 2,
  });
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("POST /admin/inventory (route level)", () => {
  it("denies an unauthenticated request with 401", async () => {
    const result = await callRoute(undefined, {});
    expect(result.statusCode).toBe(401);
  });

  it("denies a staff user with no role with 403 no_role_assigned", async () => {
    const result = await callRoute("user_norole", {
      inventory_item_id: ITEM,
      location_id: LOCATION,
      delta: 1,
      reason: "sample",
    });
    expect(result.statusCode).toBe(403);
    expect(result.body?.type).toBe("no_role_assigned");
  });

  it("denies a readonly user with 403", async () => {
    const result = await callRoute("user_readonly", {
      inventory_item_id: ITEM,
      location_id: LOCATION,
      delta: 1,
      reason: "sample",
    });
    expect(result.statusCode).toBe(403);
  });

  it("rejects a missing reason code with 400", async () => {
    const result = await callRoute("user_ops", {
      inventory_item_id: ITEM,
      location_id: LOCATION,
      delta: 1,
    });
    expect(result.statusCode).toBe(400);
  });

  it("applies a valid adjustment and returns the resulting level", async () => {
    const result = await callRoute("user_ops", {
      inventory_item_id: ITEM,
      location_id: LOCATION,
      delta: 5,
      reason: "stock_count",
    });

    expect(result.statusCode).toBe(200);
    expect(result.body?.available).toBe(13);
  });

  it("refuses a negative result with 422 and leaves the level unchanged", async () => {
    const result = await callRoute("user_ops", {
      inventory_item_id: ITEM,
      location_id: LOCATION,
      delta: -100,
      reason: "lost",
    });

    expect(result.statusCode).toBe(422);
    const level = await iso.db("inventory_level").where({ id: "il_route" }).first();
    expect(Number(level.stocked_quantity)).toBe(15);
  });

  it("creates a missing level for a brand-new variant instead of 404ing (D2)", async () => {
    const result = await callRoute("user_ops", {
      inventory_item_id: "iitem_new_variant",
      location_id: LOCATION,
      delta: 7,
      reason: "stock_count",
    });

    expect(result.statusCode).toBe(200);
    expect(result.body?.available).toBe(7);

    const level = await iso.db("inventory_level")
      .where({ inventory_item_id: "iitem_new_variant", location_id: LOCATION })
      .first();
    expect(level).toBeDefined();
    expect(String(level.id)).toMatch(/^ilev_/);
    expect(Number(level.stocked_quantity)).toBe(7);

    // A second adjust on the now-existing level works like any other adjustment.
    const second = await callRoute("user_ops", {
      inventory_item_id: "iitem_new_variant",
      location_id: LOCATION,
      delta: -2,
      reason: "sample",
    });
    expect(second.statusCode).toBe(200);
    expect(second.body?.available).toBe(5);
  }, 30_000);

  it("does not leave a stocked level when the delta would go negative (D2)", async () => {
    const result = await callRoute("user_ops", {
      inventory_item_id: "iitem_also_new",
      location_id: LOCATION,
      delta: -1,
      reason: "damaged",
    });

    expect(result.statusCode).toBe(422);
    // The missing level was created at zero (documenting that the location now tracks this
    // item), but the negative adjustment was refused, so it holds no stock.
    const level = await iso.db("inventory_level")
      .where({ inventory_item_id: "iitem_also_new", location_id: LOCATION })
      .first();
    expect(level).toBeDefined();
    expect(Number(level.stocked_quantity)).toBe(0);
  }, 30_000);
});
