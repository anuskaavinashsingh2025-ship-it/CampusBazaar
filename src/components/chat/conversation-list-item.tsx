import { Link } from "@tanstack/react-router";

import {
  formatChatTime,
  getConversationPreview,
  getConversationTimestamp,
  type ConversationListItem,
} from "@/lib/chat";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

type ConversationListItemRowProps = {
  conversation: ConversationListItem;

  isActive?: boolean;
};

export function ConversationListItemRow({
  conversation,

  isActive,
}: ConversationListItemRowProps) {
  const timestamp = getConversationTimestamp(conversation);

  const preview = getConversationPreview(conversation);

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
      </div>

      {conversation.unread_count > 0 && (
        <Badge
          variant="destructive"
          className="h-5 min-w-5 shrink-0 rounded-full px-1.5 text-[10px]"
        >
          {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
        </Badge>
      )}
    </Link>
  );
}
