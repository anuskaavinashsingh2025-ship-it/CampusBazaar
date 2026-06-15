import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  MessageSquare,
  User,
  Menu,
  Search,
  Bike,
  Plus,
  Home,
  Grid2X2,
  Mail,
  Linkedin,
  Code,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

import { CategoryStrip } from "@/components/category-strip";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";
import ThemeToggle from "@/components/theme/theme-toggle";
import { HubNavStrip } from "@/components/hub-nav-strip";
import { RecentlyViewedSection } from "@/components/listing/recently-viewed-section";
import { ProductCard, type ProductCardModel } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { RentalCard, type RentalCardModel } from "@/components/marketplace/rental-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusBazar — The VIT Student Marketplace" },
      {
        name: "description",
        content:
          "Buy, sell, rent and share notes with fellow VIT students. CampusBazar is the trusted campus marketplace.",
      },
      { property: "og:title", content: "CampusBazar — The VIT Student Marketplace" },
      {
        property: "og:description",
        content: "Buy, sell, rent and share notes with fellow VIT students.",
      },
    ],
  }),
  component: MarketplaceHome,
});

type ProductListingRow = {
  id: string;
  title: string;
  price: number | string;
  category: string;
  custom_category: string | null;
  condition: string;
  urgent_sale: boolean;
  seller_id: string;
  created_at: string;
};

type ProductImageRow = {
  product_id: string;
  storage_path: string;
  sort_index: number;
};

const PRODUCT_LISTINGS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

