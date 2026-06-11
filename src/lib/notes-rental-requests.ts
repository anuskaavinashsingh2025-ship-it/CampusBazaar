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

export type NotesRentalStatus = "pending" | "accepted" | "active_rental" | "return_requested" | "rejected" | "returned" | "completed" | "cancelled";

export type NotesRentalRow = {
  id: string;
  notes_listing_id: string;
  buyer_id: string;
  seller_id: string;
  message: string | null;
  status: NotesRentalStatus;
  created_at: string;
  updated_at: string;
};

const REQUESTS_TABLE = "notes_purchase_requests" as unknown as keyof Database["public"]["Tables"];
const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];

export function useNotesRentalForListing(
  notesListingId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["notes_rental", notesListingId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("notes_listing_id", notesListingId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as NotesRentalRow | null;
    },
    enabled: Boolean(notesListingId && buyerId),
  });
}

export function useSellerNotesRentals(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["notes_rentals", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NotesRentalRow[];
    },
    enabled: Boolean(sellerId),
  });
}

export function useBuyerNotesRentals(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["notes_rentals", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NotesRentalRow[];
    },
    enabled: Boolean(buyerId),
  });
}

export function useCreateNotesRental() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      notesListingId: string;
      buyerId: string;
      sellerId: string;
      listingTitle: string;
      rentalDurationDays: number;
      message?: string;
      buyerName?: string;
      buyerHostel?: string;
    }) => {
      await enforceBanCheck(input.buyerId, "create a notes rental request");
      
      const messageParts = [
        `Rental Duration: ${input.rentalDurationDays} day${input.rentalDurationDays === 1 ? "" : "s"}`,
      ];
      if (input.message?.trim()) {
        messageParts.push(input.message.trim());
      }
      const message = messageParts.join("\n");
      
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .insert({
          notes_listing_id: input.notesListingId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          message,
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
        title: "New Rental Request",
        description: "Someone wants to rent your notes.",
        priority: "important",
        module: "notes",
        actionUrl: "/requests",
        actions: ownerRequestActions({
          conversationId,
          listingUrl,
          acceptLabel: "Accept Rental",
          rejectLabel: "Reject Rental",
        }),
        conversationId,
        relatedEntityId: data.id,
        listingId: input.notesListingId,
        requestId: data.id,
        buyerId: input.buyerId,
      });

      return data;
    },
    onSuccess: (_: unknown, vars: { notesListingId: string; buyerId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["notes_rentals"] });
      void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
      void queryClient.invalidateQueries({
        queryKey: ["notes_rental", vars.notesListingId, vars.buyerId],
      });
      toast.success("Rental request sent!");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not send rental request");
    },
  });
}

export function useUpdateNotesRental() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      status: NotesRentalStatus;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
      listingStatus?: "available" | "rented_out" | "unavailable";
    }): Promise<ChatMutationResult> => {
      console.log("[useUpdateNotesRental] Called with:", {
        requestId: input.requestId,
        status: input.status,
      });
      let conversationId: string | undefined;
      
      const { error } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: input.status })
        .eq("id", input.requestId);
      if (error) {
        console.error("[useUpdateNotesRental] Status update error:", error);
        throw error;
      }
      console.log("[useUpdateNotesRental] Status updated to:", input.status);

      if (input.listingStatus) {
        const { data: reqRow, error: reqErr } = await supabase
          .from(REQUESTS_TABLE)
          .select("notes_listing_id")
          .eq("id", input.requestId)
          .maybeSingle();

        if (reqErr) {
          console.error("[useUpdateNotesRental] Request lookup error:", reqErr);
          throw reqErr;
        }

        if (reqRow) {
          const listingId = (reqRow as { notes_listing_id: string }).notes_listing_id;
          const { data: existingListing, error: existingErr } = await supabase
            .from(NOTES_LISTINGS_TABLE)
            .select("id,status")
            .eq("id", listingId)
            .maybeSingle();

          if (existingErr) {
            console.error("[useUpdateNotesRental] Listing lookup error:", existingErr);
            throw existingErr;
          }

          const nextStatus =
            input.listingStatus === "available"
              ? "available"
              : input.listingStatus === "rented_out"
                ? "rented_out"
                : "unavailable";

          const { data: listingData, error: listingErr } = await supabase
            .from(NOTES_LISTINGS_TABLE)
            .update({ status: nextStatus })
            .eq("id", listingId)
            .select("id,status")
            .single();

          if (listingErr) {
            console.error("[useUpdateNotesRental] Listing update error:", listingErr);
            throw listingErr;
          }

          console.debug("[useUpdateNotesRental] Listing status update", {
            requestId: input.requestId,
            listingId,
            oldStatus: (existingListing as { status?: string } | null)?.status ?? null,
            newStatus: nextStatus,
            dbResponse: listingData,
          });
        }
      }

      if (
        input.status === "accepted" ||
        input.status === "completed" ||
        input.status === "rejected" ||
        input.status === "active_rental"
      ) {
        console.log("[useUpdateNotesRental] Status is accepted/completed/active, fetching request row");
        const { data: reqRow } = await supabase
          .from(REQUESTS_TABLE)
          .select("buyer_id,seller_id,notes_listing_id")
          .eq("id", input.requestId)
          .maybeSingle();

        console.log("[useUpdateNotesRental] Request row:", reqRow);

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

          console.log("[useUpdateNotesRental] Listing title:", title);

          if (input.status === "accepted" || input.status === "active_rental") {
            console.log("[useUpdateNotesRental] Calling ensureConversationOnAccept");
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "notes",
              contextId: row.notes_listing_id,
              requestId: input.requestId,
              listingTitle: title,
              notifyBuyer: false,
            });
            console.log("[useUpdateNotesRental] Conversation ID returned:", conversationId);
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
                    ? "Rental Completed"
                    : input.status === "rejected"
                      ? "Rental Request Declined"
                      : input.status === "active_rental"
                        ? "Rental Started"
                        : input.notificationTitle || "Rental Request Accepted",
                description:
                  input.status === "completed"
                    ? "This rental has been completed successfully."
                    : input.status === "rejected"
                      ? "The owner declined your rental request."
                      : input.status === "active_rental"
                        ? "Your rental has started. You can now access the notes."
                        : input.notificationDescription || "Your rental request has been accepted by the owner.",
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
                "[useUpdateNotesRental] Notification creation failed (non-blocking):",
                notifErr,
              );
            }
          }
        } else {
          console.error("[useUpdateNotesRental] Request row not found for ID:", input.requestId);
        }
      }
      console.log("[useUpdateNotesRental] Returning conversationId:", conversationId);
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes_rentals"] });
      void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["notes_listing"] });
      void queryClient.invalidateQueries({ queryKey: ["notes", "listings"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace_home", "recommendations", "notes"] });
      void queryClient.invalidateQueries({ queryKey: ["seller_notes"] });
      void queryClient.invalidateQueries({ queryKey: ["seller_completed_notes"] });
      void queryClient.invalidateQueries({ queryKey: ["similar_listings", "notes"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not update rental request");
    },
  });
}

export function isChatUnlockedForNotesRental(status: NotesRentalStatus | undefined) {
  return status === "accepted" || status === "active_rental" || status === "return_requested" || status === "returned" || status === "completed";
}

export function parseRentalDurationFromMessage(message: string | null): number | null {
  if (!message) return null;
  const match = message.match(/Rental Duration:\s*(\d+)\s*day/);
  return match ? parseInt(match[1], 10) : null;
}
