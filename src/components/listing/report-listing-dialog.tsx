import { useEffect, useRef, useState } from "react";
import { Flag, Loader2, X, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { submitListingReport, type ReportTargetType } from "@/lib/listing-reports";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Unified Report Dialog
 * --------------------------------------------------------------
 * Opens the SAME dialog for every report entry point:
 *   - Report Seller
 *   - Report Product
 *   - Report Rental
 *   - Report Food
 *   - Report Notes
 *
 * Supports:
 *   - Report category (auto-set by caller)
 *   - Reason (enum)
 *   - Detailed description (textarea)
 *   - Evidence image upload (max 5, PNG/JPG/JPEG/WEBP)
 *   - Submit + Cancel buttons
 *
 * No browser prompt(). No window.prompt(). No duplicate report systems.
 */

const REASONS = [
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "fake", label: "Fake / misleading" },
  { value: "offensive", label: "Offensive / abusive" },
  { value: "harassment", label: "Harassment" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "prohibited", label: "Prohibited item" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Other" },
] as const;

const MAX_EVIDENCE_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

const CATEGORY_LABEL: Record<ReportTargetType, string> = {
  product: "Product",
  seller: "Seller",
  rental: "Rental",
  food: "Food listing",
  notes: "Notes listing",
};

export type ReportListingDialogProps = {
  /** Which kind of thing is being reported */
  itemType: ReportTargetType;
  /** ID of the item (listing id) or seller user id */
  itemId: string;
  /** Optional seller user id (used when itemType is "product" / "rental" / "food" / "notes") */
  sellerUserId?: string | null;
  /** Optional className passed to the trigger button */
  triggerClassName?: string;
  /** Optional label override for the trigger button */
  triggerLabel?: string;
  /** Whether the user is allowed to report (e.g. cannot report own listing) */
  disabled?: boolean;
};

export function ReportListingDialog({
  itemType,
  itemId,
  sellerUserId,
  triggerClassName,
  triggerLabel,
  disabled,
}: ReportListingDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = `report-evidence-input-${itemType}-${itemId}`;

  // Debug: log whenever evidence files change
  useEffect(() => {
    console.log(
      "[REPORT DIALOG] evidenceFiles state changed → count:",
      evidenceFiles.length,
      "names:",
      evidenceFiles.map((f) => `${f.name} (${f.size}B ${f.type})`),
    );
  }, [evidenceFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log(
      "[REPORT DIALOG] handleFileSelect: files from input:",
      files.length,
      files.map((f) => f.name),
    );
    if (!files.length) return;

    // Reset the input value AFTER we have captured the File objects so the
    // user can re-pick the same file later. We must NOT clear `files` here.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (e.target) e.target.value = "";

    if (evidenceFiles.length + files.length > MAX_EVIDENCE_IMAGES) {
      toast.error(`Maximum ${MAX_EVIDENCE_IMAGES} images allowed`);
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      console.log(
        "[REPORT DIALOG] validating file:",
        file.name,
        "type:",
        file.type,
        "size:",
        file.size,
      );
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}. Allowed: PNG, JPG, JPEG, WEBP`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large: ${file.name}. Maximum size is 10MB`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    if (!validFiles.length) {
      console.log("[REPORT DIALOG] No valid files after validation");
      return;
    }
    console.log(
      "[REPORT DIALOG] Adding",
      validFiles.length,
      "files to state. New total:",
      evidenceFiles.length + validFiles.length,
    );
    setEvidenceFiles((prev) => [...prev, ...validFiles]);
    setEvidencePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeEvidence = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setEvidencePreviews((prev) => {
      // Revoke object URL to free memory
      try {
        URL.revokeObjectURL(prev[index]);
      } catch {
        /* noop */
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const resetForm = () => {
    setDetails("");
    setReason(REASONS[0].value);
    setEvidencePreviews((prev) => {
      prev.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      });
      return [];
    });
    setEvidenceFiles([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Closing — reset state
      resetForm();
    }
    setOpen(next);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    // Always allow the dialog to attempt to open. Auth check is inside submit.
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const handleSubmit = async () => {
    console.log(
      "[REPORT DIALOG] handleSubmit invoked. evidenceFiles.length =",
      evidenceFiles.length,
    );
    if (!user) {
      toast.error("Please login to submit a report.");
      // Open login page
      setOpen(false);
      window.location.assign("/login");
      return;
    }

    if (!itemId) {
      toast.error("Cannot report: missing target id.");
      return;
    }

    // Snapshot the files BEFORE we set submitting=true so the File objects
    // cannot be lost in a race.
    const filesToUpload = evidenceFiles.slice();
    console.log(
      "[REPORT DIALOG] Snapshotted files to upload:",
      filesToUpload.length,
      filesToUpload.map((f) => `${f.name} (${f.size}B ${f.type})`),
    );

    setSubmitting(true);
    try {
      await submitListingReport({
        reporterId: user.id,
        targetType: itemType,
        itemId,
        sellerUserId: sellerUserId ?? undefined,
        reason,
        details: details.trim() || undefined,
        evidenceFiles: filesToUpload.length > 0 ? filesToUpload : undefined,
      });
      toast.success("Report submitted. Our team will review it.");
      setOpen(false);
      resetForm();
    } catch (err) {
      console.error("[REPORT DIALOG] Submit failed:", err);
      const msg = err instanceof Error ? err.message : "Could not submit report";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={handleTriggerClick}
          className={triggerClassName ?? "gap-2 text-muted-foreground"}
          aria-label={`Report ${CATEGORY_LABEL[itemType]}`}
        >
          <Flag className="h-4 w-4" />
          {triggerLabel ?? "Report"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Report {CATEGORY_LABEL[itemType]}
          </DialogTitle>
          <DialogDescription>
            Tell us what's wrong. Our moderation team will review this report. Reports are
            confidential.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-category">Category</Label>
            <div id="report-category" className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {CATEGORY_LABEL[itemType]}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="report-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">Detailed description</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened, where, and when..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={inputId}>
              Evidence (optional, max {MAX_EVIDENCE_IMAGES} images)
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              id={inputId}
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={evidenceFiles.length >= MAX_EVIDENCE_IMAGES || submitting}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById(inputId)?.click()}
              disabled={evidenceFiles.length >= MAX_EVIDENCE_IMAGES || submitting}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {evidenceFiles.length >= MAX_EVIDENCE_IMAGES
                ? `Maximum ${MAX_EVIDENCE_IMAGES} images reached`
                : "Upload screenshots"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Accepted formats: PNG, JPG, JPEG, WEBP. Max 10MB per file.
            </p>
            {evidencePreviews.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {evidencePreviews.map((preview, index) => (
                  <div
                    key={`${preview}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-md border"
                  >
                    <img
                      src={preview}
                      alt={`Evidence ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                      onClick={() => removeEvidence(index)}
                      disabled={submitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReportListingDialog;
