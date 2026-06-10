import {
  createNotification,
  type NotificationModule,
  type NotificationPriority,
} from "@/lib/notifications";

export type TransactionNotificationAction = {
  label: string;
  url: string;
};

type TransactionNotificationInput = {
  receiverId: string;
  senderId: string;
  title: string;
  description: string;
  module: NotificationModule;
  priority?: NotificationPriority;
  actionUrl: string;
  actions: TransactionNotificationAction[];
  conversationId: string;
  relatedEntityId: string;
  listingId: string;
  requestId?: string;
  buyerId?: string;
  renterId?: string;
};

export function viewListingUrl(module: NotificationModule, listingId: string) {
  if (module === "rentals") return `/rent/${listingId}`;
  if (module === "notes") return `/notes/${listingId}`;
  if (module === "food") return `/food/${listingId}`;
  return `/product/${listingId}`;
}

export function browseSimilarUrl(module: NotificationModule) {
  if (module === "rentals") return "/rent";
  if (module === "notes") return "/notes";
  if (module === "food") return "/food";
  return "/";
}

export async function createTransactionNotification(input: TransactionNotificationInput) {
  return createNotification({
    userId: input.receiverId,
    title: input.title,
    description: input.description,
    priority: input.priority ?? "important",
    module: input.module,
    actionUrl: input.actionUrl,
    metadata: {
      conversationId: input.conversationId,
      relatedEntityId: input.relatedEntityId,
      listingId: input.listingId,
      senderId: input.senderId,
      receiverId: input.receiverId,
      requestId: input.requestId,
      buyerId: input.buyerId,
      renterId: input.renterId,
      actions: input.actions,
    },
  });
}

export function ownerRequestActions(input: {
  conversationId: string;
  listingUrl: string;
  acceptLabel: string;
  rejectLabel: string;
}) {
  return [
    { label: input.acceptLabel, url: "/requests" },
    { label: input.rejectLabel, url: "/requests" },
    { label: "Open Chat", url: `/chats/${input.conversationId}` },
    { label: "View Listing", url: input.listingUrl },
  ];
}

export function acceptedActions(conversationId: string, detailsUrl: string) {
  return [
    { label: "Open Chat", url: `/chats/${conversationId}` },
    { label: "View Details", url: detailsUrl },
  ];
}

export function rejectedActions(module: NotificationModule, listingUrl: string) {
  return [
    { label: "Browse Similar Listings", url: browseSimilarUrl(module) },
    { label: "View Listing", url: listingUrl },
  ];
}

export function completedActions(detailsUrl: string) {
  return [
    { label: "Leave Review", url: detailsUrl },
    { label: "View Details", url: detailsUrl },
  ];
}

export async function createTransactionCompletedNotifications(input: {
  buyerId: string;
  sellerId: string;
  module: NotificationModule;
  conversationId: string;
  listingId: string;
  relatedEntityId: string;
  requestId?: string;
}) {
  const detailsUrl = `/chats/${input.conversationId}`;
  await Promise.all([
    createTransactionNotification({
      receiverId: input.buyerId,
      senderId: input.sellerId,
      title: "Transaction Completed",
      description: "This transaction has been completed successfully.",
      priority: "important",
      module: input.module,
      actionUrl: detailsUrl,
      actions: completedActions(detailsUrl),
      conversationId: input.conversationId,
      relatedEntityId: input.relatedEntityId,
      listingId: input.listingId,
      requestId: input.requestId,
      buyerId: input.buyerId,
    }),
    createTransactionNotification({
      receiverId: input.sellerId,
      senderId: input.buyerId,
      title: "Transaction Completed",
      description: "This transaction has been completed successfully.",
      priority: "important",
      module: input.module,
      actionUrl: detailsUrl,
      actions: completedActions(detailsUrl),
      conversationId: input.conversationId,
      relatedEntityId: input.relatedEntityId,
      listingId: input.listingId,
      requestId: input.requestId,
      buyerId: input.buyerId,
    }),
  ]);
}
