import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bike,
  BookOpen,
  Calculator,
  ChevronDown,
  FlaskConical,
  Guitar,
  Heart,
  Loader2,
  MessageSquare,
  Search,
  ShoppingBasket,
  Smartphone,
  Shirt,
  User,
  Dumbbell,
  Coffee,
  MoreHorizontal,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import ListingActions from "@/components/listing/listing-actions";
import { getStoragePublicUrl } from "@/lib/storage-url";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { HubNavStrip } from "@/components/hub-nav-strip";

export const Route = createFileRoute("/rent/")({
  head: () => ({
    meta: [{ title: "Rent — CampusBazar" }],
  }),
  component: RentFeedPage,
});

type RentalRow = {
  id: string;
  title: string;
  rent_price_per_day: number | string;
  category: string;
  custom_category: string | null;
  condition: string;
  status: "available" | "rented_out" | "unavailable";
  seller_id: string;
  created_at: string;
};

type RentalImageRow = {
  rental_id: string;
  storage_path: string;
  sort_index: number;
};

type SellerProfileRow = {
  user_id: string;
  slug: string;
  display_name: string | null;
  avatar_url: string | null;
  rating_avg: number | null;
};

const RENTAL_LISTINGS_TABLE = "rental_listings" as unknown as keyof Database["public"]["Tables"];
const RENTAL_IMAGES_TABLE = "rental_images" as unknown as keyof Database["public"]["Tables"];

const CATEGORY_OPTIONS = [
  { key: "Books", icon: BookOpen, color: "bg-orange-100 text-orange-600" },
  { key: "Calculators", icon: Calculator, color: "bg-blue-100 text-blue-600" },
  { key: "Lab Equipment", icon: FlaskConical, color: "bg-sky-100 text-sky-600" },
  { key: "Cycles", icon: Bike, color: "bg-slate-100 text-slate-600" },
  { key: "Electronics", icon: Smartphone, color: "bg-indigo-100 text-indigo-600" },
  { key: "Fashion", icon: Shirt, color: "bg-pink-100 text-pink-600" },
  { key: "Sports Equipment", icon: Dumbbell, color: "bg-amber-100 text-amber-600" },
  { key: "Musical Instruments", icon: Guitar, color: "bg-amber-50 text-amber-800" },
  { key: "Hostel Essentials", icon: Coffee, color: "bg-cyan-100 text-cyan-600" },
  { key: "Others", icon: MoreHorizontal, color: "bg-gray-100 text-gray-600" },
] as const;

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Used"] as const;

const HOW_IT_WORKS = [
  { step: 1, title: "Find Item", desc: "Browse available rental listings" },
  { step: 2, title: "Send Request", desc: "Chat with seller & send request" },
  { step: 3, title: "Wait for Response", desc: "Seller accepts or rejects" },
  { step: 4, title: "Use & Return", desc: "Use the item and return on time" },
  { step: 5, title: "Mark Returned", desc: "Complete the rental cycle" },
];

function RentFeedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [availability, setAvailability] = useState({
    available: true,
    rented_out: false,
    unavailable: false,
  });
  const [sortBy, setSortBy] = useState("recent");
  const [visibleCount, setVisibleCount] = useState(12);

  const { data, isLoading } = useQuery({
    queryKey: ["rentals", "feed"],
    queryFn: async () => {
      const { data: rentals, error } = await supabase
        .from(RENTAL_LISTINGS_TABLE)
        .select(
          "id,title,rent_price_per_day,category,custom_category,condition,status,seller_id,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (rentals ?? []) as unknown as RentalRow[];
      const ids = rows.map((r) => r.id);
      const sellerIds = [...new Set(rows.map((r) => r.seller_id))];

      const [{ data: images }, { data: sellers }] = await Promise.all([
        ids.length
          ? supabase
              .from(RENTAL_IMAGES_TABLE)
              .select("rental_id,storage_path,sort_index")
              .in("rental_id", ids)
          : Promise.resolve({ data: [] }),
        sellerIds.length
          ? supabase
              .from("seller_profiles")
              .select("user_id,slug,display_name,avatar_url,rating_avg")
              .in("user_id", sellerIds)
          : Promise.resolve({ data: [] }),
      ]);

      const imageRows = (images ?? []) as unknown as RentalImageRow[];
      const map = new Map<string, RentalImageRow[]>();
      for (const img of imageRows) {
        const arr = map.get(img.rental_id) ?? [];
        arr.push(img);
        map.set(img.rental_id, arr);
      }

          const sellerMap = new Map((sellers ?? []).map((s: any) => [s.user_id, { display_name: s.display_name, avatar_url: s.avatar_url, slug: s.slug }]));

      return rows.map((r) => {
        const cover = (map.get(r.id) ?? []).sort((a, b) => a.sort_index - b.sort_index)[0];
        const coverUrl = cover ? getStoragePublicUrl("rental-images", cover.storage_path) : null;
        return { ...r, coverUrl, seller: sellerMap.get(r.seller_id) };
      });
    },
    refetchInterval: 10000,
  });

  const statusCounts = useMemo(() => {
    const items = data ?? [];
    return {
      available: items.filter((r) => r.status === "available").length,
      rented_out: items.filter((r) => r.status === "rented_out").length,
      unavailable: items.filter((r) => r.status === "unavailable").length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    let items = data ?? [];

    const activeStatuses = Object.entries(availability)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeStatuses.length) {
      items = items.filter((r) => activeStatuses.includes(r.status));
    }

    if (categoryFilter !== "all") {
      items = items.filter((r) => r.category === categoryFilter);
    }
    if (conditionFilter !== "all") {
      items = items.filter((r) => r.condition === conditionFilter);
    }
    if (minPrice.trim()) {
      items = items.filter((r) => Number(r.rent_price_per_day) >= Number(minPrice));
    }
    if (maxPrice.trim()) {
      items = items.filter((r) => Number(r.rent_price_per_day) <= Number(maxPrice));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter((r) => {
        const category =
          r.category === "Others" && r.custom_category ? r.custom_category : r.category;
        return (
          r.title.toLowerCase().includes(q) ||
          category.toLowerCase().includes(q) ||
          r.condition.toLowerCase().includes(q)
        );
      });
    }

    if (sortBy === "price_low") {
      items = [...items].sort(
        (a, b) => Number(a.rent_price_per_day) - Number(b.rent_price_per_day),
      );
    } else if (sortBy === "price_high") {
      items = [...items].sort(
        (a, b) => Number(b.rent_price_per_day) - Number(a.rent_price_per_day),
      );
    }

    return items;
  }, [data, query, categoryFilter, conditionFilter, minPrice, maxPrice, availability, sortBy]);

  const visible = filtered.slice(0, visibleCount);

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const statusBadge = (status: RentalRow["status"]) => {
    if (status === "available")
      return { label: "Available", className: "bg-emerald-500 text-white" };
    if (status === "rented_out")
      return { label: "Rented Out", className: "bg-orange-500 text-white" };
    return { label: "Unavailable", className: "bg-slate-400 text-white" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 to-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            aria-label="CampusBazar home"
            className="flex shrink-0 items-center justify-center"
          >
            <CampusBazarLogo compact showText={false} />
          </Link>

          <div className="relative mx-auto hidden max-w-xl flex-1 md:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search for items to rent (books, cycles, electronics...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-1 sm:flex"
              onClick={() => (user ? navigate({ to: "/wishlist" }) : navigate({ to: "/login" }))}
            >
              <Heart className="h-4 w-4" />
              Wishlist
            </Button>
            <Button variant="ghost" size="icon" aria-label="Chats">
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Profile"
              onClick={() => (user ? navigate({ to: "/profile" }) : navigate({ to: "/login" }))}
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search rentals..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <HubNavStrip active="rent" className="mb-4" />

        <section className="mb-8 grid gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-2 sm:items-center">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              <span className="text-primary">Rent What You Need.</span>{" "}
              <span className="text-orange-500">Return When You&apos;re Done.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Temporary. Affordable. Convenient. Rent items from students around you.
            </p>
            <Button
              onClick={() =>
                document.getElementById("rental-listings")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explore Rentals
            </Button>
          </div>
          <div className="hidden h-40 rounded-2xl bg-gradient-to-br from-primary/15 via-orange-100/50 to-sky-100 sm:block" />
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Browse Rental Categories</h2>
            <Link to="/rent/" className="text-sm text-primary hover:underline">
              View all &gt;
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "flex shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-xs",
                categoryFilter === "all" ? "border-primary bg-primary/10" : "bg-card",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Bike className="h-5 w-5" />
              </div>
              All
            </button>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat.key ? "all" : cat.key)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-xs",
                  categoryFilter === cat.key ? "border-primary bg-primary/10" : "bg-card",
                )}
              >
                <div
                  className={cn("flex h-10 w-10 items-center justify-center rounded-lg", cat.color)}
                >
                  <cat.icon className="h-5 w-5" />
                </div>
                {cat.key.split(" ")[0]}
              </button>
            ))}
          </div>
        </section>

        <div id="rental-listings" className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden space-y-5 rounded-xl border bg-card p-4 lg:block">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filters</h3>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  setCategoryFilter("all");
                  setMinPrice("");
                  setMaxPrice("");
                  setConditionFilter("all");
                  setAvailability({ available: true, rented_out: false, unavailable: false });
                }}
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rent Price (per day)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="₹ Min"
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <Input
                  placeholder="₹ Max"
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Conditions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conditions</SelectItem>
                  {CONDITION_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Availability</Label>
              {(
                [
                  { key: "available" as const, label: "Available" },
                  { key: "rented_out" as const, label: "Rented Out" },
                  { key: "unavailable" as const, label: "Unavailable" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`avail-${key}`}
                    checked={availability[key]}
                    onCheckedChange={(v) =>
                      setAvailability((prev) => ({ ...prev, [key]: Boolean(v) }))
                    }
                  />
                  <Label htmlFor={`avail-${key}`} className="text-sm font-normal">
                    {label} ({statusCounts[key]})
                  </Label>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full">Apply Filters</Button>
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Rental Listings</h2>
                <p className="text-sm text-muted-foreground">{filtered.length} items found</p>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : visible.length ? (
                visible.map((r) => {
                  const category =
                    r.category === "Others" && r.custom_category ? r.custom_category : r.category;
                  const badge = statusBadge(r.status);
                  const seller = r.seller as SellerProfileRow | undefined;
                  return (
                    <Card
                      key={r.id}
                      className="cursor-pointer overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md"
                      onClick={() => navigate({ to: "/rent/$id", params: { id: r.id } })}
                    >
                      <CardContent className="p-0">
                        <div className="relative">
                          {/* Listing actions for owner/admin */}
                          <div
                            className="absolute right-2 top-2 z-20"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <ListingActions
                              itemType="rental"
                              itemId={r.id}
                              ownerId={r.seller_id}
                              onEdit={() => {
                                console.log("[ListingActions] onEdit rental", r.id);
                                window.location.assign(`/upload-rental?edit=${r.id}`);
                              }}
                            />
                          </div>
                          {r.coverUrl ? (
                            <img
                              src={r.coverUrl}
                              alt={r.title}
                              className="h-40 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground">
                              No image
                            </div>
                          )}
                          <div onClick={(e) => e.stopPropagation()} role="presentation">
                            <WishlistButton listingId={r.id} />
                          </div>
                          <span
                            className={cn(
                              "absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="space-y-2 p-3">
                          <p className="line-clamp-2 text-sm font-medium">{r.title}</p>
                          <p className="text-sm font-bold text-primary">
                            {formatInr(Number(r.rent_price_per_day))} / day
                          </p>
                          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                            <span>• {r.condition}</span>
                            <span>• {category}</span>
                          </div>
                          <div className="flex items-center gap-2 border-t pt-2">
                            <Avatar className="h-6 w-6">
                              {seller?.avatar_url ? (
                                <AvatarImage
                                  src={`${seller.avatar_url}${(seller.avatar_url as string).includes("?") ? "&" : "?"}t=${Date.now()}`}
                                  alt=""
                                />
                              ) : null}
                              <AvatarFallback className="text-[9px]">
                                {(seller?.display_name ?? "S").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-xs text-muted-foreground">
                              {seller?.display_name ?? "Seller"}
                            </span>
                            {seller?.rating_avg != null && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                ★ {Number(seller.rating_avg).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  No rentals found.
                </div>
              )}
            </div>

            {visibleCount < filtered.length && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={() => setVisibleCount((c) => c + 12)}>
                  Load More
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <section className="mt-12 rounded-2xl border bg-card p-6">
          <h2 className="mb-6 text-center font-semibold">How Renting Works?</h2>
          <div className="grid gap-4 sm:grid-cols-5">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {step.step}
                </div>
                <div className="text-sm font-semibold">{step.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{step.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border bg-linear-to-r from-primary/5 to-orange-50 p-6 sm:flex-row">
          <div>
            <h3 className="font-semibold">Have something to rent?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              List your item and earn by sharing it with your campus community.
            </p>
          </div>
          <Button
            onClick={() => (user ? navigate({ to: "/upload-rental" }) : navigate({ to: "/login" }))}
          >
            List Item for Rent
          </Button>
        </section>
      </main>
    </div>
  );
}
