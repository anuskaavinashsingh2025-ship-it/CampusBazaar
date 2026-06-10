import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Heart, Loader2, MessageSquare, Search, ShoppingBag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useWishlist, type WishlistRow } from "@/lib/wishlist";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({
    meta: [{ title: "Wishlist — CampusBazar" }],
  }),
  component: WishlistPage,
});

type ListingType = "product" | "rental" | "food" | "notes";

type NormalizedWishlistItem = {
  listingId: string;
  listingType: ListingType;
  title: string;
  price: number | null;
  category: string;
  coverUrl: string | null;
  status: string;
  sellerName: string;
  sellerSlug: string | null;
  sellerAvatar: string | null;
  soldOut: boolean;
  createdAt: string;
};

const TABS: { value: "all" | ListingType | "sold"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "product", label: "Products" },
  { value: "rental", label: "Rentals" },
  { value: "notes", label: "Notes" },
  { value: "food", label: "Food Hub" },
  { value: "sold", label: "Sold Out" },
];

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Saved today";
  if (days === 1) return "Saved 1 day ago";
  return `Saved ${days} days ago`;
}

function WishlistPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: wishlistRows = [], isLoading } = useWishlist(user?.id);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("all");
  const [availableOnly, setAvailableOnly] = useState(true);

  const { data: resolvedItems = [], isLoading: resolving } = useQuery({
    queryKey: ["wishlist_resolved", user?.id, wishlistRows.map((r) => r.id).join(",")],
    queryFn: () => resolveWishlistItems(wishlistRows),
    enabled: wishlistRows.length > 0,
  });

  const filtered = useMemo(() => {
    let items = resolvedItems;
    if (tab === "sold") {
      items = items.filter((i) => i.soldOut);
    } else if (tab !== "all") {
      items = items.filter((i) => i.listingType === tab && !i.soldOut);
    } else if (availableOnly) {
      items = items.filter((i) => !i.soldOut);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.sellerName.toLowerCase().includes(q),
      );
    }
    return items;
  }, [resolvedItems, tab, query, availableOnly]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Wishlist <span className="text-red-500">❤</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Saved items: {wishlistRows.length}</p>
        </div>
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <Heart className="h-8 w-8 fill-red-500 text-red-500" />
            <div>
              <div className="text-2xl font-bold">{wishlistRows.length}</div>
              <div className="text-xs text-muted-foreground">Total saved</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="rounded-full pl-9"
          placeholder="Search in wishlist..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-full border data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 flex items-center gap-2">
          <Switch id="availableOnly" checked={availableOnly} onCheckedChange={setAvailableOnly} />
          <Label htmlFor="availableOnly" className="text-sm">
            Available only
          </Label>
        </div>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {resolving && wishlistRows.length > 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10">
                <ShoppingBag className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-lg font-bold">No saved items yet!</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Tap the heart on any listing to save it here for later.
              </p>
              <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
                Browse marketplace
              </Button>
            </div>
          ) : (
            filtered.map((item) => (
              <Card key={item.listingId} className="overflow-hidden border-border/60">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
                  <div className="relative shrink-0">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="h-28 w-full rounded-lg object-cover sm:h-32 sm:w-32"
                      />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center rounded-lg bg-muted sm:h-32 sm:w-32">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge
                      className={`absolute left-2 top-2 text-[10px] ${
                        item.soldOut ? "bg-red-500" : "bg-emerald-500 hover:bg-emerald-500"
                      }`}
                    >
                      {item.soldOut ? "Sold" : timeAgo(item.createdAt)}
                    </Badge>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold leading-snug">{item.title}</h3>
                        {item.price != null && (
                          <p className="text-lg font-bold text-primary">{formatInr(item.price)}</p>
                        )}
                      </div>
                      <WishlistButton listingId={item.listingId} variant="inline" />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-6 w-6">
                        {item.sellerAvatar ? (
                          <AvatarImage
                            src={`${item.sellerAvatar}${(item.sellerAvatar as string).includes("?") ? "&" : "?"}t=${Date.now()}`}
                            alt={item.sellerName}
                          />
                        ) : null}
                        <AvatarFallback>{item.sellerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {item.sellerSlug ? (
                        <Link
                          to="/seller/$slug"
                          params={{ slug: item.sellerSlug }}
                          className="hover:underline"
                        >
                          {item.sellerName}
                        </Link>
                      ) : (
                        <span>{item.sellerName}</span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {item.category}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {!item.soldOut && (
                        <Button size="sm" variant="outline" disabled>
                          <MessageSquare className="mr-1 h-3 w-3" />
                          Chat
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={item.soldOut ? "outline" : "default"}
                        onClick={() => {
                          if (item.listingType === "product") {
                            navigate({ to: "/product/$id", params: { id: item.listingId } });
                          } else if (item.listingType === "rental") {
                            navigate({ to: "/rent/$id", params: { id: item.listingId } });
                          } else if (item.listingType === "food") {
                            navigate({ to: "/food/$id", params: { id: item.listingId } });
                          } else {
                            navigate({ to: "/notes/$id", params: { id: item.listingId } });
                          }
                        }}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function resolveWishlistItems(rows: WishlistRow[]): Promise<NormalizedWishlistItem[]> {
  console.log("[Wishlist Rows]", rows);
  const results: NormalizedWishlistItem[] = [];

  for (const row of rows) {
    const listingId = row.listing_id;
    let found = false;

    // Try product_listings
    try {
      const { data: product } = await supabase
        .from("product_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,price,category,custom_category,status,seller_id")
        .eq("id", listingId)
        .single();

      if (product) {
        const { data: images } = await supabase
          .from("product_images" as unknown as keyof Database["public"]["Tables"])
          .select("storage_path,sort_index")
          .eq("product_id", listingId)
          .order("sort_index", { ascending: true })
          .limit(1);

        const { data: seller } = await supabase
          .from("seller_profiles")
          .select("slug,display_name,avatar_url")
          .eq("user_id", product.seller_id)
          .single();

        const coverUrl =
          images && images.length > 0
            ? supabase.storage.from("product-images").getPublicUrl(images[0].storage_path).data
                .publicUrl
            : null;

        results.push({
          listingId,
          listingType: "product",
          title: product.title,
          price: Number(product.price),
          category:
            product.category === "Others" && product.custom_category
              ? product.custom_category
              : product.category,
          coverUrl,
          status: product.status,
          sellerName: seller?.display_name ?? "Seller",
          sellerSlug: seller?.slug ?? null,
          sellerAvatar: seller?.avatar_url ?? null,
          soldOut: product.status !== "available",
          createdAt: row.created_at,
        });
        found = true;
      }
    } catch (e) {
      // Product not found, continue to next table
    }

    if (found) continue;

    // Try rental_listings
    try {
      const { data: rental } = await supabase
        .from("rental_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,rent_price_per_day,category,custom_category,status,seller_id")
        .eq("id", listingId)
        .single();

      if (rental) {
        const { data: images } = await supabase
          .from("rental_images" as unknown as keyof Database["public"]["Tables"])
          .select("storage_path,sort_index")
          .eq("rental_id", listingId)
          .order("sort_index", { ascending: true })
          .limit(1);

        const { data: seller } = await supabase
          .from("seller_profiles")
          .select("slug,display_name,avatar_url")
          .eq("user_id", rental.seller_id)
          .single();

        const coverUrl =
          images && images.length > 0
            ? supabase.storage.from("rental-images").getPublicUrl(images[0].storage_path).data
                .publicUrl
            : null;

        results.push({
          listingId,
          listingType: "rental",
          title: rental.title,
          price: Number(rental.rent_price_per_day),
          category:
            rental.category === "Others" && rental.custom_category
              ? rental.custom_category
              : rental.category,
          coverUrl,
          status: rental.status,
          sellerName: seller?.display_name ?? "Seller",
          sellerSlug: seller?.slug ?? null,
          sellerAvatar: seller?.avatar_url ?? null,
          soldOut: rental.status !== "available",
          createdAt: row.created_at,
        });
        found = true;
      }
    } catch (e) {
      // Rental not found, continue to next table
    }

    if (found) continue;

    // Try food_listings
    try {
      const { data: food } = await supabase
        .from("food_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,product_name,price,category,status,seller_id")
        .eq("id", listingId)
        .single();

      if (food) {
        const { data: images } = await supabase
          .from("food_images" as unknown as keyof Database["public"]["Tables"])
          .select("storage_path,sort_index")
          .eq("food_listing_id", listingId)
          .order("sort_index", { ascending: true })
          .limit(1);

        const { data: seller } = await supabase
          .from("seller_profiles")
          .select("slug,display_name,avatar_url")
          .eq("user_id", food.seller_id)
          .single();

        const coverUrl =
          images && images.length > 0
            ? supabase.storage.from("food-images").getPublicUrl(images[0].storage_path).data
                .publicUrl
            : null;

        results.push({
          listingId,
          listingType: "food",
          title: food.product_name,
          price: Number(food.price),
          category: food.category,
          coverUrl,
          status: food.status,
          sellerName: seller?.display_name ?? "Seller",
          sellerSlug: seller?.slug ?? null,
          sellerAvatar: seller?.avatar_url ?? null,
          soldOut: food.status !== "available",
          createdAt: row.created_at,
        });
        found = true;
      }
    } catch (e) {
      // Food not found, continue to next table
    }

    if (found) continue;

    // Try notes_listings
    try {
      const { data: notes } = await supabase
        .from("notes_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,subject,status,seller_id,is_free,price")
        .eq("id", listingId)
        .single();

      if (notes) {
        const { data: seller } = await supabase
          .from("seller_profiles")
          .select("slug,display_name,avatar_url")
          .eq("user_id", notes.seller_id)
          .single();

        results.push({
          listingId,
          listingType: "notes",
          title: notes.title,
          price: notes.is_free ? 0 : Number(notes.price ?? 0),
          category: notes.subject,
          coverUrl: null,
          status: notes.status,
          sellerName: seller?.display_name ?? "Seller",
          sellerSlug: seller?.slug ?? null,
          sellerAvatar: seller?.avatar_url ?? null,
          soldOut: notes.status !== "available",
          createdAt: row.created_at,
        });
        found = true;
      }
    } catch (e) {
      // Notes not found
    }

    if (!found) {
      console.warn(`[Wishlist] Listing not found: ${listingId}`);
    }
  }

  console.log("[Wishlist Resolved Listings]", results);
  console.log("[Wishlist Final Render]", results.length);

  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
