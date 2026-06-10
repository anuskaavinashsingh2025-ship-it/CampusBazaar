import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { getRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed";
import { Card, CardContent } from "@/components/ui/card";

type RecentlyViewedSectionProps = {
  excludeItemType?: string;
  excludeItemId?: string;
};

export function RecentlyViewedSection({
  excludeItemType,
  excludeItemId,
}: RecentlyViewedSectionProps) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    const all = getRecentlyViewed().filter(
      (r) => !(r.itemType === excludeItemType && r.itemId === excludeItemId),
    );
    setItems(all.slice(0, 8));
  }, [excludeItemType, excludeItemId]);

  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Recently Viewed</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <Link key={`${item.itemType}-${item.itemId}`} to={item.route} className="shrink-0">
            <Card className="w-36 overflow-hidden border-border/60">
              <CardContent className="p-0">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-24 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-muted text-[10px] text-muted-foreground">
                    No image
                  </div>
                )}
                <div className="space-y-0.5 p-2">
                  <div className="line-clamp-2 text-[11px] font-medium">{item.title}</div>
                  <div className="text-[10px] font-semibold text-primary">{item.priceLabel}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
