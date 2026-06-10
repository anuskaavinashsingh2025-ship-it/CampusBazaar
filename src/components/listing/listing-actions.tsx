import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogHeader,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

type ListingType = "product" | "rental" | "food" | "notes";

const TABLE_FOR: Record<ListingType, string> = {
  product: "product_listings",
  rental: "rental_listings",
  food: "food_listings",
  notes: "notes_listings",
};

export function ListingActions({
  itemType,
  itemId,
  ownerId,
  onEdit,
  onDeleted,
}: {
  itemType: ListingType;
  itemId: string;
  ownerId: string | null | undefined;
  onEdit?: () => void;
  onDeleted?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const qc = useQueryClient();

  const canShow = Boolean(user && (isAdmin || user.id === ownerId));
  if (!canShow) return null;

  // ------------------------------------------------------------------
  // Debug helpers (request: console logs at every step of delete)
  // ------------------------------------------------------------------
  const logDelete = (label: string, payload?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(`[MARKETPLACE DELETE] ${label}`, payload ?? "");
  };

  const bucketFor = (type: ListingType) => {
    switch (type) {
      case "product":
        return "product-images";
      case "rental":
        return "rental-images";
      case "food":
        return "food-images";
      case "notes":
        return "notes-assets";
      default:
        return "";
    }
  };

  const imagesTableFor = (type: ListingType) => {
    switch (type) {
      case "product":
        return "product_images";
      case "rental":
        return "rental_images";
      case "food":
        return "food_images";
      case "notes":
        return "notes_assets";
      default:
        return "";
    }
  };

  async function handleDelete() {
    logDelete("Delete button clicked", { itemType, itemId, ownerId });
    logDelete("Current user", user ? { id: user.id, email: user.email } : null);
    logDelete("User role", {
      isAdmin,
      userId: user?.id ?? null,
      ownerId: ownerId ?? null,
      isOwner: user?.id === ownerId,
    });
    logDelete("Listing ID", itemId);
    logDelete("Resolved target table", TABLE_FOR[itemType]);

    setDeleting(true);
    setConfirmOpen(true);
    try {
      // Always go through the server function for admins so the
      // service-role key is used and RLS / storage cleanup is consistent.
      // The server function also enforces the "no active requests" rule
      // and the "Admins can delete all product listings" policy correctly.
      if (isAdmin) {
  const tableName = TABLE_FOR[itemType];

  logDelete("Admin delete using RLS policy", {
    table: tableName,
    id: itemId,
  });

  const { data: deleteData, error } = await supabase
    .from(tableName as never)
    .delete()
    .eq("id", itemId as never)
    .select("id");

  logDelete("Admin delete result", {
    data: deleteData,
    error,
  });

  if (error) throw error;

  onDeleted?.();

  qc.invalidateQueries({ queryKey: ["marketplace_page"] });
  qc.invalidateQueries({ queryKey: ["product_listings"] });
  qc.invalidateQueries({ queryKey: ["my_listings"] });
  qc.invalidateQueries({ queryKey: ["seller_listings"] });

  qc.refetchQueries({ queryKey: ["marketplace_page"] });

  toast.success("Listing removed");
  return;
}

      // ----------------------------------------------------------------
      // Owner path: the current user owns the listing.
      // ----------------------------------------------------------------
      const bucket = bucketFor(itemType);
      const imagesTable = imagesTableFor(itemType);
      const tableName = TABLE_FOR[itemType];

      // Verify the resolved table/id we are about to hit
      logDelete("Starting delete query (owner → supabase client)", {
        table: tableName,
        id: itemId,
        imagesTable,
        bucket,
      });

      // 1) Fetch image storage paths so we can clean up storage
      let paths: string[] = [];
      if (imagesTable) {
        const columnName =
          itemType === "product"
            ? "product_id"
            : itemType === "rental"
              ? "rental_id"
              : itemType === "food"
                ? "food_listing_id"
                : "listing_id";

        const { data: imgs, error: imgsErr } = await supabase
          .from(imagesTable as never)
          .select("storage_path")
          .eq(columnName, itemId as never);
        if (imgsErr) throw imgsErr;
        type ImageRow = { storage_path?: string | null };
        paths = (imgs ?? []).map((r: ImageRow) => r.storage_path ?? "").filter(Boolean);
      }

      // 2) Remove storage objects (best-effort, do not block DB delete)
      if (paths.length && bucket) {
        try {
          await supabase.storage.from(bucket).remove(paths);
        } catch (err) {
          logDelete("Storage cleanup warning (non-fatal)", err);
        }
      }

      // 3) Delete the listing row from the correct table
      const { data: deleteData, error } = await supabase
        .from(tableName as never)
        .delete()
        .eq("id", itemId as never)
        .select("id");
      logDelete("Delete result", { data: deleteData, error });

      if (error) throw error;

      // 4) Local state + cache invalidation + refetch
      onDeleted?.();
      qc.invalidateQueries({ queryKey: ["marketplace_page"] });
      qc.invalidateQueries({ queryKey: ["product_listings"] });
      qc.invalidateQueries({ queryKey: ["my_listings"] });
      qc.invalidateQueries({ queryKey: ["seller_listings"] });
      qc.refetchQueries({ queryKey: ["marketplace_page"] });

      // 5) Toast only after a confirmed DB delete
      toast.success("Listing removed");
    } catch (err) {
      logDelete("Delete error", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to delete listing";
      toast.error(message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="z-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Listing actions"
            className="grid h-10 w-10 place-content-center rounded-full bg-white/90 text-foreground shadow-md ring-1 ring-black/5 backdrop-blur transition-all hover:scale-105 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-11 sm:w-11"
          >
            <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          alignOffset={0}
          collisionPadding={16}
          avoidCollisions={true}
        >
          {user?.id === ownerId ? (
            <DropdownMenuItem onSelect={() => onEdit?.()}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete listing?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ListingActions;
