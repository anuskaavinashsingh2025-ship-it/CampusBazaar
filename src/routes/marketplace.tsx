import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ProductCard, type ProductCardModel } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [{ title: "Marketplace — CampusBazar" }],
  }),
  component: MarketplacePage,
});

type ProductListingRow = {
  id: string;
  title: string;
  price: number | string;
  category: string;
  custom_category: string | null;
  condition: string;
  urgent_sale: boolean;
  seller_id: string;
  created_at: string;
};

type ProductImageRow = {
  product_id: string;
  storage_path: string;
  sort_index: number;
};

const PRODUCT_LISTINGS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

function MarketplacePage() {
  const search = Route.useSearch() as unknown as Record<string, string | undefined> | undefined;
  const selectedCategory = (search?.category as string | undefined) ?? null;

  // Locally-hide listings that were just deleted, so the row disappears
  // immediately without waiting for the 5s refetch.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(16);
  const handleLocalDelete = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplace_page", selectedCategory ?? "all"],
    queryFn: async () => {
      // Defensive: ensure the supabase client is available before calling .from()
      const supabaseHasFrom =
        typeof (supabase as unknown as { from?: unknown }).from === "function";
      if (!supabaseHasFrom) {
        console.warn(
          "[Marketplace] Supabase client not ready; returning empty results.",
          selectedCategory,
        );
        return { productRows: [], sellers: [], imageRows: [] };
      }

      // Validate category: only allow product-like categories to filter the product_listings table.
      const marketplaceCategories = new Set<string>([
        "Electronics",
        "Books",
        "Furniture",
        "Clothes",
        "Other",
      ]);
      if (selectedCategory && !marketplaceCategories.has(selectedCategory)) {
        // Not a product marketplace category (e.g. Food, Rent, Notes). Return empty instead of throwing.
        console.warn(
          "[Marketplace] Selected category is not a marketplace product category:",
          selectedCategory,
        );
        return { productRows: [], sellers: [], imageRows: [] };
      }

      console.log("supabase =", supabase);
      console.log("client type =", typeof supabase);
      console.log("selectedCategory =", selectedCategory);

      const builder = supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .select(
          "id,title,price,category,custom_category,condition,urgent_sale,seller_id,created_at",
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(200);

      const { data: rows, error } = await builder;
      if (error) throw error;
      const productRows = (rows ?? []) as unknown as ProductListingRow[];
      if (!productRows.length) return { productRows: [], sellers: [], imageRows: [] };

      const sellerIds = [...new Set(productRows.map((p) => p.seller_id))];
      const { data: sellers } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url")
        .in("user_id", sellerIds);

      const productIds = productRows.map((p) => p.id);
      const { data: images } = await supabase
        .from(PRODUCT_IMAGES_TABLE)
        .select("product_id,storage_path,sort_index")
        .in("product_id", productIds);

      return {
        productRows,
        sellers: sellers ?? [],
        imageRows: (images ?? []) as unknown as ProductImageRow[],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data: { productRows: ProductListingRow[]; sellers: any[]; imageRows: ProductImageRow[] }) => {
      const sellerMap = new Map<string, { user_id: string; slug: string; display_name: string; avatar_url: string | null }>(
        data.sellers.map((s: any) => [s.user_id, s]),
      );

      const imageMap = new Map<string, { storage_path: string; sort_index: number }[]>();
      for (const img of data.imageRows) {
        const key = img.product_id;
        const arr = imageMap.get(key) ?? [];
        arr.push({ storage_path: img.storage_path, sort_index: img.sort_index });
        imageMap.set(key, arr);
      }

      let rowsToReturn = data.productRows;
      if (selectedCategory) {
        rowsToReturn = data.productRows.filter((p) => {
          const category =
            p.category === "Others" && p.custom_category ? p.custom_category : p.category;
          return category === selectedCategory;
        });
      }

      return rowsToReturn.map((p) => {
        const sorted = (imageMap.get(p.id) ?? []).sort((a, b) => a.sort_index - b.sort_index);
        const cover = sorted[0]?.storage_path ?? null;
        const coverImageUrl = cover
          ? cover
          : null;

        return {
          id: p.id,
          title: p.title,
          price: Number(p.price),
          category: p.category,
          custom_category: p.custom_category,
          condition: p.condition,
          urgent_sale: p.urgent_sale,
          seller: sellerMap.get(p.seller_id) ?? {
            user_id: p.seller_id,
            slug: "unknown",
            display_name: "Unknown seller",
            avatar_url: null,
          },
          coverImageUrl,
        } satisfies ProductCardModel;
      });
    },
  });

  const visibleProducts = useMemo(
    () => products.filter((p) => !hiddenIds.has(p.id)),
    [products, hiddenIds],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : visibleProducts.length ? (
            visibleProducts.slice(0, visibleCount).map((p) => (
              <ProductCard key={p.id} product={p} onDeleted={handleLocalDelete} />
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              {selectedCategory
                ? "No listings available in this category yet"
                : "No listings found."}
            </div>
          )}
        </div>
        {visibleCount < visibleProducts.length && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => setVisibleCount((c) => c + 16)}>
              Load More
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
