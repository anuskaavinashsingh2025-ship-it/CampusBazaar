import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { createNotification } from "@/lib/notifications";
import { isChatUnlockedForProductRequest } from "@/lib/product-requests";
import { isChatUnlockedForRentalRequest } from "@/lib/rental-requests";
import { isChatUnlockedForFoodOrder } from "@/lib/food-orders";
import { isChatUnlockedForNotesPurchase } from "@/lib/notes-purchase-requests";
import { checkBanStatus } from "@/lib/ban-enforcement";

// Re-export getDaysUntilDeletion so consumers can import from a single place
export { getDaysUntilDeletion } from "@/lib/chat-inactivity";

export type ChatContextType = "product" | "rental" | "food" | "notes";
export type ConversationStatus = "active" | "archived" | "reported" | "completed" | "auto_archived" | "completion_pending";
export type MessageType = "text" | "image";
export type MessageDeliveryStatus = "sent" | "delivered" | "read";
export type ChatReportTarget = "user" | "conversation" | "listing";
export type ChatReportReason =
  | "spam"
  | "abuse"
  | "harassment"
  | "scam"
  | "fake_listing"
  | "inappropriate"
  | "other";

export type ConversationRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  context_type: ChatContextType;
  context_id: string;
  request_id: string | null;
  listing_title: string;
  status: ConversationStatus;
  is_reported: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  buyer_unread_count: number;
  seller_unread_count: number;
  completed_at: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  completion_requested_by: string | null;
  completion_requested_at: string | null;
  completion_confirmed_by: string | null;
  completion_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: MessageType;
  content: string;
  delivery_status: MessageDeliveryStatus;
  read_at: string | null;
  created_at: string;
};

export type ConversationListItem = ConversationRow & {
  other_user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    email: string | null;
    hostel_block: string | null;
  };
  unread_count: number;
  section: ChatSection;
};

export type ChatSection = "new" | "ongoing" | "completed" | "reported";

export type ParticipantTrustInfo = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  member_since: string;
  rating_avg: number;
  rating_count: number;
  total_sold: number;
  total_rented_out: number;
  is_vit_verified: boolean;
  is_seller_verified: boolean;
};

const CONVERSATIONS_TABLE = "conversations" as unknown as keyof Database["public"]["Tables"];
const MESSAGES_TABLE = "messages" as unknown as keyof Database["public"]["Tables"];
const PRESENCE_TABLE = "user_presence" as unknown as keyof Database["public"]["Tables"];
const CHAT_REPORTS_TABLE = "chat_reports" as unknown as keyof Database["public"]["Tables"];
const RATINGS_TABLE = "conversation_ratings" as unknown as keyof Database["public"]["Tables"];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const conversationsQueryKey = (userId: string | null) => ["conversations", userId] as const;

export const messagesQueryKey = (conversationId: string | null) =>
  ["messages", conversationId] as const;

export const unreadChatsQueryKey = (userId: string | null) =>
  ["chats_unread_count", userId] as const;

export type ChatMutationResult = { conversationId?: string };

export function invalidateChatQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  void queryClient.invalidateQueries({ queryKey: ["chats_unread_count"] });
}

export function classifyConversationSection(conv: ConversationRow, _userId: string): ChatSection {
  if (conv.is_reported || conv.status === "reported") return "reported";
  if (conv.status === "completed" || conv.status === "auto_archived") return "completed";
  if (conv.status === "archived") return "completed";
  if (conv.status === "completion_pending") return "ongoing"; // Completion pending conversations are ongoing
  // New: conversation exists but no actual chat interaction has started yet
  if (!conv.last_message_at) return "new";
  // Ongoing: has user messages, transaction not completed, not reported
  return "ongoing";
}

export function getDefaultChatSection(conversations: ConversationListItem[]): ChatSection {
  const priority: ChatSection[] = ["new", "ongoing", "completed", "reported"];
  for (const section of priority) {
    if (conversations.some((c) => c.section === section)) return section;
  }
  return "ongoing";
}

export function getConversationPreview(conv: ConversationListItem) {
  if (conv.last_message_preview) return conv.last_message_preview;
  if (conv.section === "new") return "Start the conversation";
  return "No messages yet";
}

