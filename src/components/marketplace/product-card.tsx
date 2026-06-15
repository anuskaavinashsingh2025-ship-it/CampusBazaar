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

export type ProductCardModel = {
  id: string;
  title: string;
  price: number;
  category: string;
  custom_category: string | null;
  condition: string;
  urgent_sale: boolean;
  seller: SellerRef;
  coverImageUrl: string | null;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

export function ProductCard({
  product,
  onDeleted,
  linkTo,
}: {
  product: ProductCardModel;
  onDeleted?: (id: string) => void;
  linkTo?: string;
}) {
  const navigate = useNavigate();
  const ownerId =
    product.seller?.user_id ?? (product as unknown as { seller_id?: string }).seller_id ?? null;
  const categoryLabel =
    product.category === "Others" && product.custom_category
      ? product.custom_category
      : product.category;

  console.log("[ProductCard]", {
    listingId: product?.id,
    title: product?.title,
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
              itemType="product"
              itemId={product.id}
              ownerId={ownerId}
              onEdit={() => {
                console.log("[ListingActions] onEdit product", product.id);
                navigate({ to: "/upload-product", search: { edit: product.id } as never });
              }}
              onDeleted={() => onDeleted?.(product.id)}
            />
          </div>
          <Link to={(linkTo ?? `/product/${product.id}`) as any} className="block">
            {product.coverImageUrl ? (
              <img
                src={product.coverImageUrl}
                alt={product.title}
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                No image
              </div>
            )}
          </Link>

          <WishlistButton listingId={product.id} />

          {product.urgent_sale && (
            <div className="absolute left-3 top-3">
              <Badge variant="destructive">Urgent sale</Badge>
            </div>
          )}
        </div>

        <div className="space-y-2 p-3">
          <div className="text-sm font-semibold text-foreground">{formatInr(product.price)}</div>
          <Link
            to={(linkTo ?? `/product/${product.id}`) as any}
            className="line-clamp-2 block text-sm font-medium leading-snug text-foreground hover:underline"
          >
            {product.title}
          </Link>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1">{categoryLabel}</span>
            <span className="rounded-md bg-muted px-2 py-1">{product.condition}</span>
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Avatar className="h-7 w-7">
              {product.seller.avatar_url ? (
                <AvatarImage
                  src={`${product.seller.avatar_url}?t=${Date.now()}`}
                  alt={product.seller.display_name}
                />
              ) : (
                <AvatarFallback>
                  {product.seller.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 text-sm">
              <div className="truncate text-foreground">
                <Link
                  to="/seller/$slug"
                  params={{ slug: product.seller.slug }}
                  className="hover:underline"
                >
                  {product.seller.display_name}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
