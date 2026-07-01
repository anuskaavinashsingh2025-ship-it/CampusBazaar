import { Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";


import {
  formatChatTime,
  getConversationPreview,
  getConversationTimestamp,
  getDaysUntilDeletion,
  type ConversationListItem,
} from "@/lib/chat";

import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/lib/auth";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";

import { cn } from "@/lib/utils";

import { Package, Home, Utensils, BookOpen, Clock, CheckCircle2, AlertCircle, Archive, XCircle } from "lucide-react";

type ConversationListItemRowProps = {
  conversation: ConversationListItem;

  isActive?: boolean;
};

function StatusBadge({ status }: { status: ConversationListItem["status"] }) {
  switch (status) {
    case "active":
      return (
        <Badge className="shrink-0 gap-1 bg-blue-100 text-[10px] text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
          <Clock className="h-3 w-3" />
          Active
        </Badge>
      );
    case "completion_pending":
      return (
        <Badge className="shrink-0 gap-1 bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="h-3 w-3" />
          Completion Pending
        </Badge>
      );
    case "completed":
      return (
        <Badge className="shrink-0 gap-1 bg-gray-100 text-[10px] text-gray-800 hover:bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "auto_archived":
      return (
        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] text-slate-500">
          <Archive className="h-3 w-3" />
          Auto Archived
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
          <Archive className="h-3 w-3" />
          Archived
        </Badge>
      );
    default:
      return null;
  }
}

function CategoryBadge({ contextType }: { contextType: ConversationListItem["context_type"] }) {
  const config = {
    product: { label: "Product", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Package },
    rental: { label: "Rental", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: Home },
    food: { label: "Food", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: Utensils },
    notes: { label: "Notes", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: BookOpen },
  } as const;

  const { label, color, icon: Icon } = config[contextType] || config.product;

  return (
    <Badge className={cn("gap-1 text-[10px]", color)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function UserRoleBadge({
  contextType,
  isBuyer,
}: {
  contextType: ConversationListItem["context_type"];
  isBuyer: boolean;
}) {
  let role = "";
  if (contextType === "product" || contextType === "food") {
    role = isBuyer ? "Buyer" : "Seller";
  } else if (contextType === "rental") {
    role = isBuyer ? "Renter" : "Owner";
  } else if (contextType === "notes") {
    role = isBuyer ? "Notes Buyer" : "Notes Seller";
  }

  return (
    <Badge variant="outline" className="shrink-0 text-[10px]">
      {role}
    </Badge>
  );
}

export function ConversationListItemRow({
  conversation,

  isActive,
}: ConversationListItemRowProps) {
  const { user } = useAuth();

  const timestamp = getConversationTimestamp(conversation);
  const [imageError, setImageError] = useState(false);
  const preview = getConversationPreview(conversation);

  const daysLeft = getDaysUntilDeletion(conversation.archived_at);
  const isArchived =
    conversation.status === "archived" ||
    conversation.status === "auto_archived" ||
    conversation.status === "completed";

  const hasUnread = conversation.unread_count > 0;

  // Determine if current user is buyer or seller
  const isBuyer = useMemo(() => {
    return user?.id === conversation.buyer_id;
  }, [user?.id, conversation.buyer_id]);

  // Fetch listing image based on context_type and context_id
  const [listingImageUrl, setListingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListingImage() {
      if (!conversation.context_id || !conversation.context_type) return;

      try {
        const bucketMap = {
          product: "product-images",
          rental: "rental-images",
          food: "food-images",
          notes: "notes-assets",
        } as const;

        const tableMap = {
          product: "product_images",
          rental: "rental_images",
          food: "food_images",
          notes: "notes_assets",
        } as const;

        const bucket = bucketMap[conversation.context_type];
        const table = tableMap[conversation.context_type];

        // Fetch the first image for this listing
        const { data: images } = await supabase
          .from(table)
          .select("storage_path")
          .eq(conversation.context_type === "product" ? "product_id" : 
              conversation.context_type === "rental" ? "rental_id" :
              conversation.context_type === "food" ? "food_listing_id" : "notes_listing_id", 
              conversation.context_id)
          .order("sort_index", { ascending: true })
          .limit(1);

        if (images && images.length > 0) {
          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(images[0].storage_path);
          setListingImageUrl(publicUrl);
        }
      } catch (error) {
        console.error("Error fetching listing image:", error);
        setImageError(true);
      }
    }

    fetchListingImage();
  }, [conversation.context_type, conversation.context_id]);

  return (
    <Card
      className={cn(
        "group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        hasUnread && "border-primary/50 bg-primary/5",
        isActive && "border-primary ring-2 ring-primary",
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <Link
          to="/chats/$id"
          params={{ id: conversation.id }}
          className="flex gap-3 sm:gap-4"
        >
          {/* Listing Image */}
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-20">
            {listingImageUrl && !imageError ? (
  <img
    src={listingImageUrl}
    alt={conversation.listing_title}
    className="h-full w-full object-cover"
    onError={() => setImageError(true)}
  />
) : (
  <div className="flex h-full w-full items-center justify-center">
    <CategoryBadge contextType={conversation.context_type} />
  </div>
)}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
            {/* Header: Title and badges */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
                  {conversation.listing_title}
                </h3>
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  <CategoryBadge contextType={conversation.context_type} />
                  <UserRoleBadge
                    contextType={conversation.context_type}
                    isBuyer={isBuyer}
                  />
                  <StatusBadge status={conversation.status} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {formatChatTime(timestamp)}
                </span>
                {hasUnread && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 rounded-full px-1.5 text-[10px]"
                  >
                    {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                  </Badge>
                )}
              </div>
            </div>

            {/* User info and preview */}
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 shrink-0 sm:h-6 sm:w-6">
                {conversation.other_user.avatar_url ? (
                  <AvatarImage
                    src={`${conversation.other_user.avatar_url}?t=${Date.now()}`}
                    alt=""
                  />
                ) : null}
                <AvatarFallback className="text-[9px] sm:text-[10px]">
                  {conversation.other_user.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-xs font-medium text-foreground/70 sm:text-xs">
                {conversation.other_user.display_name}
              </span>
            </div>

            {/* Preview text */}
            <p
              className={cn(
                "truncate text-xs",
                hasUnread ? "font-semibold text-foreground" : 
                conversation.section === "new" ? "text-primary" : "text-muted-foreground/80",
              )}
            >
              {preview}
            </p>

            {/* Archive info */}
            {isArchived && conversation.archived_at && (
              <p className="text-[10px] text-muted-foreground">
                {conversation.archive_reason ?? "Archived"}
                {daysLeft !== null && daysLeft > 0
                  ? ` · Deletes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
                  : daysLeft === 0
                    ? " · Deletes soon"
                    : ""}
              </p>
            )}

            {/* Completed countdown */}
            {conversation.status === "completed" && conversation.completed_at && (
              <p className="text-[10px] text-muted-foreground">
                Deletes in {getDaysUntilDeletion(conversation.completed_at)} day{getDaysUntilDeletion(conversation.completed_at) === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {/* Open Chat Button */}
          <div className="flex shrink-0 items-center">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 sm:h-8 sm:px-3 sm:text-xs sm:opacity-100"
            >
              Open Chat
            </Button>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
