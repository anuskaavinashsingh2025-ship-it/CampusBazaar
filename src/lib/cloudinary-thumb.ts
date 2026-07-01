/**
 * Inserts Cloudinary transformation parameters into an existing Cloudinary
 * delivery URL to request a small, optimized thumbnail instead of the
 * full-size original image.
 *
 * Example:
 *   https://res.cloudinary.com/demo/image/upload/v123/folder/photo.jpg
 *   -> https://res.cloudinary.com/demo/image/upload/w_120,h_120,c_fill,q_auto,f_auto/v123/folder/photo.jpg
 *
 * If the URL isn't a Cloudinary URL (e.g. already has transforms, or is some
 * other host), it's returned unchanged so this is safe to wrap around any
 * coverUrl without breaking non-Cloudinary cases.
 */
export function cloudinaryThumb(
  url: string | null | undefined,
  opts: { width?: number; height?: number } = {},
): string | null {
  if (!url) return null;
  const { width = 120, height = 120 } = opts;

  const marker = "/image/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url; // not a Cloudinary upload URL, leave as-is

  const before = url.slice(0, idx + marker.length);
  const after = url.slice(idx + marker.length);

  // If transformations already present (e.g. starts with a known param key),
  // don't double up — just return the original URL.
  if (/^[a-z]_/i.test(after)) return url;

  const transform = `w_${width},h_${height},c_fill,q_auto,f_auto`;
  return `${before}${transform}/${after}`;
}