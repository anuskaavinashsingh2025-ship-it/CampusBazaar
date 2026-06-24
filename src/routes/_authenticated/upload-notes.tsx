import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ensureSellerProfile } from "@/lib/supabase-account";
import { checkBanStatus, enforceBanCheck } from "@/lib/ban-enforcement";
import type { Database } from "@/integrations/supabase/types";
import { uploadToCloudinary } from '@/lib/cloudinary-upload';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

export const Route = createFileRoute("/_authenticated/upload-notes")({
  validateSearch: (search) => search as { type?: "sell" | "rent" },
  head: () => ({
    meta: [{ title: "Upload notes — CampusBazar" }],
  }),
  component: UploadNotesPage,
});

const SELL_CATEGORIES = [
  "Handwritten Notes",
  "Previous Year Questions (PYQs)",
  "Cheat Sheets",
  "Textbooks",
  "Lab Material",
  "Exam Kits",
] as const;

const RENT_CATEGORIES = ["Handwritten Notes", "Textbooks", "Lab Material", "Exam Kits"] as const;

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Used"] as const;

type ConditionOption = (typeof CONDITION_OPTIONS)[number];

type SellerInsertable = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

type NotesAssetInsertable = {
  listing_id: string;
  kind: "image";
  storage_path: string;
  sort_index: number;
};

const SELLER_PROFILES_TABLE = "seller_profiles" as unknown as keyof Database["public"]["Tables"];
const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];
const NOTES_ASSETS_TABLE = "notes_assets" as unknown as keyof Database["public"]["Tables"];

function UploadNotesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const search = Route.useSearch();
  const type = search.type === "rent" ? "rent" : "sell";

  // Check ban status
  useEffect(() => {
    if (user) {
      checkBanStatus(user.id).then((banStatus) => {
        if (banStatus.isBanned) {
          toast.error(banStatus.isPermanent 
            ? "Your account has been permanently banned." 
            : `Your account is banned until ${new Date(banStatus.bannedUntil!).toLocaleDateString()}.`
          );
          navigate({ to: "/banned" as any });
        }
      });
    }
  }, [user, navigate]);

  const categories = type === "rent" ? RENT_CATEGORIES : SELL_CATEGORIES;

  const sellerDisplayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    return user?.email ?? "seller";
  }, [profile?.full_name, user?.email]);

  const [editId, setEditId] = useState<string | null>(null);

  // Prefill when editing via ?edit=<id>
  useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    const id = search.get("edit");
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from(NOTES_LISTINGS_TABLE)
        .select(
          "id,listing_type,title,description,category,subject,faculty,semester,branch,daily_rental_price,rental_duration_days,condition,is_digital,is_free,status,seller_id",
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setEditId(String(data.id));
      setTitle(String(data.title ?? ""));
      setDescription(String(data.description ?? ""));
      setCategory((data.category as any) ?? categories[0]);
      setSubject(String(data.subject ?? ""));
      setFaculty(String(data.faculty ?? ""));
      setSemester(String(data.semester ?? ""));
      setBranch(String(data.branch ?? ""));
      setIsDigital(Boolean(data.is_digital));
     setIsFree(Boolean(data.is_free));
if (data.listing_type === "sell") {
  setSellPrice(String(data.daily_rental_price ?? ""));
} else {
  setDailyRentalPrice(String(data.daily_rental_price ?? ""));
}
      setRentalDurationDays(String(data.rental_duration_days ?? ""));
      setCondition((data.condition as any) ?? "Good");

      const { data: imgs } = await supabase
        .from(NOTES_ASSETS_TABLE)
        .select("storage_path,sort_index")
        .eq("listing_id", id)
        .order("sort_index", { ascending: true });
      if (!cancelled && imgs?.length) {
        const previews = imgs.map((r: any) =>
          r.storage_path,
        );
        // Not storing previews in state for now; new uploads will replace images when provided.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>(categories[0]);
  const [subject, setSubject] = useState("");
  const [faculty, setFaculty] = useState("");
  const [semester, setSemester] = useState("");
  const [branch, setBranch] = useState("");

  const [isDigital, setIsDigital] = useState(true);
 const [isFree, setIsFree] = useState(false);
const [sellPrice, setSellPrice] = useState<string>("");

  const [dailyRentalPrice, setDailyRentalPrice] = useState<string>("");
  const [rentalDurationDays, setRentalDurationDays] = useState<string>("");
  const [condition, setCondition] = useState<ConditionOption>("Good");

  const [previewImages, setPreviewImages] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    category.trim().length > 0 &&
    subject.trim().length > 0 &&
    (type === "sell"
      ? isFree || Number(sellPrice) > 0
      : Number(dailyRentalPrice) > 0 && Number(rentalDurationDays) > 0) &&
    previewImages.length >= 1;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Please fill required fields and upload at least 1 preview image.");
      return;
    }

    setSubmitting(true);
    try {
      await enforceBanCheck(user.id, "create a notes listing");
      await ensureSellerProfile({
        user_id: user.id,
        display_name: sellerDisplayName,
        avatar_url: profile?.avatar_url ?? null,
      });

      const insertPayload = {
        seller_id: user.id,
        listing_type: type,
        title: title.trim(),
        description: description.trim(),
        category,
        subject: subject.trim(),
        faculty: faculty.trim() || null,
        semester: semester.trim() || null,
        branch: branch.trim() || null,
        daily_rental_price: type === "rent"
          ? Number(dailyRentalPrice)
          : isFree
          ? 0
          : Number(sellPrice),
        rental_duration_days: type === "rent" ? Number(rentalDurationDays) : null,
        condition: type === "rent" ? condition : null,
        is_digital: isDigital,
        is_free: isFree,
        status: "available",
      };

      let listingId = editId;
      if (listingId) {
        const { error } = await supabase
          .from(NOTES_LISTINGS_TABLE)
          .update(insertPayload as never)
          .eq("id", listingId)
          .eq("seller_id", user.id);
        if (error) throw error;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from(NOTES_LISTINGS_TABLE)
          .insert(insertPayload)
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        listingId = inserted.id as string;
        setEditId(listingId);
      }

      if (previewImages.length > 0) {
        console.log("[Notes Upload] Uploading images:", { count: previewImages.length, listingId });
        await supabase.from(NOTES_ASSETS_TABLE).delete().eq("listing_id", listingId as never);
        const images = previewImages.slice(0, 5);
      console.log("[Notes Upload] All images uploaded successfully:", images);
        

// inside the loop:
for (let i = 0; i < images.length; i++) {
  const file = images[i];
  const imageUrl = await uploadToCloudinary(file, 'notes-assets');

  const { error: imgMetaErr } = await supabase.from(NOTES_ASSETS_TABLE).insert({
    listing_id: listingId,
    kind: "image",
    storage_path: imageUrl,
    sort_index: i,
  } satisfies NotesAssetInsertable);
  if (imgMetaErr) throw imgMetaErr;
}
        console.log("[Notes Upload] All images uploaded successfully:", images);
      }

      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success(listingId && editId ? "Listing updated!" : "Notes uploaded!");
      navigate({ to: "/notes/$id", params: { id: listingId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload notes");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/notes" })}
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

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">Create a notes listing</CardTitle>
            <CardDescription>
              Subject is required. Upload preview images only (no PDF needed).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. DBMS Complete Notes"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Include what’s inside, quality, and any rules."
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Operating Systems"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faculty">Faculty (optional)</Label>
                  <Input
                    id="faculty"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="Dr. Rao"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester (optional)</Label>
                  <Input
                    id="semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch (optional)</Label>
                  <Input
                    id="branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="CSE"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
  <div className="flex items-center gap-3">
    <Checkbox id="digital" checked={isDigital} onCheckedChange={(v) => setIsDigital(Boolean(v))} />
    <Label htmlFor="digital" className="cursor-pointer">Digital</Label>
  </div>
  <div className="flex items-center gap-3">
    <Checkbox id="free" checked={isFree} onCheckedChange={(v) => setIsFree(Boolean(v))} />
    <Label htmlFor="free" className="cursor-pointer">Free</Label>
  </div>
</div>

{type === "sell" && !isFree && (
  <div className="space-y-2">
    <Label htmlFor="sellPrice">Selling price (INR)</Label>
    <Input
      id="sellPrice"
      type="number"
      min={1}
      step="0.01"
      value={sellPrice}
      onChange={(e) => setSellPrice(e.target.value)}
      placeholder="e.g. 150"
      required
    />
  </div>
)}

              {type === "rent" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="dailyRentalPrice">Daily rental price (INR)</Label>
                    <Input
                      id="dailyRentalPrice"
                      type="number"
                      min={1}
                      step="0.01"
                      value={dailyRentalPrice}
                      onChange={(e) => setDailyRentalPrice(e.target.value)}
                      placeholder="60"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Rental duration (days)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      value={rentalDurationDays}
                      onChange={(e) => setRentalDurationDays(e.target.value)}
                      placeholder="7"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select
                      value={condition}
                      onValueChange={(v) => setCondition(v as ConditionOption)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Preview images (required, up to 5)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPreviewImages(Array.from(e.target.files ?? []).slice(0, 5))}
                  required
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => navigate({ to: "/notes" })}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || submitting} className="gap-2">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload listing
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
