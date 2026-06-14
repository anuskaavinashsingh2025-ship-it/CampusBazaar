import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DeleteInput = z.object({
  itemType: z.enum(["product", "rental", "food", "notes"]),
  itemId: z.string(),
});

export const deleteListing = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteInput.parse(d))
  .handler(async ({ data }) => {
    const { itemType, itemId } = data as z.infer<typeof DeleteInput>;

    const map = {
      product: {
        table: "product_listings",
        imagesTable: "product_images",
        bucket: "product-images",
        requestsTable: "product_requests",
        requestCol: "product_id",
      },
      rental: {
        table: "rental_listings",
        imagesTable: "rental_images",
        bucket: "rental-images",
        requestsTable: "rental_requests",
        requestCol: "rental_id",
      },
      food: {
        table: "food_listings",
        imagesTable: "food_images",
        bucket: "food-images",
        requestsTable: "food_requests",
        requestCol: "food_listing_id",
      },
      notes: {
        table: "notes_listings",
        imagesTable: "notes_assets",
        imagesTableIdCol: "listing_id",
        bucket: "notes-assets",
        requestsTable: "notes_purchase_requests",
        requestCol: "notes_listing_id",
      },
    } as const;

    type MapEntry = {
      table: keyof import("@/integrations/supabase/types").Database["public"]["Tables"];
      imagesTable: keyof import("@/integrations/supabase/types").Database["public"]["Tables"];
      imagesTableIdCol?: string;
      bucket: string;
      requestsTable: string;
      requestCol?: string;
    };

    const cfg = (map as unknown as Record<string, MapEntry>)[itemType];
    if (!cfg) throw new Error("Unknown item type");

    // Check for active requests referencing this listing
    try {
      // Use an explicit, shallowly-typed result to avoid deep generic inference from the supabase client types.
      const reqCountRes = (await (supabaseAdmin as unknown as {
        from: (table: string) => {
          select: (cols: string, opts?: any) => { eq: (col: string, val: string) => Promise<{ count: number | null; error: any }>; };
        };
      }).from(cfg.requestsTable)
        .select("id", { count: "exact", head: true })
        .eq(cfg.requestCol!, itemId)) as { count: number | null; error: any };

      if (reqCountRes.error) throw reqCountRes.error;
      const count = reqCountRes.count ?? 0;
      if (count > 0) {
        throw new Error("There are active requests for this listing — cannot delete.");
      }
    } catch (e) {
      // bubble up
      throw e;
    }

    // fetch image storage paths
    const imagesRes = await (supabaseAdmin as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: any[] | null; error: any }>; }; }; }).from(
      cfg.imagesTable,
    ).select("storage_path").eq(cfg.imagesTableIdCol ?? (cfg.requestCol === undefined ? "id" : cfg.requestCol!), itemId as string);
    const images = (imagesRes.data ?? []) as Array<{ storage_path?: string }>;
    const paths: string[] = images.map((r) => r.storage_path ?? "").filter(Boolean);

    // remove storage objects (if any)
    if (paths.length) {
      try {
    await (supabaseAdmin as any).storage.from(cfg.bucket).remove(paths);
      } catch (err) {
        console.warn("admin: failed to remove storage objects", err);
      }
    }

    // delete image rows
    try {
      await (supabaseAdmin as unknown as { from: (table: string) => { delete: () => { eq: (col: string, val: string) => Promise<any>; }; }; })
        .from(cfg.imagesTable)
        .delete()
        .eq(cfg.imagesTableIdCol ?? (cfg.requestCol === undefined ? "id" : cfg.requestCol!), itemId as string);
    } catch (e) {
      console.warn("admin: failed to delete image rows", e);
    }

    // delete listing row
    const delRes = await (supabaseAdmin as unknown as { from: (table: string) => { delete: () => { eq: (col: string, val: string) => { select: (cols: string) => Promise<{ error: any; data?: any[] }>; }; }; }; })
      .from(cfg.table)
      .delete()
      .eq("id", itemId as string)
      .select("id");
    if (delRes.error) throw delRes.error;
    if (!delRes.data || delRes.data.length === 0) {
      throw new Error("Delete operation removed zero rows");
    }

    // log admin action
    try {
      // admin_actions.generated types expect `action_type` not `action`.
      await (supabaseAdmin as any).from("admin_actions").insert({
        action_type: "remove_listing",
        target_listing_id: itemId,
        notes: itemType + " removed by admin",
      });
    } catch (e) {
      console.warn("admin: failed to log admin action", e);
    }

    return { ok: true };
  });

export default deleteListing;
