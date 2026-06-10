import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { useSimilarListings } from "@/lib/similar-listings";
import type { WishlistItemType } from "@/lib/wishlist";
import { Card, CardContent } from "@/components/ui/card";

type SimilarListingsProps = {
  itemType: WishlistItemType;
  currentId: string;
  category: string;
};

export function SimilarListings({ itemType, currentId, category }: SimilarListingsProps) {
  const { data: items = [], isLoading } = useSimilarListings(itemType, currentId, category);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <section className="mt-10 space-y-4">
      <h2 className="text-lg font-semibold">You may also like</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <Link key={item.id} to={item.route}>
            <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-md">
              <CardContent className="p-0">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-28 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-muted text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                <div className="space-y-1 p-2">
                  <div className="line-clamp-2 text-xs font-medium">{item.title}</div>
                  <div className="text-xs font-semibold text-primary">{item.priceLabel}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
