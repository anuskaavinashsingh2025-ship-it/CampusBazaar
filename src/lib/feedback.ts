import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { checkBanStatus } from "@/lib/ban-enforcement";

const FEEDBACK_TABLE = "feedback" as unknown as keyof Database["public"]["Tables"];

export type FeedbackRow = {
  id: string;
  user_id: string;
  rating: number;
  category: string;
  message: string;
  screenshot_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FeedbackStatus = "submitted" | "under_review" | "resolved";

export type FeedbackCategory =
  | "Bug Report"
  | "Feature Request"
  | "UI / UX Suggestion"
  | "Marketplace Issue"
  | "Rental Issue"
  | "Food Hub Issue"
  | "Notes Hub Issue"
  | "Chat Issue"
  | "Account Issue"
  | "Safety / Abuse Report"
  | "General Feedback";

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "Bug Report",
  "Feature Request",
  "UI / UX Suggestion",
  "Marketplace Issue",
  "Rental Issue",
  "Food Hub Issue",
  "Notes Hub Issue",
  "Chat Issue",
  "Account Issue",
  "Safety / Abuse Report",
  "General Feedback",
];

export const feedbackQueryKey = (userId: string | null) => ["feedback", userId] as const;
export const adminFeedbackQueryKey = () => ["admin", "feedback"] as const;

export async function fetchUserFeedback(userId: string): Promise<FeedbackRow[]> {
  console.log("[USER FEEDBACK QUERY]", userId);
  const { data, error } = await supabase
    .from(FEEDBACK_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  console.log("[USER FEEDBACK DATA]", data);
  console.log("[USER FEEDBACK ERROR]", error);
  if (error) throw error;
  return (data ?? []) as unknown as FeedbackRow[];
}

export async function fetchAllFeedback(): Promise<FeedbackRow[]> {
  console.log("[ADMIN FEEDBACK QUERY]");
  const { data, error } = await supabase
    .from(FEEDBACK_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  console.log("[ADMIN FEEDBACK DATA]", data);
  console.log("[ADMIN FEEDBACK ERROR]", error);
  if (error) throw error;
  return (data ?? []) as unknown as FeedbackRow[];
}

export async function submitFeedback(params: {
  userId: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
  screenshotUrl?: string | null;
}): Promise<FeedbackRow> {
  // Check ban status before submitting feedback
  const banStatus = await checkBanStatus(params.userId);
  if (banStatus.isBanned) {
    throw new Error(banStatus.isPermanent 
      ? "Your account has been permanently banned." 
      : `Your account is banned until ${new Date(banStatus.bannedUntil!).toLocaleDateString()}.`
    );
  }

  const payload = {
    user_id: params.userId,
    rating: params.rating,
    category: params.category,
    message: params.message,
    screenshot_url: params.screenshotUrl ?? null,
    status: "submitted",
  };
  console.log("[FEEDBACK PAYLOAD]", payload);
  const { data, error } = await supabase.from(FEEDBACK_TABLE).insert(payload).select().single();
  console.log("[FEEDBACK RESULT]", { data, error });
  if (error) throw error;
  return data as unknown as FeedbackRow;
}

export async function updateFeedbackStatus(params: {
  feedbackId: string;
  status: FeedbackStatus;
  adminNotes?: string | null;
}): Promise<FeedbackRow> {
  const { data, error } = await supabase
    .from(FEEDBACK_TABLE)
    .update({
      status: params.status,
      admin_notes: params.adminNotes ?? null,
    })
    .eq("id", params.feedbackId)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as FeedbackRow;
}

export async function deleteFeedback(feedbackId: string): Promise<void> {
  const { error } = await supabase.from(FEEDBACK_TABLE).delete().eq("id", feedbackId);
  if (error) throw error;
}


export async function uploadFeedbackScreenshot(userId: string, file: File): Promise<string> {
  return uploadToCloudinary(file, "feedback-screenshots");
}

export function useUserFeedback() {
  const { user } = useAuth();
  return useQuery({
    queryKey: feedbackQueryKey(user?.id ?? null),
    queryFn: () => fetchUserFeedback(user!.id),
    enabled: Boolean(user?.id),
  });
}

export function useAllFeedback() {
  return useQuery({
    queryKey: adminFeedbackQueryKey(),
    queryFn: fetchAllFeedback,
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      rating: number;
      category: FeedbackCategory;
      message: string;
      screenshotFile?: File | null;
    }) => {
      if (!user) throw new Error("Login required");

      let screenshotUrl: string | null = null;
      if (params.screenshotFile) {
        screenshotUrl = await uploadFeedbackScreenshot(user.id, params.screenshotFile);
      }

      return submitFeedback({
        userId: user.id,
        rating: params.rating,
        category: params.category,
        message: params.message,
        screenshotUrl,
      });
    },
    onSuccess: () => {
      toast.success("Thank you! Your feedback has been submitted.");
      if (user) {
        void queryClient.invalidateQueries({ queryKey: feedbackQueryKey(user.id) });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to submit feedback";
      toast.error(msg);
    },
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFeedbackStatus,
    onSuccess: () => {
      toast.success("Feedback status updated");
      void queryClient.invalidateQueries({ queryKey: adminFeedbackQueryKey() });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to update feedback";
      toast.error(msg);
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFeedback,
    onSuccess: () => {
      toast.success("Feedback deleted");
      void queryClient.invalidateQueries({ queryKey: adminFeedbackQueryKey() });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to delete feedback";
      toast.error(msg);
    },
  });
}
