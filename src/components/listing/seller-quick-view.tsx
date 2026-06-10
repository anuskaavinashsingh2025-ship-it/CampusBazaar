import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type SellerQuickViewData = {
  user_id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg?: number;
  rating_count?: number;
  bio?: string | null;
};

export function SellerQuickView({ seller }: { seller: SellerQuickViewData }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm font-semibold text-muted-foreground">Seller</div>
      <div className="mt-3 flex items-center gap-3">
        <Avatar className="h-12 w-12">
          {seller.avatar_url ? (
            <AvatarImage src={`${seller.avatar_url}?t=${Date.now()}`} alt={seller.display_name} />
          ) : null}
          <AvatarFallback>{seller.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <Link
            to="/seller/$slug"
            params={{ slug: seller.slug }}
            className="font-semibold hover:underline"
          >
            {seller.display_name}
          </Link>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {Number(seller.rating_avg ?? 0).toFixed(1)} ({seller.rating_count ?? 0} reviews)
          </div>
        </div>
      </div>
      {seller.bio && <p className="mt-3 text-sm text-muted-foreground">{seller.bio}</p>}
    </div>
  );
}
