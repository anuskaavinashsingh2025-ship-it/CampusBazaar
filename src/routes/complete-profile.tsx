import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { bootstrapUserAccount } from "@/lib/supabase-account";
import { HOSTEL_TYPES, LADIES_HOSTEL_BLOCKS, MENS_HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

export const Route = createFileRoute("/complete-profile")({
  head: () => ({
    meta: [
      { title: "Complete your profile — CampusBazar" },
      { name: "description", content: "Finish setting up your CampusBazar profile." },
    ],
  }),
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading, isProfileComplete, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [hostelType, setHostelType] = useState("");
  const [hostelBlock, setHostelBlock] = useState("");
  const [otherHostelBlock, setOtherHostelBlock] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
    } else if (isProfileComplete) {
      navigate({ to: "/" });
    }
  }, [loading, user, isProfileComplete, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setHostelType(profile.hostel_type ?? "");
      setHostelBlock(profile.hostel_block ?? "");
      setOtherHostelBlock(profile.hostel_block === "Other" ? (profile.hostel_block ?? "") : "");
      setRoomNumber(profile.room_number ?? "");
      setPhoneNumber(profile.phone_number ?? "");
    }
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      await bootstrapUserAccount(user);

      const finalHostelBlock = hostelBlock === "Other" ? otherHostelBlock : hostelBlock;
      const payload = {
        full_name: fullName.trim(),
        hostel_type: hostelType,
        hostel_block: finalHostelBlock,
        room_number: roomNumber.trim() || null,
        phone_number: phoneNumber.trim() || null,
        is_profile_complete: true,
      };
      const { error } = profile
        ? await supabase.from("profiles").update(payload).eq("id", user.id)
        : await supabase.from("profiles").insert({
            id: user.id,
            email: user.email ?? "",
            ...payload,
          });
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile completed!");
      navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filled = [fullName.trim(), hostelType, hostelBlock].filter(Boolean).length;
  const progress = (filled / 3) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center justify-center">
          <CampusBazarLogo size="xl" />
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Complete your profile</CardTitle>
              <CardDescription>
                Tell us a bit about yourself before you start buying and selling.
              </CardDescription>
            </div>
            <Progress value={progress} />
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
                  placeholder="Aditi Sharma"
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
                    {(hostelType === "Ladies Hostel"
                      ? LADIES_HOSTEL_BLOCKS
                      : MENS_HOSTEL_BLOCKS
                    ).map((block) => (
                      <option key={block} value={block}>
                        {block}
                      </option>
                    ))}
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
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save and continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
