import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Loader2,
  MessageSquare,
  Package,
  Share2,
  Star,
  Home,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { ProductCard, type ProductCardModel } from "@/components/marketplace/product-card";
import { RentalCard, type RentalCardModel } from "@/components/marketplace/rental-card";
import { ReportListingDialog } from "@/components/listing/report-listing-dialog";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

export const Route = createFileRoute("/seller/$slug")({
  head: () => ({
    meta: [
      { title: "Seller — CampusBazar" },
      { name: "description", content: "View this seller's storefront on CampusBazar." },
    ],
  }),
  component: SellerPage,
});

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

function SellerPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"products" | "rentals" | "notes" | "reviews" | "completed">("products");
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

  const { data: seller, isLoading } = useQuery({
    queryKey: ["seller", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user_profile", seller?.user_id],
    queryFn: async () => {
      if (!seller) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", seller.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(seller?.user_id),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["seller_products", seller?.user_id, userProfile?.id],
    queryFn: async () => {
      if (!seller) return { rows: [], images: [] };
      // Ensure we prefer the latest avatar from profiles when building product seller info
      const { data: listings, error } = await supabase
        .from("product_listings" as unknown as keyof Database["public"]["Tables"])
        .select(
          "id,title,price,category,custom_category,condition,urgent_sale,status,seller_id,created_at",
        )
        .eq("seller_id", seller.user_id)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = listings ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return { rows: [], images: [] };

      const { data: images } = await supabase
        .from("product_images" as unknown as keyof Database["public"]["Tables"])
        .select("product_id,storage_path,sort_index")
        .in("product_id", ids);

      return {
        rows,
        images: images ?? [],
      };
    },
    enabled: Boolean(seller?.user_id && userProfile),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { product_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.product_id)) {
          imageMap.set(
            row.product_id,
            row.storage_path,
          );
        }
      }

      return data.rows.map(
        (p: {
          id: string;
          title: string;
          price: number;
          category: string;
          custom_category: string | null;
          condition: string;
          urgent_sale: boolean;
          seller_id: string;
        }): ProductCardModel => ({
          id: p.id,
          title: p.title,
          price: Number(p.price),
          category: p.category,
          custom_category: p.custom_category,
          condition: p.condition,
          urgent_sale: p.urgent_sale,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            // Prefer the authoritative profile avatar when available
            avatar_url: (userProfile?.avatar_url as string | null) ?? seller.avatar_url,
            rating_avg: Number(seller.rating_avg || 0),
          },
          coverImageUrl: imageMap.get(p.id) ?? null,
        }),
      );
    },
  });

  const { data: rentals = [], isLoading: loadingRentals } = useQuery({
    queryKey: ["seller_rentals", seller?.user_id, userProfile?.id],
    queryFn: async () => {
      if (!seller) return { rows: [], images: [] };
      const { data, error } = await supabase
        .from("rental_listings" as unknown as keyof Database["public"]["Tables"])
        .select(
          "id,title,rent_price_per_day,category,custom_category,condition,status,seller_id,created_at",
        )
        .eq("seller_id", seller.user_id)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return { rows: [], images: [] };

      const { data: images } = await supabase
        .from("rental_images" as unknown as keyof Database["public"]["Tables"])
        .select("rental_id,storage_path,sort_index")
        .in("rental_id", ids);

      return {
        rows,
        images: images ?? [],
      };
    },
    enabled: Boolean(seller?.user_id && userProfile),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { rental_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.rental_id)) {
          imageMap.set(
            row.rental_id,
            row.storage_path,
          );
        }
      }

      return data.rows.map(
        (r: {
          id: string;
          title: string;
          rent_price_per_day: number;
          category: string;
          custom_category: string | null;
          condition: string;
          seller_id: string;
        }): RentalCardModel => ({
          id: r.id,
          title: r.title,
          rent_price_per_day: Number(r.rent_price_per_day),
          category: r.category,
          custom_category: r.custom_category,
          condition: r.condition,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            avatar_url: (userProfile?.avatar_url as string | null) ?? seller.avatar_url,
            rating_avg: Number(seller.rating_avg || 0),
          },
          coverImageUrl: imageMap.get(r.id) ?? null,
        }),
      );
    },
  });

  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ["seller_notes", seller?.user_id, userProfile?.id],
    queryFn: async () => {
      if (!seller) return { rows: [], images: [] };
      const { data, error } = await supabase
        .from("notes_listings" as unknown as keyof Database["public"]["Tables"])
        .select(
          "id,title,listing_type,category,subject,faculty,semester,branch,daily_rental_price,rental_duration_days,condition,is_digital,is_free,status,seller_id,created_at"
        )
        .eq("seller_id", seller.user_id)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return { rows: [], images: [] };

      const { data: images } = await supabase
        .from("notes_assets" as unknown as keyof Database["public"]["Tables"])
        .select("listing_id,storage_path,sort_index")
        .eq("kind", "image")
        .in("listing_id", ids);

      return {
        rows,
        images: images ?? [],
      };
    },
    enabled: Boolean(seller?.user_id && userProfile),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { listing_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.listing_id)) {
          imageMap.set(
            row.listing_id,
            row.storage_path,
          );
        }
      }

      return data.rows.map(
        (n: {
          id: string;
          title: string;
          listing_type: "sell" | "rent";
          category: string;
          subject: string | null;
          faculty: string | null;
          semester: string | null;
          branch: string | null;
          daily_rental_price: number | string | null;
          rental_duration_days: number | null;
          condition: string | null;
          is_digital: boolean;
          is_free: boolean;
          seller_id: string;
        }) => ({
          id: n.id,
          title: n.title,
          listing_type: n.listing_type,
          category: n.category,
          subject: n.subject,
          faculty: n.faculty,
          semester: n.semester,
          branch: n.branch,
          daily_rental_price: n.daily_rental_price,
          rental_duration_days: n.rental_duration_days,
          condition: n.condition,
          is_digital: n.is_digital,
          is_free: n.is_free,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            avatar_url: (userProfile?.avatar_url as string | null) ?? seller.avatar_url,
            rating_avg: Number(seller.rating_avg || 0),
          },
          coverImageUrl: imageMap.get(n.id) ?? null,
        }),
      );
    },
  });

  const { data: soldProducts = [] } = useQuery({
    queryKey: ["seller_sold", seller?.user_id, userProfile?.id],
    queryFn: async () => {
      if (!seller) return { rows: [], images: [] };
      const { data, error } = await supabase
        .from("product_listings" as unknown as keyof Database["public"]["Tables"])
        .select(
          "id,title,price,category,custom_category,condition,urgent_sale,status,seller_id,updated_at",
        )
        .eq("seller_id", seller.user_id)
        .eq("status", "sold")
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return { rows: [], images: [] };

      const { data: images } = await supabase
        .from("product_images" as unknown as keyof Database["public"]["Tables"])
        .select("product_id,storage_path,sort_index")
        .in("product_id", ids);

      return {
        rows,
        images: images ?? [],
      };
    },
    enabled: Boolean(seller?.user_id && userProfile),
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { product_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.product_id)) {
          imageMap.set(
            row.product_id,
            row.storage_path,
          );
        }
      }

      return data.rows.map(
        (p: {
          id: string;
          title: string;
          price: number;
          category: string;
          custom_category: string | null;
          condition: string;
          urgent_sale: boolean;
          seller_id: string;
          updated_at: string;
        }): ProductCardModel & { updated_at: string } => ({
          id: p.id,
          title: p.title,
          price: Number(p.price),
          category: p.category,
          custom_category: p.custom_category,
          condition: p.condition,
          urgent_sale: p.urgent_sale,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            avatar_url: (userProfile?.avatar_url as string | null) ?? seller.avatar_url,
            rating_avg: Number(seller.rating_avg || 0),
          },
          coverImageUrl: imageMap.get(p.id) ?? null,
          updated_at: p.updated_at,
        }),
      );
    },
  });

  const { data: completedRentals = [] } = useQuery({
    queryKey: ["seller_completed_rentals", seller?.user_id, userProfile?.id],
    queryFn: async () => {
      if (!seller) return { rows: [], images: [] };
      const { data, error } = await supabase
        .from("rental_listings" as unknown as keyof Database["public"]["Tables"])
        .select(
          "id,title,rent_price_per_day,category,custom_category,condition,status,seller_id,updated_at",
        )
        .eq("seller_id", seller.user_id)
        .eq("status", "rented_out")
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return { rows: [], images: [] };

      const { data: images } = await supabase
        .from("rental_images" as unknown as keyof Database["public"]["Tables"])
        .select("rental_id,storage_path,sort_index")
        .in("rental_id", ids);

      return {
        rows,
        images: images ?? [],
      };
    },
    enabled: Boolean(seller?.user_id && userProfile),
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { rental_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.rental_id)) {
          imageMap.set(
            row.rental_id,
            row.storage_path,
          );
        }
      }

      return data.rows.map(
        (r: {
          id: string;
          title: string;
          rent_price_per_day: number;
          category: string;
          custom_category: string | null;
          condition: string;
          seller_id: string;
          updated_at: string;
        }): RentalCardModel & { updated_at: string } => ({
          id: r.id,
          title: r.title,
          rent_price_per_day: Number(r.rent_price_per_day),
          category: r.category,
          custom_category: r.custom_category,
          condition: r.condition,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            avatar_url: (userProfile?.avatar_url as string | null) ?? seller.avatar_url,
            rating_avg: Number(seller.rating_avg || 0),
          },
          coverImageUrl: imageMap.get(r.id) ?? null,
          updated_at: r.updated_at,
        }),
      );
    },
  });

  const { data: completedNotes = [] } = useQuery({
    queryKey: ["seller_completed_notes", seller?.user_id, userProfile?.id],
    queryFn: async () => {
      if (!seller) return { rows: [], images: [] };
      const { data, error } = await supabase
        .from("notes_listings" as unknown as keyof Database["public"]["Tables"])
        .select(
          "id,title,daily_rental_price,category,condition,is_digital,is_free,status,seller_id,updated_at",
        )
        .eq("seller_id", seller.user_id)
        .in("status", ["rented_out", "unavailable"])
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return { rows: [], images: [] };

      const { data: images } = await supabase
        .from("notes_assets" as unknown as keyof Database["public"]["Tables"])
        .select("listing_id,storage_path,sort_index")
        .eq("kind", "image")
        .in("listing_id", ids);

      return {
        rows,
        images: images ?? [],
      };
    },
    enabled: Boolean(seller?.user_id && userProfile),
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { listing_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.listing_id)) {
          imageMap.set(
            row.listing_id,
            row.storage_path,
          );
        }
      }

      return data.rows.map(
        (p: {
          id: string;
          title: string;
          daily_rental_price: number;
          category: string;
          custom_category: string | null;
          condition: string;
          is_digital: boolean;
          is_free: boolean;
          seller_id: string;
          updated_at: string;
          status: string;
        }): ProductCardModel & { updated_at: string; status: string } => ({
          id: p.id,
          title: p.title,
          price: Number(p.daily_rental_price),
          category: p.category,
          custom_category: p.custom_category,
          condition: p.condition,
          urgent_sale: false,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            avatar_url: (userProfile?.avatar_url as string | null) ?? seller.avatar_url,
            rating_avg: Number(seller.rating_avg || 0),
          },
          coverImageUrl: imageMap.get(p.id) ?? null,
          updated_at: p.updated_at,
          status: p.status,
        }),
      );
    },
  });

  const { data: completedFood = [] } = useQuery({
    queryKey: ["seller_completed_food", seller?.user_id, userProfile?.id],
    queryFn: async () => {
      if (!seller) return { rows: [], images: [] };
      const { data, error } = await supabase
        .from("food_listings" as unknown as keyof Database["public"]["Tables"])
        .select(
          "id,product_name,brand_name,category,quantity,price,expiry_date,status,seller_id,updated_at",
        )
        .eq("seller_id", seller.user_id)
        .eq("status", "sold")
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return { rows: [], images: [] };

      const { data: images } = await supabase
        .from("food_images" as unknown as keyof Database["public"]["Tables"])
        .select("food_listing_id,storage_path,sort_index")
        .in("food_listing_id", ids);

      return {
        rows,
        images: images ?? [],
      };
    },
    enabled: Boolean(seller?.user_id && userProfile),
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { food_listing_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.food_listing_id)) {
          imageMap.set(
            row.food_listing_id,
            row.storage_path,
          );
        }
      }

      return data.rows.map(
        (p: {
          id: string;
          product_name: string;
          brand_name: string;
          category: string;
          quantity: string;
          price: number;
          expiry_date: string;
          seller_id: string;
          updated_at: string;
        }): ProductCardModel & { updated_at: string } => ({
          id: p.id,
          title: p.product_name,
          price: Number(p.price),
          category: p.category,
          custom_category: null,
          condition: "New",
          urgent_sale: false,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            avatar_url: (userProfile?.avatar_url as string | null) ?? seller.avatar_url,
            rating_avg: Number(seller.rating_avg || 0),
          },
          coverImageUrl: imageMap.get(p.id) ?? null,
          updated_at: p.updated_at,
        }),
      );
    },
  });

  const { data: sellerMetrics } = useQuery({
    queryKey: ["seller_metrics", seller?.user_id],
    queryFn: async () => {
      if (!seller) return null;

      const [productSales, notesSales, foodSales, rentalCompletions] = await Promise.all([
        supabase
          .from("product_listings" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("seller_id", seller.user_id)
          .eq("status", "sold"),
        supabase
          .from("notes_listings" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("seller_id", seller.user_id)
          .in("status", ["rented_out", "unavailable"]),
        supabase
          .from("food_listings" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("seller_id", seller.user_id)
          .eq("status", "sold"),
        supabase
  .from("rental_requests" as unknown as keyof Database["public"]["Tables"])
  .select("id")
  .eq("seller_id", seller.user_id)
  .eq("status", "completed"),
      ]);

      const totalSales =
        (productSales.data?.length ?? 0) +
        (notesSales.data?.length ?? 0) +
        (foodSales.data?.length ?? 0);
      const rentalsCompleted = rentalCompletions.data?.length ?? 0;

      return {
        totalSales,
        rentalsCompleted,
      };
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: sellerReviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: ["seller_reviews", seller?.user_id],
    queryFn: async () => {
      if (!seller) return [];
      const { data, error } = await supabase
        .from("conversation_ratings" as unknown as keyof Database["public"]["Tables"])
        .select(`
          rating,
          review,
          created_at,
          rater_id,
          conversations!inner(
            seller_id
          )
        `)
        .eq("conversations.seller_id", seller.user_id)
        .not("review", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Get reviewer names from profiles
      const reviews = data ?? [];
      const reviewerIds = reviews.map((r: any) => r.rater_id).filter((id: string) => id);
      
      let reviewerNames: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", reviewerIds);
        
        if (profiles) {
          reviewerNames = profiles.reduce((acc: Record<string, string>, p: any) => {
            acc[p.id] = p.full_name || "Anonymous";
            return acc;
          }, {});
        }
      }
      
      return reviews.map((r: any) => ({
        rating: r.rating,
        review: r.review,
        created_at: r.created_at,
        reviewerName: reviewerNames[r.rater_id] || "Anonymous",
      }));
    },
    enabled: Boolean(seller?.user_id),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: existingConversation } = useQuery({
    queryKey: ["conversation_with_seller", user?.id, seller?.user_id],
    queryFn: async () => {
      if (!user || !seller) return null;
      const { data } = await supabase
        .from("conversations" as unknown as keyof Database["public"]["Tables"])
        .select("id")
        .eq("buyer_id", user.id)
        .eq("seller_id", seller.user_id)
        .maybeSingle();
      return data as { id: string } | null;
    },
    enabled: Boolean(user?.id && seller?.user_id),
  });

  const { data: hasAcceptedTransaction } = useQuery({
    queryKey: ["accepted_transaction_with_seller", user?.id, seller?.user_id],
    queryFn: async () => {
      if (!user || !seller) return false;

      const [productRequests, rentalRequests, notesPurchases, foodOrders] = await Promise.all([
        supabase
          .from("product_requests" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
        supabase
          .from("rental_requests" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
        supabase
          .from("notes_purchase_requests" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
        supabase
          .from("food_orders" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
      ]);

      return (
        (productRequests.data?.length ?? 0) > 0 ||
        (rentalRequests.data?.length ?? 0) > 0 ||
        (notesPurchases.data?.length ?? 0) > 0 ||
        (foodOrders.data?.length ?? 0) > 0
      );
    },
    enabled: Boolean(user?.id && seller?.user_id),
  });

  const memberSince = seller?.joined_at
    ? new Date(seller.joined_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";

  const handleMessageSeller = () => {
    if (!user) {
      toast.error("Please login to message seller.");
      return;
    }

    if (existingConversation) {
      navigate({ to: "/chats/$id", params: { id: existingConversation.id } });
      return;
    }

    toast.error("Chat unlocks after the seller accepts your request.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
              Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !seller ? (
          <div className="py-20 text-center">
            <h1 className="text-2xl font-bold">Seller not found</h1>
            <Button asChild className="mt-6">
              <Link to="/">Back home</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden border-0 shadow-md">
              <div className="h-28 bg-gradient-to-r from-primary via-orange-500 to-amber-400 sm:h-36" />
              <CardContent className="relative px-4 pb-6 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="relative -mt-12">
                      <Avatar className="h-24 w-24 border-4 border-card shadow-lg sm:h-28 sm:w-28">
                        {(userProfile?.avatar_url ?? seller.avatar_url) && (
                          <AvatarImage
                            src={`${userProfile?.avatar_url ?? seller.avatar_url}${
                              ((userProfile?.avatar_url ?? seller.avatar_url) as string).includes(
                                "?",
                              )
                                ? "&"
                                : "?"
                            }t=${Date.now()}`}
                            alt={seller.display_name}
                          />
                        )}
                        <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                          {seller.display_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                    </div>
                    <div className="pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold">{seller.display_name}</h1>
                        <BadgeCheck className="h-5 w-5 text-sky-600" />
                      </div>
                      {seller.bio && (
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{seller.bio}</p>
                      )}
                      {userProfile?.hostel_block && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {userProfile.hostel_type} - {userProfile.hostel_block}
                        </p>
                      )}
                      {userProfile?.room_number && (
                        <p className="text-sm text-muted-foreground">
                          Room {userProfile.room_number}
                        </p>
                      )}
                      {userProfile?.phone_number && (
                        <p className="text-sm text-muted-foreground">{userProfile.phone_number}</p>
                      )}
                      {userProfile?.email && (
                        <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <strong>
                            {(seller.rating_avg ?? 0).toFixed(1)}
                          </strong>
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          {sellerMetrics?.totalSales ?? 0} sold
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Home className="h-4 w-4" />
                          {sellerMetrics?.rentalsCompleted ?? 0} rentals
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-4 w-4" />
                          Fast responder
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Member since {memberSince}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleMessageSeller}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message Seller
                    </Button>
                    {user?.id === seller.user_id && (
                      <Button variant="outline" asChild>
                        <Link to="/seller-profile">Edit Profile</Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(window.location.href);
                        toast.success("Profile link copied");
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share Profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Seller performance</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Total sales", sellerMetrics?.totalSales ?? 0],
                    ["Active listings", products.length],
                    ["Rentals completed", sellerMetrics?.rentalsCompleted ?? 0],
                    ["Reviews received", seller.rating_count],
                    [
                      "Average rating",
                      `${(seller.rating_avg ?? 0).toFixed(1)} / 5`,
                    ],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="font-semibold">{value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Seller badges</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[
                    {
                      title: "Top Seller",
                      sub: "High Performer",
                      color: "bg-amber-100 text-amber-800",
                    },
                    {
                      title: "Trusted Seller",
                      sub: "Verified & Reliable",
                      color: "bg-sky-100 text-sky-800",
                    },
                    {
                      title: "Fast Responder",
                      sub: "Quick Replies",
                      color: "bg-emerald-100 text-emerald-800",
                    },
                    {
                      title: sellerMetrics?.totalSales && sellerMetrics.totalSales >= 50 ? "50+ Sales" : "Rising Seller",
                      sub: "CampusBazaar member",
                      color: "bg-violet-100 text-violet-800",
                    },
                  ].map((b) => (
                    <div key={b.title} className={`rounded-xl p-3 ${b.color}`}>
                      <div className="text-sm font-semibold">{b.title}</div>
                      <div className="text-xs opacity-80">{b.sub}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
                <TabsTrigger value="rentals">Rentals ({rentals.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
                <TabsTrigger value="reviews">
                  Reviews ({seller.rating_count})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed (
                  {soldProducts.length +
                    completedRentals.length +
                    completedNotes.length +
                    completedFood.length}
                  )
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="mt-4">
                {loadingProducts ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : products.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {products.map((p: any) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No active products listed yet.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="rentals" className="mt-4">
                {loadingRentals ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : rentals.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {rentals.map((r: RentalCardModel) => (
                      <RentalCard key={r.id} rental={r} />
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No active rentals listed yet.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                {loadingNotes ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : notes.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {notes.map((n: any) => (
                      <Link key={n.id} to="/notes/$id" params={{ id: n.id }}>
                        <Card className="overflow-hidden transition-shadow hover:shadow-md">
                          <div className="aspect-square bg-muted">
                            {n.coverImageUrl ? (
                              <img
                                src={n.coverImageUrl}
                                alt={n.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-semibold">{n.title}</div>
                                <Badge className={n.listing_type === "rent" ? "bg-blue-500 text-white text-xs" : "text-xs"}>
                                  {n.listing_type === "rent" ? "For Rent" : "For Sale"}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">{n.category}</div>
                              {n.listing_type === "rent" && n.daily_rental_price ? (
                                <div className="text-sm font-semibold text-primary">
                                  {formatInr(Number(n.daily_rental_price))} / day
                                </div>
                              ) : n.is_free ? (
                                <div className="text-sm font-semibold text-primary">Free</div>
                              ) : (
                                <div className="text-sm font-semibold text-primary">Paid</div>
                              )}
                              {n.listing_type === "rent" && n.rental_duration_days && (
                                <div className="text-xs text-muted-foreground">
                                  Max {n.rental_duration_days} days
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No active notes listed yet.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <div className="space-y-6">
                  <Card>
                    <CardContent className="py-8">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="text-4xl font-bold">
                          {(seller.rating_avg ?? 0).toFixed(1)}
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`h-5 w-5 ${
                                i <=
                                Math.round(seller.rating_avg ?? 0)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {seller.rating_count} reviews
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {isLoadingReviews ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                                <div className="flex gap-1 mt-2">
                                  {[1, 2, 3, 4, 5].map((j) => (
                                    <div key={j} className="h-4 w-4 bg-muted animate-pulse rounded" />
                                  ))}
                                </div>
                                <div className="space-y-1 mt-3">
                                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                                  <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : sellerReviews.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                          {sellerReviews.length} Review{sellerReviews.length !== 1 ? "s" : ""}
                        </h3>
                      </div>
                      {sellerReviews.map((review: any) => {
                        const isExpanded = expandedReviews.has(review.created_at);
                        const reviewLines = review.review.split("\n").length;
                        const shouldTruncate = reviewLines > 4 && !isExpanded;
                        
                        return (
                          <Card 
                            key={review.created_at}
                            className="transition-shadow hover:shadow-md"
                          >
                            <CardContent className="p-6">
                              <div className="flex items-start gap-4">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                    {review.reviewerName.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold">{review.reviewerName}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {formatRelativeTime(review.created_at)}
                                      </p>
                                    </div>
                                    <div className="flex gap-0.5 flex-shrink-0">
                                      {[1, 2, 3, 4, 5].map((i) => (
                                        <Star
                                          key={i}
                                          className={`h-4 w-4 ${
                                            i <= review.rating
                                              ? "fill-amber-400 text-amber-400"
                                              : "text-muted-foreground"
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <p 
                                      className={`text-sm leading-relaxed ${
                                        shouldTruncate 
                                          ? "line-clamp-4" 
                                          : ""
                                      }`}
                                    >
                                      {review.review}
                                    </p>
                                    {reviewLines > 4 && (
                                      <button
                                        onClick={() => {
                                          const newExpanded = new Set(expandedReviews);
                                          if (isExpanded) {
                                            newExpanded.delete(review.created_at);
                                          } else {
                                            newExpanded.add(review.created_at);
                                          }
                                          setExpandedReviews(newExpanded);
                                        }}
                                        className="text-xs text-primary hover:underline mt-2"
                                      >
                                        {isExpanded ? "Show less" : "Read more"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Star className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">No reviews yet</p>
                          <p className="text-sm text-muted-foreground">
                            This seller has not received any written reviews yet.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-4">
                <div className="space-y-6">
                  {soldProducts.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Products</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {soldProducts.map((p) => (
                          <div key={p.id} className="relative">
                            <Link to="/product/$id" params={{ id: p.id }}>
                              <div className="opacity-75 transition-opacity hover:opacity-100">
                                <ProductCard product={p} />
                              </div>
                            </Link>
                            <div className="absolute left-2 top-2 z-30">
                              <Badge variant="secondary" className="text-[10px]">
                                Completed
                              </Badge>
                            </div>
                            <div className="absolute bottom-2 right-2 z-30 text-[10px] text-muted-foreground">
                              {new Date(p.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {completedRentals.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Rentals</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {completedRentals.map((r) => (
                          <div key={r.id} className="relative">
                            <Link to="/rent/$id" params={{ id: r.id }}>
                              <div className="opacity-75 transition-opacity hover:opacity-100">
                                <RentalCard rental={r} />
                              </div>
                            </Link>
                            <div className="absolute left-2 top-2 z-30">
                              <Badge variant="secondary" className="text-[10px]">
                                {r.status === 'rented_out' ? 'Rented Out' : 'Unavailable'}
                              </Badge>
                            </div>
                            <div className="absolute bottom-2 right-2 z-30 text-[10px] text-muted-foreground">
                              {new Date(r.updated_at).toLocaleDateString()}
                            </div>
                            {user?.id === seller.user_id && r.status === 'rented_out' && (
                              <div className="absolute bottom-2 left-2 z-30 flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2 bg-background"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void supabase
                                      .from("rental_listings")
                                      .update({ status: "available" })
                                      .eq("id", r.id)
                                      .then(({ error }) => {
                                        if (error) {
                                          toast.error("Failed to make available");
                                        } else {
                                          toast.success("Made available again");
                                          void queryClient.invalidateQueries({ queryKey: ["seller_completed_rentals"] });
                                          void queryClient.invalidateQueries({ queryKey: ["rentals"] });
                                        }
                                      });
                                  }}
                                >
                                  Make Available
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2 bg-background"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void supabase
                                      .from("rental_listings")
                                      .update({ status: "unavailable" })
                                      .eq("id", r.id)
                                      .then(({ error }) => {
                                        if (error) {
                                          toast.error("Failed to mark unavailable");
                                        } else {
                                          toast.success("Marked as unavailable");
                                          void queryClient.invalidateQueries({ queryKey: ["seller_completed_rentals"] });
                                        }
                                      });
                                  }}
                                >
                                  Mark Unavailable
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {completedNotes.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Notes</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {completedNotes.map((n) => (
                          <div key={n.id} className="relative">
                            <Link to="/notes/$id" params={{ id: n.id }}>
                              <div className="opacity-75 transition-opacity hover:opacity-100">
                                <ProductCard product={n} />
                              </div>
                            </Link>
                            <div className="absolute left-2 top-2 z-30">
                              <Badge variant="secondary" className="text-[10px]">
                                {n.status === 'rented_out' ? 'Rented Out' : n.status === 'unavailable' ? 'Unavailable' : 'Completed'}
                              </Badge>
                            </div>
                            <div className="absolute bottom-2 right-2 z-30 text-[10px] text-muted-foreground">
                              {new Date(n.updated_at).toLocaleDateString()}
                            </div>
                            {user?.id === seller.user_id && n.status === 'rented_out' && (
                              <div className="absolute bottom-2 left-2 z-30 flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2 bg-background"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void supabase
                                      .from("notes_listings")
                                      .update({ status: "available" })
                                      .eq("id", n.id)
                                      .then(({ error }) => {
                                        if (error) {
                                          toast.error("Failed to make available");
                                        } else {
                                          toast.success("Made available again");
                                          void queryClient.invalidateQueries({ queryKey: ["seller_completed_notes"] });
                                          void queryClient.invalidateQueries({ queryKey: ["notes", "listings"] });
                                        }
                                      });
                                  }}
                                >
                                  Make Available
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2 bg-background"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void supabase
                                      .from("notes_listings")
                                      .update({ status: "unavailable" })
                                      .eq("id", n.id)
                                      .then(({ error }) => {
                                        if (error) {
                                          toast.error("Failed to mark unavailable");
                                        } else {
                                          toast.success("Marked as unavailable");
                                          void queryClient.invalidateQueries({ queryKey: ["seller_completed_notes"] });
                                        }
                                      });
                                  }}
                                >
                                  Mark Unavailable
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {completedFood.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Food</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {completedFood.map((f) => (
                          <div key={f.id} className="relative">
                            <Link to="/food/$id" params={{ id: f.id }}>
                              <div className="opacity-75 transition-opacity hover:opacity-100">
                                <ProductCard product={f} />
                              </div>
                            </Link>
                            <div className="absolute left-2 top-2 z-30">
                              <Badge variant="secondary" className="text-[10px]">
                                Completed
                              </Badge>
                            </div>
                            <div className="absolute bottom-2 right-2 z-30 text-[10px] text-muted-foreground">
                              {new Date(f.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {soldProducts.length === 0 &&
                    completedRentals.length === 0 &&
                    completedNotes.length === 0 &&
                    completedFood.length === 0 && (
                      <Card className="border-dashed">
                        <CardContent className="py-12 text-center text-sm text-muted-foreground">
                          No completed items yet.
                        </CardContent>
                      </Card>
                    )}
                </div>
              </TabsContent>
            </Tabs>

            {soldProducts.length > 0 && tab === "products" && (
              <p className="text-right text-sm text-primary">
                {soldProducts.length}+ items sold on CampusBazar
              </p>
            )}

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <BadgeCheck className="h-4 w-4" />
                    Student verified
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <BadgeCheck className="h-4 w-4" />
                    Campus member
                  </span>
                </div>
                <ReportListingDialog
                  itemType="seller"
                  itemId={seller.user_id}
                  disabled={user?.id === seller.user_id}
                />
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              CampusBazar connects students on campus. Always meet in safe public places and verify
              items before paying.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