export function getConversationTimestamp(conv: ConversationListItem) {
  return conv.last_message_at ?? conv.created_at;
}

export function getUnreadForUser(conv: ConversationRow, userId: string) {
  return userId === conv.buyer_id ? conv.buyer_unread_count : conv.seller_unread_count;
}

export function isChatAllowedForContext(
  contextType: ChatContextType,
  requestStatus: string | undefined,
) {
  switch (contextType) {
    case "product":
      return isChatUnlockedForProductRequest(
        requestStatus as Parameters<typeof isChatUnlockedForProductRequest>[0],
      );
    case "rental":
      return isChatUnlockedForRentalRequest(
        requestStatus as Parameters<typeof isChatUnlockedForRentalRequest>[0],
      );
    case "food":
      return isChatUnlockedForFoodOrder(
        requestStatus as Parameters<typeof isChatUnlockedForFoodOrder>[0],
      );
    case "notes":
      return isChatUnlockedForNotesPurchase(
        requestStatus as Parameters<typeof isChatUnlockedForNotesPurchase>[0],
      );
    default:
      return false;
  }
}

async function enrichConversations(
  rows: ConversationRow[],
  userId: string,
): Promise<ConversationListItem[]> {
  if (!rows.length) return [];

  const otherIds = rows.map((r) => (r.buyer_id === userId ? r.seller_id : r.buyer_id));
  const uniqueIds = [...new Set(otherIds)];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url,email,hostel_block")
    .in("id", uniqueIds);

  const profileMap = new Map<string, {
    id: string;
    display_name: string;
    avatar_url: string | null;
    email: string | null;
    hostel_block: string | null;
  }>(
    (profiles ?? []).map(
      (p: { id: string; full_name: string | null; avatar_url: string | null; email: string | null; hostel_block: string | null }) => [
        p.id,
        {
          id: p.id,
          display_name: p.full_name ?? "Student",
          avatar_url: p.avatar_url,
          email: p.email ?? null,
          hostel_block: p.hostel_block,
        },
      ],
    ),
  );

  return rows.map((r) => {
    const otherId = r.buyer_id === userId ? r.seller_id : r.buyer_id;
    return {
      ...r,
      other_user: profileMap.get(otherId) ?? {
        id: otherId,
        display_name: "Student",
        avatar_url: null,
        email: null,
        hostel_block: null,
      },
      unread_count: getUnreadForUser(r, userId),
      section: classifyConversationSection(r, userId),
    };
  });
}

export async function fetchConversations(userId: string): Promise<ConversationListItem[]> {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("*")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = [...((data ?? []) as unknown as ConversationRow[])].sort((a, b) => {
    const aTime = new Date(a.last_message_at ?? a.created_at).getTime();
    const bTime = new Date(b.last_message_at ?? b.created_at).getTime();
    return bTime - aTime;
  });
  return enrichConversations(rows, userId);
}

export async function fetchUnreadChatCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("buyer_id,seller_id,buyer_unread_count,seller_unread_count")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  if (error) throw error;

  return ((data ?? []) as ConversationRow[]).reduce((sum, c) => {
    return sum + getUnreadForUser(c, userId);
  }, 0);
}

export async function fetchConversation(
  conversationId: string,
  userId: string,
): Promise<ConversationListItem | null> {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const enriched = await enrichConversations([data as unknown as ConversationRow], userId);
  return enriched[0] ?? null;
}

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as MessageRow[];
}

