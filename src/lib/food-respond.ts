import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getOrCreateConversation, invalidateChatQueries, type ChatContextType } from "@/lib/chat";
import { createTransactionNotification } from "@/lib/transaction-notifications";

/**
 * Use the existing `conversations` / `messages` tables (the same ones used
 * by Marketplace, Rent, Food, and Notes-purchase chats) for the
 * "Food Request → Chat" integration.
 *
 * - `context_type` = "food"
 * - `context_id`   = the food_requests.id
 * - `request_id`   = the same food_requests.id (so request_id is populated)
 * - `listing_title` = the request product_name
 *
 * Buyer  = the user who created the request (`food_requests.requester_id`)
 * Seller = the current logged-in user (the responder clicking "I Have This")
 */

const MESSAGES_TABLE = "messages" as const;
const FOOD_REQUESTS_TABLE = "food_requests" as const;

const INITIAL_SYSTEM_MESSAGE = "Started from Food Request";

function buildAutoFirstMessage(productName: string) {
  return `Hi! I'm responding to your food request: ${productName}`;
}

export type RespondToFoodRequestInput = {
  requestId: string;
  requestCreatorId: string; // requester_id
  productName: string; // product_name (used as listing_title + in auto message)
  responderId: string; // current logged-in user (the responder)
};

