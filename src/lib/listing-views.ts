import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { recordRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed";
import type { WishlistItemType } from "@/lib/wishlist";

export function useTrackListingView(
  itemType: WishlistItemType,
  itemId: string | undefined,
  recentItem?: Omit<RecentlyViewedItem, "viewedAt" | "itemType" | "itemId"> | null,
) {
  const queryClient = useQueryClient();
  const tracked = useRef<string | null>(null);
  const recentRef = useRef(recentItem);
  recentRef.current = recentItem;

  useEffect(() => {
    if (!itemId) return;
    const key = `${itemType}:${itemId}`;
    if (tracked.current === key) return;
    tracked.current = key;

    void supabase.rpc(
      "increment_listing_view" as never,
      {
        p_item_type: itemType,
        p_item_id: itemId,
      } as never,
    );

    const recent = recentRef.current;
    if (recent) {
      recordRecentlyViewed({ itemType, itemId, ...recent });
    }

    const queryKeys: Record<WishlistItemType, string[]> = {
      product: ["product", itemId],
      rental: ["rental", itemId],
      food: ["food", itemId],
      notes: ["notes_listing", itemId],
    };
    void queryClient.invalidateQueries({ queryKey: queryKeys[itemType] });
  }, [itemType, itemId, queryClient]);
}
