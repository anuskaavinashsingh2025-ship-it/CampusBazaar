import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificationPriority = "critical" | "important" | "informational";
export type NotificationModule =
  | "marketplace"
  | "rentals"
  | "notes"
  | "food"
  | "chats"
  | "requests"
  | "system";

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: NotificationPriority;
  module: NotificationModule;
  read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  marketplace: boolean;
  rentals: boolean;
  notes: boolean;
  food: boolean;
  chats: boolean;
  requests: boolean;
  system: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  sound_enabled: boolean;
  desktop_enabled: boolean;
};

const NOTIFICATIONS_TABLE = "notifications" as unknown as keyof Database["public"]["Tables"];
const PREFS_TABLE = "notification_preferences" as unknown as keyof Database["public"]["Tables"];

export const notificationsQueryKey = (userId: string | null) => ["notifications", userId] as const;

export const notificationPrefsQueryKey = (userId: string | null) =>
  ["notification_preferences", userId] as const;

export const unreadCountQueryKey = (userId: string | null) =>
  ["notifications_unread_count", userId] as const;

export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as NotificationRow[];
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from(PREFS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  if (data) return data as unknown as NotificationPreferences;

  const defaults: Omit<NotificationPreferences, "user_id"> = {
    marketplace: true,
    rentals: true,
    notes: true,
    food: true,
    chats: true,
    requests: true,
    system: true,
    push_enabled: true,
    email_enabled: true,
    sound_enabled: true,
    desktop_enabled: true,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from(PREFS_TABLE)
    .insert({ user_id: userId, ...defaults })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  return inserted as unknown as NotificationPreferences;
}

export async function createNotification(input: {
  userId: string;
  title: string;
  description: string;
  priority?: NotificationPriority;
  module: NotificationModule;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const prefs = await fetchNotificationPreferences(input.userId).catch(() => null);
  if (prefs) {
    const moduleKey = input.module as keyof Pick<
      NotificationPreferences,
      "marketplace" | "rentals" | "notes" | "food" | "chats" | "requests" | "system"
    >;
    if (!prefs[moduleKey]) return null;
  }

 const { error } = await supabase
  .from(NOTIFICATIONS_TABLE)
  .insert({
    user_id: input.userId,
    title: input.title,
    description: input.description,
    priority: input.priority ?? "informational",
    module: input.module,
    action_url: input.actionUrl ?? null,
    metadata: input.metadata ?? {},
  });

const data = null;
  if (error) {
    console.error("[Notification] Insert failed:", {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId: input.userId,
      title: input.title,
      module: input.module,
    });
    throw error;
  }
  return null;
}

export function useNotifications(userId: string | null | undefined) {
  return useQuery({
    queryKey: notificationsQueryKey(userId ?? null),
    queryFn: () => fetchNotifications(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Singleton registry to prevent duplicate channel subscriptions
const notificationChannels = new Map<string, ReturnType<typeof supabase.channel>>();

export function useNotificationRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channelName = `notifications:${userId}`;

    // Return early if channel already exists (singleton pattern)
    if (notificationChannels.has(channelName)) {
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
          void queryClient.invalidateQueries({ queryKey: unreadCountQueryKey(userId) });
        },
      )
      .subscribe();

    // Store channel in registry
    notificationChannels.set(channelName, channel);

    return () => {
      // Remove from registry and cleanup channel
      notificationChannels.delete(channelName);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}

export function useUnreadNotificationCount(userId: string | null | undefined) {
  return useQuery({
    queryKey: unreadCountQueryKey(userId ?? null),
    queryFn: () => fetchUnreadCount(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    throwOnError: false,
  });
}

export function useNotificationPreferences(userId: string | null | undefined) {
  return useQuery({
    queryKey: notificationPrefsQueryKey(userId ?? null),
    queryFn: () => fetchNotificationPreferences(userId!),
    enabled: Boolean(userId),
  });
}

export function useMarkNotificationRead(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
        void queryClient.invalidateQueries({ queryKey: unreadCountQueryKey(userId) });
      }
    },
  });
}

export function useMarkAllNotificationsRead(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .update({ read: true })
        .eq("user_id", userId!)
        .eq("read", false);
      if (error) throw error;
    },
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
        void queryClient.invalidateQueries({ queryKey: unreadCountQueryKey(userId) });
      }
    },
  });
}

export function useSaveNotificationPreferences(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      const { error } = await supabase
        .from(PREFS_TABLE)
        .upsert({ user_id: userId!, ...prefs }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: notificationPrefsQueryKey(userId) });
      }
    },
  });
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export const MODULE_LABELS: Record<NotificationModule, string> = {
  marketplace: "Marketplace",
  rentals: "Rentals",
  notes: "Notes",
  food: "Food",
  chats: "Chats",
  requests: "Requests",
  system: "System",
};

export const PRIORITY_STYLES: Record<
  NotificationPriority,
  { dot: string; badge: string; label: string }
> = {
  critical: { dot: "bg-red-500", badge: "bg-red-100 text-red-700", label: "Critical" },
  important: { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700", label: "Important" },
  informational: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700", label: "Info" },
};
