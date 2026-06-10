import { Link } from "@tanstack/react-router";

import {
  formatChatTime,
  getConversationPreview,
  getConversationTimestamp,
  getDaysUntilDeletion,
  type ConversationListItem,
} from "@/lib/chat";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

type ConversationListItemRowProps = {
  conversation: ConversationListItem;

  isActive?: boolean;
};

function StatusBadge({ status }: { status: ConversationListItem["status"] }) {
  switch (status) {
    case "active":
      return (
        <Badge variant="secondary" className="shrink-0 text-[9px]">
          Active
        </Badge>
      );
    case "completion_pending":
      return (
        <Badge className="shrink-0 bg-amber-100 text-[9px] text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
          Completion Pending
        </Badge>
      );
    case "completed":
      return (
        <Badge className="shrink-0 bg-emerald-100 text-[9px] text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
          Completed
        </Badge>
      );
    case "auto_archived":
      return (
        <Badge variant="outline" className="shrink-0 text-[9px] text-slate-500">
          Auto Archived
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline" className="shrink-0 text-[9px]">
          Archived
        </Badge>
      );
    default:
      return null;
  }
}

export function ConversationListItemRow({
  conversation,

  isActive,
}: ConversationListItemRowProps) {
  const timestamp = getConversationTimestamp(conversation);

  const preview = getConversationPreview(conversation);

  const daysLeft = getDaysUntilDeletion(conversation.archived_at);
  const isArchived =
    conversation.status === "archived" ||
    conversation.status === "auto_archived" ||
    conversation.status === "completed";

  return (
    <Link
      to="/chats/$id"
      params={{ id: conversation.id }}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-muted/50",

        isActive && "border-primary bg-primary/5",

        conversation.section === "request" && "border-primary/30 bg-primary/5",
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        {conversation.other_user.avatar_url ? (
          <AvatarImage src={`${conversation.other_user.avatar_url}?t=${Date.now()}`} alt="" />
        ) : null}

        <AvatarFallback>
          {conversation.other_user.display_name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">
            {conversation.other_user.display_name}
          </span>

          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatChatTime(timestamp)}
          </span>
        </div>

        <p className="truncate text-xs font-medium text-foreground/80">
          {conversation.listing_title}
        </p>

        <p
          className={cn(
            "truncate text-xs",

            conversation.section === "request" ? "text-primary" : "text-muted-foreground/80",
          )}
        >
          {preview}
        </p>

        {/* Archive info */}
        {isArchived && conversation.archived_at && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {conversation.archive_reason ?? "Archived"}
            {daysLeft !== null && daysLeft > 0
              ? ` · Deletes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
              : daysLeft === 0
                ? " · Deletes soon"
                : ""}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={conversation.status} />

        {conversation.unread_count > 0 && (
          <Badge
            variant="destructive"
            className="h-5 min-w-5 rounded-full px-1.5 text-[10px]"
          >
            {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
          </Badge>
        )}
      </div>
    </Link>
  );
}
