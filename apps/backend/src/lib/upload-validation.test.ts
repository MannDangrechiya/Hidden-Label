import { describe, expect, it } from "vitest";
import { checkUploadRequest, MAX_UPLOAD_BYTES } from "./upload-validation";

describe("Upload request guard", () => {
  it("accepts a normal multipart image upload", () => {
    expect(
      checkUploadRequest({
        "content-type": "multipart/form-data; boundary=----x",
        "content-length": "524288",
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a multipart request without a content-length header", () => {
    expect(checkUploadRequest({ "content-type": "multipart/form-data; boundary=----x" })).toEqual({
      ok: true,
    });
  });

  it("rejects non-multipart bodies", () => {
    const result = checkUploadRequest({ "content-type": "application/json" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a missing content type", () => {
    expect(checkUploadRequest({}).ok).toBe(false);
  });

  it("rejects an oversized body with 413", () => {
    const result = checkUploadRequest({
      "content-type": "multipart/form-data; boundary=----x",
      "content-length": String(MAX_UPLOAD_BYTES * 4),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("rejects a non-numeric content length", () => {
    const result = checkUploadRequest({
      "content-type": "multipart/form-data",
      "content-length": "lots",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
