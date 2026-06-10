import { Link, useNavigate } from "@tanstack/react-router";
import ListingActions from "@/components/listing/listing-actions";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SellerRef = {
  user_id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg?: number;
};

export type RentalCardModel = {
  id: string;
  title: string;
  rent_price_per_day: number;
  category: string;
  custom_category: string | null;
  condition: string;
  seller: SellerRef;
  coverImageUrl: string | null;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

export function RentalCard({
  rental,
  onDeleted,
}: {
  rental: RentalCardModel;
  onDeleted?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const ownerId =
    rental.seller?.user_id ?? (rental as unknown as { seller_id?: string }).seller_id ?? null;
  const categoryLabel =
    rental.category === "Others" && rental.custom_category
      ? rental.custom_category
      : rental.category;

  console.log("[RentalCard]", {
    listingId: rental?.id,
    title: rental?.title,
  });

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardContent className="p-0">
        <div className="relative">
          <div
            className="absolute right-2 top-2 z-20"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            {/* Robust ownerId resolution: some callers may not populate seller.user_id consistently */}
            <ListingActions
              itemType="rental"
              itemId={rental.id}
              ownerId={ownerId}
              onEdit={() => {
                console.log("[ListingActions] onEdit rental", rental.id);
                navigate({ to: "/upload-rental", search: { edit: rental.id } as never });
              }}
              onDeleted={() => onDeleted?.(rental.id)}
            />
          </div>
          <Link to="/rent/$id" params={{ id: rental.id }} className="block">
            {rental.coverImageUrl ? (
              <img
                src={rental.coverImageUrl}
                alt={rental.title}
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                No image
              </div>
            )}
          </Link>

          <WishlistButton listingId={rental.id} />
        </div>

        <div className="space-y-2 p-3">
          <div className="text-sm font-semibold text-foreground">
            {formatInr(rental.rent_price_per_day)}/day
          </div>
          <Link
            to="/rent/$id"
            params={{ id: rental.id }}
            className="line-clamp-2 block text-sm font-medium leading-snug text-foreground hover:underline"
          >
            {rental.title}
          </Link>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1">{categoryLabel}</span>
            <span className="rounded-md bg-muted px-2 py-1">{rental.condition}</span>
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Avatar className="h-7 w-7">
              {rental.seller.avatar_url ? (
                <AvatarImage
                  src={`${rental.seller.avatar_url}?t=${Date.now()}`}
                  alt={rental.seller.display_name}
                />
              ) : (
                <AvatarFallback>
                  {rental.seller.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 text-sm">
              <div className="truncate text-foreground">
                <Link
                  to="/seller/$slug"
                  params={{ slug: rental.seller.slug }}
                  className="hover:underline"
                >
                  {rental.seller.display_name}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
