export type StorageBucket =
  | "product-images"
  | "rental-images"
  | "food-images"
  | "notes-assets"
  | "profile-avatars"
  | "avatars";

export function getStoragePublicUrl(bucket: StorageBucket, storagePath: string): string {
  // If already a full URL (Cloudinary), return as-is
  if (storagePath?.startsWith('http')) return storagePath;
  // Fallback for any old Supabase paths still in DB
  return `https://gspyomabbvtlcuskszyn.supabase.co/storage/v1/object/public/${bucket}/${storagePath}`;
}