import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  parseRentalRequestMessage,
  useBuyerRentalRequests,
  useSellerRentalRequests,
  useUpdateRentalRequest,
  type RentalRequestDetails,
} from "@/lib/rental-requests";
import {
  useBuyerProductRequests,
  useSellerProductRequests,
  useUpdateProductRequest,
  type ProductRequestDetails,
} from "@/lib/product-requests";
import {
  useBuyerFoodOrders,
  useSellerFoodOrders,
  useUpdateFoodOrder,
  type FoodOrderRow,
} from "@/lib/food-orders";
import {
  useBuyerNotesPurchases,
  useSellerNotesPurchases,
  useUpdateNotesPurchase,
  type NotesPurchaseRow,
} from "@/lib/notes-purchase-requests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChatMutationResult } from "@/lib/chat";
import { cn } from "@/lib/utils";

function useOpenChatOnAccept() {
  const navigate = useNavigate();
  return useCallback(
    (result: ChatMutationResult | undefined, acceptedMessage: string) => {
      if (result?.conversationId) {
        toast.success("Request accepted — opening chat with buyer");
        navigate({ to: "/chats/$id", params: { id: result.conversationId } });
        return;
      }
      toast.success(acceptedMessage);
      navigate({ to: "/chats" });
    },
    [navigate],
  );
}

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [{ title: "Requests — CampusBazar" }],
  }),
  component: RequestsPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  returned: "bg-blue-100 text-blue-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function RoleToggle({
  view,
  onChange,
}: {
  view: "seller" | "buyer";
  onChange: (v: "seller" | "buyer") => void;
}) {
  return (
    <div className="flex w-fit rounded-full border bg-muted/40 p-0.5">
      {(["seller", "buyer"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          As {v === "seller" ? "Seller" : "Buyer"}
        </button>
      ))}
    </div>
  );
}

function RequestsPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<"seller" | "buyer">("seller");

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage purchase, rental, food, and notes requests.
        </p>
      </div>

      <RoleToggle view={role} onChange={setRole} />

      <Tabs defaultValue="products">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="food">Food</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <ProductRequestsTab userId={user?.id} role={role} formatInr={formatInr} />
        </TabsContent>
        <TabsContent value="rentals" className="mt-4">
          <RentalRequestsTab userId={user?.id} role={role} formatInr={formatInr} />
        </TabsContent>
        <TabsContent value="food" className="mt-4">
          <FoodOrdersTab userId={user?.id} role={role} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesRequestsTab userId={user?.id} role={role} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductRequestsTab({
  userId,
  role,
  formatInr,
}: {
  userId: string | undefined;
  role: "seller" | "buyer";
  formatInr: (n: number) => string;
}) {
  const { data: sellerReqs = [], isLoading: ls } = useSellerProductRequests(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerReqs = [], isLoading: lb } = useBuyerProductRequests(
    role === "buyer" ? userId : undefined,
  );
  const update = useUpdateProductRequest();
  const openChat = useOpenChatOnAccept();
  const requests = role === "seller" ? sellerReqs : buyerReqs;
  const isLoading = role === "seller" ? ls : lb;

  const handleAccept = (req: ProductRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "accepted",
        productId: req.product_id,
        notifyUserId: req.buyer_id,
        notificationTitle: "Purchase Request Accepted — Chat Unlocked",
        notificationDescription: `Your request for "${req.product?.title ?? "the item"}" was accepted. You can now chat with the seller.`,
      },
      {
        onSuccess: (result) =>
          openChat(result, `Request accepted for "${req.product?.title ?? "the item"}"`),
      },
    );
  };

  const handleReject = (req: ProductRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "rejected",
        productId: req.product_id,
        notifyUserId: req.buyer_id,
        notificationTitle: "Purchase Request Rejected",
        notificationDescription: `Your request for "${req.product?.title ?? "the item"}" was rejected.`,
      },
      { onSuccess: () => toast.success("Request rejected") },
    );
  };

  const handleComplete = (req: ProductRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "completed",
        productId: req.product_id,
        markSold: true,
        notifyUserId: req.buyer_id,
        notificationTitle: "Deal Completed",
        notificationDescription: `Your purchase of "${req.product?.title ?? "the item"}" is complete.`,
      },
      { onSuccess: () => toast.success("Deal completed") },
    );
  };

  const handleCancel = (req: ProductRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "cancelled",
        productId: req.product_id,
        notifyUserId: role === "buyer" ? req.seller_id : req.buyer_id,
        notificationTitle: "Request Cancelled",
        notificationDescription: `A purchase request for "${req.product?.title ?? "the item"}" was cancelled.`,
      },
      { onSuccess: () => toast.success("Request cancelled") },
    );
  };

  if (isLoading) return <LoadingState />;
  if (!requests.length) return <EmptyState label="product" />;

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <RequestCard
          key={req.id}
          title={req.product?.title ?? "Product"}
          status={req.status}
          price={
            req.request_type === "offer" && req.offered_price != null
              ? `Offer: ${formatInr(req.offered_price)}`
              : req.product
                ? formatInr(req.product.price)
                : undefined
          }
          coverUrl={req.product?.coverUrl}
          counterparty={role === "seller" ? req.buyer : req.seller}
          counterpartyLabel={role === "seller" ? "Buyer" : "Seller"}
          message={req.message ?? undefined}
          extra={req.request_type === "offer" ? "Type: Offer" : "Type: Buy Now"}
          actions={
            <>
              {role === "seller" && req.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleAccept(req)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleReject(req)}
                  >
                    Reject
                  </Button>
                </div>
              )}
              {role === "seller" && req.status === "accepted" && (
                <Button className="w-full" onClick={() => handleComplete(req)}>
                  Mark Completed
                </Button>
              )}
              {req.status === "pending" && (
                <Button variant="outline" className="w-full" onClick={() => handleCancel(req)}>
                  Cancel Request
                </Button>
              )}
            </>
          }
        />
      ))}
    </div>
  );
}

