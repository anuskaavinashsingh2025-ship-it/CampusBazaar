import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Eye,
  Grid3X3,
  Image as ImageIcon,
  Lightbulb,
  List,
  Loader2,
  MapPin,
  Shield,
  Sparkles,
  Tag,
  Users,
  Zap,
  Lock,
  FileText,
  IndianRupee,
  X,
} from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { uploadToCloudinary } from '@/lib/cloudinary-upload';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  "Books",
  "Electronics",
  "Lab Equipment",
  "Hostel Essentials",
  "Cycles",
  "Fashion",
  "Furniture",
  "Sports",
  "Stationery",
  "Food",
  "Others",
] as const;

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Used"] as const;

const STEPS = [
  { id: 1, label: "Item Details" },
  { id: 2, label: "Photos" },
  { id: 3, label: "Additional Info" },
  { id: 4, label: "Review & Publish" },
] as const;

const DRAFT_STORAGE_KEY = "campusbazar_product_draft_v1";

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
type ConditionOption = (typeof CONDITION_OPTIONS)[number];
type StepId = (typeof STEPS)[number]["id"];

type DraftMeta = {
  draftId?: string;
  step?: StepId;
};

const PRODUCT_LISTINGS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

export const Route = createFileRoute("/_authenticated/upload-product")({
  head: () => ({
    meta: [{ title: "Sell an Item — CampusBazar" }],
  }),
  component: UploadProductPage,
});

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

