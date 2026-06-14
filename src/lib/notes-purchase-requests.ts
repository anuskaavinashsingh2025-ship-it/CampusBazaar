import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  completeConversationForRequest,
  ensureConversationOnAccept,
  getOrCreateConversation,
  invalidateChatQueries,
  type ChatMutationResult,
} from "@/lib/chat";
import {
  createTransactionNotification,
  ownerRequestActions,
  acceptedActions,
  rejectedActions,
  completedActions,
  viewListingUrl,
} from "@/lib/transaction-notifications";
import { enforceBanCheck } from "@/lib/ban-enforcement";

export type NotesPurchaseStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type NotesPurchaseRow = {
  id: string;
  notes_listing_id: string;
  buyer_id: string;
  seller_id: string;
  message: string | null;
  status: NotesPurchaseStatus;
  created_at: string;
  updated_at: string;
  conversation_id: string | null;
};

const REQUESTS_TABLE = "notes_purchase_requests" as unknown as keyof Database["public"]["Tables"];
const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];

export function useNotesPurchaseForListing(
  notesListingId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["notes_purchase", notesListingId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("notes_listing_id", notesListingId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as NotesPurchaseRow | null;
    },
    enabled: Boolean(notesListingId && buyerId),
  });
}

export function useSellerNotesPurchases(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["notes_purchases", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const purchases = (data ?? []) as unknown as NotesPurchaseRow[];
      if (!purchases.length) return purchases;
      
      const conversationIds = [...new Set(purchases.map((p) => p.id))];
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id,request_id")
        .in("request_id", conversationIds)
        .eq("context_type", "notes");
      
      const conversationMap = new Map<string, string>();
      for (const conv of conversations ?? []) {
        const row = conv as { id: string; request_id: string };
        conversationMap.set(row.request_id, row.id);
      }
      
      return purchases.map((p) => ({
        ...p,
        conversation_id: conversationMap.get(p.id) ?? null,
      }));
    },
    enabled: Boolean(sellerId),
  });
}

export function useBuyerNotesPurchases(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["notes_purchases", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const purchases = (data ?? []) as unknown as NotesPurchaseRow[];
      if (!purchases.length) return purchases;
      
      const conversationIds = [...new Set(purchases.map((p) => p.id))];
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id,request_id")
        .in("request_id", conversationIds)
        .eq("context_type", "notes"); 
      
      const conversationMap = new Map<string, string>();
      for (const conv of conversations ?? []) {
        const row = conv as { id: string; request_id: string };
        conversationMap.set(row.request_id, row.id);
      }
      
      return purchases.map((p) => ({
        ...p,
        conversation_id: conversationMap.get(p.id) ?? null,
      }));
    },
    enabled: Boolean(buyerId),
  });
}

