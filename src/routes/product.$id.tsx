import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShoppingCart, Tag } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { ChatSellerButton } from "@/components/listing/chat-seller-button";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { ListingStats } from "@/components/listing/listing-stats";
import { RecentlyViewedSection } from "@/components/listing/recently-viewed-section";
import { ReportListingDialog } from "@/components/listing/report-listing-dialog";
import { SellerQuickView } from "@/components/listing/seller-quick-view";
import ListingActions from "@/components/listing/listing-actions";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";
import { ShareListingButton } from "@/components/listing/share-listing-button";
import { SimilarListings } from "@/components/listing/similar-listings";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useTrackListingView } from "@/lib/listing-views";
import {
  isChatUnlockedForProductRequest,
  useCreateProductRequest,
  useProductRequestForListing,
} from "@/lib/product-requests";
import { getStoragePublicUrl } from "@/lib/storage-url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/product/$id")({
  head: ({ params }) => ({
    meta: [{ title: `${params.id} — CampusBazar` }],
  }),
  component: ProductDetailsPage,
});

type ProductListingRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  custom_category: string | null;
  price: number | string;
  condition: string;
  urgent_sale: boolean;
  is_negotiable: boolean;
  location: string | null;
  status: "available" | "sold" | "hidden";
  seller_id: string;
  created_at: string;
  views_count?: number;
  wishlist_count?: number;
};

type SellerRow = {
  user_id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  rating_avg: number;
  rating_count: number;
};

type ProductImageRow = { storage_path: string; sort_index: number };

const PRODUCT_LISTINGS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

function ProductDetailsPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const createRequest = useCreateProductRequest();
  const { data: existingRequest } = useProductRequestForListing(id, user?.id);

  const [offerOpen, setOfferOpen] = useState(false);
  const [offeredPrice, setOfferedPrice] = useState("");
  const [offerMessage, setOfferMessage] = useState("");

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      console.log("[ProductDetail] Fetching product with ID:", id);
      const { data, error } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .select(
          "id,title,description,category,custom_category,price,condition,urgent_sale,is_negotiable,location,status,seller_id,created_at,views_count,wishlist_count",
        )
        .eq("id", id)
        .eq("status", "available")
        .maybeSingle();
      console.log("[ProductDetail] Query result:", { data, error });
      if (error) throw error;
      return (data ?? null) as unknown as ProductListingRow | null;
    },
  });

  const { data: seller } = useQuery({
    queryKey: ["seller_for_product", product?.seller_id ?? null],
    queryFn: async () => {
      if (!product?.seller_id) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url,bio,rating_avg,rating_count")
        .eq("user_id", product.seller_id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SellerRow | null;
    },
    enabled: Boolean(product?.seller_id),
  });

  const { data: images } = useQuery({
    queryKey: ["product_images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PRODUCT_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("product_id", id)
        .order("sort_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProductImageRow[];
    },
    enabled: Boolean(product?.id),
  });

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const coverImageModels = useMemo(
    () =>
      (images ?? []).map((img) => ({
        url: getStoragePublicUrl("product-images", img.storage_path),
        sort_index: img.sort_index,
      })),
    [images],
  );

  const priceLabel = product ? formatInr(Number(product.price)) : "";

  useTrackListingView(
    "product",
    product?.id,
    product
      ? {
          title: product.title,
          coverUrl: coverImageModels[0]?.url ?? null,
          priceLabel,
          route: `/product/${product.id}`,
        }
      : null,
  );

  const categoryLabel =
    product?.category === "Others" && product?.custom_category
      ? product.custom_category
      : product?.category;

  const chatUnlocked = isChatUnlockedForProductRequest(existingRequest?.status);

  const requireAuth = () => {
    if (!user) {
      navigate({ to: "/login" });
      return false;
    }
    if (product && user.id === product.seller_id) {
      toast.error("You can't buy your own listing.");
      return false;
    }
    return true;
  };

  const handleBuyNow = () => {
    if (!requireAuth() || !product || !user) return;
    createRequest.mutate({
      productId: product.id,
      buyerId: user.id,
      sellerId: product.seller_id,
      productTitle: product.title,
      requestType: "buy",
      buyerName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Buyer",
      buyerHostel: user.user_metadata?.hostel_block || null,
    });
  };

  const handleSubmitOffer = () => {
    if (!requireAuth() || !product || !user) return;
    const price = Number(offeredPrice);
    if (!price || price <= 0) {
      toast.error("Enter a valid offer price.");
      return;
    }
    createRequest.mutate(
      {
        productId: product.id,
        buyerId: user.id,
        sellerId: product.seller_id,
        productTitle: product.title,
        requestType: "offer",
        offeredPrice: price,
        message: offerMessage,
        buyerName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Buyer",
        buyerHostel: user.user_metadata?.hostel_block || null,
      },
      { onSuccess: () => setOfferOpen(false) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link
              to="/"
              aria-label="CampusBazar home"
              className="flex items-center gap-2"
            >
              <CampusBazarLogo compact showText />
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Marketplace
              </Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10 text-center">
          <h1 className="text-2xl font-bold">Listing not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This listing may be unavailable.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            aria-label="CampusBazar home"
            className="flex items-center justify-center"
          >
            <CampusBazarLogo compact showText={false} />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Marketplace
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ListingGallery
            images={coverImageModels}
            alt={product.title}
            overlay={<WishlistButton listingId={product.id} className="right-4 top-4" />}
          />

          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold">{product.title}</h1>
                {product.urgent_sale && <Badge variant="destructive">Urgent sale</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Posted {new Date(product.created_at).toLocaleDateString()}
              </p>
              <div className="mt-2 text-2xl font-bold text-primary">{priceLabel}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Tag className="mr-1 h-3.5 w-3.5" />
                {categoryLabel}
              </Badge>
              <Badge variant="outline">{product.condition}</Badge>
              {product.is_negotiable && <Badge variant="outline">Negotiable</Badge>}
              {product.location && <Badge variant="outline">{product.location}</Badge>}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {product.description}
              </p>
            </div>

            {seller && <SellerQuickView seller={seller} />}

            <div className="flex flex-wrap gap-2">
              <ShareListingButton title={product.title} />
              <ReportListingDialog
                itemType="product"
                itemId={product.id}
                sellerUserId={product.seller_id}
                disabled={user?.id === product.seller_id}
              />
              <ListingActions
                itemType="product"
                itemId={product.id}
                ownerId={product.seller_id}
                onDeleted={() => navigate({ to: "/" })}
                onEdit={() => {
                  console.log("[ListingActions] onEdit product detail", product.id);
                  window.location.assign(`/upload-product?edit=${product.id}`);
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ChatSellerButton
                sellerId={product.seller_id}
                chatUnlocked={chatUnlocked}
                contextType="product"
                contextId={product.id}
                listingTitle={product.title}
                requestId={existingRequest?.id}
                className="w-full gap-2"
              />
              {product.is_negotiable && (
                <Button variant="outline" onClick={() => requireAuth() && setOfferOpen(true)}>
                  Make Offer
                </Button>
              )}
              <Button
                className="gap-2 sm:col-span-2"
                onClick={handleBuyNow}
                disabled={createRequest.isPending || existingRequest?.status === "pending"}
              >
                {createRequest.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                {existingRequest?.status === "pending"
                  ? "Request Pending"
                  : existingRequest?.status === "accepted"
                    ? "Request Accepted"
                    : "Buy Now"}
              </Button>
            </div>
          </div>
        </div>

        <SimilarListings itemType="product" currentId={product.id} category={product.category} />
        <RecentlyViewedSection excludeItemType="product" excludeItemId={product.id} />
      </main>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              Suggest a price for "{product.title}". Listed at {priceLabel}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="offerPrice">Your offer (₹)</Label>
              <Input
                id="offerPrice"
                type="number"
                min={1}
                value={offeredPrice}
                onChange={(e) => setOfferedPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offerMessage">Message (optional)</Label>
              <Textarea
                id="offerMessage"
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitOffer} disabled={createRequest.isPending}>
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
