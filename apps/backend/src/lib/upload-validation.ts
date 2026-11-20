/**
 * Request-level guard for `POST /admin/uploads`.
 *
 * Medusa's core upload route accepts multipart form data. Per-file MIME and size checks happen
 * in the admin app before the file is sent (`apps/admin/lib/upload-rules.ts`); this guard stops
 * an oversized or non-multipart request before it is buffered, so the backend is not used as an
 * unbounded upload sink by anything that can authenticate.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Multipart framing overhead allowance on top of the file limit. */
export const UPLOAD_FRAME_OVERHEAD_BYTES = 1024 * 1024;

export type UploadRequestCheck =
  | { ok: true }
  | { ok: false; status: 400 | 413; message: string };

type HeaderValue = string | string[] | undefined;

function header(headers: Record<string, HeaderValue>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function checkUploadRequest(headers: Record<string, HeaderValue>): UploadRequestCheck {
  const contentType = header(headers, "content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return {
      ok: false,
      status: 400,
      message: "Uploads must be sent as multipart/form-data.",
    };
  }

  const rawLength = header(headers, "content-length");
  if (rawLength !== undefined) {
    const length = Number(rawLength);
    if (!Number.isFinite(length) || length < 0) {
      return { ok: false, status: 400, message: "Invalid Content-Length header." };
    }
    if (length > MAX_UPLOAD_BYTES + UPLOAD_FRAME_OVERHEAD_BYTES) {
      return {
        ok: false,
        status: 413,
        message: `Uploads are limited to ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
      };
    }
  }

  return { ok: true };
}
