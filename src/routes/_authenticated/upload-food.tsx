import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { ensureSellerProfile } from "@/lib/supabase-account";
import { checkBanStatus, enforceBanCheck } from "@/lib/ban-enforcement";

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

export const Route = createFileRoute("/_authenticated/upload-food")({
  head: () => ({
    meta: [{ title: "Sell food — CampusBazar" }],
  }),
  component: UploadFoodPage,
});

const FOOD_CATEGORIES = [
  "Snacks",
  "Chocolates & Sweets",
  "Instant Food",
  "Beverages",
  "Health & Fitness",
  "Others",
] as const;

const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];
const FOOD_IMAGES_TABLE = "food_images" as unknown as keyof Database["public"]["Tables"];
const SELLER_PROFILES_TABLE = "seller_profiles" as unknown as keyof Database["public"]["Tables"];

function UploadFoodPage() {
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

  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof FOOD_CATEGORIES)[number]>("Snacks");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sellerDisplayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    return user?.email ?? "seller";
  }, [profile?.full_name, user?.email]);

  // Prefill when editing via ?edit=<id>
  useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    const id = search.get("edit");
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from(FOOD_LISTINGS_TABLE)
        .select(
          "id,product_name,brand_name,category,quantity,price,description,expiry_date,status,seller_id",
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setEditId(String(data.id));
      setProductName(String(data.product_name ?? ""));
      setBrandName(String(data.brand_name ?? ""));
      setCategory(String(data.category ?? "Snacks") as any);
      setQuantity(String(data.quantity ?? ""));
      setPrice(String(data.price ?? ""));
      setExpiryDate(String(data.expiry_date ?? ""));
      setDescription(String(data.description ?? ""));

      const { data: imgs } = await supabase
        .from(FOOD_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("food_listing_id", id)
        .order("sort_index", { ascending: true });
      if (!cancelled && imgs?.length) {
        const previews = imgs.map(
          (r: any) => supabase.storage.from("food-images").getPublicUrl(r.storage_path).data.publicUrl,
        );
        // Store previews in the images state by using a synthetic File-less preview array via setImages([]) and maybe separate state? Simpler: setImages([]) and keep previews in local variable
        // We don't have a dedicated preview state in this component; rely on images File[] for new uploads and not display existing previews for now.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const canSubmit =
    productName.trim() &&
    brandName.trim() &&
    category.trim() &&
    quantity.trim() &&
    Number(price) > 0 &&
    expiryDate &&
    description.trim() &&
    images.length >= 1;

  const validateFoodItem = () => {
    const banned = [
      "homemade",
      "tiffin",
      "alcohol",
      "tobacco",
      "medicine",
      "medicines",
      "cigarette",
    ];
    const text = `${productName} ${brandName} ${description}`.toLowerCase();
    return !banned.some((word) => text.includes(word));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Please fill all required fields and upload at least 1 image.");
      return;
    }
    if (!validateFoodItem()) {
      toast.error("This listing includes prohibited food categories.");
      return;
    }
    if (new Date(expiryDate) < new Date(new Date().toISOString().slice(0, 10))) {
      toast.error("Expired products cannot be listed.");
      return;
    }

    setSubmitting(true);
    try {
      if (!user) throw new Error("Please login again.");
      await enforceBanCheck(user.id, "create a food listing");

      await ensureSellerProfile({
        user_id: user.id,
        display_name: sellerDisplayName,
        avatar_url: profile?.avatar_url ?? null,
      });

      let listingId = editId;
      if (listingId) {
        // update existing
        const { error } = await supabase
          .from(FOOD_LISTINGS_TABLE)
          .update({
            product_name: productName.trim(),
            brand_name: brandName.trim(),
            category,
            quantity: quantity.trim(),
            price: Number(price),
            description: description.trim(),
            expiry_date: expiryDate,
          } as never)
          .eq("id", listingId)
          .eq("seller_id", user.id);
        if (error) throw error;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from(FOOD_LISTINGS_TABLE)
          .insert({
            seller_id: user.id,
            product_name: productName.trim(),
            brand_name: brandName.trim(),
            category,
            quantity: quantity.trim(),
            price: Number(price),
            description: description.trim(),
            expiry_date: expiryDate,
            status: "available",
          } as never)
          .select("id")
          .single();
        if (insertErr) throw insertErr;

        listingId = inserted.id as string;
        setEditId(listingId);
      }

      // If new images were provided, replace existing image rows and upload
      if (images.length > 0) {
        console.log("[Food Upload] Uploading images:", { count: images.length, listingId });
        await supabase.from(FOOD_IMAGES_TABLE).delete().eq("food_listing_id", listingId as never);
        const bucket = "food-images";
        const uploadedPaths: string[] = [];
        for (let i = 0; i < images.length; i++) {
          const file = images[i];
          const objectName = `${listingId}/${i}-${file.name.replaceAll("/", "-")}`;
          console.log(`[Food Upload] Uploading image ${i + 1}/${images.length}:`, objectName);
          const { error: uploadErr } = await supabase.storage.from(bucket).upload(objectName, file, {
            upsert: true,
            contentType: file.type,
          });
          if (uploadErr) throw uploadErr;
          uploadedPaths.push(objectName);
          const { error: imgErr } = await supabase.from(FOOD_IMAGES_TABLE).insert({
            food_listing_id: listingId,
            storage_path: objectName,
            sort_index: i,
          } as never);
          if (imgErr) throw imgErr;
          console.log(`[Food Upload] Inserted image row ${i + 1}/${images.length}:`, { storage_path: objectName, sort_index: i });
        }
        console.log("[Food Upload] All images uploaded successfully:", uploadedPaths);
      }

      await queryClient.invalidateQueries({ queryKey: ["food"] });
      toast.success(listingId && editId ? "Listing updated!" : "Food listing posted!");
      navigate({ to: "/food/$id", params: { id: listingId as string } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload food listing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-4">
      <Card>
        <CardHeader>
          <CardTitle>Sell Food Item</CardTitle>
          <CardDescription>Only packaged and branded food items are allowed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="120g / 1 pack"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Product Images (1-5)</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                required
                onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 5))}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/food" })}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post Listing
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