export function useCreateNotesPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      notesListingId: string;
      buyerId: string;
      sellerId: string;
      listingTitle: string;
      message?: string;
      buyerName?: string;
      buyerHostel?: string;
    }) => {
      await enforceBanCheck(input.buyerId, "create a notes purchase request");
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .insert({
          notes_listing_id: input.notesListingId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          message: input.message?.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      const conversationId = await getOrCreateConversation({
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        contextType: "notes",
        contextId: input.notesListingId,
        requestId: data.id,
        listingTitle: input.listingTitle,
      });
      const listingUrl = viewListingUrl("notes", input.notesListingId);

      await createTransactionNotification({
        receiverId: input.sellerId,
        senderId: input.buyerId,
        title: "New Purchase Request",
        description: "Someone is interested in purchasing your listing.",
        priority: "important",
        module: "notes",
        actionUrl: "/requests",
        actions: ownerRequestActions({
          conversationId,
          listingUrl,
          acceptLabel: "Accept Deal",
          rejectLabel: "Reject Deal",
        }),
        conversationId,
        relatedEntityId: data.id,
        listingId: input.notesListingId,
        requestId: data.id,
        buyerId: input.buyerId,
      });

      return data;
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
      void queryClient.invalidateQueries({
        queryKey: ["notes_purchase", vars.notesListingId, vars.buyerId],
      });
      toast.success("Request sent!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    },
  });
}

export function useUpdateNotesPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      status: NotesPurchaseStatus;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
    }): Promise<ChatMutationResult> => {
      console.log("[useUpdateNotesPurchase] Called with:", {
        requestId: input.requestId,
        status: input.status,
      });
      let conversationId: string | undefined;
      const { error } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: input.status })
        .eq("id", input.requestId);
      if (error) {
        console.error("[useUpdateNotesPurchase] Status update error:", error);
        throw error;
      }
      console.log("[useUpdateNotesPurchase] Status updated to:", input.status);

      if (
        input.status === "accepted" ||
        input.status === "completed" ||
        input.status === "rejected"
      ) {
        console.log("[useUpdateNotesPurchase] Status is accepted/completed, fetching request row");
        const { data: reqRow } = await supabase
          .from(REQUESTS_TABLE)
          .select("buyer_id,seller_id,notes_listing_id")
          .eq("id", input.requestId)
          .maybeSingle();

        console.log("[useUpdateNotesPurchase] Request row:", reqRow);

        if (reqRow) {
          const row = reqRow as {
            buyer_id: string;
            seller_id: string;
            notes_listing_id: string;
          };
          const { data: listing } = await supabase
            .from(NOTES_LISTINGS_TABLE)
            .select("title")
            .eq("id", row.notes_listing_id)
            .maybeSingle();
          const title = (listing as { title: string } | null)?.title ?? "Notes listing";

          console.log("[useUpdateNotesPurchase] Listing title:", title);

          if (input.status === "accepted") {
            console.log("[useUpdateNotesPurchase] Calling ensureConversationOnAccept");
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "notes",
              contextId: row.notes_listing_id,
              requestId: input.requestId,
              listingTitle: title,
              notifyBuyer: false,
            });
            console.log("[useUpdateNotesPurchase] Conversation ID returned:", conversationId);
          } else if (input.status === "completed") {
            conversationId = await getOrCreateConversation({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "notes",
              contextId: row.notes_listing_id,
              requestId: input.requestId,
              listingTitle: title,
            });
            await completeConversationForRequest({
              buyerId: row.buyer_id,
              contextType: "notes",
              contextId: row.notes_listing_id,
            });
          } else {
            conversationId = await getOrCreateConversation({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "notes",
              contextId: row.notes_listing_id,
              requestId: input.requestId,
              listingTitle: title,
            });
          }

          if (input.notifyUserId && conversationId) {
            const listingUrl = viewListingUrl("notes", row.notes_listing_id);
            try {
              await createTransactionNotification({
                receiverId: input.notifyUserId,
                senderId: row.seller_id,
                title:
                  input.status === "completed"
                    ? "Transaction Completed"
                    : input.status === "rejected"
                      ? "Request Declined"
                      : "Request Accepted",
                description:
                  input.status === "completed"
                    ? "This transaction has been completed successfully."
                    : input.status === "rejected"
                      ? "The owner declined your request."
                      : "Your request has been accepted by the owner.",
                priority: "important",
                module: "notes",
                actionUrl: input.status === "rejected" ? listingUrl : `/chats/${conversationId}`,
                actions:
                  input.status === "completed"
                    ? completedActions(`/chats/${conversationId}`)
                    : input.status === "rejected"
                      ? rejectedActions("notes", listingUrl)
                      : acceptedActions(conversationId, listingUrl),
                conversationId,
                relatedEntityId: input.requestId,
                listingId: row.notes_listing_id,
                requestId: input.requestId,
                buyerId: row.buyer_id,
              });
            } catch (notifErr) {
              console.error(
                "[useUpdateNotesPurchase] Notification creation failed (non-blocking):",
                notifErr,
              );
            }
          }
        } else {
          console.error("[useUpdateNotesPurchase] Request row not found for ID:", input.requestId);
        }
      }
      console.log("[useUpdateNotesPurchase] Returning conversationId:", conversationId);
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["notes_listing"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update request");
    },
  });
}

export function isChatUnlockedForNotesPurchase(status: NotesPurchaseStatus | undefined) {
  return status === "accepted" || status === "completed";
}
