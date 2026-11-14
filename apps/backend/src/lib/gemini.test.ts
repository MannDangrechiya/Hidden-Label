import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("gemini client (apps/backend/src/lib/gemini.ts)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("isConfigured is false with no key", async () => {
    const { isConfigured } = await import("./gemini");
    expect(isConfigured()).toBe(false);
  });

  it("generateConciergeReply throws (never fabricates a reply) when not configured", async () => {
    const { generateConciergeReply } = await import("./gemini");
    await expect(
      generateConciergeReply("something casual for weekends", [{ title: "Dunk Low", handle: "dunk-low" }]),
    ).rejects.toThrow(/not configured/i);
  });

  it("returns the model's real text and grounds the prompt in the real catalogue", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Try the Dunk Low — it suits weekend fits." }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { generateConciergeReply } = await import("./gemini");
    const reply = await generateConciergeReply("something casual for weekends", [
      { title: "Dunk Low", handle: "dunk-low", brand: "Nike" },
    ]);

    expect(reply).toBe("Try the Dunk Low — it suits weekend fits.");
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const sentBody = JSON.parse(init.body);
    expect(sentBody.contents[0].parts[0].text).toContain("Dunk Low");
    expect(sentBody.contents[0].parts[0].text).toContain("never invent a product");
  });

  it("throws when the Gemini API responds with an error", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" }),
    );

    const { generateConciergeReply } = await import("./gemini");
    await expect(generateConciergeReply("hi", [])).rejects.toThrow(/429/);
  });

  it("analyzeSneakerImage fetches the image and sends it as inline data, returning parsed keywords", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const imageBytes = new Uint8Array([1, 2, 3]).buffer;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => imageBytes,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "nike, dunk low, panda" }] } }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { analyzeSneakerImage } = await import("./gemini");
    const keywords = await analyzeSneakerImage("https://example.com/shoe.jpg");

    expect(keywords).toEqual(["nike", "dunk low", "panda"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, geminiInit] = fetchMock.mock.calls[1] as [string, { body: string }];
    const sentBody = JSON.parse(geminiInit.body);
    expect(sentBody.contents[0].parts[1].inline_data.mime_type).toBe("image/png");
  });
});