function MarketplaceHome() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller_profile_self", user?.id ?? null],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["marketplace_home", "recommendations"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .select(
          "id,title,price,category,custom_category,condition,urgent_sale,seller_id,created_at",
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      const productRows = (rows ?? []) as unknown as ProductListingRow[];
      if (!productRows.length) return { productRows: [], sellers: [], imageRows: [] };

      const sellerIds = [...new Set(productRows.map((p) => p.seller_id))];
      const { data: sellers } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url")
        .in("user_id", sellerIds);

      const productIds = productRows.map((p) => p.id);
      const { data: images } = await supabase
        .from(PRODUCT_IMAGES_TABLE)
        .select("product_id,storage_path,sort_index")
        .in("product_id", productIds);

      return {
        productRows,
        sellers: sellers ?? [],
        imageRows: (images ?? []) as unknown as ProductImageRow[],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const sellerMap = new Map<string, { user_id: string; slug: string; display_name: string; avatar_url: string | null }>(
        data.sellers.map((s: any) => [s.user_id, s]),
      );

      const imageMap = new Map<string, { storage_path: string; sort_index: number }[]>();
      for (const img of data.imageRows) {
        const key = img.product_id;
        const arr = imageMap.get(key) ?? [];
        arr.push({ storage_path: img.storage_path, sort_index: img.sort_index });
        imageMap.set(key, arr);
      }

      return data.productRows.map((p) => {
        const sorted = (imageMap.get(p.id) ?? []).sort((a, b) => a.sort_index - b.sort_index);
        const cover = sorted[0]?.storage_path ?? null;
        const coverImageUrl = cover
          ? supabase.storage.from("product-images").getPublicUrl(cover).data.publicUrl
          : null;

        return {
          id: p.id,
          title: p.title,
          price: Number(p.price),
          category: p.category,
          custom_category: p.custom_category,
          condition: p.condition,
          urgent_sale: p.urgent_sale,
          seller: sellerMap.get(p.seller_id) ?? {
            user_id: p.seller_id,
            slug: "unknown",
            display_name: "Unknown seller",
            avatar_url: null,
          },
          coverImageUrl,
        } satisfies ProductCardModel;
      });
    },
  });

  // Selected category for homepage category strip (affects Fresh recommendations)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: foodRecs = [], isLoading: loadingFood } = useQuery({
    queryKey: ["marketplace_home", "recommendations", "food"],
    queryFn: async () => {
      // re-use the food listing logic but limited
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("food_listings")
        .select("id,product_name,brand_name,category,price,expiry_date,status,seller_id,created_at")
        .eq("status", "available")
        .gte("expiry_date", today)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (!rows.length) return { rows: [], images: [], sellers: [] };

      const ids = rows.map((r) => r.id);
      const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
      const [{ data: images }, { data: sellers }] = await Promise.all([
        ids.length
          ? supabase
              .from("food_images")
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

      return {
        rows,
        images: images ?? [],
        sellers: sellers ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { food_listing_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.food_listing_id)) {
          imageMap.set(
            row.food_listing_id,
            supabase.storage.from("food-images").getPublicUrl(row.storage_path).data.publicUrl,
          );
        }
      }

      const sellerMap = new Map(
        data.sellers.map((s: any) => [s.user_id, { user_id: s.user_id, slug: s.slug, display_name: s.display_name, avatar_url: s.avatar_url }]),
      );

      return data.rows.map((r) => ({
        id: r.id,
        title: r.product_name,
        price: Number(r.price),
        category: r.category,
        custom_category: null,
        condition: "",
        urgent_sale: false,
        seller: sellerMap.get(r.seller_id) ?? {
          user_id: r.seller_id,
          slug: "",
          display_name: "Seller",
          avatar_url: null,
        },
        coverImageUrl: imageMap.get(r.id) ?? null,
      }));
    },
  });

  const { data: rentalRecs = [], isLoading: loadingRentals } = useQuery({
    queryKey: ["marketplace_home", "recommendations", "rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_listings")
        .select(
          "id,title,rent_price_per_day,category,custom_category,condition,status,seller_id,created_at",
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (!rows.length) return { rows: [], images: [], sellers: [] };

      const ids = rows.map((r) => r.id);
      const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
      const [{ data: images }, { data: sellers }] = await Promise.all([
        ids.length
          ? supabase
              .from("rental_images")
              .select("rental_id,storage_path,sort_index")
              .in("rental_id", ids)
          : Promise.resolve({ data: [] }),
        sellerIds.length
          ? supabase
              .from("seller_profiles")
              .select("user_id,slug,display_name,avatar_url")
              .in("user_id", sellerIds)
          : Promise.resolve({ data: [] }),
      ]);

      return {
        rows,
        images: images ?? [],
        sellers: sellers ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { rental_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.rental_id)) {
          imageMap.set(
            row.rental_id,
            supabase.storage.from("rental-images").getPublicUrl(row.storage_path).data.publicUrl,
          );
        }
      }

      const sellerMap = new Map(
        data.sellers.map((s: any) => [
          s.user_id,
          {
            user_id: s.user_id,
            slug: s.slug,
            display_name: s.display_name,
            avatar_url: s.avatar_url,
          },
        ]),
      );

      return data.rows.map((r) => ({
        id: r.id,
        title: r.title,
        price: Number(r.rent_price_per_day),
        category: r.category,
        custom_category: r.custom_category,
        condition: r.condition,
        urgent_sale: false,
        seller: sellerMap.get(r.seller_id) ?? {
          user_id: r.seller_id,
          slug: "",
          display_name: "Seller",
          avatar_url: null,
        },
        coverImageUrl: imageMap.get(r.id) ?? null,
      }));
    },
  });

  const { data: notesRecs = [], isLoading: loadingNotes } = useQuery({
    queryKey: ["marketplace_home", "recommendations", "notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes_listings")
       .select(
"id,title,daily_rental_price,category,status,seller_id,created_at"
)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (!rows.length) return { rows: [], images: [], sellers: [] };

      const ids = rows.map((r) => r.id);
      const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
      const [{ data: images }, { data: sellers }] = await Promise.all([
        ids.length
          ? supabase
              .from("notes_assets")
              .select("listing_id,storage_path,sort_index")
              .in("listing_id", ids)
          : Promise.resolve({ data: [] }),
        sellerIds.length
          ? supabase
              .from("seller_profiles")
              .select("user_id,slug,display_name,avatar_url")
              .in("user_id", sellerIds)
          : Promise.resolve({ data: [] }),
      ]);

      return {
        rows,
        images: images ?? [],
        sellers: sellers ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { listing_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.listing_id)) {
          imageMap.set(
            row.listing_id,
            supabase.storage.from("notes-assets").getPublicUrl(row.storage_path).data.publicUrl,
          );
        }
      }

      const sellerMap = new Map(
        data.sellers.map((s: any) => [
          s.user_id,
          {
            user_id: s.user_id,
            slug: s.slug,
            display_name: s.display_name,
            avatar_url: s.avatar_url,
          },
        ]),
      );

      return data.rows.map((r) => ({
        id: r.id,
        title: r.title,
        price: Number(r.daily_rental_price),
        category: r.category,
       
        condition: "",
        urgent_sale: false,
        seller: sellerMap.get(r.seller_id) ?? {
          user_id: r.seller_id,
          slug: "",
          display_name: "Seller",
          avatar_url: null,
        },
        coverImageUrl: imageMap.get(r.id) ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products ?? [];
    return (products ?? []).filter((p) => {
      const category =
        p.category === "Others" && p.custom_category ? p.custom_category : p.category;
      return (
        p.title.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        p.condition.toLowerCase().includes(q) ||
        p.seller.display_name.toLowerCase().includes(q)
      );
    });
  }, [products, query]);

  // Compute the items to show for the Fresh recommendations area.
  // On the home page preview we cap at 8 items — users click "View all" for the full list.
  const HOME_PREVIEW_LIMIT = 8;

  const itemsToShow = useMemo(() => {
    if (isLoading) return [] as ProductCardModel[];
    // If a category is selected, pick the correct dataset:
    // - Food -> foodRecs
    // - Rent -> rentalRecs
    // - Notes -> notesRecs
    // - otherwise -> products filtered by that category
    if (selectedCategory) {
      if (selectedCategory === "Food") return foodRecs as unknown as ProductCardModel[];
      if (selectedCategory === "Rent") return rentalRecs as unknown as ProductCardModel[];
      if (selectedCategory === "Notes") return notesRecs as unknown as ProductCardModel[];
      return (products ?? []).filter((p) => {
        const category =
          p.category === "Others" && p.custom_category ? p.custom_category : p.category;
        return category === selectedCategory;
      });
    }
    return filtered;
  }, [isLoading, selectedCategory, foodRecs, rentalRecs, notesRecs, products, filtered]);

  const handleSell = () => {
    navigate({ to: "/upload-product" });
  };


  const handleProfileTap = () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setProfilePickerOpen(true);
  };

  const openUserProfile = () => {
    setProfilePickerOpen(false);
    navigate({ to: "/profile" });
  };

  const openSellerProfile = () => {
    setProfilePickerOpen(false);
    if (sellerProfile?.slug) {
      navigate({ to: "/seller/$slug", params: { slug: sellerProfile.slug } });
    } else {
      navigate({ to: "/seller-profile" });
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            aria-label="CampusBazar home"
            className="flex items-center justify-center"
          >
            <CampusBazarLogo compact showText={false} />
          </Link>

          <div className="relative ml-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search for items, notes, food, rent..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Wishlist"
              onClick={() => {
                if (!user) navigate({ to: "/login" });
                else navigate({ to: "/wishlist" });
              }}
            >
              <Heart className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Chats"
              onClick={() => {
                if (!user) navigate({ to: "/login" });
                else navigate({ to: "/chats" });
              }}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Profile" onClick={handleProfileTap}>
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-4">
        <HubNavStrip active="home" className="mb-4" />

        <Card className="overflow-hidden border-border/60">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:items-center">
            <div className="space-y-2">
              <div className="text-2xl font-bold leading-tight">
                Smart Choices. <span className="text-primary">Student Voices.</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Buy, sell, exchange or discover everything a student needs — all in one trusted
                place.
              </div>
              <div className="pt-2">
                <Button
                  onClick={() =>
                    document.getElementById("fresh-recos")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Explore Now
                </Button>
              </div>
            </div>
            <div className="hidden justify-end sm:flex">
              <div className="h-40 w-full rounded-xl bg-linear-to-br from-primary/15 via-accent/10 to-secondary/40" />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm font-semibold">Browse Categories</div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/marketplace">View all</Link>
          </Button>
        </div>

        <CategoryStrip
          className="mt-3"
          onViewAll={() => navigate({ to: "/marketplace" })}
          onCategorySelect={(k) => setSelectedCategory(k)}
          activeKey={selectedCategory}
        />

        <div className="mt-6 flex items-center justify-between" id="fresh-recos">
          <div className="text-sm font-semibold">Fresh recommendations</div>
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <Link to="/marketplace">View all</Link>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : itemsToShow.length ? (
            itemsToShow.slice(0, HOME_PREVIEW_LIMIT).map((p) => <ProductCard key={p.id} product={p} />)
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              {selectedCategory
                ? `No listings available yet in this category.`
                : "No listings found."}
            </div>
          )}
        </div>
        {itemsToShow.length > HOME_PREVIEW_LIMIT && (
          <div className="mt-3 flex justify-center">
            <Button variant="outline" size="sm" asChild>
              <Link to="/marketplace">View all {itemsToShow.length} listings</Link>
            </Button>
          </div>
        )}

        {/* Food preview section */}
        {!selectedCategory && foodRecs.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Food Listings</div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/food">View all</Link>
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {loadingFood ? (
                <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                (foodRecs as unknown as ProductCardModel[]).slice(0, HOME_PREVIEW_LIMIT).map((p) => (
                  <ProductCard key={p.id} product={p} linkTo={`/food/${p.id}`} />
                ))
              )}
            </div>
            {foodRecs.length > HOME_PREVIEW_LIMIT && (
              <div className="mt-3 flex justify-center">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/food">View all food listings</Link>
                </Button>
              </div>
            )}    
          </div>
        )}

        {/* Rentals preview section */}
        {!selectedCategory && rentalRecs.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Rental Listings</div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/rent/">View all</Link>
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {loadingRentals ? (
                <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                (rentalRecs as unknown as RentalCardModel[]).slice(0, HOME_PREVIEW_LIMIT).map((p) => (
  <RentalCard key={p.id} rental={p} />
                ))
              )}
            </div>
            {rentalRecs.length > HOME_PREVIEW_LIMIT && (
              <div className="mt-3 flex justify-center">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/rent/">View all rental listings</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Notes preview section */}
        {!selectedCategory && notesRecs.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Notes &amp; Study Material</div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/notes">View all</Link>
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {loadingNotes ? (
                <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                (notesRecs as unknown as ProductCardModel[]).slice(0, HOME_PREVIEW_LIMIT).map((p) => (
                  <ProductCard key={p.id} product={p} linkTo={`/notes/${p.id}`} />
                ))
              )}
            </div>
            {notesRecs.length > HOME_PREVIEW_LIMIT && (
              <div className="mt-3 flex justify-center">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/notes">View all notes listings</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <RecentlyViewedSection />
        </div>

        <Card className="mt-8 border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Got something to sell?</div>
              <div className="mt-1 text-xs text-muted-foreground">
                List it in minutes and reach students near you.
              </div>
            </div>
            <Button onClick={handleSell}>Sell Now</Button>
          </CardContent>
        </Card>

        <div className="mt-10 space-y-6">
          <Separator />

          {/* About Us Section */}
          <section>
            <h2 className="text-base font-bold">About us</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              CampusBazar is a VIT-only marketplace built for student life — buy and sell essentials
              with verified students.
            </p>
          </section>

          {/* Contact Us Section */}
          <section id="contact-us">
            <h2 className="text-base font-bold">Contact us</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {/* Alok Kale Card */}
              <div className="group rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                {/* Profile Image */}
                <div className="flex justify-center">
                  <div className="h-56 w-56 overflow-hidden rounded-full border-4 border-background bg-muted">
                    <img
                      src="/images/alok.jpeg"
                      alt="Alok Kale"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* Role Label */}
                <div className="mt-6 flex justify-center">
                  <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-600">
                    PROJECT HEAD
                  </span>
                </div>

                {/* Name */}
                <h3 className="mt-4 text-center text-xl font-bold text-foreground">Alok Kale</h3>

                {/* Subtitle */}
                <p className="text-center text-sm text-muted-foreground">CampusBazar Project Head</p>

                {/* Divider */}
                <div className="my-4 h-px bg-border"></div>

                {/* Email */}
                <a
                  href="mailto:kale.alokavinash2025@vitstudent.ac.in"
                  className="flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="break-all text-foreground">kale.alokavinash2025@vitstudent.ac.in</span>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://linkedin.com/in/alok-kale-a23aa4385"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <Linkedin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate text-foreground">linkedin.com/in/alok-kale-a23aa4385</span>
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                </a>
              </div>

              {/* Anuska Singh Card */}
              <div className="group rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                {/* Profile Image */}
                <div className="flex justify-center">
                  <div className="h-56 w-56 overflow-hidden rounded-full border-4 border-background bg-muted">
                    <img
                      src="/images/anuska.jpeg"
                      alt="Anuska Singh"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* Role Label */}
                <div className="mt-6 flex justify-center">
                  <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-600">
                    PROJECT HEAD
                  </span>
                </div>

                {/* Name */}
                <h3 className="mt-4 text-center text-xl font-bold text-foreground">Anuska Singh</h3>

                {/* Subtitle */}
                <p className="text-center text-sm text-muted-foreground">CampusBazar Project Head</p>

                {/* Divider */}
                <div className="my-4 h-px bg-border"></div>

                {/* Email */}
                <a
                  href="mailto:anuska.avinashsingh2025@vitstudent.ac.in"
                  className="flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="break-all text-foreground">anuska.avinashsingh2025@vitstudent.ac.in</span>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://linkedin.com/in/anuska-singh-269a0136b"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <Linkedin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate text-foreground">linkedin.com/in/anuska-singh-269a0136b</span>
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                </a>
              </div>
            </div>
          </section>

          {/* Special Thanks To Section */}
          <section>
            <h2 className="text-base font-bold">Special Thanks To</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                <Code className="h-5 w-5 flex-shrink-0 text-orange-600" />
                <span className="text-sm font-medium text-foreground">Chintala Keshav Karthik</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                <Code className="h-5 w-5 flex-shrink-0 text-orange-600" />
                <span className="text-sm font-medium text-foreground">Sneha Kumari</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                <Code className="h-5 w-5 flex-shrink-0 text-orange-600" />
                <span className="text-sm font-medium text-foreground">Sakshi Saraf</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                <Code className="h-5 w-5 flex-shrink-0 text-orange-600" />
                <span className="text-sm font-medium text-foreground">Tejas Chandane</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-foreground"
            onClick={() => navigate({ to: "/" })}
          >
            <Home className="h-5 w-5" />
            Home
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            onClick={() => navigate({ to: "/rent" })}
          >
            <Bike className="h-5 w-5" />
            Rent
          </button>

          <button
            type="button"
            className="-mt-8 rounded-full bg-primary p-4 text-primary-foreground shadow-lg"
            onClick={handleSell}
            aria-label="Sell"
          >
            <Plus className="h-6 w-6" />
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            onClick={() => {
              if (!user) navigate({ to: "/login" });
              else navigate({ to: "/chats" });
            }}
          >
            <MessageSquare className="h-5 w-5" />
            Chats
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            onClick={handleProfileTap}
          >
            <User className="h-5 w-5" />
            Profile
          </button>
        </div>
      </nav>

      {/* Mobile top-right icons (wishlist/chats/profile), shown below header on small screens */}
      <div className="fixed right-3 top-16 z-30 flex gap-2 sm:hidden">
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow"
          onClick={() => {
            if (!user) navigate({ to: "/login" });
            else navigate({ to: "/wishlist" });
          }}
          aria-label="Wishlist"
        >
          <Heart className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow"
          onClick={() => {
            if (!user) navigate({ to: "/login" });
            else navigate({ to: "/chats" });
          }}
          aria-label="Chats"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow"
          onClick={handleProfileTap}
          aria-label="Profile"
        >
          <User className="h-5 w-5" />
        </Button>
      </div>

      {isAdmin && (
        <div className="fixed left-3 top-16 z-30 sm:hidden">
          <Badge variant="secondary">Admin</Badge>
        </div>
      )}

      <Dialog open={profilePickerOpen} onOpenChange={setProfilePickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Choose profile</DialogTitle>
            <DialogDescription>
              User profile is private. Seller profile is public.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-1">
            <Button className="w-full justify-start" onClick={openUserProfile}>
              User Profile
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={openSellerProfile}>
              Seller Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
