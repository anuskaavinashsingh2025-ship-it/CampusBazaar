import { supabase } from "@/integrations/supabase/client";

export type StorageBucket =
  | "product-images"
  | "rental-images"
  | "food-images"
  | "notes-assets"
  | "profile-avatars"
  | "avatars";

export function getStoragePublicUrl(bucket: StorageBucket, storagePath: string): string {
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}