function UploadProductPage() {
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

  const defaultLocation = profile?.hostel_block
    ? `${profile.hostel_block}, VIT Campus`
    : "VIT Campus";

  const [step, setStep] = useState<StepId>(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryOption | "">("");
  const [customCategory, setCustomCategory] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<ConditionOption | "">("");
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [location, setLocation] = useState(defaultLocation);
  const [urgentSale, setUrgentSale] = useState(false);
  const [contactNote, setContactNote] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    setLocation(defaultLocation);
  }, [defaultLocation]);

  useEffect(() => {
    const previews = images.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const meta = JSON.parse(raw) as DraftMeta & Record<string, unknown>;
      if (meta.title) setTitle(String(meta.title));
      if (meta.description) setDescription(String(meta.description));
      if (meta.category) setCategory(meta.category as CategoryOption);
      if (meta.customCategory) setCustomCategory(String(meta.customCategory));
      if (meta.price) setPrice(String(meta.price));
      if (meta.condition) setCondition(meta.condition as ConditionOption);
      if (typeof meta.isNegotiable === "boolean") setIsNegotiable(meta.isNegotiable);
      if (meta.location) setLocation(String(meta.location));
      if (typeof meta.urgentSale === "boolean") setUrgentSale(meta.urgentSale);
      if (meta.contactNote) setContactNote(String(meta.contactNote));
      if (meta.draftId) setDraftId(String(meta.draftId));
      if (meta.step) setStep(meta.step as StepId);
    } catch {
      /* ignore corrupt draft */
    }
  }, []);

  // Pre-fill form when editing an existing listing via ?edit=<id>
  // Route.useSearch is available on upload-notes; for consistency read from window.location
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const editId = search.get("edit");
    if (!editId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .select(
          "id,title,description,category,custom_category,price,condition,is_negotiable,location,urgent_sale,seller_id,status",
        )
        .eq("id", editId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setDraftId(data.id as string);
      setTitle(String(data.title ?? ""));
      setDescription(String(data.description ?? ""));
      setCategory((data.category as CategoryOption) ?? "");
      setCustomCategory(String(data.custom_category ?? ""));
      setPrice(String(data.price ?? ""));
      setCondition((data.condition as ConditionOption) ?? "Good");
      setIsNegotiable(Boolean(data.is_negotiable));
      setLocation(String(data.location ?? defaultLocation));
      setUrgentSale(Boolean(data.urgent_sale));

      // Load image previews (public URLs) from product_images
      const { data: imagesRows } = await supabase
        .from(PRODUCT_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("product_id", editId)
        .order("sort_index", { ascending: true });
      if (!cancelled && imagesRows?.length) {
        const previews = imagesRows.map(
          (r: any) =>
            r.storage_path,
        );
        setImagePreviews(previews as string[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!draftId || !user) return;
    let cancelled = false;
    void (async () => {
      const { data: imageRows } = await supabase
        .from(PRODUCT_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("product_id", draftId)
        .order("sort_index", { ascending: true });
      if (cancelled || !imageRows?.length || images.length > 0) return;
      const previews = imageRows.map(
        (row: { storage_path: string }) =>
          row.storage_path,
      );
      setImagePreviews(previews);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, user]);

  const categoryLabel =
    category === "Others" && customCategory.trim() ? customCategory.trim() : category || "Category";

  const step1Valid =
    title.trim().length > 0 &&
    title.trim().length <= 60 &&
    description.trim().length > 0 &&
    description.trim().length <= 500 &&
    category !== "" &&
    (category !== "Others" || customCategory.trim().length > 0) &&
    condition !== "" &&
    price.trim().length > 0 &&
    Number(price) > 0 &&
    location.trim().length > 0;

  const step2Valid = images.length >= 1 && images.length <= 5;
  const canPublish = step1Valid && step2Valid;

  const saveLocalDraft = () => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        draftId,
        step,
        title,
        description,
        category,
        customCategory,
        price,
        condition,
        isNegotiable,
        location,
        urgentSale,
        contactNote,
      }),
    );
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const next = [...images, ...Array.from(fileList)].slice(0, 5);
    setImages(next);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const upsertDraftListing = async (publish: boolean): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    await enforceBanCheck(user.id, publish ? "publish a product listing" : "save a product draft");

    await ensureSellerProfile({
      user_id: user.id,
      display_name: sellerDisplayName,
      avatar_url: profile?.avatar_url ?? null,
    });

    const resolvedCategory = (category || "Others") as CategoryOption;
    const resolvedCondition = (condition || "Good") as ConditionOption;
    const resolvedDescription =
      description.trim() || title.trim() || "Draft listing — details to be added.";
    const resolvedPrice = price.trim() ? Number(price) : 0;
    const resolvedLocation = location.trim() || defaultLocation;

    const payload = {
      seller_id: user.id,
      title: title.trim(),
      description: contactNote.trim()
        ? `${resolvedDescription}\n\nPickup notes: ${contactNote.trim()}`
        : resolvedDescription,
      category: resolvedCategory,
      custom_category: resolvedCategory === "Others" ? customCategory.trim() || "Draft" : null,
      price: resolvedPrice,
      condition: resolvedCondition,
      is_negotiable: isNegotiable,
      location: resolvedLocation,
      urgent_sale: urgentSale,
      status: publish ? ("available" as const) : ("hidden" as const),
    };

    let productId = draftId;

    if (productId) {
      const { error } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .update(payload)
        .eq("id", productId)
        .eq("seller_id", user.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      productId = data.id as string;
      setDraftId(productId);
    }

    if (images.length > 0) {
  await supabase.from(PRODUCT_IMAGES_TABLE).delete().eq("product_id", productId);

  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const imageUrl = await uploadToCloudinary(file, 'product-images');

    const { error: imageInsertErr } = await supabase.from(PRODUCT_IMAGES_TABLE).insert({
      product_id: productId,
      storage_path: imageUrl,
      sort_index: i,
    });
    if (imageInsertErr) throw imageInsertErr;
  }
}

    return productId!;
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error("Add at least a title before saving a draft.");
      return;
    }
    setSavingDraft(true);
    try {
      await upsertDraftListing(false);
      saveLocalDraft();
      toast.success("Draft saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canPublish) {
      toast.error("Complete all required fields and add at least one photo.");
      return;
    }
    setSubmitting(true);
    try {
      const productId = await upsertDraftListing(true);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await queryClient.invalidateQueries({ queryKey: ["marketplace_home"] });
      toast.success("Listing published!");
      navigate({ to: "/product/$id", params: { id: productId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish listing");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
<div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-muted to-background sm:-m-6 lg:-m-8">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sell an Item</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              List your item in minutes and reach students near you.
            </p>
          </div>
          <div className="hidden h-20 w-32 rounded-2xl bg-primary/10 lg:block" aria-hidden />
        </div>

        <nav className="mb-8 overflow-x-auto">
          <ol className="flex min-w-max items-center gap-0">
            {STEPS.map((s, idx) => (
              <li key={s.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => s.id <= step && setStep(s.id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                      step === s.id
                        ? "bg-primary text-primary-foreground"
                        : step > s.id
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                  </span>
                  <span
                    className={cn(
                      "hidden text-sm font-medium sm:inline",
                      step === s.id ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 w-8 sm:w-16",
                      step > s.id ? "bg-primary" : "bg-muted",
                    )}
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            {step === 1 && (
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <List className="h-5 w-5 text-primary" />
                    Item Details
                  </CardTitle>
                  <CardDescription>Provide basic information about your item.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={category}
                      onValueChange={(v) => setCategory(v as CategoryOption)}
                    >
                      <SelectTrigger>
                        <Grid3X3 className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Select Category" />
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

                  {category === "Others" && (
                    <div className="space-y-2">
                      <Label htmlFor="customCategory">Custom category</Label>
                      <Input
                        id="customCategory"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. Calculators"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="title">Item Title</Label>
                      <span className="text-xs text-muted-foreground">{title.length}/60</span>
                    </div>
                    <div className="relative">
                      <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="title"
                        className="pl-9"
                        value={title}
                        maxLength={60}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter item title"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="description">Description</Label>
                      <span className="text-xs text-muted-foreground">
                        {description.length}/500
                      </span>
                    </div>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        id="description"
                        className="min-h-[120px] pl-9"
                        value={description}
                        maxLength={500}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your item in detail..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select
                      value={condition}
                      onValueChange={(v) => setCondition(v as ConditionOption)}
                    >
                      <SelectTrigger>
                        <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Select Condition" />
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
                    <Label htmlFor="price">Price</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="price"
                          type="number"
                          min={1}
                          className="pl-9"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="Enter price"
                        />
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <Label htmlFor="negotiable" className="text-sm">
                          Negotiable
                        </Label>
                        <Switch
                          id="negotiable"
                          checked={isNegotiable}
                          onCheckedChange={setIsNegotiable}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="location"
                        className="pl-9"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="VIT Campus, Near SJT"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                  >
                    Next: Add Photos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Photos
                  </CardTitle>
                  <CardDescription>Add up to 5 clear photos of your item.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {imagePreviews.map((url, idx) => (
                      <div
                        key={url}
                        className="relative aspect-square overflow-hidden rounded-xl border"
                      >
                        <img
                          src={url}
                          alt={`Preview ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                          aria-label="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {images.length < 5 && (
                      <button
                        type="button"
                        onClick={() => document.getElementById("productImagesInput")?.click()}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      >
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-xs">Add photo</span>
                      </button>
                    )}
                  </div>
                  <input
                    id="productImagesInput"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  <p className="text-xs text-muted-foreground">Selected: {images.length}/5</p>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={!step2Valid}
                      onClick={() => setStep(3)}
                    >
                      Next: Additional Info
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Additional Information</CardTitle>
                  <CardDescription>
                    Optional details to help buyers find your listing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <p className="font-medium">Urgent sale</p>
                      <p className="text-sm text-muted-foreground">
                        Show an urgent badge on your listing
                      </p>
                    </div>
                    <Switch checked={urgentSale} onCheckedChange={setUrgentSale} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactNote">Pickup / contact notes (optional)</Label>
                    <Textarea
                      id="contactNote"
                      value={contactNote}
                      onChange={(e) => setContactNote(e.target.value)}
                      placeholder="Best time to meet, preferred pickup spot..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button type="button" className="flex-1" onClick={() => setStep(4)}>
                      Review listing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Review & Publish</CardTitle>
                  <CardDescription>
                    Confirm everything looks good before going live.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium text-right">{title}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{categoryLabel}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Condition</span>
                      <span className="font-medium">{condition}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-medium">
                        {formatInr(Number(price))}
                        {isNegotiable ? " (negotiable)" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium text-right">{location}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description</span>
                      <p className="mt-1">{description}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Photos</span>
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {imagePreviews.map((url) => (
                          <img
                            key={url}
                            src={url}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(3)}>
                      Back
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={!canPublish || submitting}
                      onClick={() => void handlePublish()}
                    >
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Publish listing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="border-sky-100 bg-sky-50/80 shadow-none dark:border-sky-900/40 dark:bg-sky-950/30">
  <CardHeader className="pb-2">
    <CardTitle className="flex items-center gap-2 text-base text-sky-900 dark:text-sky-300">
                  <Eye className="h-4 w-4" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {title || imagePreviews[0] ? (
                  <div className="overflow-hidden rounded-xl border bg-card">
                    {imagePreviews[0] ? (
                      <img src={imagePreviews[0]} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-muted text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-semibold">{title || "Item title"}</p>
                      <p className="text-lg font-bold text-primary">
                        {price ? formatInr(Number(price)) : "₹—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{categoryLabel}</p>
                      {condition && (
                        <p className="text-xs text-muted-foreground">Condition: {condition}</p>
                      )}
                      {location && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {location}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
<div className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
                    Your item preview will appear here. Add details and photos to see how your
                    listing will look.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-emerald-100 bg-emerald-50/80 shadow-none dark:border-emerald-900/40 dark:bg-emerald-950/30">
  <CardHeader className="pb-2">
    <CardTitle className="flex items-center gap-2 text-base text-emerald-900 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  Tips for a Great Listing
                </CardTitle>
              </CardHeader>
              <CardContent>
<ul className="space-y-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                  {[
                    "Add clear, well-lit photos",
                    "Write a detailed description",
                    "Mention condition clearly",
                    "Set a fair price",
                    "Respond to chats quickly",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-sky-100 bg-sky-50/50 shadow-none dark:border-sky-900/40 dark:bg-sky-950/20">
  <CardHeader className="pb-2">
    <CardTitle className="text-base text-sky-900 dark:text-sky-300">Why sell on CampusBazar?</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3 text-sm">
    {[
                  { icon: Users, text: "Reach students near you" },
                  { icon: Zap, text: "Quick and easy process" },
                  { icon: Shield, text: "Trusted student community" },
                  { icon: Lock, text: "Safe & secure platform" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-sky-900/80">
                    <Icon className="h-4 w-4 text-sky-600" />
                    {text}
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>


      </div>
    </div>
  );
}
