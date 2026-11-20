import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, validateImageUpload } from "./upload-rules";

const image = { name: "product.jpg", type: "image/jpeg", size: 1024 };

describe("Admin image upload validation", () => {
  it("accepts allowed image types with matching extensions", () => {
    for (const [type, name] of [
      ["image/jpeg", "a.jpg"],
      ["image/jpeg", "a.jpeg"],
      ["image/png", "a.png"],
      ["image/webp", "a.webp"],
      ["image/avif", "a.avif"],
    ] as const) {
      expect(validateImageUpload({ name, type, size: 2048 })).toEqual({ ok: true });
    }
  });

  it("rejects a non-image MIME type", () => {
    const result = validateImageUpload({ name: "invoice.pdf", type: "application/pdf", size: 1024 });
    expect(result.ok).toBe(false);
  });

  it("rejects a script disguised as an image", () => {
    expect(validateImageUpload({ name: "evil.svg", type: "image/svg+xml", size: 100 }).ok).toBe(false);
    expect(validateImageUpload({ name: "payload.html", type: "image/png", size: 100 }).ok).toBe(false);
  });

  it("rejects an oversized image", () => {
    const result = validateImageUpload({ ...image, size: MAX_IMAGE_BYTES + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("MB");
  });

  it("rejects empty files and empty names", () => {
    expect(validateImageUpload({ ...image, size: 0 }).ok).toBe(false);
    expect(validateImageUpload({ ...image, name: "  " }).ok).toBe(false);
  });
});
