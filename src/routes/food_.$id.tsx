import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useTrackListingView } from "@/lib/listing-views";
import {
  isChatUnlockedForFoodOrder,
  useCreateFoodOrder,
  useFoodOrderForListing,
} from "@/lib/food-orders";
import { getStoragePublicUrl } from "@/lib/storage-url";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";
import { ChatSellerButton } from "@/components/listing/chat-seller-button";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { ListingStats } from "@/components/listing/listing-stats";
import { RecentlyViewedSection } from "@/components/listing/recently-viewed-section";
import { ReportListingDialog } from "@/components/listing/report-listing-dialog";
import { SellerQuickView } from "@/components/listing/seller-quick-view";
import { ShareListingButton } from "@/components/listing/share-listing-button";
import { SimilarListings } from "@/components/listing/similar-listings";
import ListingActions from "@/components/listing/listing-actions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/food_/$id")({
  head: () => ({
    meta: [{ title: "Food listing — CampusBazar" }],
  }),
  component: FoodDetailsPage,
});

type FoodListingRow = {
  id: string;
  product_name: string;
  brand_name: string;
  category: string;
  quantity: string;
  price: number | string;
  description: string;
  expiry_date: string;
  status: "available" | "hidden" | "expired" | "sold";
  seller_id: string;
  created_at: string;
  views_count?: number;
  wishlist_count?: number;
};

type FoodImageRow = { storage_path: string; sort_index: number };

const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];
const FOOD_IMAGES_TABLE = "food_images" as unknown as keyof Database["public"]["Tables"];

function FoodDetailsPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const createOrder = useCreateFoodOrder();
  const { data: existingOrder } = useFoodOrderForListing(id, user?.id);

  const [orderOpen, setOrderOpen] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [orderMessage, setOrderMessage] = useState("");

  const { data: listing, isLoading } = useQuery({
    queryKey: ["food", id],
    queryFn: async () => {
      console.log("[FoodDetail] Fetching food listing with ID:", id);
      const { data, error } = await supabase
        .from(FOOD_LISTINGS_TABLE)
        .select(
          "id,product_name,brand_name,category,quantity,price,description,expiry_date,status,seller_id,created_at,views_count,wishlist_count",
        )
        .eq("id", id)
        .maybeSingle();
      console.log("[FoodDetail] Query result:", { data, error });
      if (error) throw error;
      return (data ?? null) as unknown as FoodListingRow | null;
    },
  });

  const { data: images } = useQuery({
    queryKey: ["food_images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(FOOD_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("food_listing_id", id)
        .order("sort_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FoodImageRow[];
    },
    enabled: Boolean(listing?.id),
  });

  const { data: seller } = useQuery({
    queryKey: ["food_seller", listing?.seller_id ?? null],
    queryFn: async () => {
      if (!listing?.seller_id) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url,bio,rating_avg,rating_count")
        .eq("user_id", listing.seller_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(listing?.seller_id),
  });

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const imageModels = useMemo(
    () =>
      (images ?? []).map((img) => ({
        url: getStoragePublicUrl("food-images", img.storage_path),
        sort_index: img.sort_index,
      })),
    [images],
  );

  const priceLabel = listing ? formatInr(Number(listing.price)) : "";

  useTrackListingView(
    "food",
    listing?.id,
    listing
      ? {
          title: listing.product_name,
          coverUrl: imageModels[0]?.url ?? null,
          priceLabel,
          route: `/food/${listing.id}`,
        }
      : null,
  );

  const chatUnlocked = isChatUnlockedForFoodOrder(existingOrder?.status);

  const openOrderDialog = () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (listing && user.id === listing.seller_id) {
      toast.error("You can't order your own listing.");
      return;
    }
    if (listing?.status !== "available") {
      toast.error("This item is not available.");
      return;
    }
    setOrderOpen(true);
  };

  const submitOrder = () => {
    if (!user || !listing) return;
    const qty = Number(orderQuantity);
    if (!qty || qty < 1) {
      toast.error("Enter a valid quantity.");
      return;
    }
    createOrder.mutate(
      {
        foodListingId: listing.id,
        buyerId: user.id,
        sellerId: listing.seller_id,
        productName: listing.product_name,
        quantity: qty,
        message: orderMessage,
      },
      { onSuccess: () => setOrderOpen(false) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-muted-foreground">
          Food listing not found.
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/food" })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link
            to="/"
            aria-label="CampusBazar home"
            className="flex items-center justify-center"
          >
            <CampusBazarLogo compact showText={false} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ListingGallery
            images={imageModels}
            alt={listing.product_name}
            overlay={<WishlistButton listingId={listing.id} className="right-4 top-4" />}
          />

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{listing.product_name}</h1>
              <p className="text-sm text-muted-foreground">{listing.brand_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Posted {new Date(listing.created_at).toLocaleDateString()}
              </p>
              <p className="mt-1 text-xl font-bold text-primary">{priceLabel}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{listing.category}</Badge>
              <Badge variant="outline">{listing.quantity}</Badge>
              <Badge variant="outline">
                Expires {new Date(listing.expiry_date).toLocaleDateString()}
              </Badge>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{listing.description}</p>
            </div>

            {seller && <SellerQuickView seller={seller} />}

            <div className="flex flex-wrap gap-2">
              <ShareListingButton title={listing.product_name} />
              <ReportListingDialog
                itemType="food"
                itemId={listing.id}
                sellerUserId={listing.seller_id}
                disabled={user?.id === listing.seller_id}
              />
              <ListingActions
                itemType="food"
                itemId={listing.id}
                ownerId={listing.seller_id}
                onDeleted={() => navigate({ to: "/food" })}
                onEdit={() => {
                  console.log("[ListingActions] onEdit food detail", listing.id);
                  window.location.assign(`/upload-food?edit=${listing.id}`);
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ChatSellerButton
                sellerId={listing.seller_id}
                chatUnlocked={chatUnlocked}
                contextType="food"
                contextId={listing.id}
                listingTitle={listing.product_name}
                requestId={existingOrder?.id}
                className="w-full gap-2"
              />
              <Button
                className="gap-2"
                onClick={openOrderDialog}
                disabled={listing.status !== "available" || existingOrder?.status === "pending"}
              >
                <ShoppingBag className="h-4 w-4" />
                {existingOrder?.status === "pending" ? "Order Pending" : "Order Food"}
              </Button>
            </div>
          </div>
        </div>

        <SimilarListings itemType="food" currentId={listing.id} category={listing.category} />
        <RecentlyViewedSection excludeItemType="food" excludeItemId={listing.id} />
      </main>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Food</DialogTitle>
            <DialogDescription>
              Place an order for {listing.product_name} from {seller?.display_name ?? "the seller"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderMsg">Message (optional)</Label>
              <Textarea
                id="orderMsg"
                value={orderMessage}
                onChange={(e) => setOrderMessage(e.target.value)}
                placeholder="Pickup time, dietary notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitOrder} disabled={createOrder.isPending}>
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
