import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useRespondToFoodRequest } from "@/lib/food-respond";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";
import ListingActions from "@/components/listing/listing-actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { HubNavStrip } from "@/components/hub-nav-strip";

export const Route = createFileRoute("/food")({
  head: () => ({
    meta: [{ title: "Food Hub — CampusBazar" }],
  }),
  component: FoodHubPage,
});

type FoodListingRow = {
  id: string;
  product_name: string;
  brand_name: string;
  category: string;
  quantity: string;
  price: number | string;
  expiry_date: string;
  status: "available" | "hidden" | "expired" | "sold";
  seller_id: string;
  created_at: string;
  coverUrl?: string | null;
  seller?: { display_name: string; avatar_url: string | null; slug: string };
};

type FoodRequestRow = {
  id: string;
  requester_id: string;
  product_name: string;
  category: string;
  quantity_needed: string;
  description: string;
  urgency_level: string;
  status: string;
  created_at: string;
};

const FOOD_CATEGORIES = [
  "Snacks",
  "Chocolates & Sweets",
  "Instant Food",
  "Beverages",
  "Health & Fitness",
  "Others",
] as const;

const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];
const FOOD_IMAGES_TABLE = "food_images" as unknown as keyof Database["public"]["Tables"];
const FOOD_REQUESTS_TABLE = "food_requests" as unknown as keyof Database["public"]["Tables"];

function FoodHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const respond = useRespondToFoodRequest();
  const [mode, setMode] = useState<"sell" | "requests">("sell");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  const { data: listings, isLoading: loadingListings } = useQuery({
    queryKey: ["food", "listings"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from(FOOD_LISTINGS_TABLE)
        .select(
          "id,product_name,brand_name,category,quantity,price,expiry_date,status,seller_id,created_at",
        )
        .eq("status", "available")
        .gte("expiry_date", today)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as FoodListingRow[];

      const ids = rows.map((r) => r.id);
      const sellerIds = [...new Set(rows.map((r) => r.seller_id))];

      const [{ data: images }, { data: sellers }] = await Promise.all([
        ids.length
          ? supabase
              .from(FOOD_IMAGES_TABLE)
              .select("food_listing_id,storage_path,sort_index")
              .in("food_listing_id", ids)
          : Promise.resolve({ data: [] }),
        sellerIds.length
          ? supabase
              .from("seller_profiles")
              .select("user_id,slug,display_name,avatar_url")
              .in("user_id", sellerIds)
          : Promise.resolve({ data: [] }),
      ]);

      const imageMap = new Map<string, string>();
      for (const img of images ?? []) {
        const row = img as { food_listing_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.food_listing_id)) {
          imageMap.set(
            row.food_listing_id,
            supabase.storage.from("food-images").getPublicUrl(row.storage_path).data.publicUrl,
          );
        }
      }

      type SellerRefLocal = { display_name: string; avatar_url: string | null; slug: string };
      const sellerMap = new Map<string, SellerRefLocal>(
        (sellers ?? []).map((s: SellerRefLocal & { user_id: string }) => [s.user_id, { display_name: s.display_name, avatar_url: s.avatar_url, slug: s.slug }]),
      );

      return rows.map((r) => ({
        ...r,
        coverUrl: imageMap.get(r.id) ?? null,
        seller: sellerMap.get(r.seller_id),
      }));
    },
    refetchInterval: 10000,
  });

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["food", "requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(FOOD_REQUESTS_TABLE)
        .select(
          "id,requester_id,product_name,category,quantity_needed,description,urgency_level,status,created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FoodRequestRow[];
    },
    refetchInterval: 10000,
  });

  const filteredListings = useMemo(() => {
    let items = listings ?? [];
    if (categoryFilter) items = items.filter((l) => l.category === categoryFilter);
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (l) =>
        l.product_name.toLowerCase().includes(q) ||
        l.brand_name.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q),
    );
  }, [listings, query, categoryFilter]);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests ?? [];
    return (requests ?? []).filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [requests, query]);

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const getExpiryBadge = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 60) return { label: `${diff} days left`, className: "bg-emerald-500 text-white" };
    if (diff >= 30) return { label: `${diff} days left`, className: "bg-yellow-500 text-white" };
    return { label: `${Math.max(diff, 0)} days left`, className: "bg-red-500 text-white" };
  };

  const urgencyColor = (level: string) => {
    const l = level.toLowerCase();
    if (l.includes("urgent")) return "bg-red-500 text-white";
    if (l.includes("high")) return "bg-orange-500 text-white";
    if (l.includes("medium")) return "bg-yellow-500 text-white";
    return "bg-emerald-500 text-white";
  };

  const timeAgo = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const openForm = (formMode: "sell" | "request") => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (formMode === "sell") navigate({ to: "/upload-food" });
    else navigate({ to: "/upload-food-request" });
  };

  const handleRespond = (r: FoodRequestRow) => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.id === r.requester_id) {
      toast.error("You cannot respond to your own food request.");
      return;
    }
    respond.mutate(
      {
        requestId: r.id,
        requestCreatorId: r.requester_id,
        productName: r.product_name,
        responderId: user.id,
      },
      {
        onSuccess: ({ conversationId }) => {
          if (conversationId) {
            navigate({
              to: "/chats/$id",
              params: { id: conversationId },
              search: { focus: "1" } as never,
            });
          }
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/50 to-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/" })}
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

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Wishlist"
              onClick={() => (user ? navigate({ to: "/wishlist" }) : navigate({ to: "/login" }))}
            >
              <Heart className="h-5 w-5" />
            </Button>
            <div className="flex rounded-full border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setMode("sell")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === "sell"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Sell
              </button>
              <button
                type="button"
                onClick={() => setMode("requests")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === "requests" ? "bg-sky-600 text-white shadow-sm" : "text-muted-foreground",
                )}
              >
                Requests
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <HubNavStrip active="food" className="mb-4" />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-10 rounded-full bg-card pl-9"
            placeholder="Search food, brand, or requests..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {mode === "sell" && (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-medium",
                  !categoryFilter ? "border-primary bg-primary/10 text-primary" : "bg-card",
                )}
              >
                All
              </button>
              {FOOD_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                  className={cn(
                    "flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-[10px]",
                    categoryFilter === cat ? "border-primary bg-primary/10" : "bg-card",
                  )}
                >
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  {cat.split(" ")[0]}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recently Added</h2>
              <Button size="sm" onClick={() => openForm("sell")}>
                <Plus className="mr-1 h-4 w-4" />
                Post listing
              </Button>
            </div>

            {loadingListings ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredListings.length ? (
              <>
                <div className="space-y-3">
                  {filteredListings.slice(0, visibleCount).map((l) => {
                    const expiry = getExpiryBadge(l.expiry_date);
                    return (
                      <Card
                        key={l.id}
                        className="cursor-pointer overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md"
                        onClick={() => navigate({ to: "/food/$id", params: { id: l.id } })}
                      >
                        <CardContent className="flex gap-3 p-3">
                          <div className="relative shrink-0">
                            {l.coverUrl ? (
                              <img
                                src={l.coverUrl}
                                alt={l.product_name}
                                className="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28"
                              />
                            ) : (
                              <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted sm:h-28 sm:w-28">
                                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <span
                              className={`absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${expiry.className}`}
                            >
                              {expiry.label}
                            </span>
                            <div
                              className="absolute right-2 top-2 z-20"
                              onClick={(e) => e.stopPropagation()}
                              role="presentation"
                            >
                              <WishlistButton listingId={l.id} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="line-clamp-2 text-sm font-semibold">
                                  {l.product_name}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                  {l.brand_name} · {l.quantity}
                                </p>
                              </div>
                            </div>
                            <p className="mt-1 text-base font-bold text-sky-700">
                              {formatInr(Number(l.price))}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  {l.seller?.avatar_url ? (
                                    <AvatarImage
                                      src={`${l.seller.avatar_url}${(l.seller.avatar_url as string).includes("?") ? "&" : "?"}t=${Date.now()}`}
                                      alt=""
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-[9px]">
                                    {(l.seller?.display_name ?? "S").slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">
                                  {l.seller?.display_name ?? "Seller"} · {timeAgo(l.created_at)}
                                </span>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast.message("Chat coming soon");
                                }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {visibleCount < filteredListings.length && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={() => setVisibleCount((c) => c + 12)}>
                      Load More
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <Heart className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No food listings yet.</p>
                <Button className="mt-4" onClick={() => openForm("sell")}>
                  Post first listing
                </Button>
              </div>
            )}
          </>
        )}

        {mode === "requests" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Food Requests</h2>
              <Button size="sm" variant="secondary" onClick={() => openForm("request")}>
                <Plus className="mr-1 h-4 w-4" />
                New Request
              </Button>
            </div>

            {loadingRequests ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRequests.length ? (
              <div className="space-y-3">
                {filteredRequests.map((r) => (
                  <Card key={r.id} className="border-border/60 shadow-sm">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span
                            className={`mb-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${urgencyColor(r.urgency_level)}`}
                          >
                            {r.urgency_level}
                          </span>
                          <h3 className="font-semibold">{r.product_name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {r.category} · {r.quantity_needed}
                          </p>
                        </div>
                        <Badge variant="outline">{timeAgo(r.created_at)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleRespond(r)}
                          disabled={respond.isPending || (!!user && user.id === r.requester_id)}
                        >
                          {respond.isPending ? (
                            <>
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              Opening chat…
                            </>
                          ) : (
                            "I Have This"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespond(r)}
                          disabled={respond.isPending || (!!user && user.id === r.requester_id)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No open requests yet. Be the first to post one!
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
