import "server-only";
import { BackendError, requireSessionToken } from "../backend";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:9000";

export interface UploadedFile {
  id: string;
  url: string;
}

/**
 * MF-26: real image upload. Medusa's core `POST /admin/uploads` wants multipart form data
 * (`multer.array("files")`), so this bypasses `backendFetch` — that helper always JSON-encodes
 * its body — and posts the browser-supplied `File` directly under the field name it expects.
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const token = await requireSessionToken();

  const body = new FormData();
  body.append("files", file, file.name);

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/admin/uploads`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new BackendError(
      `Cannot reach the backend at ${BACKEND_URL}. Is it running? (${
        error instanceof Error ? error.message : String(error)
      })`,
      0,
    );
  }

  const text = await response.text();
  const json = text ? (JSON.parse(text) as { files?: UploadedFile[]; message?: string }) : {};

  if (!response.ok) {
    throw new BackendError(json.message ?? `Upload failed with status ${response.status}.`, response.status);
  }

  const uploaded = json.files?.[0];
  if (!uploaded) throw new BackendError("The backend did not return an uploaded file.", 502);
  return uploaded;
}
