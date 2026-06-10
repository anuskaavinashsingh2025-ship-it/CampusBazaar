import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkBanStatus } from "@/lib/ban-enforcement";

export type ReportTargetType = "product" | "seller" | "rental" | "food" | "notes";

const MAX_EVIDENCE_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const REPORTS_BUCKET = "report-evidence";

/**
 * Upload evidence images for a report to the report-evidence storage bucket.
 * Returns array of public URLs (bucket is configured as public).
 */
export async function uploadReportEvidence(reportId: string, files: File[]): Promise<string[]> {
  console.log("[REPORT EVIDENCE UPLOAD] Starting upload for report:", reportId);
  console.log("[REPORT EVIDENCE UPLOAD] Number of files:", files.length);

  if (files.length > MAX_EVIDENCE_IMAGES) {
    throw new Error(`Maximum ${MAX_EVIDENCE_IMAGES} images allowed`);
  }

  const uploadedUrls: string[] = [];

  for (const file of files) {
    console.log("[REPORT EVIDENCE UPLOAD] Processing file:", file.name, file.size, file.type);

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Allowed: PNG, JPG, JPEG, WEBP`);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.name}. Maximum size is 10MB`);
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${reportId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    console.log("[REPORT EVIDENCE UPLOAD] Storage path:", fileName);

    const { data, error } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(fileName, file, {
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error("[REPORT EVIDENCE UPLOAD] Upload error:", error);
      throw error;
    }

    console.log("[REPORT EVIDENCE UPLOAD] Upload successful:", data);

    const {
      data: { publicUrl },
    } = supabase.storage.from(REPORTS_BUCKET).getPublicUrl(data.path);

    uploadedUrls.push(publicUrl);
    console.log("[REPORT EVIDENCE UPLOAD] Public URL:", publicUrl);
  }

  console.log("[REPORT EVIDENCE UPLOAD] All uploads completed");
  return uploadedUrls;
}

export type SubmitListingReportInput = {
  reporterId: string;
  targetType: ReportTargetType;
  itemId: string;
  /**
   * Seller user id. The reports table CHECK constraint (as of migration
   * 20260609100000_allow_seller_user_id_with_listing_fks) ALLOWS
   * `seller_user_id` to be set together with the listing FK column for
   * non-seller target_types. So we now pass it through for every report
   * type that has a known seller, and it ends up in its own column on
   * the report row.
   */
  sellerUserId?: string;
  reason: string;
  details?: string;
  evidenceFiles?: File[];
};

/**
 * Build the insert payload for the `reports` table.
 *
 * After the CHECK constraint was relaxed (migration
 * 20260609100000_allow_seller_user_id_with_listing_fks), `seller_user_id`
 * may be set together with the listing FK column for the target type.
 * We set BOTH so the admin portal can immediately see the offending
 * seller without parsing `details`.
 */
function buildReportPayload(input: SubmitListingReportInput): Record<string, unknown> {
  console.log("[BUILD PAYLOAD] Building report payload for:", input.targetType, input.itemId);

  const baseDetails = input.details?.trim() ? input.details.trim() : null;

  const payload: Record<string, unknown> = {
    reporter_id: input.reporterId,
    target_type: input.targetType,
    reason: input.reason,
    details: baseDetails,
  };

  // Set the listing FK for the target type. For `seller` we use the
  // explicit sellerUserId or fall back to itemId.
  switch (input.targetType) {
    case "product":
      payload.product_id = input.itemId;
      break;
    case "seller":
      payload.seller_user_id = input.sellerUserId ?? input.itemId;
      break;
    case "rental":
      payload.rental_id = input.itemId;
      break;
    case "food":
      payload.food_listing_id = input.itemId;
      break;
    case "notes":
      payload.notes_listing_id = input.itemId;
      break;
    default:
      throw new Error(`Unknown report target_type: ${input.targetType as string}`);
  }

  // For non-seller reports, ALSO set seller_user_id when known. The
  // CHECK constraint now permits this combination.
  if (
    input.targetType !== "seller" &&
    input.sellerUserId
  ) {
    payload.seller_user_id = input.sellerUserId;
  }

  console.log("[BUILD PAYLOAD] Final payload:", payload);
  return payload;
}

/**
 * Submit a listing/seller report to the `reports` table.
 * - Enforces ban status
 * - Inserts a report row
 * - Uploads evidence files (if any) to the report-evidence bucket
 * - Updates the report with evidence_urls + evidence_count
 */
export async function submitListingReport(input: SubmitListingReportInput) {
  console.log("[SUBMIT LISTING REPORT] Starting report submission", {
    reporterId: input.reporterId,
    targetType: input.targetType,
    itemId: input.itemId,
    sellerUserId: input.sellerUserId,
    reason: input.reason,
    hasEvidence: !!input.evidenceFiles?.length,
    evidenceCount: input.evidenceFiles?.length ?? 0,
  });

  if (!input.itemId) {
    throw new Error("submitListingReport: itemId is required");
  }
  if (!input.reporterId) {
    throw new Error("submitListingReport: reporterId is required");
  }
  if (!input.reason) {
    throw new Error("submitListingReport: reason is required");
  }

  // 1. Check ban status
  const banStatus = await checkBanStatus(input.reporterId);
  if (banStatus.isBanned) {
    const msg = banStatus.isPermanent
      ? "Your account has been permanently banned."
      : `Your account is banned until ${new Date(banStatus.bannedUntil!).toLocaleDateString()}.`;
    console.warn("[SUBMIT LISTING REPORT] Banned user tried to submit report:", input.reporterId);
    throw new Error(msg);
  }

  // 2. Build payload
  const payload = buildReportPayload(input);

  // 3. Insert the report row first
  console.log("[SUBMIT LISTING REPORT] Inserting report row with payload:", payload);
  const { data: reportData, error: insertError } = await supabase
    .from("reports" as never)
    .insert(payload as never)
    .select("id")
    .single();

  if (insertError) {
    console.error("[SUBMIT LISTING REPORT] Insert error:", insertError);
    console.error(
      "[SUBMIT LISTING REPORT] Failed payload was:",
      JSON.stringify(payload, null, 2),
    );
    throw insertError;
  }

  const reportId = (reportData as { id: string }).id;
  console.log("[SUBMIT LISTING REPORT] Report created with ID:", reportId);

  // 4. Upload evidence files (if any) and link them back to the report
  if (input.evidenceFiles && input.evidenceFiles.length > 0) {
    console.log("[SUBMIT LISTING REPORT] Uploading", input.evidenceFiles.length, "evidence files");
    try {
      const evidenceUrls = await uploadReportEvidence(reportId, input.evidenceFiles);

      if (evidenceUrls.length > 0) {
        const updatePayload = {
          evidence_urls: evidenceUrls,
          evidence_count: evidenceUrls.length,
        };
        console.log("[SUBMIT LISTING REPORT] Linking evidence URLs:", updatePayload);

        const { error: updateError } = await supabase
          .from("reports" as never)
          .update(updatePayload as never)
          .eq("id", reportId);

        if (updateError) {
          console.error(
            "[SUBMIT LISTING REPORT] Failed to update evidence URLs:",
            updateError,
          );
          // Don't fail the entire submission — the report was created.
          toast.warning("Report saved. Evidence could not be linked automatically.");
        } else {
          console.log(
            "[SUBMIT LISTING REPORT] Evidence linked successfully:",
            evidenceUrls.length,
          );
        }
      }
    } catch (evErr) {
      console.error("[SUBMIT LISTING REPORT] Evidence upload failed:", evErr);
      toast.warning(
        "Report saved, but evidence upload failed. Admins will still see your report.",
      );
    }
  }

  console.log("[SUBMIT LISTING REPORT] Report submission completed");
  return { reportId };
}

/**
 * Map a target type to its WishlistItemType equivalent (kept for backward compat).
 */
export function reportTargetFromItemType(itemType: ReportTargetType): ReportTargetType {
  return itemType;
}
