import { pas } from '../services/pas';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadFile(path: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum size of 10MB');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed');
  }
  // Most app-side uploads (flyer designs, profile photos, property reports)
  // need to render in <img src>, which means a public URL. Private uploads
  // can call pas.storage.upload() directly.
  const result = await pas.storage.uploadPublic(path, file, file.type);
  return result.url;
}
