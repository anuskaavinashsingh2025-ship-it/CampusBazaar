import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HOSTEL_TYPES, LADIES_HOSTEL_BLOCKS, MENS_HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/seller-profile")({
  head: () => ({
    meta: [{ title: "Seller Profile — CampusBazar" }],
  }),
  component: SellerProfileEditPage,
});

function SellerProfileEditPage() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [hostelType, setHostelType] = useState("");
  const [hostelBlock, setHostelBlock] = useState("");
  const [otherHostelBlock, setOtherHostelBlock] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: seller, isLoading } = useQuery({
    queryKey: ["seller_profile_self", user?.id ?? null],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setHostelType(profile.hostel_type ?? "");
      setHostelBlock(profile.hostel_block ?? "");
      setOtherHostelBlock(profile.hostel_block === "Other" ? (profile.hostel_block ?? "") : "");
      setRoomNumber(profile.room_number ?? "");
      setPhoneNumber(profile.phone_number ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

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
      const { error: sellerError } = await supabase
        .from("seller_profiles")
        .update({ display_name: fullName.trim() })
        .eq("user_id", user.id);
      if (sellerError) throw sellerError;
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["seller_for_product"] });
      // Invalidate seller-related queries so storefronts and cards pick up the new avatar
      await queryClient.invalidateQueries({ queryKey: ["seller_profile_self", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["seller", profile?.id] });
      await queryClient.invalidateQueries({ queryKey: ["seller_products", user.id] });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seller profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your profile information shown to buyers on CampusBazar.
          </p>
        </div>
        {seller?.slug && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/seller/$slug" params={{ slug: seller.slug }}>
              <Store className="mr-2 h-4 w-4" />
              View storefront
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>
            Update your personal information. Changes will appear on your storefront and profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL (Optional)</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
