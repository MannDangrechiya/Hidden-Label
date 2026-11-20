import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { nextReturnDisplayId } from "./rma-numbering";

let iso: IsolatedDatabase;

beforeAll(async () => {
  iso = await createIsolatedDatabase();
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("RMA numbering under concurrency (BUG-08)", () => {
  it("allocates unique display ids to 25 concurrent requests", async () => {
    const ids = await Promise.all(Array.from({ length: 25 }, () => nextReturnDisplayId(iso.db)));

    expect(new Set(ids).size).toBe(25);
    expect(ids.every((id) => /^RMA-\d+$/.test(id))).toBe(true);

    for (const id of ids) {
      await iso.db("return_request").insert({ id: `rma_${id}`, display_id: id });
    }

    const count = await iso.db("return_request").count<{ count: string }[]>("id as count");
    expect(Number(count[0].count)).toBe(25);
  }, 30_000);

  it("continues past values already taken by the sequence", async () => {
    const first = await nextReturnDisplayId(iso.db);
    const second = await nextReturnDisplayId(iso.db);
    expect(Number(second.replace("RMA-", ""))).toBe(
      Number(first.replace("RMA-", "")) + 1,
    );
  }, 30_000);
});
