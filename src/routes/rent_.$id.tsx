import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarRange, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { getStoragePublicUrl } from "@/lib/storage-url";
import {
  isChatUnlockedForRentalRequest,
  useCreateRentalRequest,
  useRentalRequestForListing,
} from "@/lib/rental-requests";
import { HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { useTrackListingView } from "@/lib/listing-views";
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

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/rent_/$id")({
  head: () => ({
    meta: [{ title: "Rent item — CampusBazar" }],
  }),
  component: RentDetailsPage,
});

type RentalRow = {
  id: string;
  title: string;
  description: string;
  rent_price_per_day: number | string;
  category: string;
  custom_category: string | null;
  condition: string;
  status: "available" | "rented_out" | "unavailable";
  seller_id: string;
  created_at: string;
  views_count?: number;
  wishlist_count?: number;
};

type RentalImageRow = { storage_path: string; sort_index: number };

const RENTAL_LISTINGS_TABLE = "rental_listings" as unknown as keyof Database["public"]["Tables"];
const RENTAL_IMAGES_TABLE = "rental_images" as unknown as keyof Database["public"]["Tables"];

const DURATION_PRESETS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "1 month" },
  { value: "custom", label: "Custom" },
] as const;

function formatLocationFromBlock(block: string) {
  return block === "Other" ? "" : `${block}, VIT Campus`;
}

function RentDetailsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { id } = Route.useParams();
  const createRequest = useCreateRentalRequest();
  const { data: existingRequest } = useRentalRequestForListing(id, user?.id);

  const [requestOpen, setRequestOpen] = useState(false);
  const [durationPreset, setDurationPreset] = useState("7");
  const [customDurationDays, setCustomDurationDays] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupBlock, setPickupBlock] = useState(profile?.hostel_block ?? "Other");
  const [pickupLocation, setPickupLocation] = useState(
    profile?.hostel_block ? formatLocationFromBlock(profile.hostel_block) : "VIT Campus",
  );
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    if (!profile?.hostel_block) return;
    setPickupBlock(profile.hostel_block);
    setPickupLocation(formatLocationFromBlock(profile.hostel_block) || "VIT Campus");
  }, [profile?.hostel_block]);

  const minPickupDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const resolvedDurationDays =
    durationPreset === "custom" ? Number(customDurationDays) : Number(durationPreset);

  const { data: rental, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: async () => {
      console.log("[RentalDetail] Fetching rental with ID:", id);
      const { data, error } = await supabase
        .from(RENTAL_LISTINGS_TABLE)
        .select(
          "id,title,description,rent_price_per_day,category,custom_category,condition,status,seller_id,created_at,views_count,wishlist_count",
        )
        .eq("id", id)
        .maybeSingle();
      console.log("[RentalDetail] Query result:", { data, error });
      if (error) throw error;
      return (data ?? null) as unknown as RentalRow | null;
    },
  });

  const { data: images } = useQuery({
    queryKey: ["rental_images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(RENTAL_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("rental_id", id)
        .order("sort_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RentalImageRow[];
    },
    enabled: Boolean(rental?.id),
  });

  const { data: seller } = useQuery({
    queryKey: ["rental_seller", rental?.seller_id ?? null],
    queryFn: async () => {
      if (!rental?.seller_id) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url,bio,rating_avg,rating_count")
        .eq("user_id", rental.seller_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(rental?.seller_id),
  });

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const imageModels = useMemo(
    () =>
      (images ?? []).map((img) => ({
        url: getStoragePublicUrl("rental-images", img.storage_path),
        sort_index: img.sort_index,
      })),
    [images],
  );

  const priceLabel = rental ? `${formatInr(Number(rental.rent_price_per_day))} / day` : "";

  useTrackListingView(
    "rental",
    rental?.id,
    rental
      ? {
          title: rental.title,
          coverUrl: imageModels[0]?.url ?? null,
          priceLabel,
          route: `/rent/${rental.id}`,
        }
      : null,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/90 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              onClick={() => navigate({ to: "/rent" })}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-muted-foreground">
          Rental listing not found.
        </main>
      </div>
    );
  }

  const statusLabel =
    rental.status === "available"
      ? "Available"
      : rental.status === "rented_out"
        ? "Rented out"
        : "Unavailable";

  const statusClass =
    rental.status === "available"
      ? "bg-emerald-500 text-white"
      : rental.status === "rented_out"
        ? "bg-orange-500 text-white"
        : "bg-slate-400 text-white";

  const categoryLabel =
    rental.category === "Others" && rental.custom_category
      ? rental.custom_category
      : rental.category;

  const chatUnlocked = isChatUnlockedForRentalRequest(existingRequest?.status);

  const openRequestDialog = () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (rental.seller_id === user.id) {
      toast.error("You can't request your own rental.");
      return;
    }
    if (rental.status !== "available") {
      toast.error("This item is not available for request.");
      return;
    }
    setRequestOpen(true);
  };

  const estimatedTotal =
    rental && resolvedDurationDays > 0
      ? formatInr(Number(rental.rent_price_per_day) * resolvedDurationDays)
      : null;

  const requestButtonLabel =
    existingRequest?.status === "pending"
      ? "Request Pending"
      : existingRequest?.status === "accepted"
        ? "Request Accepted"
        : "Request Rental";

  const submitRequest = () => {
    if (!user) return;
    const days = resolvedDurationDays;
    if (!days || days < 1) {
      toast.error("Select a valid rental duration.");
      return;
    }
    if (!pickupDate) {
      toast.error("Select a pickup date.");
      return;
    }
    if (!pickupLocation.trim()) {
      toast.error("Enter a pickup location.");
      return;
    }

    createRequest.mutate(
      {
        rentalId: rental.id,
        buyerId: user.id,
        sellerId: rental.seller_id,
        rentalTitle: rental.title,
        form: {
          rentalDurationDays: days,
          pickupDate,
          pickupLocation: pickupLocation.trim(),
          message: requestMessage,
        },
        buyerName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Buyer",
        buyerHostel: user.user_metadata?.hostel_block || null,
      },
      { onSuccess: () => setRequestOpen(false) },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/rent" })}
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
            alt={rental.title}
            overlay={
              <>
                <WishlistButton listingId={rental.id} className="right-4 top-4" />
                <span
                  className={`absolute bottom-4 left-4 rounded-md px-2 py-1 text-xs font-semibold ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </>
            }
          />

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{rental.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Posted {new Date(rental.created_at).toLocaleDateString()}
              </p>
              <p className="mt-1 text-xl font-bold text-primary">{priceLabel}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{categoryLabel}</Badge>
              <Badge variant="outline">{rental.condition}</Badge>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold text-muted-foreground">Description</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{rental.description}</p>
            </div>

            {seller && <SellerQuickView seller={seller} />}

            <div className="flex flex-wrap gap-2">
              <ShareListingButton title={rental.title} />
              <ReportListingDialog
                itemType="rental"
                itemId={rental.id}
                sellerUserId={rental.seller_id}
                disabled={user?.id === rental.seller_id}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ChatSellerButton
                sellerId={rental.seller_id}
                chatUnlocked={chatUnlocked}
                contextType="rental"
                contextId={rental.id}
                listingTitle={rental.title}
                requestId={existingRequest?.id}
                className="w-full gap-2"
              />
              <Button
                className="gap-2"
                onClick={openRequestDialog}
                disabled={
                  rental.status !== "available" ||
                  existingRequest?.status === "pending" ||
                  existingRequest?.status === "accepted"
                }
              >
                <CalendarRange className="h-4 w-4" />
                {requestButtonLabel}
              </Button>
            </div>
          </div>
        </div>

        <SimilarListings itemType="rental" currentId={rental.id} category={rental.category} />
        <RecentlyViewedSection excludeItemType="rental" excludeItemId={rental.id} />
      </main>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Rental</DialogTitle>
            <DialogDescription>
              Send a rental request to {seller?.display_name ?? "the seller"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rental Duration</Label>
              <Select value={durationPreset} onValueChange={setDurationPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {durationPreset === "custom" && (
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  placeholder="Number of days"
                  value={customDurationDays}
                  onChange={(e) => setCustomDurationDays(e.target.value)}
                />
              )}
              {estimatedTotal && (
                <p className="text-sm text-muted-foreground">
                  Estimated total:{" "}
                  <span className="font-semibold text-primary">{estimatedTotal}</span> ({priceLabel}
                  )
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupDate">Pickup Date</Label>
              <Input
                id="pickupDate"
                type="date"
                min={minPickupDate}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pickup Location</Label>
              <Select
                value={pickupBlock}
                onValueChange={(value) => {
                  setPickupBlock(value);
                  const formatted = formatLocationFromBlock(value);
                  if (formatted) setPickupLocation(formatted);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pickup area" />
                </SelectTrigger>
                <SelectContent>
                  {HOSTEL_BLOCKS.map((block) => (
                    <SelectItem key={block} value={block}>
                      {block}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="pickupLocation"
                  className="pl-9"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="VIT Campus, near SJT..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Any notes for the seller..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={createRequest.isPending}>
              {createRequest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
