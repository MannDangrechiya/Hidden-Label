/**
 * Upload validation for the admin media manager.
 *
 * Checked before the browser-supplied `File` is posted to Medusa's `/admin/uploads`, so a
 * mislabelled or oversized file never reaches the backend. The backend independently rejects
 * non-multipart or oversized requests (`apps/backend/src/lib/upload-validation.ts`).
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"] as const;

export type UploadValidation =
  | { ok: true }
  | { ok: false; message: string };

export interface UploadCandidate {
  name: string;
  type: string;
  size: number;
}

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function validateImageUpload(file: UploadCandidate): UploadValidation {
  if (!file || typeof file.name !== "string" || !file.name.trim()) {
    return { ok: false, message: "Choose an image file to upload." };
  }

  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      message: `Unsupported image type${file.type ? ` (${file.type})` : ""}. Use JPEG, PNG, WebP or AVIF.`,
    };
  }

  if (!hasAllowedExtension(file.name)) {
    return { ok: false, message: "The file extension does not match an allowed image type." };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, message: "The selected file is empty." };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: `Images must be ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))} MB or smaller.`,
    };
  }

  return { ok: true };
}
