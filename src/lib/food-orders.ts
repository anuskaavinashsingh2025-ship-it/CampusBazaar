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

export type FoodOrderStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type FoodOrderRow = {
  id: string;
  food_listing_id: string;
  buyer_id: string;
  seller_id: string;
  quantity: number;
  message: string | null;
  status: FoodOrderStatus;
  created_at: string;
  updated_at: string;
};

const ORDERS_TABLE = "food_orders" as unknown as keyof Database["public"]["Tables"];
const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];

export function useFoodOrderForListing(
  foodListingId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["food_order", foodListingId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .eq("food_listing_id", foodListingId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as FoodOrderRow | null;
    },
    enabled: Boolean(foodListingId && buyerId),
  });
}

export function useSellerFoodOrders(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["food_orders", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FoodOrderRow[];
    },
    enabled: Boolean(sellerId),
  });
}

export function useBuyerFoodOrders(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["food_orders", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FoodOrderRow[];
    },
    enabled: Boolean(buyerId),
  });
}

export function useCreateFoodOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      foodListingId: string;
      buyerId: string;
      sellerId: string;
      productName: string;
      quantity?: number;
      message?: string;
    }) => {
      await enforceBanCheck(input.buyerId, "create a food order");
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .insert({
          food_listing_id: input.foodListingId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          quantity: input.quantity ?? 1,
          message: input.message?.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      const conversationId = await getOrCreateConversation({
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        contextType: "food",
        contextId: input.foodListingId,
        requestId: data.id,
        listingTitle: input.productName,
      });
      const listingUrl = viewListingUrl("food", input.foodListingId);

      await createTransactionNotification({
        receiverId: input.sellerId,
        senderId: input.buyerId,
        title: "New Purchase Request",
        description: "Someone is interested in purchasing your listing.",
        priority: "important",
        module: "food",
        actionUrl: "/requests",
        actions: ownerRequestActions({
          conversationId,
          listingUrl,
          acceptLabel: "Accept Deal",
          rejectLabel: "Reject Deal",
        }),
        conversationId,
        relatedEntityId: data.id,
        listingId: input.foodListingId,
        requestId: data.id,
        buyerId: input.buyerId,
      });

      return data;
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["food_orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["food_order", vars.foodListingId, vars.buyerId],
      });
      toast.success("Order placed!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    },
  });
}

export function useUpdateFoodOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orderId: string;
      status: FoodOrderStatus;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
    }): Promise<ChatMutationResult> => {
      console.log("[useUpdateFoodOrder] Called with:", {
        orderId: input.orderId,
        status: input.status,
      });
      let conversationId: string | undefined;
      const { error } = await supabase
        .from(ORDERS_TABLE)
        .update({ status: input.status })
        .eq("id", input.orderId);
      if (error) {
        console.error("[useUpdateFoodOrder] Status update error:", error);
        throw error;
      }
      console.log("[useUpdateFoodOrder] Status updated to:", input.status);

      if (
        input.status === "accepted" ||
        input.status === "completed" ||
        input.status === "rejected"
      ) {
        console.log("[useUpdateFoodOrder] Status is accepted/completed, fetching order row");
        const { data: orderRow } = await supabase
          .from(ORDERS_TABLE)
          .select("buyer_id,seller_id,food_listing_id")
          .eq("id", input.orderId)
          .maybeSingle();

        console.log("[useUpdateFoodOrder] Order row:", orderRow);

        if (orderRow) {
          const row = orderRow as {
            buyer_id: string;
            seller_id: string;
            food_listing_id: string;
          };
          const { data: listing } = await supabase
            .from(FOOD_LISTINGS_TABLE)
            .select("product_name")
            .eq("id", row.food_listing_id)
            .maybeSingle();
          const title =
            (listing as { product_name: string } | null)?.product_name ?? "Food listing";

          console.log("[useUpdateFoodOrder] Listing title:", title);

          if (input.status === "accepted") {
            console.log("[useUpdateFoodOrder] Calling ensureConversationOnAccept");
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "food",
              contextId: row.food_listing_id,
              requestId: input.orderId,
              listingTitle: title,
              notifyBuyer: false,
            });
            console.log("[useUpdateFoodOrder] Conversation ID returned:", conversationId);
          } else if (input.status === "completed") {
            conversationId = await getOrCreateConversation({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "food",
              contextId: row.food_listing_id,
              requestId: input.orderId,
              listingTitle: title,
            });
            await completeConversationForRequest({
              buyerId: row.buyer_id,
              contextType: "food",
              contextId: row.food_listing_id,
            });
          } else {
            conversationId = await getOrCreateConversation({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "food",
              contextId: row.food_listing_id,
              requestId: input.orderId,
              listingTitle: title,
            });
          }

          if (input.notifyUserId && conversationId) {
            const listingUrl = viewListingUrl("food", row.food_listing_id);
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
                module: "food",
                actionUrl: input.status === "rejected" ? listingUrl : `/chats/${conversationId}`,
                actions:
                  input.status === "completed"
                    ? completedActions(`/chats/${conversationId}`)
                    : input.status === "rejected"
                      ? rejectedActions("food", listingUrl)
                      : acceptedActions(conversationId, listingUrl),
                conversationId,
                relatedEntityId: input.orderId,
                listingId: row.food_listing_id,
                requestId: input.orderId,
                buyerId: row.buyer_id,
              });
            } catch (notifErr) {
              console.error(
                "[useUpdateFoodOrder] Notification creation failed (non-blocking):",
                notifErr,
              );
            }
          }
        } else {
          console.error("[useUpdateFoodOrder] Order row not found for ID:", input.orderId);
        }
      }
      console.log("[useUpdateFoodOrder] Returning conversationId:", conversationId);
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["food_orders"] });
      void queryClient.invalidateQueries({ queryKey: ["food"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update order");
    },
  });
}

export function isChatUnlockedForFoodOrder(status: FoodOrderStatus | undefined) {
  return status === "accepted" || status === "completed";
}
