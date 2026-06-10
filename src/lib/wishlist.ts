import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WishlistItemType = "product" | "rental" | "food" | "notes" | "seller";

const WISHLIST_TABLE = "wishlist_items" as unknown as keyof Database["public"]["Tables"];

export type WishlistRow = {
  id: string;
  user_id: string;
  listing_id: string;
  /** @deprecated Use listing_id instead */
  item_type: string | null;
  /** @deprecated Use listing_id instead */
  item_id: string | null;
  created_at: string;
};

export const wishlistQueryKey = (userId: string | null) => ["wishlist", userId] as const;

export async function fetchWishlist(userId: string): Promise<WishlistRow[]> {
  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .select("id,user_id,listing_id,item_type,item_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WishlistRow[];
}

export function wishlistKey(userId: string, listingId: string) {
  return `${listingId}`;
}

export function buildWishlistSet(rows: WishlistRow[]) {
  return new Set(rows.map((r) => wishlistKey(r.user_id, r.listing_id)));
}

export function useWishlist(userId: string | null | undefined) {
  return useQuery({
    queryKey: wishlistQueryKey(userId ?? null),
    queryFn: () => fetchWishlist(userId!),
    enabled: Boolean(userId),
  });
}

export function useWishlistToggle(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listingId,
      isWishlisted,
    }: {
      listingId: string;
      isWishlisted: boolean;
    }) => {
      if (!userId) throw new Error("Login required");

      if (isWishlisted) {
        console.log("[Wishlist] Removing", { user_id: userId, listing_id: listingId });
        const { data, error } = await supabase
          .from(WISHLIST_TABLE)
          .delete()
          .eq("user_id", userId)
          .eq("listing_id", listingId)
          .select("id");
        if (error) throw error;
        if (!data?.length) {
          throw new Error("Item was not in your wishlist");
        }
        return false;
      }

      console.log("[Wishlist] Adding", { user_id: userId, listing_id: listingId });
      const payload = {
        user_id: userId,
        listing_id: listingId,
      };
      console.log("[Wishlist] Payload:", payload);
      const { error } = await supabase.from(WISHLIST_TABLE).insert(payload);
      console.log("[Wishlist] Error:", error);
      if (error) {
        if (error.code === "23505") return true;
        throw error;
      }
      return true;
    },
    onMutate: async ({ listingId, isWishlisted }) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: wishlistQueryKey(userId) });
      const previous = queryClient.getQueryData<WishlistRow[]>(wishlistQueryKey(userId));

      queryClient.setQueryData<WishlistRow[]>(wishlistQueryKey(userId), (old = []) => {
        if (isWishlisted) {
          return old.filter((r) => r.listing_id !== listingId);
        }
        return [
          {
            id: `optimistic-${listingId}`,
            user_id: userId,
            listing_id: listingId,
            item_type: null,
            item_id: null,
            created_at: new Date().toISOString(),
          },
          ...old,
        ];
      });

      return { previous };
    },
    onSuccess: (added) => {
      if (added) toast.success("Added to wishlist");
      else toast.success("Removed from wishlist");
    },
    onError: (err, vars, context) => {
      if (userId && context?.previous) {
        queryClient.setQueryData(wishlistQueryKey(userId), context.previous);
      }
      const msg = err instanceof Error ? err.message : "Could not update wishlist";
      if (vars.isWishlisted && msg.includes("not in your wishlist")) {
        void queryClient.invalidateQueries({ queryKey: wishlistQueryKey(userId!) });
        return;
      }
      toast.error(msg);
    },
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: wishlistQueryKey(userId) });
      }
    },
  });
}

export function useIsWishlisted(userId: string | null | undefined, listingId: string) {
  const { data: rows = [] } = useWishlist(userId);
  return rows.some((r) => r.listing_id === listingId);
}
