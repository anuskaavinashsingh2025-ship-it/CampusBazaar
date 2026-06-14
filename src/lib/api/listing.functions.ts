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

    const map: Record<string, {
      table: string;
      imagesTable: string;
      imagesFkCol: string;
      bucket: string;
      requestsTable: string;
      requestsFkCol: string;
    }> = {
      product: {
        table: "product_listings",
        imagesTable: "product_images",
        imagesFkCol: "product_id",       // confirm with query above
        bucket: "product-images",
        requestsTable: "product_requests",
        requestsFkCol: "product_id",
      },
      rental: {
        table: "rental_listings",
        imagesTable: "rental_images",
        imagesFkCol: "rental_id",         // confirm with query above
        bucket: "rental-images",
        requestsTable: "rental_requests",
        requestsFkCol: "rental_id",
      },
      food: {
        table: "food_listings",
        imagesTable: "food_images",
        imagesFkCol: "food_listing_id",   // confirm with query above
        bucket: "food-images",
        requestsTable: "food_orders",     // ← FIXED (was food_requests)
        requestsFkCol: "food_listing_id",
      },
      notes: {
        table: "notes_listings",
        imagesTable: "notes_assets",
        imagesFkCol: "listing_id",        // confirm with query above
        bucket: "notes-assets",
        requestsTable: "notes_purchase_requests",
        requestsFkCol: "notes_listing_id",
      },
    };

    const cfg = map[itemType];
    if (!cfg) throw new Error("Unknown item type");

    const db = supabaseAdmin as any;

    // 1. Check for active requests — admin can still force-delete, just logs warning
    const { count, error: countErr } = await db
      .from(cfg.requestsTable)
      .select("id", { count: "exact", head: true })
      .eq(cfg.requestsFkCol, itemId);
    if (countErr) console.warn("admin: could not check requests", countErr);
    if (count && count > 0) {
      console.warn(`admin: force-deleting listing with ${count} active requests`);
    }

    // 2. Fetch image storage paths
    const { data: imageRows } = await db
      .from(cfg.imagesTable)
      .select("storage_path")
      .eq(cfg.imagesFkCol, itemId);
    const paths: string[] = (imageRows ?? [])
      .map((r: any) => r.storage_path)
      .filter(Boolean);

    // 3. Delete storage objects
    if (paths.length) {
      const { error: storageErr } = await db.storage.from(cfg.bucket).remove(paths);
      if (storageErr) console.warn("admin: storage remove failed", storageErr);
    }

    // 4. Delete image rows
    const { error: imgDelErr } = await db
      .from(cfg.imagesTable)
      .delete()
      .eq(cfg.imagesFkCol, itemId);
    if (imgDelErr) console.warn("admin: image row delete failed", imgDelErr);

    // 5. Delete the listing itself
    const { data: deleted, error: delErr } = await db
      .from(cfg.table)
      .delete()
      .eq("id", itemId)
      .select("id");
    if (delErr) throw delErr;
    if (!deleted || deleted.length === 0) {
      throw new Error("Delete operation removed zero rows");
    }

    // 6. Log admin action
    const { error: logErr } = await db.from("admin_actions").insert({
      action_type: "remove_listing",
      target_listing_id: itemId,
      notes: `${itemType} removed by admin`,
    });
    if (logErr) console.warn("admin: failed to log action", logErr);

    return { ok: true };
  });

export default deleteListing;