function RentalRequestsTab({
  userId,
  role,
  formatInr,
}: {
  userId: string | undefined;
  role: "seller" | "buyer";
  formatInr: (n: number) => string;
}) {
  const { data: sellerReqs = [], isLoading: ls } = useSellerRentalRequests(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerReqs = [], isLoading: lb } = useBuyerRentalRequests(
    role === "buyer" ? userId : undefined,
  );
  const update = useUpdateRentalRequest();
  const openChat = useOpenChatOnAccept();
  const requests = role === "seller" ? sellerReqs : buyerReqs;
  const isLoading = role === "seller" ? ls : lb;

  const handleAccept = (req: RentalRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "accepted",
        rentalId: req.rental_id,
        notifyUserId: req.buyer_id,
        notificationTitle: "Rental Request Accepted — Chat Unlocked",
        notificationDescription: `Your request for "${req.rental?.title ?? "the item"}" was accepted. You can now chat with the seller.`,
      },
      {
        onSuccess: (result) =>
          openChat(result, `Rental request accepted for "${req.rental?.title ?? "the item"}"`),
      },
    );
  };

  const handleReject = (req: RentalRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "rejected",
        rentalId: req.rental_id,
        notifyUserId: req.buyer_id,
        notificationTitle: "Rental Request Rejected",
        notificationDescription: `Your request for "${req.rental?.title ?? "the item"}" was rejected.`,
      },
      { onSuccess: () => toast.success("Request rejected") },
    );
  };

  const handleCancel = (req: RentalRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "cancelled",
        rentalId: req.rental_id,
        notifyUserId: role === "buyer" ? req.seller_id : req.buyer_id,
        notificationTitle: "Rental Request Cancelled",
        notificationDescription: `A rental request for "${req.rental?.title ?? "the item"}" was cancelled.`,
      },
      { onSuccess: () => toast.success("Request cancelled") },
    );
  };

  if (isLoading) return <LoadingState />;
  if (!requests.length) return <EmptyState label="rental" />;

  return (
    <div className="space-y-4">
      {requests.map((req) => {
        const parsed = parseRentalRequestMessage(req.message);
        return (
          <RequestCard
            key={req.id}
            title={req.rental?.title ?? "Rental"}
            status={req.status}
            price={req.rental ? `${formatInr(req.rental.rent_price_per_day)} / day` : undefined}
            coverUrl={req.rental?.coverUrl}
            counterparty={role === "seller" ? req.buyer : req.seller}
            counterpartyLabel={role === "seller" ? "Requester" : "Seller"}
            message={parsed.personalMessage || undefined}
            extra={
              [parsed.duration, parsed.pickupDate, parsed.pickupLocation]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            actions={
              <>
                {role === "seller" && req.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleAccept(req)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleReject(req)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {req.status === "pending" && (
                  <Button variant="outline" className="w-full" onClick={() => handleCancel(req)}>
                    Cancel Request
                  </Button>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}

function FoodOrdersTab({ userId, role }: { userId: string | undefined; role: "seller" | "buyer" }) {
  const { data: sellerOrders = [], isLoading: ls } = useSellerFoodOrders(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerOrders = [], isLoading: lb } = useBuyerFoodOrders(
    role === "buyer" ? userId : undefined,
  );
  const update = useUpdateFoodOrder();
  const openChat = useOpenChatOnAccept();
  const orders = role === "seller" ? sellerOrders : buyerOrders;
  const isLoading = role === "seller" ? ls : lb;

  const act = (
    order: FoodOrderRow,
    status: FoodOrderRow["status"],
    title: string,
    desc: string,
    notify: string,
  ) => {
    update.mutate(
      {
        orderId: order.id,
        status,
        notifyUserId: notify,
        notificationTitle: title,
        notificationDescription: desc,
      },
      {
        onSuccess: (result) => {
          if (status === "accepted") openChat(result, title);
          else toast.success(title);
        },
      },
    );
  };

  if (isLoading) return <LoadingState />;
  if (!orders.length) return <EmptyState label="food" />;

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <RequestCard
          key={order.id}
          title={`Food order · Qty ${order.quantity}`}
          status={order.status}
          message={order.message ?? undefined}
          actions={
            <>
              {role === "seller" && order.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() =>
                      act(
                        order,
                        "accepted",
                        "Food Order Accepted — Chat Unlocked",
                        "Your food order was accepted. You can now chat with the seller.",
                        order.buyer_id,
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() =>
                      act(
                        order,
                        "rejected",
                        "Food Order Rejected",
                        "Your food order was rejected.",
                        order.buyer_id,
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              )}
              {role === "seller" && order.status === "accepted" && (
                <Button
                  className="w-full"
                  onClick={() =>
                    act(
                      order,
                      "completed",
                      "Order Completed",
                      "Your food order is complete.",
                      order.buyer_id,
                    )
                  }
                >
                  Mark Completed
                </Button>
              )}
              {order.status === "pending" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    act(
                      order,
                      "cancelled",
                      "Order Cancelled",
                      "A food order was cancelled.",
                      role === "buyer" ? order.seller_id : order.buyer_id,
                    )
                  }
                >
                  Cancel
                </Button>
              )}
            </>
          }
        />
      ))}
    </div>
  );
}

function NotesRequestsTab({
  userId,
  role,
}: {
  userId: string | undefined;
  role: "seller" | "buyer";
}) {
  const { data: sellerReqs = [], isLoading: ls } = useSellerNotesPurchases(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerReqs = [], isLoading: lb } = useBuyerNotesPurchases(
    role === "buyer" ? userId : undefined,
  );
  const update = useUpdateNotesPurchase();
  const openChat = useOpenChatOnAccept();
  const requests = role === "seller" ? sellerReqs : buyerReqs;
  const isLoading = role === "seller" ? ls : lb;

  const act = (
    req: NotesPurchaseRow,
    status: NotesPurchaseRow["status"],
    title: string,
    desc: string,
    notify: string,
  ) => {
    update.mutate(
      {
        requestId: req.id,
        status,
        notifyUserId: notify,
        notificationTitle: title,
        notificationDescription: desc,
      },
      {
        onSuccess: (result) => {
          if (status === "accepted") openChat(result, title);
          else toast.success(title);
        },
      },
    );
  };

  if (isLoading) return <LoadingState />;
  if (!requests.length) return <EmptyState label="notes" />;

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <RequestCard
          key={req.id}
          title="Notes purchase request"
          status={req.status}
          message={req.message ?? undefined}
          actions={
            <>
              {role === "seller" && req.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() =>
                      act(
                        req,
                        "accepted",
                        "Notes Request Accepted — Chat Unlocked",
                        "Your notes request was accepted. You can now chat with the seller.",
                        req.buyer_id,
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() =>
                      act(
                        req,
                        "rejected",
                        "Notes Request Rejected",
                        "Your notes request was rejected.",
                        req.buyer_id,
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              )}
              {role === "seller" && req.status === "accepted" && (
                <Button
                  className="w-full"
                  onClick={() =>
                    act(
                      req,
                      "completed",
                      "Deal Completed",
                      "Your notes purchase is complete.",
                      req.buyer_id,
                    )
                  }
                >
                  Mark Completed
                </Button>
              )}
              {req.status === "pending" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    act(
                      req,
                      "cancelled",
                      "Request Cancelled",
                      "A notes request was cancelled.",
                      role === "buyer" ? req.seller_id : req.buyer_id,
                    )
                  }
                >
                  Cancel
                </Button>
              )}
            </>
          }
        />
      ))}
    </div>
  );
}

function RequestCard({
  title,
  status,
  price,
  coverUrl,
  counterparty,
  counterpartyLabel,
  message,
  extra,
  actions,
}: {
  title: string;
  status: string;
  price?: string;
  coverUrl?: string | null;
  counterparty?: { display_name: string; avatar_url: string | null };
  counterpartyLabel?: string;
  message?: string;
  extra?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-4">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
              —
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              <Badge className={cn("text-[10px] capitalize", STATUS_STYLES[status])}>
                {status}
              </Badge>
            </div>
            {price && <p className="text-sm text-primary">{price}</p>}
            {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
            {counterparty && (
              <div className="mt-1 flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {counterparty.avatar_url ? (
                    <AvatarImage
                      src={`${counterparty.avatar_url}${(counterparty.avatar_url as string).includes("?") ? "&" : "?"}t=${Date.now()}`}
                      alt=""
                    />
                  ) : null}
                  <AvatarFallback className="text-[9px]">
                    {counterparty.display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  {counterpartyLabel}: {counterparty.display_name}
                </span>
              </div>
            )}
          </div>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        {actions}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">No {label} requests yet.</div>
  );
}
