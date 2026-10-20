// Shared size/type rules for flyer uploads. Used by the campaign wizard
// (FlyerStep) and the flyer library page (FlyersPage, create and edit).
// storageUpload.ts keeps its own rules because it also serves profile photos.

export const FLYER_MAX_SIZE_MB = 10;
export const FLYER_MAX_SIZE_BYTES = FLYER_MAX_SIZE_MB * 1024 * 1024;

export const FLYER_ACCEPTED_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

// Value for <input accept="...">
export const FLYER_ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.gif,.pdf";

export const FLYER_TYPE_HINT = "JPG, PNG, WebP, GIF or PDF";

/** Returns an error message for a file that can't be used as a flyer, or null if it's valid. */
export function validateFlyerFile(file: File): string | null {
  if (file.size > FLYER_MAX_SIZE_BYTES) {
    return `File too large. Maximum size is ${FLYER_MAX_SIZE_MB} MB.`;
  }

  if (!FLYER_ACCEPTED_TYPES.includes(file.type)) {
    return `Invalid file type. Please upload a ${FLYER_TYPE_HINT}.`;
  }

  return null;
}
