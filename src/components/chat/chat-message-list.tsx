import { useEffect, useRef } from "react";
import { Check, CheckCheck } from "lucide-react";

import { formatChatTime, getChatImageUrl, type MessageRow } from "@/lib/chat";
import { cn } from "@/lib/utils";

type ChatMessageListProps = {
  messages: MessageRow[];
  currentUserId: string;
  isTyping?: boolean;
  otherUserName?: string;
};

function DeliveryIcon({ status }: { status: MessageRow["delivery_status"] }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 text-primary" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

export function ChatMessageList({
  messages,
  currentUserId,
  isTyping,
  otherUserName,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((msg) => {
        const isMine = msg.sender_id === currentUserId;
        return (
          <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                isMine
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md border bg-card",
              )}
            >
              {msg.message_type === "image" ? (
                <a href={getChatImageUrl(msg.content)} target="_blank" rel="noreferrer">
                  <img
                    src={getChatImageUrl(msg.content)}
                    alt="Shared image"
                    className="max-h-48 rounded-lg object-cover"
                  />
                </a>
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              )}
              <div
                className={cn(
                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                  isMine ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                <span>{formatChatTime(msg.created_at)}</span>
                {isMine && <DeliveryIcon status={msg.delivery_status} />}
              </div>
            </div>
          </div>
        );
      })}
      {isTyping && (
        <div className="text-xs text-muted-foreground">{otherUserName ?? "User"} is typing...</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
