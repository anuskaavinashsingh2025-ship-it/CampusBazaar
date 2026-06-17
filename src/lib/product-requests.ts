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

export type ProductRequestStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";
export type ProductRequestType = "buy" | "offer";

export type ProductRequestRow = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  request_type: ProductRequestType;
  offered_price: number | null;
  message: string | null;
  status: ProductRequestStatus;
  created_at: string;
  updated_at: string;
  conversation_id: string | null;
};

export type ProductRequestDetails = ProductRequestRow & {
  product?: {
    id: string;
    title: string;
    price: number;
    status: string;
    coverUrl: string | null;
  };
  buyer?: { display_name: string; avatar_url: string | null; hostel_block: string | null };
  seller?: { display_name: string; avatar_url: string | null; hostel_block: string | null };
};

const REQUESTS_TABLE = "product_requests" as unknown as keyof Database["public"]["Tables"];
const PRODUCTS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

async function enrichProductRequests(rows: ProductRequestRow[]): Promise<ProductRequestDetails[]> {
  if (!rows.length) return [];

  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const userIds = [...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id]))];

  const [{ data: products }, { data: images }, { data: profiles }, { data: conversations }] = await Promise.all([
    supabase.from(PRODUCTS_TABLE).select("id,title,price,status").in("id", productIds),
    supabase
      .from(PRODUCT_IMAGES_TABLE)
      .select("product_id,storage_path,sort_index")
      .in("product_id", productIds),
    supabase.from("profiles").select("id,full_name,avatar_url,hostel_block").in("id", userIds),
    supabase
      .from("conversations")
      .select("id,context_type,context_id,request_id")
      .in("request_id", rows.map((r) => r.id))
      .in("context_type", ["product"]),
  ]);

  const imageMap = new Map<string, string>();
  for (const img of images ?? []) {
    const row = img as { product_id: string; storage_path: string; sort_index: number };
    if (!imageMap.has(row.product_id)) {
      imageMap.set(
        row.product_id,
        row.storage_path,
      );
    }
  }

  const profileMap = new Map<
    string,
    { display_name: string; avatar_url: string | null; hostel_block: string | null }
  >(
    (profiles ?? []).map(
      (p: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        hostel_block: string | null;
      }) => [
        p.id,
        {
          display_name: p.full_name ?? "Student",
          avatar_url: p.avatar_url,
          hostel_block: p.hostel_block,
        },
      ],
    ),
  );

  const conversationMap = new Map<string, string>();
  for (const conv of conversations ?? []) {
    const row = conv as { id: string; request_id: string };
    conversationMap.set(row.request_id, row.id);
  }

  return rows.map((r) => {
    const product = (products ?? []).find((x: { id: string }) => x.id === r.product_id) as
      | { id: string; title: string; price: number; status: string }
      | undefined;
    return {
      ...r,
      offered_price: r.offered_price != null ? Number(r.offered_price) : null,
      conversation_id: conversationMap.get(r.id) ?? null,
      product: product
        ? {
            ...product,
            price: Number(product.price),
            coverUrl: imageMap.get(product.id) ?? null,
          }
        : undefined,
      buyer: profileMap.get(r.buyer_id),
      seller: profileMap.get(r.seller_id),
    };
  });
}

export function useSellerProductRequests(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["product_requests", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enrichProductRequests((data ?? []) as unknown as ProductRequestRow[]);
    },
    enabled: Boolean(sellerId),
  });
}

export function useBuyerProductRequests(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["product_requests", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enrichProductRequests((data ?? []) as unknown as ProductRequestRow[]);
    },
    enabled: Boolean(buyerId),
  });
}

export function useProductRequestForListing(
  productId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["product_request", productId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("product_id", productId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ProductRequestRow | null;
    },
    enabled: Boolean(productId && buyerId),
  });
}

export function useCreateProductRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      buyerId: string;
      sellerId: string;
      productTitle: string;
      requestType: ProductRequestType;
      offeredPrice?: number;
      message?: string;
      buyerName?: string;
      buyerHostel?: string;
    }) => {
      await enforceBanCheck(input.buyerId, "create a product request");
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .insert({
          product_id: input.productId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          request_type: input.requestType,
          offered_price: input.offeredPrice ?? null,
          message: input.message?.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      const conversationId = await getOrCreateConversation({
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        contextType: "product",
        contextId: input.productId,
        requestId: data.id,
        listingTitle: input.productTitle,
      });
      const listingUrl = viewListingUrl("marketplace", input.productId);

      await createTransactionNotification({
        receiverId: input.sellerId,
        senderId: input.buyerId,
        title: "New Purchase Request",
        description: "Someone is interested in purchasing your listing.",
        priority: "important",
        module: "marketplace",
        actionUrl: "/requests",
        actions: ownerRequestActions({
          conversationId,
          listingUrl,
          acceptLabel: "Accept Deal",
          rejectLabel: "Reject Deal",
        }),
        conversationId,
        relatedEntityId: data.id,
        listingId: input.productId,
        requestId: data.id,
        buyerId: input.buyerId,
      });

      return data;
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["product_requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["product_request", vars.productId, vars.buyerId],
      });
      toast.success(vars.requestType === "offer" ? "Offer sent!" : "Purchase request sent!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    },
  });
}

