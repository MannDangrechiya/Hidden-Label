import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../../test/integration-db";
import { createGuestSession } from "../../../../lib/concierge-session";
import { POST } from "./route";

/**
 * Route-level regression tests for concierge thread ownership (BUG-09).
 *
 * The handler is called directly with a minimal request/response shim and a real PostgreSQL
 * schema. The case that matters is the one the audit found: a second session must not be able
 * to append to another session's thread, and a client-supplied token must never be trusted
 * without signature verification.
 */

let iso: IsolatedDatabase;
const SECRET = "test_concierge_secret_0123456789abcdef0123456789";

interface Captured {
  statusCode: number;
  body: Record<string, unknown> | null;
}

function makeResponse(capture: Captured): MedusaResponse {
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

function makeRequest(body: Record<string, unknown>, actorId?: string): MedusaRequest {
  return {
    body,
    auth_context: actorId ? { actor_id: actorId, actor_type: "customer" } : undefined,
    scope: {
      resolve() {
        return iso.db;
      },
    },
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
  } as unknown as MedusaRequest;
}

async function callRoute(body: Record<string, unknown>, actorId?: string): Promise<Captured> {
  const capture: Captured = { statusCode: 200, body: null };
  await POST(makeRequest(body, actorId), makeResponse(capture));
  return capture;
}

beforeAll(async () => {
  process.env.MEDUSA_JWT_SECRET = SECRET;
  iso = await createIsolatedDatabase();
  await iso.db("product").insert({
    id: "prod_1",
    title: "Test Sneaker",
    handle: "test-sneaker",
    thumbnail: null,
    description: "A test product",
    status: "published",
  });
  await iso.db("brand").insert({ id: "brand_1", name: "Test Brand" });
  await iso.db("product_brand").insert({ product_id: "prod_1", brand_id: "brand_1" });
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
  delete process.env.MEDUSA_JWT_SECRET;
});

describe("POST /store/concierge/chat ownership", () => {
  it("issues a signed session for a new guest thread", async () => {
    const result = await callRoute({ message: "I want a white sneaker" });

    expect(result.statusCode).toBe(200);
    expect(typeof result.body?.thread_id).toBe("string");
    expect(typeof result.body?.session_token).toBe("string");

    const thread = await iso.db("concierge_thread").where({ id: result.body?.thread_id }).first();
    expect(thread.session_token_hash).toBeTruthy();
    expect(thread.session_token).not.toBe(result.body?.session_token);
  });

  it("rejects a thread id with no session token", async () => {
    const created = await callRoute({ message: "first message" });
    const threadId = created.body?.thread_id as string;

    const result = await callRoute({ message: "hijack attempt", thread_id: threadId });
    expect(result.statusCode).toBe(403);

    const messages = await iso.db("concierge_message").where({ thread_id: threadId });
    expect(messages).toHaveLength(2); // user + assistant from the first request only
  });

  it("rejects another guest's valid token", async () => {
    const victim = await callRoute({ message: "victim message" });
    const threadId = victim.body?.thread_id as string;
    const attackerSession = createGuestSession(SECRET);

    const result = await callRoute({
      message: "attacker message",
      thread_id: threadId,
      session_token: attackerSession.token,
    });
    expect(result.statusCode).toBe(403);
  });

  it("rejects an unsigned client-minted token", async () => {
    const created = await callRoute({ message: "signed message" });
    const threadId = created.body?.thread_id as string;

    const result = await callRoute({
      message: "forged message",
      thread_id: threadId,
      session_token: "sess_12345678",
    });
    expect(result.statusCode).toBe(403);
  });

  it("allows the same guest to continue with its issued token", async () => {
    const created = await callRoute({ message: "remember my size" });
    const threadId = created.body?.thread_id as string;
    const token = created.body?.session_token as string;

    const result = await callRoute({
      message: "what did I say?",
      thread_id: threadId,
      session_token: token,
    });
    expect(result.statusCode).toBe(200);
    expect(result.body?.thread_id).toBe(threadId);
  });

  it("scopes a customer thread to that customer only", async () => {
    const threadId = "cth_customer_thread";
    await iso.db("concierge_thread").insert({
      id: threadId,
      customer_id: "cus_owner",
      session_token: "customer:cus_owner",
      session_token_hash: null,
    });

    const foreign = await callRoute({ message: "hello", thread_id: threadId }, "cus_other");
    expect(foreign.statusCode).toBe(403);

    const owner = await callRoute({ message: "hello", thread_id: threadId }, "cus_owner");
    expect(owner.statusCode).toBe(200);
  });

  it("rejects a legacy thread that has neither owner nor session hash", async () => {
    await iso.db("concierge_thread").insert({
      id: "cth_legacy",
      customer_id: null,
      session_token: "sess_old",
      session_token_hash: null,
    });
    const result = await callRoute({ message: "hello", thread_id: "cth_legacy" });
    expect(result.statusCode).toBe(403);
  });
});
