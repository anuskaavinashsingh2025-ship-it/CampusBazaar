import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { enforceBanCheck } from "@/lib/ban-enforcement";

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

export const Route = createFileRoute("/_authenticated/upload-food-request")({
  head: () => ({
    meta: [{ title: "Food request — CampusBazar" }],
  }),
  component: UploadFoodRequestPage,
});

const FOOD_REQUESTS_TABLE = "food_requests" as unknown as keyof Database["public"]["Tables"];

const FOOD_CATEGORIES = [
  "Snacks",
  "Chocolates & Sweets",
  "Instant Food",
  "Beverages",
  "Health & Fitness",
  "Others",
] as const;

const URGENCY_OPTIONS = ["low", "normal", "high", "urgent"] as const;

function UploadFoodRequestPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<(typeof FOOD_CATEGORIES)[number]>("Snacks");
  const [quantityNeeded, setQuantityNeeded] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<(typeof URGENCY_OPTIONS)[number]>("normal");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = productName.trim() && category && quantityNeeded.trim() && description.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!user) {
      toast.error("Please login again.");
      return;
    }

    setSubmitting(true);
    try {
      await enforceBanCheck(user.id, "create a food request");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from(FOOD_REQUESTS_TABLE).insert({
        requester_id: user.id,
        product_name: productName.trim(),
        category,
        quantity_needed: quantityNeeded.trim(),
        description: description.trim(),
        urgency_level: urgency,
        status: "open",
        expires_at: expiresAt,
      } as never);
      if (error) throw error;

      toast.success("Food request posted!");
      navigate({ to: "/food" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-4">
      <Card>
        <CardHeader>
          <CardTitle>Create Food Request</CardTitle>
          <CardDescription>Ask nearby students for a specific packaged item.</CardDescription>
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
                <Label>Quantity Needed</Label>
                <Input
                  value={quantityNeeded}
                  onChange={(e) => setQuantityNeeded(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/food" })}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
