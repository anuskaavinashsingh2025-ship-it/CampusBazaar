/**
 * Appends Cloudinary transformation params to an existing secure_url
 * for automatic format (WebP/AVIF) and quality optimization.
 */
export function optimizedImage(url: string | null | undefined, width = 800): string {
  if (!url || !url.includes('/upload/')) return url ?? '';
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}