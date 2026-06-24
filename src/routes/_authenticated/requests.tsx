import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
import {
  useBuyerNotesRentals,
  useSellerNotesRentals,
  useUpdateNotesRental,
  parseRentalDurationFromMessage,
  type NotesRentalRow,
  type NotesRentalStatus,
} from "@/lib/notes-rental-requests";
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
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  active_rental: "bg-green-100 text-green-800",
  active_transaction: "bg-green-100 text-green-800",
  return_requested: "bg-orange-100 text-orange-800",
  completion_pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  returned: "bg-slate-100 text-slate-700",
  completed: "bg-slate-100 text-slate-700",
  sold: "bg-slate-100 text-slate-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const CATEGORY_STYLES: Record<string, string> = {
  product: "bg-blue-100 text-blue-800",
  rental: "bg-purple-100 text-purple-800",
  food: "bg-orange-100 text-orange-800",
  notes: "bg-green-100 text-green-800",
};

const ACTIONABLE_STATUSES = new Set([
  "pending",
  "accepted",
  "active_rental",
  "return_requested",
  "completion_pending",
]);

function isActionableStatus(status: string) {
  return ACTIONABLE_STATUSES.has(status.toLowerCase());
}

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

      <Tabs defaultValue="all">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="food">Food</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <AllRequestsTab userId={user?.id} role={role} formatInr={formatInr} />
        </TabsContent>
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

type UnifiedRequest = {
  id: string;
  type: "product" | "rental" | "food" | "notes_purchase" | "notes_rental";
  title: string;
  status: string;
  price?: string;
  coverUrl?: string | null;
  counterparty?: { display_name: string; avatar_url: string | null };
  counterpartyLabel: string;
  message?: string;
  extra?: string;
  category: string;
  created_at: string;
  rawData: any;
};