export function useUpdateProductRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      status: ProductRequestStatus;
      productId?: string;
      productTitle?: string;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
      markSold?: boolean;
    }): Promise<ChatMutationResult> => {
      console.log("[useUpdateProductRequest] Called with:", {
        requestId: input.requestId,
        status: input.status,
      });
      let conversationId: string | undefined;
      const { error } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: input.status })
        .eq("id", input.requestId);
      if (error) {
        console.error("[useUpdateProductRequest] Status update error:", error);
        throw error;
      }
      console.log("[useUpdateProductRequest] Status updated to:", input.status);

      if (input.markSold && input.productId) {
        const { error: productErr } = await supabase
          .from(PRODUCTS_TABLE)
          .update({ status: "sold" })
          .eq("id", input.productId);
        if (productErr) throw productErr;
      }

      if (
        input.status === "accepted" ||
        input.status === "completed" ||
        input.status === "rejected"
      ) {
        console.log("[useUpdateProductRequest] Status is accepted/completed, fetching request row");
        const { data: reqRow } = await supabase
          .from(REQUESTS_TABLE)
          .select("buyer_id,seller_id,product_id")
          .eq("id", input.requestId)
          .maybeSingle();

        console.log("[useUpdateProductRequest] Request row:", reqRow);

        if (reqRow) {
          const row = reqRow as { buyer_id: string; seller_id: string; product_id: string };
          const { data: product } = await supabase
            .from(PRODUCTS_TABLE)
            .select("title")
            .eq("id", row.product_id)
            .maybeSingle();
          const title = (product as { title: string } | null)?.title ?? "Product listing";

          console.log("[useUpdateProductRequest] Product title:", title);

          if (input.status === "accepted") {
            console.log("[useUpdateProductRequest] Calling ensureConversationOnAccept");
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "product",
              contextId: row.product_id,
              requestId: input.requestId,
              listingTitle: title,
              notifyBuyer: false,
            });
            console.log("[useUpdateProductRequest] Conversation ID returned:", conversationId);
          } else if (input.status === "completed") {
            conversationId = await getOrCreateConversation({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "product",
              contextId: row.product_id,
              requestId: input.requestId,
              listingTitle: title,
            });
            await completeConversationForRequest({
              buyerId: row.buyer_id,
              contextType: "product",
              contextId: row.product_id,
            });
          } else {
            conversationId = await getOrCreateConversation({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "product",
              contextId: row.product_id,
              requestId: input.requestId,
              listingTitle: title,
            });
          }

          if (input.notifyUserId && conversationId) {
            const listingUrl = viewListingUrl("marketplace", row.product_id);
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
                module: "marketplace",
                actionUrl: input.status === "rejected" ? listingUrl : `/chats/${conversationId}`,
                actions:
                  input.status === "completed"
                    ? completedActions(`/chats/${conversationId}`)
                    : input.status === "rejected"
                      ? rejectedActions("marketplace", listingUrl)
                      : acceptedActions(conversationId, listingUrl),
                conversationId,
                relatedEntityId: input.requestId,
                listingId: row.product_id,
                requestId: input.requestId,
                buyerId: row.buyer_id,
              });
            } catch (notifErr) {
              console.error(
                "[useUpdateProductRequest] Notification creation failed (non-blocking):",
                notifErr,
              );
            }
          }
        } else {
          console.error("[useUpdateProductRequest] Request row not found for ID:", input.requestId);
        }
      }
      console.log("[useUpdateProductRequest] Returning conversationId:", conversationId);
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["product"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err) => {
      console.error("[useUpdateProductRequest] Mutation error:", err);
      toast.error(err instanceof Error ? err.message : "Could not update request");
    },
  });
}

export function isChatUnlockedForProductRequest(status: ProductRequestStatus | undefined) {
  return status === "accepted" || status === "completed";
}
