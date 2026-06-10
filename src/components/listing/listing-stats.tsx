import { Eye, Heart } from "lucide-react";

type ListingStatsProps = {
  viewsCount?: number;
  wishlistCount?: number;
};

export function ListingStats({ viewsCount = 0, wishlistCount = 0 }: ListingStatsProps) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3.5 w-3.5" />
        {viewsCount} view{viewsCount === 1 ? "" : "s"}
      </span>
      <span className="inline-flex items-center gap-1">
        <Heart className="h-3.5 w-3.5" />
        {wishlistCount} saved
      </span>
    </div>
  );
}