function AllRequestsTab({
  userId,
  role,
  formatInr,
}: {
  userId: string | undefined;
  role: "seller" | "buyer";
  formatInr: (n: number) => string;
}) {
  const updateProduct = useUpdateProductRequest();
  const updateRental = useUpdateRentalRequest();
  const updateFood = useUpdateFoodOrder();
  const updateNotesPurchase = useUpdateNotesPurchase();
  const updateNotesRental = useUpdateNotesRental();
  const openChat = useOpenChatOnAccept();

  // Fetch all request types in parallel
  const { data: sellerProductReqs = [], isLoading: lsp } = useSellerProductRequests(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerProductReqs = [], isLoading: lbp } = useBuyerProductRequests(
    role === "buyer" ? userId : undefined,
  );
  const { data: sellerRentalReqs = [], isLoading: lsr } = useSellerRentalRequests(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerRentalReqs = [], isLoading: lbr } = useBuyerRentalRequests(
    role === "buyer" ? userId : undefined,
  );
  const { data: sellerFoodOrders = [], isLoading: lsf } = useSellerFoodOrders(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerFoodOrders = [], isLoading: lbf } = useBuyerFoodOrders(
    role === "buyer" ? userId : undefined,
  );
  const { data: sellerPurchaseReqs = [], isLoading: lsnp } = useSellerNotesPurchases(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerPurchaseReqs = [], isLoading: lbnp } = useBuyerNotesPurchases(
    role === "buyer" ? userId : undefined,
  );
  const { data: sellerNotesRentals = [], isLoading: lsnr } = useSellerNotesRentals(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerNotesRentals = [], isLoading: lbnr } = useBuyerNotesRentals(
    role === "buyer" ? userId : undefined,
  );

  const isLoading =
    (role === "seller" ? lsp : lbp) ||
    (role === "seller" ? lsr : lbr) ||
    (role === "seller" ? lsf : lbf) ||
    (role === "seller" ? lsnp : lbnp) ||
    (role === "seller" ? lsnr : lbnr);

  // Combine all requests into unified format
  const unifiedRequests: UnifiedRequest[] = [];

  // Product requests
  const productRequests = (role === "seller" ? sellerProductReqs : buyerProductReqs).filter(
    (req) => isActionableStatus(req.status),
  );
  productRequests.forEach((req) => {
    unifiedRequests.push({
      id: req.id,
      type: "product",
      title: req.product?.title ?? "Product",
      status: req.status,
      price:
        req.request_type === "offer" && req.offered_price != null
          ? `Offer: ${formatInr(req.offered_price)}`
          : req.product
            ? formatInr(req.product.price)
            : undefined,
      coverUrl: req.product?.coverUrl,
      counterparty: role === "seller" ? req.buyer : req.seller,
      counterpartyLabel: role === "seller" ? "Buyer" : "Seller",
      message: req.message ?? undefined,
      extra: req.request_type === "offer" ? "Type: Offer" : "Type: Buy Now",
      category: "Product",
      created_at: req.created_at,
      rawData: req,
    });
  });

  // Rental requests
  const rentalRequests = (role === "seller" ? sellerRentalReqs : buyerRentalReqs).filter(
    (req) => isActionableStatus(req.status),
  );
  rentalRequests.forEach((req) => {
    unifiedRequests.push({
      id: req.id,
      type: "rental",
      title: req.rental?.title ?? "Rental",
      status: req.status,
      price: req.rental ? `${formatInr(req.rental.rent_price_per_day)} / day` : undefined,
      coverUrl: req.rental?.coverUrl,
      counterparty: role === "seller" ? req.buyer : req.seller,
      counterpartyLabel: role === "seller" ? "Requester" : "Seller",
      message: req.message ?? undefined,
      extra: "Rental",
      category: "Rental",
      created_at: req.created_at,
      rawData: req,
    });
  });

  // Food orders
  const foodOrders = (role === "seller" ? sellerFoodOrders : buyerFoodOrders).filter(
    (order) => isActionableStatus(order.status),
  );
  foodOrders.forEach((order) => {
    unifiedRequests.push({
      id: order.id,
      type: "food",
      title: `Food order · Qty ${order.quantity}`,
      status: order.status,
      price: undefined,
      coverUrl: null,
      counterparty: undefined,
      counterpartyLabel: role === "seller" ? "Buyer" : "Seller",
      message: order.message ?? undefined,
      extra: "Food Order",
      category: "Food",
      created_at: order.created_at,
      rawData: order,
    });
  });

  // Notes purchases
  const notesPurchases = (role === "seller" ? sellerPurchaseReqs : buyerPurchaseReqs).filter(
    (req) => isActionableStatus(req.status),
  );
  notesPurchases.forEach((req) => {
    unifiedRequests.push({
      id: req.id,
      type: "notes_purchase",
      title: "Notes purchase request",
      status: req.status,
      price: undefined,
      coverUrl: null,
      counterparty: undefined,
      counterpartyLabel: role === "seller" ? "Buyer" : "Seller",
      message: req.message ?? undefined,
      extra: "Type: Purchase",
      category: "Notes",
      created_at: req.created_at,
      rawData: req,
    });
  });

  // Notes rentals
  const notesRentals = (role === "seller" ? sellerNotesRentals : buyerNotesRentals).filter(
    (req) => isActionableStatus(req.status),
  );
  notesRentals.forEach((req) => {
    unifiedRequests.push({
      id: req.id,
      type: "notes_rental",
      title: "Notes rental request",
      status: req.status,
      price: undefined,
      coverUrl: null,
      counterparty: undefined,
      counterpartyLabel: role === "seller" ? "Requester" : "Seller",
      message: req.message ?? undefined,
      extra: "Type: Rental",
      category: "Notes",
      created_at: req.created_at,
      rawData: req,
    });
  });

  // Sort by created_at DESC (newest first)
  unifiedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (isLoading) return <LoadingState />;
  if (unifiedRequests.length === 0) return <EmptyState label="any" />;

  // Action handlers
  const handleProductAccept = (req: UnifiedRequest) => {
    updateProduct.mutate(
      {
        requestId: req.id,
        status: "accepted",
        productId: req.rawData.product_id,
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Purchase Request Accepted — Chat Unlocked",
        notificationDescription: `Your request for "${req.rawData.product?.title ?? "the item"}" was accepted. You can now chat with the seller.`,
      },
      {
        onSuccess: (result) =>
          openChat(result, `Request accepted for "${req.rawData.product?.title ?? "the item"}"`),
      },
    );
  };

  const handleProductReject = (req: UnifiedRequest) => {
    updateProduct.mutate(
      {
        requestId: req.id,
        status: "rejected",
        productId: req.rawData.product_id,
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Purchase Request Rejected",
        notificationDescription: `Your request for "${req.rawData.product?.title ?? "the item"}" was rejected.`,
      },
      { onSuccess: () => toast.success("Request rejected") },
    );
  };

  const handleProductComplete = (req: UnifiedRequest) => {
    updateProduct.mutate(
      {
        requestId: req.id,
        status: "completed",
        productId: req.rawData.product_id,
        markSold: true,
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Deal Completed",
        notificationDescription: `Your purchase of "${req.rawData.product?.title ?? "the item"}" is complete.`,
      },
      { onSuccess: () => toast.success("Deal completed") },
    );
  };

  const handleProductCancel = (req: UnifiedRequest) => {
    updateProduct.mutate(
      {
        requestId: req.id,
        status: "cancelled",
        productId: req.rawData.product_id,
        notifyUserId: role === "buyer" ? req.rawData.seller_id : req.rawData.buyer_id,
        notificationTitle: "Request Cancelled",
        notificationDescription: `A purchase request for "${req.rawData.product?.title ?? "the item"}" was cancelled.`,
      },
      { onSuccess: () => toast.success("Request cancelled") },
    );
  };

  const handleRentalAccept = (req: UnifiedRequest) => {
    updateRental.mutate(
      {
        requestId: req.id,
        status: "accepted",
        rentalId: req.rawData.rental_id,
        listingStatus: "rented_out",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Rental Request Accepted — Chat Unlocked",
        notificationDescription: `Your request for "${req.rawData.rental?.title ?? "the item"}" was accepted. You can now chat with the seller.`,
      },
      {
        onSuccess: (result) =>
          openChat(result, `Rental request accepted for "${req.rawData.rental?.title ?? "the item"}"`),
      },
    );
  };

  const handleRentalReject = (req: UnifiedRequest) => {
    updateRental.mutate(
      {
        requestId: req.id,
        status: "rejected",
        rentalId: req.rawData.rental_id,
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Rental Request Rejected",
        notificationDescription: `Your request for "${req.rawData.rental?.title ?? "the item"}" was rejected.`,
      },
      { onSuccess: () => toast.success("Request rejected") },
    );
  };

  const handleRentalMarkAsRentedOut = (req: UnifiedRequest) => {
    updateRental.mutate(
      {
        requestId: req.id,
        status: "active_rental",
        rentalId: req.rawData.rental_id,
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Rental Started",
        notificationDescription: `Your rental of "${req.rawData.rental?.title ?? "the item"}" has started.`,
      },
      { onSuccess: () => toast.success("Rental started") },
    );
  };

  const handleRentalReturnItem = (req: UnifiedRequest) => {
    updateRental.mutate(
      {
        requestId: req.id,
        status: "return_requested",
        rentalId: req.rawData.rental_id,
        notifyUserId: req.rawData.seller_id,
        notificationTitle: "Return Requested",
        notificationDescription: `The renter has requested to return "${req.rawData.rental?.title ?? "the item"}".`,
      },
      { onSuccess: () => toast.success("Return requested") },
    );
  };

  const handleRentalCancel = (req: UnifiedRequest) => {
    updateRental.mutate(
      {
        requestId: req.id,
        status: "cancelled",
        rentalId: req.rawData.rental_id,
        notifyUserId: role === "buyer" ? req.rawData.seller_id : req.rawData.buyer_id,
        notificationTitle: "Rental Request Cancelled",
        notificationDescription: `A rental request for "${req.rawData.rental?.title ?? "the item"}" was cancelled.`,
      },
      { onSuccess: () => toast.success("Request cancelled") },
    );
  };

  const handleFoodAccept = (req: UnifiedRequest) => {
    updateFood.mutate(
      {
        orderId: req.id,
        status: "accepted",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Food Order Accepted — Chat Unlocked",
        notificationDescription: "Your food order was accepted. You can now chat with the seller.",
      },
      {
        onSuccess: (result) => openChat(result, "Food order accepted"),
      },
    );
  };

  const handleFoodReject = (req: UnifiedRequest) => {
    updateFood.mutate(
      {
        orderId: req.id,
        status: "rejected",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Food Order Rejected",
        notificationDescription: "Your food order was rejected.",
      },
      { onSuccess: () => toast.success("Order rejected") },
    );
  };

  const handleFoodComplete = (req: UnifiedRequest) => {
    updateFood.mutate(
      {
        orderId: req.id,
        status: "completed",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Order Completed",
        notificationDescription: "Your food order is complete.",
      },
      { onSuccess: () => toast.success("Order completed") },
    );
  };

  const handleFoodCancel = (req: UnifiedRequest) => {
    updateFood.mutate(
      {
        orderId: req.id,
        status: "cancelled",
        notifyUserId: role === "buyer" ? req.rawData.seller_id : req.rawData.buyer_id,
        notificationTitle: "Order Cancelled",
        notificationDescription: "A food order was cancelled.",
      },
      { onSuccess: () => toast.success("Order cancelled") },
    );
  };

  const handleNotesPurchaseAccept = (req: UnifiedRequest) => {
    updateNotesPurchase.mutate(
      {
        requestId: req.id,
        status: "accepted",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Notes Request Accepted — Chat Unlocked",
        notificationDescription: "Your notes request was accepted. You can now chat with the seller.",
      },
      {
        onSuccess: (result) => openChat(result, "Notes request accepted"),
      },
    );
  };

  const handleNotesPurchaseReject = (req: UnifiedRequest) => {
    updateNotesPurchase.mutate(
      {
        requestId: req.id,
        status: "rejected",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Notes Request Rejected",
        notificationDescription: "Your notes request was rejected.",
      },
      { onSuccess: () => toast.success("Request rejected") },
    );
  };

  const handleNotesPurchaseComplete = (req: UnifiedRequest) => {
    updateNotesPurchase.mutate(
      {
        requestId: req.id,
        status: "completed",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Deal Completed",
        notificationDescription: "Your notes purchase is complete.",
      },
      { onSuccess: () => toast.success("Deal completed") },
    );
  };

  const handleNotesPurchaseCancel = (req: UnifiedRequest) => {
    updateNotesPurchase.mutate(
      {
        requestId: req.id,
        status: "cancelled",
        notifyUserId: role === "buyer" ? req.rawData.seller_id : req.rawData.buyer_id,
        notificationTitle: "Request Cancelled",
        notificationDescription: "A notes request was cancelled.",
      },
      { onSuccess: () => toast.success("Request cancelled") },
    );
  };

  const handleNotesRentalAccept = (req: UnifiedRequest) => {
    updateNotesRental.mutate(
      {
        requestId: req.id,
        status: "accepted",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Rental Request Accepted — Chat Unlocked",
        notificationDescription: "Your rental request was accepted. You can now chat with the seller.",
        listingStatus: "rented_out",
      },
      {
        onSuccess: (result) => openChat(result, "Rental request accepted"),
      },
    );
  };

  const handleNotesRentalReject = (req: UnifiedRequest) => {
    updateNotesRental.mutate(
      {
        requestId: req.id,
        status: "rejected",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Rental Request Rejected",
        notificationDescription: "Your rental request was rejected.",
      },
      { onSuccess: () => toast.success("Request rejected") },
    );
  };

  const handleNotesRentalMarkAsRentedOut = (req: UnifiedRequest) => {
    updateNotesRental.mutate(
      {
        requestId: req.id,
        status: "active_rental",
        notifyUserId: req.rawData.buyer_id,
        notificationTitle: "Rental Started",
        notificationDescription: "Your notes rental has started. You can now access the notes.",
      },
      { onSuccess: () => toast.success("Rental started") },
    );
  };

  const handleNotesRentalReturnItem = (req: UnifiedRequest) => {
    updateNotesRental.mutate(
      {
        requestId: req.id,
        status: "return_requested",
        notifyUserId: req.rawData.seller_id,
        notificationTitle: "Return Requested",
        notificationDescription: "The renter has returned the notes. Please confirm.",
      },
      { onSuccess: () => toast.success("Return requested") },
    );
  };

  const handleNotesRentalCancel = (req: UnifiedRequest) => {
    updateNotesRental.mutate(
      {
        requestId: req.id,
        status: "cancelled",
        notifyUserId: role === "buyer" ? req.rawData.seller_id : req.rawData.buyer_id,
        notificationTitle: "Rental Request Cancelled",
        notificationDescription: "A rental request was cancelled.",
      },
      { onSuccess: () => toast.success("Request cancelled") },
    );
  };

  const getActions = (req: UnifiedRequest): React.ReactNode => {
    if (req.type === "product") {
      if (role === "seller" && req.status === "pending") {
        return (
          <div className="flex gap-2">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleProductAccept(req)}>
              Accept
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleProductReject(req)}>
              Reject
            </Button>
          </div>
        );
      }
      if (role === "seller" && req.status === "accepted") {
        return <Button className="w-full" onClick={() => handleProductComplete(req)}>Mark Completed</Button>;
      }
      if (req.status === "pending") {
        return <Button variant="outline" className="w-full" onClick={() => handleProductCancel(req)}>Cancel Request</Button>;
      }
    }

    if (req.type === "rental") {
      if (role === "seller" && req.status === "pending") {
        return (
          <div className="flex gap-2">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleRentalAccept(req)}>
              Accept
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleRentalReject(req)}>
              Reject
            </Button>
          </div>
        );
      }
      if (role === "seller" && req.status === "accepted") {
        return <Button className="w-full" onClick={() => handleRentalMarkAsRentedOut(req)}>Mark as Rented Out</Button>;
      }
      if (role === "buyer" && req.status === "active_rental") {
        return <Button className="w-full" onClick={() => handleRentalReturnItem(req)}>Returned Item</Button>;
      }
      if (req.status === "pending") {
        return <Button variant="outline" className="w-full" onClick={() => handleRentalCancel(req)}>Cancel Request</Button>;
      }
    }

    if (req.type === "food") {
      if (role === "seller" && req.status === "pending") {
        return (
          <div className="flex gap-2">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleFoodAccept(req)}>
              Accept
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleFoodReject(req)}>
              Reject
            </Button>
          </div>
        );
      }
      if (role === "seller" && req.status === "accepted") {
        return <Button className="w-full" onClick={() => handleFoodComplete(req)}>Mark Completed</Button>;
      }
      if (req.status === "pending") {
        return <Button variant="outline" className="w-full" onClick={() => handleFoodCancel(req)}>Cancel</Button>;
      }
    }

    if (req.type === "notes_purchase") {
      if (role === "seller" && req.status === "pending") {
        return (
          <div className="flex gap-2">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleNotesPurchaseAccept(req)}>
              Accept
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleNotesPurchaseReject(req)}>
              Reject
            </Button>
          </div>
        );
      }
      if (role === "seller" && req.status === "accepted") {
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => {
        if (req.rawData.conversation_id) {
          window.open(`/chats/${req.rawData.conversation_id}`, "_self");
        }
      }}
    >
      Complete via Chat
    </Button>
  );
}
      if (req.status === "pending") {
        return <Button variant="outline" className="w-full" onClick={() => handleNotesPurchaseCancel(req)}>Cancel</Button>;
      }
    }

    if (req.type === "notes_rental") {
      if (role === "seller" && req.status === "pending") {
        return (
          <div className="flex gap-2">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleNotesRentalAccept(req)}>
              Accept
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleNotesRentalReject(req)}>
              Reject
            </Button>
          </div>
        );
      }
      if (role === "seller" && req.status === "accepted") {
        return <Button className="w-full" onClick={() => handleNotesRentalMarkAsRentedOut(req)}>Mark as Rented Out</Button>;
      }
      if (role === "buyer" && req.status === "active_rental") {
        return <Button className="w-full" onClick={() => handleNotesRentalReturnItem(req)}>Returned Item</Button>;
      }
      if (req.status === "pending") {
        return <Button variant="outline" className="w-full" onClick={() => handleNotesRentalCancel(req)}>Cancel</Button>;
      }
    }

    return null;
  };

  const getViewListingUrl = (req: UnifiedRequest): string => {
    if (req.type === "product") return `/product/${req.rawData.product_id}`;
    if (req.type === "rental") return `/rent/${req.rawData.rental_id}`;
    if (req.type === "food") return `/food/${req.rawData.food_listing_id}`;
    if (req.type === "notes_purchase" || req.type === "notes_rental") return `/notes/${req.rawData.notes_listing_id}`;
    return "#";
  };

  // Status-based sections
  const pendingRequests = unifiedRequests.filter((r) => r.status === "pending");
  const acceptedRequests = unifiedRequests.filter((r) => ["accepted", "active_transaction", "active_rental"].includes(r.status));
  const returnRequested = unifiedRequests.filter((r) => r.status === "return_requested");
  const completedRequests = unifiedRequests.filter((r) => ["completed", "sold", "returned"].includes(r.status));
  const otherRequests = unifiedRequests.filter((r) => !["pending", "accepted", "active_transaction", "active_rental", "return_requested", "completed", "sold", "returned"].includes(r.status));

  // Sort each section by created_at DESC
  const sortRequests = (reqs: typeof unifiedRequests) =>
    [...reqs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending ({pendingRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(pendingRequests).map((req) => (
              <UnifiedRequestCard
                key={req.id}
                title={req.title}
                status={req.status}
                price={req.price}
                coverUrl={req.coverUrl}
                counterparty={req.counterparty}
                counterpartyLabel={req.counterpartyLabel}
                message={req.message}
                extra={req.extra}
                category={req.category}
                createdAt={req.created_at}
                actions={getActions(req)}
                onViewListing={() => window.open(getViewListingUrl(req), "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "active_transaction" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed" || req.status === "sold" || req.status === "returned") && req.rawData.conversation_id
                    ? () => window.open(`/chats?conversation=${req.rawData.conversation_id}`, "_blank")
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
      {acceptedRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Accepted / Active ({acceptedRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(acceptedRequests).map((req) => (
              <UnifiedRequestCard
                key={req.id}
                title={req.title}
                status={req.status}
                price={req.price}
                coverUrl={req.coverUrl}
                counterparty={req.counterparty}
                counterpartyLabel={req.counterpartyLabel}
                message={req.message}
                extra={req.extra}
                category={req.category}
                createdAt={req.created_at}
                actions={getActions(req)}
                onViewListing={() => window.open(getViewListingUrl(req), "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "active_transaction" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed" || req.status === "sold" || req.status === "returned") && req.rawData.conversation_id
                    ? () => window.open(`/chats?conversation=${req.rawData.conversation_id}`, "_blank")
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
      {returnRequested.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Return Requested ({returnRequested.length})</h3>
          <div className="space-y-4">
            {sortRequests(returnRequested).map((req) => (
              <UnifiedRequestCard
                key={req.id}
                title={req.title}
                status={req.status}
                price={req.price}
                coverUrl={req.coverUrl}
                counterparty={req.counterparty}
                counterpartyLabel={req.counterpartyLabel}
                message={req.message}
                extra={req.extra}
                category={req.category}
                createdAt={req.created_at}
                actions={getActions(req)}
                onViewListing={() => window.open(getViewListingUrl(req), "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "active_transaction" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed" || req.status === "sold" || req.status === "returned") && req.rawData.conversation_id
                    ? () => window.open(`/chats?conversation=${req.rawData.conversation_id}`, "_blank")
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
      {completedRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Completed ({completedRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(completedRequests).map((req) => (
              <UnifiedRequestCard
                key={req.id}
                title={req.title}
                status={req.status}
                price={req.price}
                coverUrl={req.coverUrl}
                counterparty={req.counterparty}
                counterpartyLabel={req.counterpartyLabel}
                message={req.message}
                extra={req.extra}
                category={req.category}
                createdAt={req.created_at}
                actions={getActions(req)}
                onViewListing={() => window.open(getViewListingUrl(req), "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "active_transaction" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed" || req.status === "sold" || req.status === "returned") && req.rawData.conversation_id
                    ? () => window.open(`/chats?conversation=${req.rawData.conversation_id}`, "_blank")
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
      {otherRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Other ({otherRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(otherRequests).map((req) => (
              <UnifiedRequestCard
                key={req.id}
                title={req.title}
                status={req.status}
                price={req.price}
                coverUrl={req.coverUrl}
                counterparty={req.counterparty}
                counterpartyLabel={req.counterpartyLabel}
                message={req.message}
                extra={req.extra}
                category={req.category}
                createdAt={req.created_at}
                actions={getActions(req)}
                onViewListing={() => window.open(getViewListingUrl(req), "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "active_transaction" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed" || req.status === "sold" || req.status === "returned") && req.rawData.conversation_id
                    ? () => window.open(`/chats?conversation=${req.rawData.conversation_id}`, "_blank")
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </>
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
  const requests = (role === "seller" ? sellerReqs : buyerReqs).filter((req) =>
    isActionableStatus(req.status),
  );
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

  // Status-based sections
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const acceptedRequests = requests.filter((r) => r.status === "accepted");
  const completedRequests = requests.filter((r) => r.status === "completed");
  const otherRequests = requests.filter((r) => !["pending", "accepted", "completed"].includes(r.status));

  // Sort each section by created_at DESC
  const sortRequests = (reqs: typeof requests) =>
    [...reqs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending Requests ({pendingRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(pendingRequests).map((req) => (
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
                category="Product"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/product/${req.product_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
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
            ))}
          </div>
        </div>
      )}
      {acceptedRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Accepted Requests ({acceptedRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(acceptedRequests).map((req) => (
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
                category="Product"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/product/${req.product_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
                }
                actions={
                  <>
                    {role === "seller" && req.status === "accepted" && (
                      <Button className="w-full" onClick={() => handleComplete(req)}>
                        Mark Completed
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}
      {completedRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Completed Requests ({completedRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(completedRequests).map((req) => (
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
                category="Product"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/product/${req.product_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
                }
                actions={<></>}
              />
            ))}
          </div>
        </div>
      )}
      {otherRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Other Requests ({otherRequests.length})</h3>
          <div className="space-y-4">
            {sortRequests(otherRequests).map((req) => (
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
                category="Product"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/product/${req.product_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
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
        </div>
      )}
    </>
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
  const requests = (role === "seller" ? sellerReqs : buyerReqs).filter((req) =>
    isActionableStatus(req.status),
  );
  const isLoading = role === "seller" ? ls : lb;
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RentalRequestDetails | null>(null);

  const handleAccept = (req: RentalRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "accepted",
        rentalId: req.rental_id,
        listingStatus: "rented_out",
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

  const handleMarkAsRentedOut = (req: RentalRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "active_rental",
        rentalId: req.rental_id,
        listingStatus: "rented_out",
        notifyUserId: req.buyer_id,
        notificationTitle: "Rental Started",
        notificationDescription: `Your rental of "${req.rental?.title ?? "the item"}" has started.`,
      },
      { onSuccess: () => toast.success("Marked as rented out") },
    );
  };

  const handleReturnItem = (req: RentalRequestDetails) => {
    update.mutate(
      {
        requestId: req.id,
        status: "return_requested",
        rentalId: req.rental_id,
        notifyUserId: req.seller_id,
        notificationTitle: "Item Returned",
        notificationDescription: `The renter has returned "${req.rental?.title ?? "the item"}". Please confirm.`,
      },
      { onSuccess: () => toast.success("Return requested") },
    );
  };

  const handleConfirmReturn = (req: RentalRequestDetails) => {
    setSelectedRequest(req);
    setCompletionModalOpen(true);
  };

  const handleCompletionChoice = (listingStatus: "available" | "unavailable") => {
    if (!selectedRequest) return;
    update.mutate(
      {
        requestId: selectedRequest.id,
        status: "completed",
        rentalId: selectedRequest.rental_id,
        listingStatus,
        notifyUserId: selectedRequest.buyer_id,
        notificationTitle: "Return Confirmed",
        notificationDescription: `Your return of "${selectedRequest.rental?.title ?? "the item"}" has been confirmed.`,
      },
      {
        onSuccess: () => {
          toast.success(listingStatus === "available" ? "Marked as available again" : "Kept unavailable");
          setCompletionModalOpen(false);
          setSelectedRequest(null);
        },
      },
    );
  };

  if (isLoading) return <LoadingState />;
  if (!requests.length) return <EmptyState label="rental" />;

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const acceptedRequests = requests.filter((r) => r.status === "accepted");
  const activeRentals = requests.filter((r) => r.status === "active_rental");
  const pendingReturns = requests.filter((r) => r.status === "return_requested");
  const completedRentals = requests.filter((r) => r.status === "completed");
  const otherRequests = requests.filter((r) => !["pending", "accepted", "active_rental", "return_requested", "completed"].includes(r.status));

  // Sort each section by created_at DESC
  const sortRentals = (reqs: typeof requests) =>
    [...reqs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending Requests ({pendingRequests.length})</h3>
          <div className="space-y-4">
            {sortRentals(pendingRequests).map((req) => {
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
                  category="Rental"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/rent/${req.rental_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "seller" && (
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
                      {role === "buyer" && (
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
        </div>
      )}
      {acceptedRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Accepted Requests ({acceptedRequests.length})</h3>
          <div className="space-y-4">
            {sortRentals(acceptedRequests).map((req) => {
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
                  category="Rental"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/rent/${req.rental_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "seller" && (
                        <Button className="w-full" onClick={() => handleMarkAsRentedOut(req)}>
                          Mark as Rented Out
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      {activeRentals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Active Rentals ({activeRentals.length})</h3>
          <div className="space-y-4">
            {sortRentals(activeRentals).map((req) => {
              const parsed = parseRentalRequestMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title={req.rental?.title ?? "Rental"}
                  status={req.status}
                  price={req.rental ? `${formatInr(req.rental.rent_price_per_day)} / day` : undefined}
                  coverUrl={req.rental?.coverUrl}
                  counterparty={role === "seller" ? req.buyer : req.seller}
                  counterpartyLabel={role === "seller" ? "Renter" : "Seller"}
                  message={parsed.personalMessage || undefined}
                  extra={
                    [parsed.duration, parsed.pickupDate, parsed.pickupLocation]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  category="Rental"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/rent/${req.rental_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "buyer" && (
                        <Button className="w-full" onClick={() => handleReturnItem(req)}>
                          Returned Item
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      {pendingReturns.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending Returns ({pendingReturns.length})</h3>
          <div className="space-y-4">
            {sortRentals(pendingReturns).map((req) => {
              const parsed = parseRentalRequestMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title={req.rental?.title ?? "Rental"}
                  status={req.status}
                  price={req.rental ? `${formatInr(req.rental.rent_price_per_day)} / day` : undefined}
                  coverUrl={req.rental?.coverUrl}
                  counterparty={role === "seller" ? req.buyer : req.seller}
                  counterpartyLabel={role === "seller" ? "Renter" : "Seller"}
                  message={parsed.personalMessage || undefined}
                  extra={
                    [parsed.duration, parsed.pickupDate, parsed.pickupLocation]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  category="Rental"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/rent/${req.rental_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "seller" && (
                        <Button className="w-full" onClick={() => handleConfirmReturn(req)}>
                          Confirm Return
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      {completedRentals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Completed Rentals ({completedRentals.length})</h3>
          <div className="space-y-4">
            {sortRentals(completedRentals).map((req) => {
              const parsed = parseRentalRequestMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title={req.rental?.title ?? "Rental"}
                  status={req.status}
                  price={req.rental ? `${formatInr(req.rental.rent_price_per_day)} / day` : undefined}
                  coverUrl={req.rental?.coverUrl}
                  counterparty={role === "seller" ? req.buyer : req.seller}
                  counterpartyLabel={role === "seller" ? "Renter" : "Seller"}
                  message={parsed.personalMessage || undefined}
                  extra={
                    [parsed.duration, parsed.pickupDate, parsed.pickupLocation]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  category="Rental"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/rent/${req.rental_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={<></>}
                />
              );
            })}
          </div>
        </div>
      )}
      {otherRequests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Other Requests ({otherRequests.length})</h3>
          <div className="space-y-4">
            {sortRentals(otherRequests).map((req) => {
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
                  category="Rental"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/rent/${req.rental_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
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
                      {role === "seller" && req.status === "accepted" && (
                        <Button className="w-full" onClick={() => handleMarkAsRentedOut(req)}>
                          Mark as Rented Out
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
              );
            })}
          </div>
        </div>
      )}
      <Dialog open={completionModalOpen} onOpenChange={setCompletionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rental Completed Successfully</DialogTitle>
            <DialogDescription>
              The rental has been completed. Would you like to make this item available for rent again?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleCompletionChoice("available")}
            >
              Make Available Again
            </Button>
            <Button onClick={() => handleCompletionChoice("unavailable")}>
              Keep Unavailable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  const orders = (role === "seller" ? sellerOrders : buyerOrders).filter((order) =>
    isActionableStatus(order.status),
  );
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

  // Status-based sections
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const acceptedOrders = orders.filter((o) => o.status === "accepted");
  const completedOrders = orders.filter((o) => o.status === "completed");
  const otherOrders = orders.filter((o) => !["pending", "accepted", "completed"].includes(o.status));

  // Sort each section by created_at DESC
  const sortOrders = (ords: typeof orders) =>
    [...ords].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      {pendingOrders.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending Orders ({pendingOrders.length})</h3>
          <div className="space-y-4">
            {sortOrders(pendingOrders).map((order) => (
              <RequestCard
                key={order.id}
                title={`Food order · Qty ${order.quantity}`}
                status={order.status}
                message={order.message ?? undefined}
                category="Food"
                createdAt={order.created_at}
                onViewListing={() => window.open(`/food/${order.food_listing_id}`, "_blank")}
                onOpenChat={
                  (order.status === "accepted" || order.status === "completed") && order.conversation_id
                    ? () => window.open(`/chats?conversation=${order.conversation_id}`, "_blank")
                    : undefined
                }
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
        </div>
      )}
      {acceptedOrders.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Accepted Orders ({acceptedOrders.length})</h3>
          <div className="space-y-4">
            {sortOrders(acceptedOrders).map((order) => (
              <RequestCard
                key={order.id}
                title={`Food order · Qty ${order.quantity}`}
                status={order.status}
                message={order.message ?? undefined}
                category="Food"
                createdAt={order.created_at}
                onViewListing={() => window.open(`/food/${order.food_listing_id}`, "_blank")}
                onOpenChat={
                  (order.status === "accepted" || order.status === "completed") && order.conversation_id
                    ? () => window.open(`/chats?conversation=${order.conversation_id}`, "_blank")
                    : undefined
                }
                actions={
                  <>
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
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}
      {completedOrders.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Completed Orders ({completedOrders.length})</h3>
          <div className="space-y-4">
            {sortOrders(completedOrders).map((order) => (
              <RequestCard
                key={order.id}
                title={`Food order · Qty ${order.quantity}`}
                status={order.status}
                message={order.message ?? undefined}
                category="Food"
                createdAt={order.created_at}
                onViewListing={() => window.open(`/food/${order.food_listing_id}`, "_blank")}
                onOpenChat={
                  (order.status === "accepted" || order.status === "completed") && order.conversation_id
                    ? () => window.open(`/chats?conversation=${order.conversation_id}`, "_blank")
                    : undefined
                }
                actions={<></>}
              />
            ))}
          </div>
        </div>
      )}
      {otherOrders.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Other Orders ({otherOrders.length})</h3>
          <div className="space-y-4">
            {sortOrders(otherOrders).map((order) => (
              <RequestCard
                key={order.id}
                title={`Food order · Qty ${order.quantity}`}
                status={order.status}
                message={order.message ?? undefined}
                category="Food"
                createdAt={order.created_at}
                onViewListing={() => window.open(`/food/${order.food_listing_id}`, "_blank")}
                onOpenChat={
                  (order.status === "accepted" || order.status === "completed") && order.conversation_id
                    ? () => window.open(`/chats?conversation=${order.conversation_id}`, "_blank")
                    : undefined
                }
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
        </div>
      )}
    </>
  );
}

function NotesRequestsTab({
  userId,
  role,
}: {
  userId: string | undefined;
  role: "seller" | "buyer";
}) {
  const { data: sellerPurchaseReqs = [], isLoading: ls } = useSellerNotesPurchases(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerPurchaseReqs = [], isLoading: lb } = useBuyerNotesPurchases(
    role === "buyer" ? userId : undefined,
  );
  const { data: sellerRentalReqs = [], isLoading: lsr } = useSellerNotesRentals(
    role === "seller" ? userId : undefined,
  );
  const { data: buyerRentalReqs = [], isLoading: lbr } = useBuyerNotesRentals(
    role === "buyer" ? userId : undefined,
  );
  const updatePurchase = useUpdateNotesPurchase();
  const updateRental = useUpdateNotesRental();
  const openChat = useOpenChatOnAccept();
  
  const purchaseRequests = (role === "seller" ? sellerPurchaseReqs : buyerPurchaseReqs).filter(
    (req) => isActionableStatus(req.status),
  );
  const rentalRequests = (role === "seller" ? sellerRentalReqs : buyerRentalReqs).filter(
    (req) => isActionableStatus(req.status),
  );
  const isLoading = role === "seller" ? (ls || lsr) : (lb || lbr);
  const [notesCompletionModalOpen, setNotesCompletionModalOpen] = useState(false);
  const [selectedNotesRequest, setSelectedNotesRequest] = useState<NotesRentalRow | null>(null);

  const actPurchase = (
    req: NotesPurchaseRow,
    status: NotesPurchaseRow["status"],
    title: string,
    desc: string,
    notify: string,
  ) => {
    updatePurchase.mutate(
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

  const actRental = (
    req: NotesRentalRow,
    status: NotesRentalStatus,
    title: string,
    desc: string,
    notify: string,
    listingStatus?: "available" | "rented_out" | "unavailable",
  ) => {
    updateRental.mutate(
      {
        requestId: req.id,
        status,
        notifyUserId: notify,
        notificationTitle: title,
        notificationDescription: desc,
        listingStatus,
      },
      {
        onSuccess: (result) => {
          if (status === "accepted" || status === "active_rental") openChat(result, title);
          else toast.success(title);
        },
      },
    );
  };

  const handleMarkAsRentedOutNotes = (req: NotesRentalRow) => {
    actRental(
      req,
      "active_rental",
      "Rental Started",
      "Your notes rental has started. You can now access the notes.",
      req.buyer_id,
      "rented_out",
    );
  };

  const handleReturnNotes = (req: NotesRentalRow) => {
    actRental(
      req,
      "return_requested",
      "Notes Returned",
      "The renter has returned the notes. Please confirm.",
      req.seller_id,
    );
  };

  const handleConfirmReturnNotes = (req: NotesRentalRow) => {
    setSelectedNotesRequest(req);
    setNotesCompletionModalOpen(true);
  };

  const handleNotesCompletionChoice = (listingStatus: "available" | "unavailable") => {
    if (!selectedNotesRequest) return;
    actRental(
      selectedNotesRequest,
      "completed",
      "Return Confirmed",
      "Your return of the notes has been confirmed.",
      selectedNotesRequest.buyer_id,
      listingStatus,
    );
    setNotesCompletionModalOpen(false);
    setSelectedNotesRequest(null);
  };

  if (isLoading) return <LoadingState />;
  if (!purchaseRequests.length && !rentalRequests.length) return <EmptyState label="notes" />;

  // Rental requests - status-based sections
  const pendingRentals = rentalRequests.filter((r) => r.status === "pending");
  const acceptedRentals = rentalRequests.filter((r) => r.status === "accepted");
  const activeRentals = rentalRequests.filter((r) => r.status === "active_rental");
  const pendingReturns = rentalRequests.filter((r) => r.status === "return_requested");
  const completedRentals = rentalRequests.filter((r) => r.status === "completed");
  const otherRentals = rentalRequests.filter((r) => !["pending", "accepted", "active_rental", "return_requested", "completed"].includes(r.status));

  // Purchase requests - status-based sections
  const pendingPurchases = purchaseRequests.filter((r) => r.status === "pending");
  const acceptedPurchases = purchaseRequests.filter((r) => r.status === "accepted");
  const completedPurchases = purchaseRequests.filter((r) => r.status === "completed");
  const otherPurchases = purchaseRequests.filter((r) => !["pending", "accepted", "completed"].includes(r.status));

  // Sort each section by created_at DESC
  const sortRentals = (reqs: typeof rentalRequests) =>
    [...reqs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const sortPurchases = (reqs: typeof purchaseRequests) =>
    [...reqs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      {/* Rental Requests */}
      {pendingRentals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending Rental Requests ({pendingRentals.length})</h3>
          <div className="space-y-4">
            {sortRentals(pendingRentals).map((req) => {
              const rentalDuration = parseRentalDurationFromMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title="Notes rental request"
                  status={req.status}
                  message={req.message?.replace(/Rental Duration: \d+ day[s]?\n?/, "") ?? undefined}
                  extra={rentalDuration ? `Duration: ${rentalDuration} days` : undefined}
                  category="Notes"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "seller" && (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() =>
                              actRental(
                                req,
                                "accepted",
                                "Rental Request Accepted — Chat Unlocked",
                                "Your rental request was accepted. You can now chat with the seller.",
                                req.buyer_id,
                                "rented_out",
                              )
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() =>
                              actRental(
                                req,
                                "rejected",
                                "Rental Request Rejected",
                                "Your rental request was rejected.",
                                req.buyer_id,
                              )
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {role === "buyer" && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() =>
                            actRental(
                              req,
                              "cancelled",
                              "Rental Request Cancelled",
                              "A rental request was cancelled.",
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
              );
            })}
          </div>
        </div>
      )}
      {acceptedRentals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Accepted Rental Requests ({acceptedRentals.length})</h3>
          <div className="space-y-4">
            {sortRentals(acceptedRentals).map((req) => {
              const rentalDuration = parseRentalDurationFromMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title="Notes rental request"
                  status={req.status}
                  message={req.message?.replace(/Rental Duration: \d+ day[s]?\n?/, "") ?? undefined}
                  extra={rentalDuration ? `Duration: ${rentalDuration} days` : undefined}
                  category="Notes"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "seller" && (
                        <Button className="w-full" onClick={() => handleMarkAsRentedOutNotes(req)}>
                          Mark as Rented Out
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      {activeRentals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Active Rentals ({activeRentals.length})</h3>
          <div className="space-y-4">
            {sortRentals(activeRentals).map((req) => {
              const rentalDuration = parseRentalDurationFromMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title="Notes rental request"
                  status={req.status}
                  message={req.message?.replace(/Rental Duration: \d+ day[s]?\n?/, "") ?? undefined}
                  extra={rentalDuration ? `Duration: ${rentalDuration} days` : undefined}
                  category="Notes"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "buyer" && (
                        <Button className="w-full" onClick={() => handleReturnNotes(req)}>
                          Returned Notes
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      {pendingReturns.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending Returns ({pendingReturns.length})</h3>
          <div className="space-y-4">
            {sortRentals(pendingReturns).map((req) => {
              const rentalDuration = parseRentalDurationFromMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title="Notes rental request"
                  status={req.status}
                  message={req.message?.replace(/Rental Duration: \d+ day[s]?\n?/, "") ?? undefined}
                  extra={rentalDuration ? `Duration: ${rentalDuration} days` : undefined}
                  category="Notes"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={
                    <>
                      {role === "seller" && (
                        <Button className="w-full" onClick={() => handleConfirmReturnNotes(req)}>
                          Confirm Return
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      {completedRentals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Completed Rentals ({completedRentals.length})</h3>
          <div className="space-y-4">
            {sortRentals(completedRentals).map((req) => {
              const rentalDuration = parseRentalDurationFromMessage(req.message);
              return (
                <RequestCard
                  key={req.id}
                  title="Notes rental request"
                  status={req.status}
                  message={req.message?.replace(/Rental Duration: \d+ day[s]?\n?/, "") ?? undefined}
                  extra={rentalDuration ? `Duration: ${rentalDuration} days` : undefined}
                  category="Notes"
                  createdAt={req.created_at}
                  onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                  onOpenChat={
                    (req.status === "accepted" || req.status === "active_rental" || req.status === "return_requested" || req.status === "completed") && req.conversation_id
                      ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                      : undefined
                  }
                  actions={<></>}
                />
              );
            })}
          </div>
        </div>
      )}
      {/* Purchase Requests */}
      {pendingPurchases.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pending Purchase Requests ({pendingPurchases.length})</h3>
          <div className="space-y-4">
            {sortPurchases(pendingPurchases).map((req) => (
              <RequestCard
                key={req.id}
                title="Notes purchase request"
                status={req.status}
                message={req.message ?? undefined}
                extra="Type: Purchase"
                category="Notes"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
                }
                actions={
                  <>
                    {role === "seller" && req.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() =>
                            actPurchase(
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
                            actPurchase(
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
                    {req.status === "pending" && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          actPurchase(
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
        </div>
      )}
      {acceptedPurchases.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Accepted Purchase Requests ({acceptedPurchases.length})</h3>
          <div className="space-y-4">
            {sortPurchases(acceptedPurchases).map((req) => (
              <RequestCard
                key={req.id}
                title="Notes purchase request"
                status={req.status}
                message={req.message ?? undefined}
                extra="Type: Purchase"
                category="Notes"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
                }
                actions={
                  <>
                  {role === "seller" && req.status === "accepted" && req.conversation_id && (
  <Button
    className="w-full"
    variant="outline"
    onClick={() => window.open(`/chats/${req.conversation_id}`, "_self")}
  >
    Complete via Chat
  </Button>
)}          
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}
      {completedPurchases.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Completed Purchase Requests ({completedPurchases.length})</h3>
          <div className="space-y-4">
            {sortPurchases(completedPurchases).map((req) => (
              <RequestCard
                key={req.id}
                title="Notes purchase request"
                status={req.status}
                message={req.message ?? undefined}
                extra="Type: Purchase"
                category="Notes"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
                }
                actions={<></>}
              />
            ))}
          </div>
        </div>
      )}
      {otherPurchases.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Other Purchase Requests ({otherPurchases.length})</h3>
          <div className="space-y-4">
            {sortPurchases(otherPurchases).map((req) => (
              <RequestCard
                key={req.id}
                title="Notes purchase request"
                status={req.status}
                message={req.message ?? undefined}
                extra="Type: Purchase"
                category="Notes"
                createdAt={req.created_at}
                onViewListing={() => window.open(`/notes/${req.notes_listing_id}`, "_blank")}
                onOpenChat={
                  (req.status === "accepted" || req.status === "completed") && req.conversation_id
                    ? () => window.open(`/chats?conversation=${req.conversation_id}`, "_blank")
                    : undefined
                }
                actions={
                  <>
                    {role === "seller" && req.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() =>
                            actPurchase(
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
                            actPurchase(
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
                   {role === "seller" && req.status === "accepted" && req.conversation_id && (
  <Button
    className="w-full"
    variant="outline"
    onClick={() => window.open(`/chats/${req.conversation_id}`, "_self")}
  >
    Complete via Chat
  </Button>
)}
                    {req.status === "pending" && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          actPurchase(
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
        </div>
      )}
      {otherRentals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Other Rental Requests ({otherRentals.length})</h3>
          <div className="space-y-4">
            {sortRentals(otherRentals).map((req) => {
                const rentalDuration = parseRentalDurationFromMessage(req.message);
                return (
                  <RequestCard
                    key={req.id}
                    title="Notes rental request"
                    status={req.status}
                    message={req.message?.replace(/Rental Duration: \d+ day[s]?\n?/, "") ?? undefined}
                    extra={rentalDuration ? `Duration: ${rentalDuration} days` : undefined}
                    category="Notes"
                    createdAt={req.created_at}
                    actions={
                      <>
                        {role === "seller" && req.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() =>
                                actRental(
                                  req,
                                  "accepted",
                                  "Rental Request Accepted — Chat Unlocked",
                                  "Your rental request was accepted. You can now chat with the seller.",
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
                                actRental(
                                  req,
                                  "rejected",
                                  "Rental Request Rejected",
                                  "Your rental request was rejected.",
                                  req.buyer_id,
                                )
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {role === "seller" && req.status === "accepted" && (
                          <Button className="w-full" onClick={() => handleMarkAsRentedOutNotes(req)}>
                            Mark as Rented Out
                          </Button>
                        )}
                        {req.status === "pending" && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              actRental(
                                req,
                                "cancelled",
                                "Rental Request Cancelled",
                                "A rental request was cancelled.",
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
                );
              })}
            </div>
          </div>
        )}
      <Dialog open={notesCompletionModalOpen} onOpenChange={setNotesCompletionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes Rental Completed Successfully</DialogTitle>
            <DialogDescription>
              The notes rental has been completed. Would you like to make these notes available for rent again?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleNotesCompletionChoice("available")}
            >
              Make Available Again
            </Button>
            <Button onClick={() => handleNotesCompletionChoice("unavailable")}>
              Keep Unavailable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  category,
  createdAt,
  actions,
  onViewListing,
  onOpenChat,
}: {
  title: string;
  status: string;
  price?: string;
  coverUrl?: string | null;
  counterparty?: { display_name: string; avatar_url: string | null };
  counterpartyLabel?: string;
  message?: string;
  extra?: string;
  category?: string;
  createdAt?: string;
  actions?: React.ReactNode;
  onViewListing?: () => void;
  onOpenChat?: () => void;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const categoryLower = category?.toLowerCase() || "product";
  const categoryStyle = CATEGORY_STYLES[categoryLower] || CATEGORY_STYLES.product;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;

  // Category icon fallback
  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, string> = {
      product: "📦",
      rental: "🔄",
      food: "🍔",
      notes: "📝",
    };
    return icons[cat.toLowerCase()] || "📦";
  };

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-4">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted text-3xl">
              {getCategoryIcon(category || "product")}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <Badge className={cn("text-[10px] capitalize", categoryStyle)}>
                  {category}
                </Badge>
              )}
              <Badge className={cn("text-[10px] capitalize", statusStyle)}>
                {status}
              </Badge>
              {createdAt && <span className="text-xs text-muted-foreground">{formatDate(createdAt)}</span>}
            </div>
            <h3 className="mt-1 font-semibold">{title}</h3>
            {price && <p className="text-sm text-primary">{price}</p>}
            {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
            {counterparty && (
              <div className="mt-2 flex items-center gap-2">
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
        <div className="flex flex-wrap gap-2">
          {actions}
          {onViewListing && (
            <Button variant="outline" className="flex-1" onClick={onViewListing}>
              View Listing
            </Button>
          )}
          {onOpenChat && (
            <Button variant="outline" className="flex-1" onClick={onOpenChat}>
              Open Chat
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UnifiedRequestCard({
  title,
  status,
  price,
  coverUrl,
  counterparty,
  counterpartyLabel,
  message,
  extra,
  category,
  createdAt,
  actions,
  onViewListing,
  onOpenChat,
}: {
  title: string;
  status: string;
  price?: string;
  coverUrl?: string | null;
  counterparty?: { display_name: string; avatar_url: string | null };
  counterpartyLabel?: string;
  message?: string;
  extra?: string;
  category: string;
  createdAt: string;
  actions?: React.ReactNode;
  onViewListing?: () => void;
  onOpenChat?: () => void;
}) {
  const categoryLower = category.toLowerCase();
  const categoryStyle = CATEGORY_STYLES[categoryLower] || CATEGORY_STYLES.product;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-4">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
              —
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("text-[10px] capitalize", categoryStyle)}>
                {category}
              </Badge>
              <Badge className={cn("text-[10px] capitalize", statusStyle)}>
                {status}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(createdAt)}</span>
            </div>
            <h3 className="mt-1 font-semibold">{title}</h3>
            {price && <p className="text-sm text-primary">{price}</p>}
            {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
            {counterparty && (
              <div className="mt-2 flex items-center gap-2">
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
        <div className="flex flex-wrap gap-2">
          {actions}
          {onViewListing && (
            <Button variant="outline" className="flex-1" onClick={onViewListing}>
              View Listing
            </Button>
          )}
          {onOpenChat && (
            <Button variant="outline" className="flex-1" onClick={onOpenChat}>
              Open Chat
            </Button>
          )}
        </div>
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
