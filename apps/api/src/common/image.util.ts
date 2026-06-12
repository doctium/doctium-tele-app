import { CloudinaryService } from "../modules/prescriptions/cloudinary.service";

/**
 * Resolves an uploaded image to a storable string.
 * - empty / non-data-URL (already a URL) → returned unchanged
 * - data-URL + Cloudinary configured → uploaded, returns the secure URL
 * - data-URL + Cloudinary NOT configured → returns the data-URL itself so the image still
 *   persists & displays today (upgrades to Cloudinary automatically once creds are added)
 */
export async function resolveImageUrl(
  cloudinary: CloudinaryService,
  dataUrl: string | undefined | null,
  publicId: string,
): Promise<string> {
  if (!dataUrl) return "";
  if (!dataUrl.startsWith("data:")) return dataUrl;
  if (cloudinary.isConfigured()) {
    const url = await cloudinary.uploadDataUrl(dataUrl, publicId);
    if (url) return url;
  }
  return dataUrl;
}
