import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

type BanDuration = "7" | "30" | "90" | "permanent";

type BanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName?: string;
  reportContext?: {
    reportId: string;
    targetType: string;
    reporterId: string;
    sellerUserId: string | null;
  } | null;
  onBanned?: () => Promise<void> | void;
};

export function BanModal({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  reportContext,
  onBanned,
}: BanModalProps) {
  const { user } = useAuth();
  const [duration, setDuration] = useState<BanDuration>("7");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to ban users");
      return;
    }

    if (!targetUserId) {
      toast.error("Cannot ban user: missing target user id.");
      console.error("[BanModal] Missing target user id", {
        reportId: reportContext?.reportId ?? null,
        targetType: reportContext?.targetType ?? null,
        reporterId: reportContext?.reporterId ?? null,
        sellerUserId: reportContext?.sellerUserId ?? null,
        finalUserIdBeingBanned: targetUserId,
      });
      return;
    }

    if (reportContext && targetUserId !== reportContext.sellerUserId) {
      toast.error("Cannot ban user: selected target is not the reported seller.");
      console.error("[BanModal] Refusing to ban non-seller target", {
        reportId: reportContext.reportId,
        targetType: reportContext.targetType,
        reporterId: reportContext.reporterId,
        sellerUserId: reportContext.sellerUserId,
        finalUserIdBeingBanned: targetUserId,
      });
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for the ban");
      return;
    }

    setSubmitting(true);
    try {
      console.log("[BanModal] ADMIN USER CONTEXT:", {
        adminUserId: user.id,
        adminEmail: user.email,
      });

      // Calculate banned_until based on duration
      let bannedUntil: string | null = null;
      if (duration !== "permanent") {
        const days = parseInt(duration);
        const date = new Date();
        date.setDate(date.getDate() + days);
        bannedUntil = date.toISOString();
      }

      // Update user profile with ban information
      const bannedAt = new Date().toISOString();
      const updatePayload = {
        status: "banned",
        banned_at: bannedAt,
        banned_until: bannedUntil,
        ban_reason: reason.trim(),
        banned_by: user.id,
      };

      console.log("[BanModal] BEFORE UPDATE:", {
        reportId: reportContext?.reportId ?? null,
        reportTargetType: reportContext?.targetType ?? null,
        reporterId: reportContext?.reporterId ?? null,
        reportSellerUserId: reportContext?.sellerUserId ?? null,
        targetUserIdReceived: targetUserId,
        targetUserIdType: typeof targetUserId,
        targetUserIdLength: targetUserId?.length,
        targetUserIdIsEmpty: targetUserId === "",
        targetUserIdIsNull: targetUserId === null,
        targetUserIdTrimmed: targetUserId?.trim(),
        updatePayload,
      });

      // Execute UPDATE with .select() to see exactly which rows were updated
      console.log("[BanModal] Executing UPDATE query...", {
        whereClauseField: "id",
        whereClauseValue: targetUserId,
        whereClauseValueType: typeof targetUserId,
        whereClauseValueLength: targetUserId?.length,
        updateValues: updatePayload,
      });

      const updateResult = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", targetUserId)
        .select("id,email,status,banned_at,banned_until,ban_reason,banned_by");

      console.log("[BanModal] UPDATE QUERY EXECUTED - Raw Result:", {
        dataLength: updateResult.data?.length ?? 0,
        dataArray: updateResult.data,
        errorExists: updateResult.error !== null && updateResult.error !== undefined,
        errorObject: updateResult.error,
        statusCode: updateResult.status,
      });

      if (updateResult.error) {
        console.error("[BanModal] UPDATE query returned error", {
          reportId: reportContext?.reportId ?? null,
          targetType: reportContext?.targetType ?? null,
          reporterId: reportContext?.reporterId ?? null,
          sellerUserId: reportContext?.sellerUserId ?? null,
          finalUserIdBeingBanned: targetUserId,
          error: updateResult.error,
          errorMessage: updateResult.error?.message,
          errorDetails: updateResult.error?.details,
          errorCode: updateResult.error?.code,
          errorHint: (updateResult.error as any)?.hint,
        });
        throw updateResult.error;
      }

      if (!updateResult.data || updateResult.data.length === 0) {
        console.error("[BanModal] UPDATE returned 0 rows - WHERE clause matched no rows", {
          reportId: reportContext?.reportId ?? null,
          targetType: reportContext?.targetType ?? null,
          reporterId: reportContext?.reporterId ?? null,
          sellerUserId: reportContext?.sellerUserId ?? null,
          finalUserIdBeingBanned: targetUserId,
          targetUserIdType: typeof targetUserId,
          targetUserIdLength: targetUserId?.length,
          updatePayload,
          possibleIssues: [
            "WHERE id='${targetUserId}' matched 0 rows - profile does not exist",
            "RLS policy blocked the update (admin role check failed)",
            "Database trigger reverted the update",
            "targetUserId is null/undefined",
          ],
        });
        throw new Error(`Ban update affected 0 rows. Profile with id '${targetUserId}' may not exist or RLS policy blocked the update.`);
      }

      const updatedProfile = updateResult.data[0];
      console.log("[BanModal] UPDATE succeeded - rows affected and returned:", {
        reportId: reportContext?.reportId ?? null,
        targetType: reportContext?.targetType ?? null,
        reporterId: reportContext?.reporterId ?? null,
        sellerUserId: reportContext?.sellerUserId ?? null,
        finalUserIdBeingBanned: targetUserId,
        updatedProfile,
      });

      if (updatedProfile.status !== "banned" || !updatedProfile.banned_at) {
        console.error("[BanModal] Ban fields not set correctly in UPDATE response", {
          reportId: reportContext?.reportId ?? null,
          targetType: reportContext?.targetType ?? null,
          reporterId: reportContext?.reporterId ?? null,
          sellerUserId: reportContext?.sellerUserId ?? null,
          finalUserIdBeingBanned: targetUserId,
          updatedProfile,
        });
        throw new Error(`Ban fields not set. Status: ${updatedProfile.status}, banned_at: ${updatedProfile.banned_at}`);
      }

      // Log admin action
      const { error: actionError } = await supabase.from("admin_actions" as never).insert({
        admin_user_id: user.id,
        action_type: "ban_user",
        target_user_id: targetUserId,
        notes: `Banned for ${duration === "permanent" ? "permanent" : `${duration} days`}: ${reason.trim()}`,
      } as never);
      if (actionError) throw actionError;

      toast.success(
        `User ${targetUserName ? targetUserName : ""} banned ${duration === "permanent" ? "permanently" : `for ${duration} days`}`
      );
      await onBanned?.();
      onOpenChange(false);
      setReason("");
      setDuration("7");
    } catch (err) {
      console.error("[BanModal] EXCEPTION CAUGHT:", {
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorObject: err,
        targetUserId,
        sellerUserId: reportContext?.sellerUserId ?? null,
      });
      toast.error(err instanceof Error ? err.message : "Failed to ban user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setReason("");
    setDuration("7");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban User</DialogTitle>
          <DialogDescription>
            {targetUserName ? `Ban ${targetUserName}` : "Ban this user"} from the platform.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={(v) => setDuration(v as BanDuration)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
            {duration === "permanent" && (
              <p className="text-xs text-destructive">
                Permanent bans cannot be undone and will block all platform access.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this user is being banned..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} variant="destructive">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ban User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
