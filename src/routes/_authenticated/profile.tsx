import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Camera,
  Heart,
  Loader2,
  MessageSquare,
  Package,
  Pencil,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HOSTEL_TYPES, LADIES_HOSTEL_BLOCKS, MENS_HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { useUnreadChatCount } from "@/lib/chat";
import { useUnreadNotificationCount } from "@/lib/notifications";
import { fetchWishlist } from "@/lib/wishlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "My Profile — CampusBazar" }],
  }),
  component: UserProfilePage,
});

function formatMemberSince(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function UserProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [hostelType, setHostelType] = useState("");
  const [hostelBlock, setHostelBlock] = useState("");
  const [otherHostelBlock, setOtherHostelBlock] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setHostelType(profile.hostel_type ?? "");
      setHostelBlock(profile.hostel_block ?? "");
      setOtherHostelBlock(profile.hostel_block === "Other" ? (profile.hostel_block ?? "") : "");
      setRoomNumber(profile.room_number ?? "");
      setPhoneNumber(profile.phone_number ?? "");
      setEmail(profile.email ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller_profile_self", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("seller_profiles")
        .select("slug,display_name,rating_avg,rating_count,total_sold,total_rented_out")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const { data: wishlistCount = 0 } = useQuery({
    queryKey: ["wishlist_count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const rows = await fetchWishlist(user.id);
      return rows.length;
    },
    enabled: Boolean(user?.id),
  });

  const { data: productCount = 0 } = useQuery({
    queryKey: ["my_product_count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("product_listings" as never)
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "available");
      return count ?? 0;
    },
    enabled: Boolean(user?.id),
  });

  const { data: unreadChats = 0 } = useUnreadChatCount(user?.id);
  const { data: unreadNotifications = 0 } = useUnreadNotificationCount(user?.id);

  // Fetch Active Orders
  const { data: activeOrders = [], isLoading: loadingActiveOrders } = useQuery({
    queryKey: ["active_orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Fetch product requests (pending/accepted)
      const { data: productRequests } = await supabase
        .from("product_requests")
        .select(`
          id,
          status,
          created_at,
          product_id,
          buyer_id,
          seller_id,
          conversation_id,
          product_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["pending", "accepted"]);
      
      // Fetch product images
      const productIds = [...new Set((productRequests ?? []).map((r: any) => r.product_id))];
      const { data: productImages } = await supabase
        .from("product_images")
        .select("product_id, storage_path")
        .in("product_id", productIds);
      const productImageMap = new Map((productImages ?? []).map((img: any) => [img.product_id, img.storage_path]));
      
      // Fetch rental requests (pending/accepted/active_rental/return_requested)
      const { data: rentalRequests } = await supabase
        .from("rental_requests")
        .select(`
          id,
          status,
          created_at,
          rental_id,
          buyer_id,
          seller_id,
          conversation_id,
          rental_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["pending", "accepted", "active_rental", "return_requested"]);
      
      // Fetch rental images
      const rentalIds = [...new Set((rentalRequests ?? []).map((r: any) => r.rental_id))];
      const { data: rentalImages } = await supabase
        .from("rental_images")
        .select("rental_id, storage_path")
        .in("rental_id", rentalIds);
      const rentalImageMap = new Map((rentalImages ?? []).map((img: any) => [img.rental_id, img.storage_path]));
      
      // Fetch notes purchase requests (pending/accepted)
      const { data: notesPurchases } = await supabase
        .from("notes_purchases")
        .select(`
          id,
          status,
          created_at,
          notes_id,
          buyer_id,
          seller_id,
          conversation_id,
          notes_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["pending", "accepted"]);
      
      // Fetch notes rental requests (pending/accepted/active_rental/return_requested)
      const { data: notesRentals } = await supabase
        .from("notes_rentals")
        .select(`
          id,
          status,
          created_at,
          notes_id,
          buyer_id,
          seller_id,
          conversation_id,
          notes_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["pending", "accepted", "active_rental", "return_requested"]);
      
      // Fetch food orders (pending/accepted)
      const { data: foodOrders } = await supabase
        .from("food_orders")
        .select(`
          id,
          status,
          created_at,
          food_listing_id,
          buyer_id,
          seller_id,
          conversation_id,
          food_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["pending", "accepted"]);
      
      // Fetch counterparty names
      const userIds = new Set<string>();
      [...(productRequests ?? []), ...(rentalRequests ?? []), ...(notesPurchases ?? []), ...(notesRentals ?? []), ...(foodOrders ?? [])].forEach((req: any) => {
        userIds.add(req.buyer_id);
        userIds.add(req.seller_id);
      });
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      
      // Transform and combine all orders
      const orders = [
        ...(productRequests ?? []).map((r: any) => ({
          ...r,
          type: "product",
          title: r.product_listings.title,
          category: r.product_listings.category || r.product_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
          imageUrl: productImageMap.get(r.product_id),
        })),
        ...(rentalRequests ?? []).map((r: any) => ({
          ...r,
          type: "rental",
          title: r.rental_listings.title,
          category: r.rental_listings.category || r.rental_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
          imageUrl: rentalImageMap.get(r.rental_id),
        })),
        ...(notesPurchases ?? []).map((r: any) => ({
          ...r,
          type: "notes_purchase",
          title: r.notes_listings.title,
          category: r.notes_listings.category || r.notes_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
        })),
        ...(notesRentals ?? []).map((r: any) => ({
          ...r,
          type: "notes_rental",
          title: r.notes_listings.title,
          category: r.notes_listings.category || r.notes_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
        })),
        ...(foodOrders ?? []).map((r: any) => ({
          ...r,
          type: "food",
          title: r.food_listings.title,
          category: r.food_listings.category || r.food_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
        })),
      ];
      
      return orders.map((order: any) => ({
        ...order,
        counterpartyName: profileMap.get(order.counterpartyId) || "Unknown",
      })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: Boolean(user?.id),
  });

  // Fetch Order History (completed transactions)
  const { data: orderHistory = [], isLoading: loadingOrderHistory } = useQuery({
    queryKey: ["order_history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log("Fetching Order History for user:", user.id);
      
      // Fetch completed product requests
      const { data: productRequests } = await supabase
        .from("product_requests")
        .select(`
          id,
          status,
          created_at,
          updated_at,
          product_id,
          buyer_id,
          seller_id,
          conversation_id,
          product_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["completed", "sold"]);
      
      console.log("Product requests (completed/sold):", productRequests?.length || 0);
      
      // Fetch product images
      const productIds = [...new Set((productRequests ?? []).map((r: any) => r.product_id))];
      const { data: productImages } = await supabase
        .from("product_images")
        .select("product_id, storage_path")
        .in("product_id", productIds);
      const productImageMap = new Map((productImages ?? []).map((img: any) => [img.product_id, img.storage_path]));
      
      // Fetch completed rental requests
      const { data: rentalRequests } = await supabase
        .from("rental_requests")
        .select(`
          id,
          status,
          created_at,
          updated_at,
          rental_id,
          buyer_id,
          seller_id,
          conversation_id,
          rental_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["completed", "returned"]);
      
      console.log("Rental requests (completed/returned):", rentalRequests?.length || 0);
      
      // Fetch rental images
      const rentalImageIds = [...new Set((rentalRequests ?? []).map((r: any) => r.rental_id))];
      const { data: rentalImages } = await supabase
        .from("rental_images")
        .select("rental_id, storage_path")
        .in("rental_id", rentalImageIds);
      const rentalImageMap = new Map((rentalImages ?? []).map((img: any) => [img.rental_id, img.storage_path]));
      
      // Fetch completed notes purchase requests (FIXED: notes_purchase_requests not notes_purchases)
      const { data: notesPurchases } = await supabase
        .from("notes_purchase_requests")
        .select(`
          id,
          status,
          created_at,
          updated_at,
          notes_listing_id,
          buyer_id,
          seller_id,
          conversation_id,
          notes_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["completed"]);
      
      console.log("Notes purchase requests (completed):", notesPurchases?.length || 0);
      
      // Fetch completed notes rentals
      const { data: notesRentals } = await supabase
        .from("notes_rentals")
        .select(`
          id,
          status,
          created_at,
          updated_at,
          notes_listing_id,
          buyer_id,
          seller_id,
          conversation_id,
          notes_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["completed", "returned"]);
      
      console.log("Notes rentals (completed/returned):", notesRentals?.length || 0);
      
      // Fetch completed food orders
      const { data: foodOrders } = await supabase
        .from("food_orders")
        .select(`
          id,
          status,
          created_at,
          updated_at,
          food_listing_id,
          buyer_id,
          seller_id,
          conversation_id,
          food_listings!inner(title, category, custom_category)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["completed", "sold", "fulfilled"]);
      
      console.log("Food orders (completed/sold/fulfilled):", foodOrders?.length || 0);
      
      // Fetch counterparty names
      const userIds = new Set<string>();
      [...(productRequests ?? []), ...(rentalRequests ?? []), ...(notesPurchases ?? []), ...(notesRentals ?? []), ...(foodOrders ?? [])].forEach((req: any) => {
        userIds.add(req.buyer_id);
        userIds.add(req.seller_id);
      });
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      
      // Fetch rating information for all conversations
      const allConversationIds = [
        ...(productRequests ?? []).map((r: any) => r.conversation_id),
        ...(rentalRequests ?? []).map((r: any) => r.conversation_id),
        ...(notesPurchases ?? []).map((r: any) => r.conversation_id),
        ...(notesRentals ?? []).map((r: any) => r.conversation_id),
        ...(foodOrders ?? []).map((r: any) => r.conversation_id),
      ].filter(Boolean);
      
      const { data: ratings } = await supabase
        .from("conversation_ratings")
        .select("conversation_id, rating, review")
        .in("conversation_id", allConversationIds);
      
      const ratingMap = new Map((ratings ?? []).map((r: any) => [r.conversation_id, { rating: r.rating, review: r.review }]));
      
      // Fetch rental duration and returned date for rentals
      const rentalIds = [...new Set((rentalRequests ?? []).map((r: any) => r.rental_id))];
      const { data: rentalDetails } = await supabase
        .from("rental_listings")
        .select("id, rental_duration")
        .in("id", rentalIds);
      const rentalDurationMap = new Map((rentalDetails ?? []).map((r: any) => [r.id, r.rental_duration]));
      
      // Transform and combine all orders
      const orders = [
        ...(productRequests ?? []).map((r: any) => ({
          ...r,
          type: "product",
          title: r.product_listings.title,
          category: r.product_listings.category || r.product_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
          imageUrl: productImageMap.get(r.product_id),
          completionDate: r.updated_at,
          rating: ratingMap.get(r.conversation_id),
        })),
        ...(rentalRequests ?? []).map((r: any) => ({
          ...r,
          type: "rental",
          title: r.rental_listings.title,
          category: r.rental_listings.category || r.rental_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
          imageUrl: rentalImageMap.get(r.rental_id),
          completionDate: r.updated_at,
          rating: ratingMap.get(r.conversation_id),
          rentalDuration: rentalDurationMap.get(r.rental_id),
        })),
        ...(notesPurchases ?? []).map((r: any) => ({
          ...r,
          type: "notes_purchase",
          title: r.notes_listings.title,
          category: r.notes_listings.category || r.notes_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
          completionDate: r.updated_at,
          rating: ratingMap.get(r.conversation_id),
        })),
        ...(notesRentals ?? []).map((r: any) => ({
          ...r,
          type: "notes_rental",
          title: r.notes_listings.title,
          category: r.notes_listings.category || r.notes_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
          completionDate: r.updated_at,
          rating: ratingMap.get(r.conversation_id),
        })),
        ...(foodOrders ?? []).map((r: any) => ({
          ...r,
          type: "food",
          title: r.food_listings.title,
          category: r.food_listings.category || r.food_listings.custom_category,
          counterpartyId: r.buyer_id === user.id ? r.seller_id : r.buyer_id,
          completionDate: r.updated_at,
          rating: ratingMap.get(r.conversation_id),
        })),
      ];
      
      console.log("Total merged orders before sorting:", orders.length);
      
      const finalOrders = orders.map((order: any) => ({
        ...order,
        counterpartyName: profileMap.get(order.counterpartyId) || "Unknown",
      })).sort((a: any, b: any) => new Date(b.completionDate || b.created_at).getTime() - new Date(a.completionDate || a.created_at).getTime());
      
      console.log("Final order history count:", finalOrders.length);
      
      return finalOrders;
    },
    enabled: Boolean(user?.id),
  });

  const initials = useMemo(() => {
    const name = profile?.full_name ?? user?.email ?? "U";
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile?.full_name, user?.email]);

  const handlePhotoUpload = async (file: File) => {
  if (!user) return;
  setUploadingPhoto(true);
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'campusbazaar');
    formData.append('folder', 'avatars');

    const res = await fetch(
      'https://api.cloudinary.com/v1_1/dchs7jfzv/image/upload',
      { method: 'POST', body: formData }
    );
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    const url = data.secure_url as string;

    setAvatarUrl(url);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);
    if (error) throw error;
    await refreshProfile();
    toast.success("Profile photo updated");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not upload photo");
  } finally {
    setUploadingPhoto(false);
  }
};

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const finalHostelBlock = hostelBlock === "Other" ? otherHostelBlock : hostelBlock;
      const payload = {
        full_name: fullName.trim(),
        hostel_type: hostelType,
        hostel_block: finalHostelBlock,
        room_number: roomNumber.trim() || null,
        phone_number: phoneNumber.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      };
      const { error } = profile
        ? await supabase.from("profiles").update(payload).eq("id", user.id)
        : await supabase.from("profiles").insert({
            id: user.id,
            email: user.email ?? "",
            ...payload,
            is_profile_complete: true,
          });
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile saved");
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  type QuickLink = { label: string; icon: any; to?: string; count?: number | null; action?: () => void };
  const quickLinks: QuickLink[] = [
    { label: "Wishlist", icon: Heart, to: "/wishlist", count: wishlistCount },
    { label: "My Orders", icon: ShoppingBag, action: () => setOrdersOpen(true), count: null },
    { label: "My Chats", icon: MessageSquare, to: "/chats", count: unreadChats },
    { label: "Notifications", icon: Bell, to: "/notifications", count: unreadNotifications },
    { label: "Settings", icon: Settings, to: "/notification-settings", count: null },
  ];

  const stats = [
    { label: "Active listings", value: productCount, icon: Package },
    { label: "Wishlist items", value: wishlistCount, icon: Heart },
    {
      label: "Seller rating",
      value: sellerProfile ? (sellerProfile.rating_avg ?? 0).toFixed(1) : "—",
      icon: Star,
    },
    { label: "Items sold", value: sellerProfile?.total_sold ?? 0, icon: Store },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="overflow-hidden border-0 shadow-md">
        <div className="relative h-32 bg-gradient-to-r from-primary via-orange-500 to-amber-400 sm:h-40" />
        <CardContent className="relative px-4 pb-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative -mt-12 sm:-mt-14">
                <Avatar className="h-24 w-24 border-4 border-card shadow-lg sm:h-28 sm:w-28">
                  {avatarUrl ? (
                    <AvatarImage
                      src={`${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}t=${Date.now()}`}
                      alt={fullName}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow"
                  aria-label="Change profile photo"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhotoUpload(file);
                  }}
                />
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold sm:text-2xl">
                    {profile?.full_name ?? "Student"}
                  </h1>
                  {profile?.is_profile_complete && (
                    <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-500">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.hostel_block && (
                  <p className="text-sm text-muted-foreground">
                    {profile.hostel_type} - {profile.hostel_block}
                  </p>
                )}
                {profile?.room_number && (
                  <p className="text-sm text-muted-foreground">Room {profile.room_number}</p>
                )}
                {profile?.phone_number && (
                  <p className="text-sm text-muted-foreground">{profile.phone_number}</p>
                )}
              </div>
            </div>
            <Button variant="secondary" className="shrink-0" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 border-t pt-4 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Member since </span>
              <span className="font-medium">{formatMemberSince(profile?.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Verified student </span>
              <span className="font-medium">VIT Campus</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Active on CampusBazar</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Your dashboard</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickLinks.map((link) => (
            <div key={link.label}>
              {link.to ? (
                <Link
                  to={link.to}
                  className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors hover:bg-muted/50"
                >
                  <link.icon className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{link.label}</span>
                  {link.count != null && link.count > 0 && (
                    <Badge variant="secondary">{link.count}</Badge>
                  )}
                </Link>
              ) : link.action ? (
                <button
                  onClick={link.action}
                  className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors hover:bg-muted/50"
                >
                  <link.icon className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{link.label}</span>
                  {link.count != null && link.count > 0 && (
                    <Badge variant="secondary">{link.count}</Badge>
                  )}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-center opacity-60">
                  <link.icon className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium">{link.label}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">Soon</span>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/seller-profile">
            <Store className="mr-2 h-4 w-4" />
            My Seller Profile
          </Link>
        </Button>
        {sellerProfile?.slug && (
          <Button variant="outline" asChild>
            <Link to="/seller/$slug" params={{ slug: sellerProfile.slug }}>
              View public storefront
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/upload-product">Sell an item</Link>
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Your private account details. Hostel block is never shown on your public seller
              profile.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.email ?? user.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hostelType">Hostel Type</Label>
              <select
                id="hostelType"
                value={hostelType}
                onChange={(e) => {
                  setHostelType(e.target.value);
                  setHostelBlock("");
                }}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Select hostel type
                </option>
                {HOSTEL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {hostelType && (
              <div className="space-y-2">
                <Label htmlFor="hostelBlock">Hostel Block</Label>
                <select
                  id="hostelBlock"
                  value={hostelBlock}
                  onChange={(e) => setHostelBlock(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Select your block
                  </option>
                  {(hostelType === "Ladies Hostel" ? LADIES_HOSTEL_BLOCKS : MENS_HOSTEL_BLOCKS).map(
                    (block) => (
                      <option key={block} value={block}>
                        {block}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}
            {hostelBlock === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="otherHostelBlock">Other Hostel Block</Label>
                <Input
                  id="otherHostelBlock"
                  value={otherHostelBlock}
                  onChange={(e) => setOtherHostelBlock(e.target.value)}
                  required
                  placeholder="Enter your hostel block"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="roomNumber">Room Number (Optional)</Label>
              <Input
                id="roomNumber"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g., 101"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 9876543210"
                pattern="[0-9]{10}"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={ordersOpen} onOpenChange={setOrdersOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>My Orders</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active Orders</TabsTrigger>
              <TabsTrigger value="history">Order History</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
              {loadingActiveOrders ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeOrders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No active orders
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {activeOrders.map((order: any) => (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex gap-4 p-4">
                          {/* Listing image thumbnail */}
                          <div className="h-20 w-20 shrink-0 rounded-lg bg-muted overflow-hidden">
                            {order.imageUrl ? (
                              <img
                                src={order.imageUrl}
                                alt={order.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Top Row: Title and category */}
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold truncate">{order.title}</h3>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {order.category}
                              </Badge>
                            </div>
                            {/* Middle Row: Counterparty and date */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="truncate">{order.counterpartyName}</span>
                              <span className="shrink-0">{new Date(order.created_at).toLocaleDateString()}</span>
                            </div>
                            {/* Bottom Row: Status and buttons */}
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  order.status === "pending"
                                    ? "bg-yellow-500 hover:bg-yellow-600"
                                    : order.status === "accepted"
                                      ? "bg-green-500 hover:bg-green-600"
                                      : order.status === "active_rental"
                                        ? "bg-blue-500 hover:bg-blue-600"
                                        : order.status === "return_requested"
                                          ? "bg-orange-500 hover:bg-orange-600"
                                          : "bg-gray-500 hover:bg-gray-600"
                                }
                              >
                                {order.status === "active_rental" ? "Active" : order.status.replace(/_/g, " ")}
                              </Badge>
                              {order.conversation_id && (
                                <Button size="sm" variant="outline" asChild>
                                  <Link to="/chats/$id" params={{ id: order.conversation_id }}>
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    Chat
                                  </Link>
                                </Button>
                              )}
                              <Button size="sm" variant="ghost">
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              {loadingOrderHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No order history
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {orderHistory.map((order: any) => (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex gap-4 p-4">
                          {/* Listing image thumbnail */}
                          <div className="h-20 w-20 shrink-0 rounded-lg bg-muted overflow-hidden">
                            {order.imageUrl ? (
                              <img
                                src={order.imageUrl}
                                alt={order.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Top Row: Title, category, and type badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold truncate">{order.title}</h3>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {order.category}
                              </Badge>
                              {order.type === "notes_purchase" && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Purchase
                                </Badge>
                              )}
                              {order.type === "notes_rental" && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Rental
                                </Badge>
                              )}
                              {order.type === "food" && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Delivered
                                </Badge>
                              )}
                            </div>
                            {/* Middle Row: Counterparty link and completion date */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <Link
                                to="/seller/$slug"
                                params={{ slug: order.counterpartyId }}
                                className="truncate hover:text-foreground hover:underline"
                              >
                                {order.counterpartyName}
                              </Link>
                              <span className="shrink-0 font-medium text-foreground">
                                {order.type === "product" && order.status === "sold"
                                  ? `Sold: ${new Date(order.completionDate || order.created_at).toLocaleDateString()}`
                                  : order.type === "rental" && order.status === "returned"
                                    ? `Returned: ${new Date(order.completionDate || order.created_at).toLocaleDateString()}`
                                    : `Completed: ${new Date(order.completionDate || order.created_at).toLocaleDateString()}`}
                              </span>
                            </div>
                            {/* Rental duration for rentals */}
                            {order.type === "rental" && order.rentalDuration && (
                              <div className="text-sm text-muted-foreground mb-3">
                                Duration: {order.rentalDuration}
                              </div>
                            )}
                            {/* Rating and review */}
                            {order.rating && (
                              <div className="mb-3">
                                <div className="flex items-center gap-1 mb-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${i < order.rating.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                                    />
                                  ))}
                                  <span className="text-sm text-muted-foreground ml-1">{order.rating.rating}/5</span>
                                </div>
                                {order.rating.review && (
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {order.rating.review}
                                  </p>
                                )}
                              </div>
                            )}
                            {/* Bottom Row: Status, rating badge, and buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-gray-500 hover:bg-gray-600">
                                {order.status === "returned" ? "Returned" : order.status === "sold" ? "Sold" : order.status === "fulfilled" ? "Fulfilled" : "Completed"}
                              </Badge>
                              <Badge
                                variant={order.rating ? "default" : "outline"}
                                className={order.rating ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                              >
                                {order.rating ? "Rated" : "Not Rated Yet"}
                              </Badge>
                              {order.conversation_id && (
                                <Button size="sm" variant="outline" asChild>
                                  <Link to="/chats/$id" params={{ id: order.conversation_id }}>
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    Chat
                                  </Link>
                                </Button>
                              )}
                              <Button size="sm" variant="ghost">
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
