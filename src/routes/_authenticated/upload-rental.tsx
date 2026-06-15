import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ensureSellerProfile } from "@/lib/supabase-account";
import { checkBanStatus, enforceBanCheck } from "@/lib/ban-enforcement";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

const CATEGORY_OPTIONS = [
  "Books",
  "Calculators",
  "Lab Equipment",
  "Cycles",
  "Electronics",
  "Fashion",
  "Sports Equipment",
  "Musical Instruments",
  "Hostel Essentials",
  "Others",
] as const;

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Used"] as const;

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
type ConditionOption = (typeof CONDITION_OPTIONS)[number];

type SellerInsertable = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

type RentalImagesInsertable = {
  rental_id: string;
  storage_path: string;
  sort_index: number;
};

const SELLER_PROFILES_TABLE = "seller_profiles" as unknown as keyof Database["public"]["Tables"];
const RENTAL_LISTINGS_TABLE = "rental_listings" as unknown as keyof Database["public"]["Tables"];
const RENTAL_IMAGES_TABLE = "rental_images" as unknown as keyof Database["public"]["Tables"];

export const Route = createFileRoute("/_authenticated/upload-rental")({
  head: () => ({
    meta: [{ title: "Upload rental — CampusBazar" }],
  }),
  component: UploadRentalPage,
});

function UploadRentalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

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

  const sellerDisplayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    return user?.email ?? "seller";
  }, [profile?.full_name, user?.email]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryOption>("Books");
  const [customCategory, setCustomCategory] = useState("");
  const [rentPrice, setRentPrice] = useState<string>("");
  const [condition, setCondition] = useState<ConditionOption>("Good");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // support editing an existing rental via ?edit=<id>
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const editId = search.get("edit");
    setEditingId(editId);
    if (!editId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from(RENTAL_LISTINGS_TABLE)
        .select("id,title,description,category,custom_category,rent_price_per_day,condition")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setTitle(String(data.title ?? ""));
      setDescription(String(data.description ?? ""));
      setCategory((data.category as CategoryOption) ?? "Books");
      setCustomCategory(String(data.custom_category ?? ""));
      setRentPrice(String(data.rent_price_per_day ?? ""));
      setCondition((data.condition as ConditionOption) ?? "Good");

      const { data: imgs } = await supabase
        .from(RENTAL_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("rental_id", editId)
        .order("sort_index", { ascending: true });
      if (!cancelled && imgs?.length) {
        const previews = imgs.map(
          (row: any) =>
            supabase.storage.from("rental-images").getPublicUrl(row.storage_path).data.publicUrl,
        );
        setImagePreviews(previews as string[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  (category !== "Others" || customCategory.trim().length > 0) &&
  rentPrice.trim().length > 0 &&
  Number(rentPrice) > 0 &&
  (editingId ? images.length <= 5 : images.length >= 1 && images.length <= 5);    

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setImages(Array.from(fileList).slice(0, 5));
  };

  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  if (!canSubmit) {
    toast.error("Please fill all required fields (and upload 1–5 images).");
    return;
  }

  setSubmitting(true);
  try {
    await enforceBanCheck(user.id, "create a rental listing");
    await ensureSellerProfile({
      user_id: user.id,
      display_name: sellerDisplayName,
      avatar_url: profile?.avatar_url ?? null,
    });

    let rentalId: string;

    if (editingId) {
      const { error: updateErr } = await supabase
        .from(RENTAL_LISTINGS_TABLE)
        .update({
          title: title.trim(),
          description: description.trim(),
          category,
          custom_category: category === "Others" ? customCategory.trim() : null,
          rent_price_per_day: Number(rentPrice),
          condition,
        })
        .eq("id", editingId);
      if (updateErr) throw updateErr;
      rentalId = editingId;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from(RENTAL_LISTINGS_TABLE)
        .insert({
          seller_id: user.id,
          title: title.trim(),
          description: description.trim(),
          category,
          custom_category: category === "Others" ? customCategory.trim() : null,
          rent_price_per_day: Number(rentPrice),
          condition,
          status: "available",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      rentalId = inserted.id as string;
    }

    const bucket = "rental-images";

    // Only touch images if the user picked new ones
    if (images.length > 0) {
      if (editingId) {
        // remove old images first
        const { data: oldImages } = await supabase
          .from(RENTAL_IMAGES_TABLE)
          .select("storage_path")
          .eq("rental_id", rentalId);

        if (oldImages?.length) {
          await supabase.storage
            .from(bucket)
            .remove(oldImages.map((row: any) => row.storage_path));
          await supabase.from(RENTAL_IMAGES_TABLE).delete().eq("rental_id", rentalId);
        }
      }

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const objectName = `${rentalId}/${i}-${file.name.replaceAll("/", "-")}`;

        const { error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(objectName, file, { upsert: false, contentType: file.type });
        if (uploadErr) throw uploadErr;

        const { error: imageErr } = await supabase.from(RENTAL_IMAGES_TABLE).insert({
          rental_id: rentalId,
          storage_path: objectName,
          sort_index: i,
        } satisfies RentalImagesInsertable);
        if (imageErr) throw imageErr;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["rentals"] });
    toast.success(editingId ? "Rental updated!" : "Rental uploaded!");
    navigate({ to: "/rent/$id", params: { id: rentalId } });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not upload rental");
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
            onClick={() => navigate({ to: "/rent" })}
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
            <CardTitle className="text-xl">Rent out an item</CardTitle>
            <CardDescription>Add 1–5 photos. This will appear in the Rent feed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Casio scientific calculator"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Include condition, pickup location, and any rules."
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as CategoryOption)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <div className="space-y-2">
                  <Label htmlFor="rentPrice">Rent price per day (INR)</Label>
                  <Input
                    id="rentPrice"
                    type="number"
                    min={1}
                    step="0.01"
                    value={rentPrice}
                    onChange={(e) => setRentPrice(e.target.value)}
                    placeholder="60"
                    required
                  />
                </div>

                {category === "Others" ? (
                  <div className="space-y-2">
                    <Label htmlFor="customCategory">Custom category</Label>
                    <Input
                      id="customCategory"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Type a category"
                      required
                    />
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>

              <div className="space-y-2">
                <Label>Images (1–5)</Label>
                <div className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-3">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Upload images</div>
                    <div className="mt-1 text-xs text-muted-foreground">Max 5 images.</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("rentalImagesInput")?.click()}
                  >
                    Choose
                  </Button>
                </div>
                <input
                  id="rentalImagesInput"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {images.map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="relative overflow-hidden rounded-lg border bg-background"
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt={`Upload preview ${idx + 1}`}
                          className="h-24 w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">Selected: {images.length}/5</div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => navigate({ to: "/rent" })}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Upload rental
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