export async function fetchParticipantTrust(userId: string): Promise<ParticipantTrustInfo> {
  const [{ data: profile }, { data: seller }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,avatar_url,email,created_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("seller_profiles")
      .select(
        "user_id,display_name,avatar_url,joined_at,rating_avg,rating_count,total_sold,total_rented_out",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const p = profile as {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
    created_at: string;
  } | null;

  const s = seller as {
    display_name: string;
    avatar_url: string | null;
    joined_at: string;
    rating_avg: number;
    rating_count: number;
    total_sold: number;
    total_rented_out: number;
  } | null;

  const email = p?.email ?? "";
  return {
    user_id: userId,
    display_name: s?.display_name ?? p?.full_name ?? "Student",
    avatar_url: s?.avatar_url ?? p?.avatar_url ?? null,
    email,
    member_since: s?.joined_at ?? p?.created_at ?? new Date().toISOString(),
    rating_avg: Number(s?.rating_avg ?? 0),
    rating_count: Number(s?.rating_count ?? 0),
    total_sold: Number(s?.total_sold ?? 0),
    total_rented_out: Number(s?.total_rented_out ?? 0),
    is_vit_verified: email.toLowerCase().endsWith("@vitstudent.ac.in"),
    is_seller_verified: Number(s?.rating_count ?? 0) >= 3 && Number(s?.rating_avg ?? 0) >= 4,
  };
}

export async function getOrCreateConversation(input: {
  buyerId: string;
  sellerId: string;
  contextType: ChatContextType;
  contextId: string;
  requestId?: string;
  listingTitle: string;
}): Promise<string> {
  console.log("[Conversation] Starting creation");
  console.log("[getOrCreateConversation] Called with:", {
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    contextType: input.contextType,
    contextId: input.contextId,
    requestId: input.requestId,
    listingTitle: input.listingTitle,
  });

  const { data, error } = await supabase.rpc(
    "get_or_create_conversation" as never,
    {
      p_buyer_id: input.buyerId,
      p_seller_id: input.sellerId,
      p_context_type: input.contextType,
      p_context_id: input.contextId,
      p_request_id: input.requestId ?? null,
      p_listing_title: input.listingTitle,
    } as never,
  );

  console.log("[getOrCreateConversation] RPC result:", { data, error });

  if (!error && data) {
    console.log("[Conversation] Created successfully via RPC:", data);
    return data as string;
  }

  console.log(
    "[getOrCreateConversation] RPC failed or returned null, checking existing conversation",
  );

  const { data: existing } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("id")
    .eq("buyer_id", input.buyerId)
    .eq("context_type", input.contextType)
    .eq("context_id", input.contextId)
    .maybeSingle();

  console.log("[getOrCreateConversation] Existing conversation:", existing);

  if (existing) {
    console.log("[Conversation] Created successfully (existing):", (existing as { id: string }).id);
    return (existing as { id: string }).id;
  }

  console.log("[getOrCreateConversation] No existing conversation, inserting new one");

  const { data: inserted, error: insertErr } = await supabase
    .from(CONVERSATIONS_TABLE)
    .insert({
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
      context_type: input.contextType,
      context_id: input.contextId,
      request_id: input.requestId ?? null,
      listing_title: input.listingTitle,
      status: "active",
    })
    .select("id")
    .single();

  console.log("[getOrCreateConversation] Insert result:", { inserted, insertErr });

  if (insertErr) {
    console.error("[Conversation] Failed:", insertErr);
    throw insertErr ?? error;
  }
  console.log("[Conversation] Created successfully via insert:", (inserted as { id: string }).id);
  return (inserted as { id: string }).id;
}

export async function findConversationForListing(input: {
  userId: string;
  contextType: ChatContextType;
  contextId: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("id")
    .eq("context_type", input.contextType)
    .eq("context_id", input.contextId)
    .or(`buyer_id.eq.${input.userId},seller_id.eq.${input.userId}`)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

export function useConversations(userId: string | null | undefined) {
  return useQuery({
    queryKey: conversationsQueryKey(userId ?? null),
    queryFn: () => fetchConversations(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useUnreadChatCount(userId: string | null | undefined) {
  return useQuery({
    queryKey: unreadChatsQueryKey(userId ?? null),
    queryFn: () => fetchUnreadChatCount(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    throwOnError: false,
  });
}

export function useConversation(
  conversationId: string | undefined,
  userId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["conversation", conversationId, userId],
    queryFn: () => fetchConversation(conversationId!, userId!),
    enabled: Boolean(conversationId && userId),
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: messagesQueryKey(conversationId ?? null),
    queryFn: () => fetchMessages(conversationId!),
    enabled: Boolean(conversationId),
  });
}

export function useParticipantTrust(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["participant_trust", userId],
    queryFn: () => fetchParticipantTrust(userId!),
    enabled: Boolean(userId),
  });
}

// Singleton registries to prevent duplicate channel subscriptions
const messageChannels = new Map<string, ReturnType<typeof supabase.channel>>();
const conversationChannels = new Map<string, ReturnType<typeof supabase.channel>>();
const presenceChannels = new Map<string, ReturnType<typeof supabase.channel>>();

export function useMessageRealtime(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `messages:${conversationId}`;

    // Return early if channel already exists (singleton pattern)
    if (messageChannels.has(channelName)) {
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
      (payload: { new: MessageRow }) => {
        const newMsg = payload.new as MessageRow;
          queryClient.setQueryData<MessageRow[]>(messagesQueryKey(conversationId), (old) => {
            if (!old) return [newMsg];
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(null) });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: MessageRow }) => {
          const updated = payload.new as MessageRow;
          queryClient.setQueryData<MessageRow[]>(
            messagesQueryKey(conversationId),
            (old) => old?.map((m) => (m.id === updated.id ? updated : m)) ?? [],
          );
        },
      )
      .subscribe();

    // Store channel in registry
    messageChannels.set(channelName, channel);

    return () => {
      // Remove from registry and cleanup channel
      messageChannels.delete(channelName);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

export function useConversationRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channelName = `conversations:${userId}`;

    // Return early if channel already exists (singleton pattern)
    if (conversationChannels.has(channelName)) {
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId) });
        void queryClient.invalidateQueries({ queryKey: unreadChatsQueryKey(userId) });
      })
      .subscribe();

    // Store channel in registry
    conversationChannels.set(channelName, channel);

    return () => {
      // Remove from registry and cleanup channel
      conversationChannels.delete(channelName);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

export function usePresence(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["presence", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from(PRESENCE_TABLE)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        user_id: string;
        is_online: boolean;
        last_seen_at: string;
        typing_conversation_id: string | null;
        typing_updated_at: string | null;
      } | null;
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function usePresenceRealtime(otherUserId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!otherUserId) return;

    const channelName = `presence:${otherUserId}`;

    // Return early if channel already exists (singleton pattern)
    if (presenceChannels.has(channelName)) {
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `user_id=eq.${otherUserId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["presence", otherUserId] });
        },
      )
      .subscribe();

    // Store channel in registry
    presenceChannels.set(channelName, channel);

    return () => {
      // Remove from registry and cleanup channel
      presenceChannels.delete(channelName);
      void supabase.removeChannel(channel);
    };
  }, [otherUserId, queryClient]);
}

export function useUpdatePresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const setOnline = async (online: boolean) => {
      await supabase.from(PRESENCE_TABLE).upsert(
        {
          user_id: userId,
          is_online: online,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    };

    void setOnline(true);
    const interval = setInterval(() => void setOnline(true), 30000);

    const handleUnload = () => {
      void supabase.from(PRESENCE_TABLE).upsert({
        user_id: userId,
        is_online: false,
        last_seen_at: new Date().toISOString(),
      });
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      void setOnline(false);
    };
  }, [userId]);
}

export function useSetTyping(
  userId: string | null | undefined,
  conversationId: string | undefined,
) {
  return useMutation({
    mutationFn: async (isTyping: boolean) => {
      if (!userId || !conversationId) return;
      await supabase.from(PRESENCE_TABLE).upsert(
        {
          user_id: userId,
          typing_conversation_id: isTyping ? conversationId : null,
          typing_updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    },
  });
}

export function useRequestCompletion(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!userId) throw new Error("Authentication required");

      const { error } = await supabase.rpc("request_conversation_completion", {
        p_conversation_id: conversationId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateChatQueries(queryClient);
      toast.success("Completion requested");
    },
  });
}

export function useDeclineCompletion(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!userId) throw new Error("Authentication required");

      const { error } = await supabase.rpc("decline_conversation_completion", {
        p_conversation_id: conversationId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateChatQueries(queryClient);
      toast.success("Completion declined");
    },
  });
}

export function useDeclineConversationCompletion(userId: string | null | undefined) {
  return useDeclineCompletion(userId);
}

export function useSendMessage(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      content: string;
      messageType?: MessageType;
      recipientId: string;
      listingTitle: string;
    }) => {
      // Check ban status before sending message
      if (userId) {
        const banStatus = await checkBanStatus(userId);
        if (banStatus.isBanned) {
          throw new Error(banStatus.isPermanent 
            ? "Your account has been permanently banned." 
            : `Your account is banned until ${new Date(banStatus.bannedUntil!).toLocaleDateString()}.`
          );
        }
      }

      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .insert({
          conversation_id: input.conversationId,
          sender_id: userId!,
          message_type: input.messageType ?? "text",
          content: input.content,
        })
        .select("*")
        .single();
      if (error) {
        console.error("[Chat] Message insert failed:", error);
        throw error;
      }
      console.log("[Chat] Message inserted successfully");

      try {
        await createNotification({
          userId: input.recipientId,
          title: "New message",
          description: `New message about "${input.listingTitle}".`,
          priority: "informational",
          module: "chats",
          actionUrl: `/chats/${input.conversationId}`,
          metadata: { conversationId: input.conversationId },
        });
      } catch (notifErr) {
        console.error("[Chat] Notification failed (non-blocking):", notifErr);
      }

      console.log("[Chat] Send completed");
      return data as unknown as MessageRow;
    },
    onSuccess: (msg) => {
      queryClient.setQueryData<MessageRow[]>(messagesQueryKey(msg.conversation_id), (old) => {
        if (!old) return [msg];
        if (old.some((m) => m.id === msg.id)) return old;
        return [...old, msg];
      });
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      void queryClient.invalidateQueries({ queryKey: unreadChatsQueryKey(userId ?? null) });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    },
  });
}

export function useUploadChatImage(userId: string | null | undefined) {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("Not signed in");
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error("Only JPEG, PNG, GIF, and WebP images are allowed.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      return path;
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not upload image");
    },
  });
}

export function getChatImageUrl(storagePath: string) {
  return supabase.storage.from("chat-images").getPublicUrl(storagePath).data.publicUrl;
}

export function useMarkConversationRead(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc(
        "mark_conversation_read" as never,
        {
          p_conversation_id: conversationId,
        } as never,
      );
      if (error) throw error;
    },
    onSettled: (_, __, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      void queryClient.invalidateQueries({ queryKey: unreadChatsQueryKey(userId ?? null) });
    },
  });
}

export function useArchiveConversation(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      console.debug("[useArchiveConversation] Archiving conversation", { conversationId });
      const { error } = await supabase
        .from(CONVERSATIONS_TABLE)
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      toast.success("Chat archived");
    },
  });
}

export function useCompleteConversation(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from(CONVERSATIONS_TABLE)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          archived_at: new Date().toISOString(),
          archive_reason: "Transaction completed",
        })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      toast.success("Transaction marked complete");
    },
  });
}

export function useRequestConversationCompletion(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from(CONVERSATIONS_TABLE)
        .update({
          status: "completion_pending",
          completion_requested_by: userId,
          completion_requested_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      toast.success("Completion requested. Waiting for confirmation.");
    },
  });
}

export function useConfirmConversationCompletion(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data: conversation, error: conversationError } = await supabase
  .from(CONVERSATIONS_TABLE)
  .select("id, context_type, context_id, request_id")
  .eq("id", conversationId)
  .single();
  if (conversationError) throw conversationError;

  console.log("context_type =", conversation.context_type);
console.log("context_id =", conversation.context_id);
console.log("request_id =", conversation.request_id);

   const { error } = await supabase
        .from(CONVERSATIONS_TABLE)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          archived_at: new Date().toISOString(),
          archive_reason: "Both participants confirmed completion",
          completion_requested_by: null,
          completion_requested_at: null,
        })
        .eq("id", conversationId);

         if (error) throw error;

  if (conversation.context_type === "product") {
  const { error: productRequestError } = await supabase
  .from("product_requests")
  .update({ status: "completed" })
  .eq("id", conversation.request_id);

if (productRequestError) {
  console.error("Product request update failed", productRequestError);
}

  const { error: productError } = await supabase
  .from("product_listings")
  .update({ status: "sold" })
  .eq("id", conversation.context_id);

if (productError) {
  console.error("Product update failed", productError);
}
}
if (conversation.context_type === "rental") {
 const { error: rentalRequestError } = await supabase
  .from("rental_requests")
  .update({ status: "completed" })
  .eq("id", conversation.request_id);

if (rentalRequestError) {
  console.error("Rental request update failed", rentalRequestError);
}

 const { error: rentalError } = await supabase
  .from("rental_listings")
  .update({ status: "rented_out" })
  .eq("id", conversation.context_id);

if (rentalError) {
  console.error("Rental update failed", rentalError);
}
}
if (conversation.context_type === "food") {
  // Update food_order status using request_id
  if (conversation.request_id) {
    const { error: foodOrderError } = await supabase
      .from("food_orders")
      .update({ status: "completed" })
      .eq("id", conversation.request_id);
    if (foodOrderError) console.error("Food order update failed", foodOrderError);
  }

  // context_id is food_listings.id for listing chats,
  // food_requests.id for request chats — try both, one will silently no-op
  const { error: foodListingError } = await supabase
    .from("food_listings")
    .update({ status: "sold" })
    .eq("id", conversation.context_id);
  if (foodListingError) console.error("Food listing update failed", foodListingError);

  // Only mark food_request fulfilled if context_id matches a food_request
  // (i.e. this is a food request chat, not a food listing chat)
  if (conversation.context_id !== conversation.request_id) {
    const { error: foodRequestError } = await supabase
      .from("food_requests")
      .update({ status: "fulfilled" })
      .eq("id", conversation.context_id);
    if (foodRequestError) console.error("Food request update failed", foodRequestError);
  }
}
if (conversation.context_type === "notes") {
  const { data: notesListing } = await supabase
    .from("notes_listings")
    .select("listing_type")
    .eq("id", conversation.context_id)
    .maybeSingle();

  const listingType = (notesListing as { listing_type?: "sell" | "rent" } | null)?.listing_type;

  const { error: notesRequestError } = await supabase
    .from("notes_purchase_requests")
    .update({ status: "completed" })
    .eq("id", conversation.request_id);
  if (notesRequestError) console.error("Notes request update failed", notesRequestError);

  // ← ADD THIS: mark notes_requests as fulfilled so it disappears from marketplace
  const { error: notesMarketRequestError } = await supabase
    .from("notes_requests")
    .update({ status: "fulfilled" })
    .eq("id", conversation.context_id);
  if (notesMarketRequestError) console.error("Notes market request update failed", notesMarketRequestError);

  if (listingType !== "rent") {
    const { error: notesError } = await supabase
      .from("notes_listings")
      .update({ status: "unavailable" })
      .eq("id", conversation.context_id);
    if (notesError) console.error("Notes update failed", notesError);
  }
}
     
      console.log("Completed conversation:", conversation);
    },
    onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
  void queryClient.invalidateQueries({ queryKey: ["notes_listing"] });
  void queryClient.invalidateQueries({ queryKey: ["notes", "listings"] });
  void queryClient.invalidateQueries({ queryKey: ["marketplace_home", "recommendations", "notes"] });
  void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
  // Invalidate food queries so listings/requests disappear immediately
  void queryClient.invalidateQueries({ queryKey: ["food_listings"] });
  void queryClient.invalidateQueries({ queryKey: ["food"] });
  void queryClient.invalidateQueries({ queryKey: ["marketplace_home", "recommendations", "food"] });
  void queryClient.invalidateQueries({ queryKey: ["food_requests"] });
  toast.success("Transaction completed");
},
  });
}

export function useWithdrawCompletionRequest(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from(CONVERSATIONS_TABLE)
        .update({
          status: "active",
          completion_requested_by: null,
          completion_requested_at: null,
        })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      toast.success("Completion request withdrawn");
    },
  });
}

export function useReopenArchivedChat(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from(CONVERSATIONS_TABLE)
        .update({
          status: "active",
          archived_at: null,
          archive_reason: null,
        })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      toast.success("Chat reopened");
    },
  });
}

export function useSubmitChatReport(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      reportTarget: ChatReportTarget;
      reportedUserId?: string;
      reason: ChatReportReason;
      details?: string;
      notifyAdmin?: boolean;
      listingTitle?: string;
    }) => {
      // Check ban status before submitting chat report
      if (userId) {
        const banStatus = await checkBanStatus(userId);
        if (banStatus.isBanned) {
          throw new Error(banStatus.isPermanent 
            ? "Your account has been permanently banned." 
            : `Your account is banned until ${new Date(banStatus.bannedUntil!).toLocaleDateString()}.`
          );
        }
      }

      const { error: reportErr } = await supabase.from(CHAT_REPORTS_TABLE).insert({
        conversation_id: input.conversationId,
        reporter_id: userId!,
        report_target: input.reportTarget,
        reported_user_id: input.reportedUserId ?? null,
        reason: input.reason,
        details: input.details?.trim() || null,
      });
      if (reportErr) throw reportErr;

      const { error: convErr } = await supabase
        .from(CONVERSATIONS_TABLE)
        .update({ status: "reported", is_reported: true })
        .eq("id", input.conversationId);
      if (convErr) throw convErr;

      if (input.notifyAdmin) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        for (const admin of admins ?? []) {
          await createNotification({
            userId: (admin as { user_id: string }).user_id,
            title: "Chat Report Filed",
            description: `A chat about "${input.listingTitle ?? "a listing"}" was reported for moderation.`,
            priority: "critical",
            module: "system",
            actionUrl: "/admin",
            metadata: { conversationId: input.conversationId },
          });
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
      toast.success("Report submitted. Our team will review it.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not submit report");
    },
  });
}

export function useSubmitRating(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversationId: string; rating: number; review?: string }) => {
      const { error } = await supabase.from(RATINGS_TABLE).insert({
        conversation_id: input.conversationId,
        rater_id: userId!,
        rating: input.rating,
        review: input.review?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thank you for your review!");
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId ?? null) });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not submit rating");
    },
  });
}

export async function ensureConversationOnAccept(input: {
  buyerId: string;
  sellerId: string;
  contextType: ChatContextType;
  contextId: string;
  requestId: string;
  listingTitle: string;
  notifyBuyer?: boolean;
}) {
  const conversationId = await getOrCreateConversation({
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    contextType: input.contextType,
    contextId: input.contextId,
    requestId: input.requestId,
    listingTitle: input.listingTitle,
  });

  if (input.notifyBuyer) {
    console.log("[ensureConversationOnAccept] Creating notifications for conversation:", {
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      conversationId,
    });

    try {
      console.log(
        "[ensureConversationOnAccept] Creating buyer notification for userId:",
        input.buyerId,
        "title: Chat Ready",
      );
      await createNotification({
        userId: input.buyerId,
        title: "Chat Ready",
        description: `Seller accepted your request for "${input.listingTitle}".`,
        priority: "important",
        module: "chats",
        actionUrl: `/chats/${conversationId}`,
        metadata: { conversationId, requestId: input.requestId },
      });
      console.log("[ensureConversationOnAccept] Buyer notification created successfully");
    } catch (notifErr) {
      console.error(
        "[ensureConversationOnAccept] Buyer notification failed (non-blocking):",
        notifErr,
      );
    }

    try {
      console.log(
        "[ensureConversationOnAccept] Creating seller notification for userId:",
        input.sellerId,
        "title: Chat Ready",
      );
      await createNotification({
        userId: input.sellerId,
        title: "Chat Ready",
        description: `Chat is open with the buyer for "${input.listingTitle}".`,
        priority: "informational",
        module: "chats",
        actionUrl: `/chats/${conversationId}`,
        metadata: { conversationId, requestId: input.requestId },
      });
      console.log("[ensureConversationOnAccept] Seller notification created successfully");
    } catch (notifErr) {
      console.error(
        "[ensureConversationOnAccept] Seller notification failed (non-blocking):",
        notifErr,
      );
    }
  }

  return conversationId;
}

export async function requestConversationCompletion(input: {
  conversationId: string;
  userId: string;
}) {
  const { error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update({
      status: "completion_pending",
      completion_requested_by: input.userId,
      completion_requested_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId);
  if (error) throw error;
}

export async function confirmConversationCompletion(input: {
  conversationId: string;
}) {
  const { error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      archived_at: new Date().toISOString(),
      archive_reason: "Both participants confirmed completion",
      completion_requested_by: null,
      completion_requested_at: null,
    })
    .eq("id", input.conversationId);
  if (error) throw error;

  // Mark the associated request as fulfilled when conversation completes
  const { data: conversation } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("context_type, context_id, request_id")
    .eq("id", input.conversationId)
    .single();

  if (conversation) {
    if (conversation.context_type === "food" && conversation.request_id) {
      await supabase
        .from("food_requests")
        .update({ status: "fulfilled" })
        .eq("id", conversation.request_id);
    } else if (conversation.context_type === "notes" && conversation.request_id) {
      await supabase
        .from("notes_requests")
        .update({ status: "fulfilled" })
        .eq("id", conversation.request_id);
    }
  }
}

export async function withdrawCompletionRequest(input: {
  conversationId: string;
}) {
  const { error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update({
      status: "active",
      completion_requested_by: null,
      completion_requested_at: null,
    })
    .eq("id", input.conversationId);
  if (error) throw error;
}

export async function reopenArchivedChat(input: {
  conversationId: string;
}) {
  const { error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update({
      status: "active",
      archived_at: null,
      archive_reason: null,
    })
    .eq("id", input.conversationId);
  if (error) throw error;
}

export async function completeConversationForRequest(input: {
  buyerId: string;
  contextType: ChatContextType;
  contextId: string;
}) {
  console.debug("[completeConversationForRequest] Archiving conversation", {
    buyerId: input.buyerId,
    contextType: input.contextType,
    contextId: input.contextId,
  });
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      archived_at: new Date().toISOString(),
      archive_reason: "Transaction completed",
    })
    .eq("buyer_id", input.buyerId)
    .eq("context_type", input.contextType)
    .eq("context_id", input.contextId)
    .select("id,status,archived_at,request_id")
    .single();
  console.debug("[completeConversationForRequest] Archive result", { data, error });
  if (error) throw error;

  // Mark the associated request as fulfilled when conversation completes
  if (data && data.request_id) {
    if (input.contextType === "food") {
      await supabase
        .from("food_requests")
        .update({ status: "fulfilled" })
        .eq("id", data.request_id);
    } else if (input.contextType === "notes") {
      await supabase
        .from("notes_requests")
        .update({ status: "fulfilled" })
        .eq("id", data.request_id);
    }
  }
}

export async function fetchRentalRequestStatus(conversation: ConversationRow): Promise<string | null> {
  if (conversation.context_type === "rental" && conversation.request_id) {
    const { data } = await supabase
      .from("rental_requests" as unknown as keyof Database["public"]["Tables"])
      .select("status")
      .eq("id", conversation.request_id)
      .maybeSingle();
    return (data as { status: string } | null)?.status ?? null;
  }
  if (conversation.context_type === "notes" && conversation.request_id) {
    const { data } = await supabase
      .from("notes_purchase_requests" as unknown as keyof Database["public"]["Tables"])
      .select("status")
      .eq("id", conversation.request_id)
      .maybeSingle();
    return (data as { status: string } | null)?.status ?? null;
  }
  return null;
}

export function filterConversationsBySection(
  conversations: ConversationListItem[],
  section: ChatSection,
) {
  return conversations.filter((c) => c.section === section);
}

export function formatChatTime(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function useIsTyping(
  otherPresence: ReturnType<typeof usePresence>["data"],
  conversationId: string,
) {
  return useMemo(() => {
    if (!otherPresence?.typing_conversation_id) return false;
    if (otherPresence.typing_conversation_id !== conversationId) return false;
    if (!otherPresence.typing_updated_at) return false;
    return Date.now() - new Date(otherPresence.typing_updated_at).getTime() < 5000;
  }, [otherPresence, conversationId]);
}