export function useRespondToFoodRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RespondToFoodRequestInput) => {
      // ----------------------------------------------------------------
      // Step 1: log entry
      // ----------------------------------------------------------------
      console.log("[FOOD REQUEST] Respond clicked", input);
      console.log("[FOOD REQUEST] Request ID", input.requestId);
      console.log("[FOOD REQUEST] Request creator", input.requestCreatorId);

      if (input.responderId === input.requestCreatorId) {
        // A user cannot "respond" to their own request — this is not a fatal
        // error, but we should still surface a friendly message and bail out
        // before creating a self-chat.
        throw new Error("You cannot respond to your own food request.");
      }

      // ----------------------------------------------------------------
      // Step 2: check for an existing conversation for this food request
      // involving both users. getOrCreateConversation() handles the
      // generic (buyer, context_type, context_id) lookup, but we also
      // do a defensive explicit lookup here so we can log the result
      // and avoid creating a duplicate if the participants don't match
      // (e.g. an admin previously opened a chat on the same request).
      // ----------------------------------------------------------------
      const { data: existing, error: existingErr } = await supabase
        .from("conversations" as never)
        .select("id,buyer_id,seller_id,context_type,context_id,request_id")
        .eq("context_type" as never, "food" as never)
        .eq("context_id" as never, input.requestId as never)
        .or(
          `and(buyer_id.eq.${input.requestCreatorId},seller_id.eq.${input.responderId}),and(buyer_id.eq.${input.responderId},seller_id.eq.${input.requestCreatorId})`,
        )
        .maybeSingle();

      if (existingErr) {
        console.error("[FOOD REQUEST] Existing-conversation lookup error", existingErr);
      }

      if (existing) {
        console.log("[FOOD REQUEST] Existing conversation found", (existing as { id: string }).id);
      } else {
        console.log("[FOOD REQUEST] Creating new conversation");
      }

      // ----------------------------------------------------------------
      // Step 3: get-or-create the conversation (single source of truth)
      // ----------------------------------------------------------------
      const conversationId = await getOrCreateConversation({
        buyerId: input.requestCreatorId,
        sellerId: input.responderId,
        contextType: "food" as ChatContextType,
        contextId: input.requestId,
        requestId: input.requestId,
        listingTitle: input.productName,
      });

      console.log("[FOOD REQUEST] Conversation ID", conversationId);

      const { data: authUserData, error: authUserErr } = await supabase.auth.getUser();
      const authUserId = authUserData.user?.id ?? null;
      if (authUserErr) {
        console.error("[FOOD REQUEST] Auth user lookup failed", authUserErr);
        throw authUserErr;
      }
      if (!authUserId) {
        throw new Error("You must be signed in to open chat.");
      }

      const { data: conversationRecord, error: conversationLookupErr } = await supabase
        .from("conversations" as never)
        .select("id, buyer_id, seller_id, status")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversationLookupErr) {
        console.error("[FOOD REQUEST] Conversation lookup failed before message insert", conversationLookupErr);
        throw conversationLookupErr;
      }

      if (!conversationRecord) {
        throw new Error("Conversation record is missing before sending the first message.");
      }

      const isAuthenticatedParticipant =
        conversationRecord.buyer_id === authUserId || conversationRecord.seller_id === authUserId;

      if (!isAuthenticatedParticipant) {
        throw new Error("Authenticated user is not a participant in this conversation.");
      }

      console.log("[FOOD REQUEST] Message insert context", {
        conversation_id: conversationId,
        seller_id: conversationRecord.seller_id,
        buyer_id: conversationRecord.buyer_id,
        sender_id: authUserId,
        user_id: authUserId,
      });

      await createTransactionNotification({
        receiverId: input.requestCreatorId,
        senderId: input.responderId,
        title: "Food Request Response",
        description: "Someone has responded to your food request.",
        priority: "important",
        module: "food",
        actionUrl: `/chats/${conversationId}`,
        actions: [
          { label: "View Request", url: `/food?tab=requests` },
          { label: "Open Chat", url: `/chats/${conversationId}` },
        ],
        conversationId,
        relatedEntityId: input.requestId,
        listingId: input.requestId,
        requestId: input.requestId,
      });

      // ----------------------------------------------------------------
      // Step 4: check if the conversation already has any messages.
      // If it does, we don't re-insert the system message or the auto
      // first message (we'd be spamming the buyer every time they reload).
      // ----------------------------------------------------------------
      const { data: existingMessages, error: msgsErr } = await supabase
        .from(MESSAGES_TABLE)
        .select("id")
        .eq("conversation_id", conversationId)
        .limit(1);

      if (msgsErr) {
        console.error("[FOOD REQUEST] Existing-messages lookup error", msgsErr);
      }

      const hasAnyMessages = (existingMessages ?? []).length > 0;

      if (!hasAnyMessages) {
        // First time the conversation is being opened — insert a system
        // message from the requester ("self") so the thread is never
        // visually empty when the buyer opens the chat.
        console.log("[FOOD REQUEST] Inserting system message", {
          conversation_id: conversationId,
          seller_id: input.responderId,
          buyer_id: input.requestCreatorId,
          sender_id: authUserId,
          user_id: authUserId,
        });

        const { error: sysErr } = await supabase.from(MESSAGES_TABLE).insert({
          conversation_id: conversationId,
          sender_id: authUserId,
          message_type: "text",
          content: INITIAL_SYSTEM_MESSAGE,
        });
        if (sysErr) {
          console.error("[FOOD REQUEST] System message insert error", sysErr);
          // Non-fatal — keep going
        }
      }

      // ----------------------------------------------------------------
      // Step 5: insert the auto first message from the responder,
      // unless the responder has *already* sent a message in this thread
      // (we don't want to spam them either).
      // ----------------------------------------------------------------
      const { data: responderPrevMsgs, error: responderPrevErr } = await supabase
        .from(MESSAGES_TABLE)
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_id", input.responderId)
        .limit(1);

      if (responderPrevErr) {
        console.error("[FOOD REQUEST] Responder-history lookup error", responderPrevErr);
      }

      const responderHasSentBefore = (responderPrevMsgs ?? []).length > 0;
      if (!responderHasSentBefore) {
        const autoMessage = buildAutoFirstMessage(input.productName);

        console.log("[FOOD REQUEST] Inserting auto first message", {
          conversation_id: conversationId,
          seller_id: input.responderId,
          buyer_id: input.requestCreatorId,
          sender_id: authUserId,
          user_id: authUserId,
        });

        const { error: autoErr } = await supabase.from(MESSAGES_TABLE).insert({
          conversation_id: conversationId,
          sender_id: authUserId,
          message_type: "text",
          content: autoMessage,
        });
        if (autoErr) {
          console.error("[FOOD REQUEST] Auto first message insert error", autoErr);
          throw autoErr;
        }

        // Best-effort: refresh the conversation row's preview / last_message_at
        // so the conversation list shows the latest message.
        try {
          await supabase
            .from("conversations" as never)
            .update({
              last_message_at: new Date().toISOString(),
              last_message_preview: autoMessage,
              last_message_sender_id: authUserId,
            } as never)
            .eq("id" as never, conversationId as never);
        } catch (updErr) {
          console.warn("[FOOD REQUEST] Conversation preview update warning", updErr);
        }
      }

      // ----------------------------------------------------------------
      // Step 6: mark the request status as "in_progress" (best-effort).
      // The food_requests.status column is a free-form string, so any
      // non-"open" / non-"fulfilled" value is fine; we use "in_progress".
      // ----------------------------------------------------------------
      try {
        const { error: reqStatusErr } = await supabase
          .from(FOOD_REQUESTS_TABLE)
          .update({ status: "in_progress" })
          .eq("id", input.requestId);
        if (reqStatusErr) {
          console.warn("[FOOD REQUEST] Could not update request status (non-fatal)", reqStatusErr);
        }
      } catch (reqErr) {
        console.warn("[FOOD REQUEST] Request status update threw (non-fatal)", reqErr);
      }

      return { conversationId };
    },
    onSuccess: ({ conversationId }, vars) => {
      // Refresh the relevant React Query caches so the conversation
      // immediately shows up in the Chats list, and the request card
      // reflects the new status.
      invalidateChatQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["food", "requests"] });

      console.log("[FOOD REQUEST] Redirecting to chat", conversationId);
      toast.success("Opening chat with requester…", {
        description: vars.productName,
      });

      return conversationId;
    },
    onError: (err) => {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Could not open chat for this request.";
      console.error("[FOOD REQUEST] Error", err);
      toast.error(message);
    },
  });
}
