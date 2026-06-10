import { useState } from "react";
import { Flag, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useSubmitChatReport, type ChatReportReason } from "@/lib/chat";
import { submitListingReport } from "@/lib/listing-reports";
import { useAuth } from "@/lib/auth";
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
 * Chat Report Dialog
 * --------------------------------------------------------------
 * Reports a user / conversation.
 * Uses the SAME shared `reports` table that the listing report dialog uses,
 * so admins see every report in the unified queue.
 *
 * Uses `target_type = 'seller'` and the `seller_user_id` column to identify
 * the offending user. The conversation id is stored in `details` as a prefix
 * so admins can trace it back.
 */

const REASONS: { value: ChatReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse" },
  { value: "harassment", label: "Harassment" },
  { value: "scam", label: "Scam Attempt" },
  { value: "fake_listing", label: "Fake Listing" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "other", label: "Other" },
];

type ChatReportDialogProps = {
  userId: string;
  conversationId: string;
  otherUserId: string;
  listingTitle: string;
};

export function ChatReportDialog({
  userId,
  conversationId,
  otherUserId,
  listingTitle,
}: ChatReportDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ChatReportReason>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Keep the legacy chat-specific flow (marks conversation as reported)
  // so it can still show in the chat-reported section.
  const submit = useSubmitChatReport(userId);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please login to submit a report.");
      return;
    }
    setSubmitting(true);
    try {
      // 1) Submit to the unified `reports` table so the admin queue shows it.
      try {
        const composedDetails = details.trim()
          ? `[Chat ${conversationId}] ${details.trim()}`
          : `[Chat ${conversationId}] No additional details.`;
        await submitListingReport({
          reporterId: userId,
          targetType: "seller",
          itemId: otherUserId,
          sellerUserId: otherUserId,
          reason,
          details: composedDetails,
        });
      } catch (e) {
        console.warn("[ChatReport] Unified reports insert failed (continuing):", e);
      }

      // 2) Also record in the chat-specific chat_reports table and mark
      //    the conversation as reported.
      await new Promise<void>((resolve, reject) => {
        submit.mutate(
          {
            conversationId,
            reportTarget: "user",
            reportedUserId: otherUserId,
            reason,
            details,
            notifyAdmin: true,
            listingTitle,
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      });

      toast.success("Report submitted. Our team will review it.");
      setOpen(false);
      setDetails("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit report";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs">
          <Flag className="h-3.5 w-3.5" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Report this user
          </DialogTitle>
          <DialogDescription>
            Tell us what went wrong. Reports are confidential and reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chat-report-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ChatReportReason)}>
              <SelectTrigger id="chat-report-reason">
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
            <Label htmlFor="chat-report-details">Details (optional)</Label>
            <Textarea
              id="chat-report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
