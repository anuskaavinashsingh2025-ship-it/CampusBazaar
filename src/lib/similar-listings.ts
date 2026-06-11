import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getStoragePublicUrl, type StorageBucket } from "@/lib/storage-url";
import type { WishlistItemType } from "@/lib/wishlist";

export type SimilarListingItem = {
  id: string;
  title: string;
  priceLabel: string;
  coverUrl: string | null;
  route: string;
};

const TABLE_MAP: Record<
  WishlistItemType,
  { table: string; imageTable: string; bucket: string; idField: string; routePrefix: string }
> = {
  product: {
    table: "product_listings",
    imageTable: "product_images",
    bucket: "product-images",
    idField: "product_id",
    routePrefix: "/product",
  },
  rental: {
    table: "rental_listings",
    imageTable: "rental_images",
    bucket: "rental-images",
    idField: "rental_id",
    routePrefix: "/rent",
  },
  food: {
    table: "food_listings",
    imageTable: "food_images",
    bucket: "food-images",
    idField: "food_listing_id",
    routePrefix: "/food",
  },
  notes: {
    table: "notes_listings",
    imageTable: "notes_assets",
    bucket: "notes-assets",
    idField: "listing_id",
    routePrefix: "/notes",
  },
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

export function useSimilarListings(
  itemType: WishlistItemType,
  currentId: string | undefined,
  category: string | undefined,
) {
  const config = TABLE_MAP[itemType];

  return useQuery({
    queryKey: ["similar_listings", itemType, currentId, category],
    queryFn: async (): Promise<SimilarListingItem[]> => {
      if (!currentId || !category) return [];

      const table = config.table as unknown as keyof Database["public"]["Tables"];
      const imageTable = config.imageTable as unknown as keyof Database["public"]["Tables"];

      let selectFields = "id,title";
      if (itemType === "product") selectFields += ",price";
      else if (itemType === "rental") selectFields += ",rent_price_per_day";
      else if (itemType === "food") selectFields += ",price,product_name";
      else selectFields += ",title,daily_rental_price,listing_type,is_free";

      const { data: listings, error } = await supabase
        .from(table)
        .select(selectFields)
        .eq("category", category)
        .eq("status", "available")
        .neq("id", currentId)
        .limit(4);
      if (error) throw error;
      if (!listings?.length) return [];

      const ids = listings.map((l: { id: string }) => l.id);
      const { data: images } = await supabase
        .from(imageTable)
        .select(`${config.idField},storage_path,sort_index`)
        .in(config.idField, ids)
        .order("sort_index", { ascending: true });

      const imageMap = new Map<string, string>();
      for (const img of images ?? []) {
        const row = img as Record<string, string | number>;
        const listingId = row[config.idField] as string;
        if (!imageMap.has(listingId)) {
          imageMap.set(
            listingId,
            getStoragePublicUrl(config.bucket as StorageBucket, row.storage_path as string),
          );
        }
      }

      return listings.map((raw: Record<string, unknown>) => {
        const l = raw;
        let title = String(l.title ?? l.product_name ?? "Listing");
        let priceLabel = "";
        if (itemType === "product") priceLabel = formatInr(Number(l.price));
        else if (itemType === "rental")
          priceLabel = `${formatInr(Number(l.rent_price_per_day))} / day`;
        else if (itemType === "food") priceLabel = formatInr(Number(l.price));
        else if (l.is_free) priceLabel = "Free";
        else if (l.listing_type === "rent" && l.daily_rental_price != null)
          priceLabel = `${formatInr(Number(l.daily_rental_price))} / day`;
        else priceLabel = "See details";

        return {
          id: l.id as string,
          title,
          priceLabel,
          coverUrl: imageMap.get(l.id as string) ?? null,
          route: `${config.routePrefix}/${l.id}`,
        };
      });
    },
    enabled: Boolean(currentId && category),
  });
}
