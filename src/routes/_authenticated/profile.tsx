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

  type QuickLink = { label: string; icon: any; to?: string; count?: number | null };
  const quickLinks: QuickLink[] = [
    { label: "Wishlist", icon: Heart, to: "/wishlist", count: wishlistCount },
    { label: "My Orders", icon: ShoppingBag, to: "/requests", count: null },
    { label: "My Chats", icon: MessageSquare, to: "/chats", count: unreadChats },
    { label: "Notifications", icon: Bell, to: "/notifications", count: unreadNotifications },
    { label: "Settings", icon: Settings, to: "/notification-settings", count: null },
  ];

  const stats = [
    { label: "Active listings", value: productCount, icon: Package },
    { label: "Wishlist items", value: wishlistCount, icon: Heart },
    {
      label: "Seller rating",
      value: sellerProfile ? Number(sellerProfile.rating_avg).toFixed(1) : "—",
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
    </div>
  );
}
