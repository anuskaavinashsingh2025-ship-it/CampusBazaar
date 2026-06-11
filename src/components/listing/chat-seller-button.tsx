import { MessageSquare } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  findConversationForListing,
  getOrCreateConversation,
  type ChatContextType,
} from "@/lib/chat";
import { Button } from "@/components/ui/button";

type ChatSellerButtonProps = {
  sellerId: string;
  chatUnlocked: boolean;
  contextType: ChatContextType;
  contextId: string;
  listingTitle: string;
  requestId?: string;
  className?: string;
};

export function ChatSellerButton({
  sellerId,
  chatUnlocked,
  contextType,
  contextId,
  listingTitle,
  requestId,
  className,
}: ChatSellerButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = async () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.id === sellerId) {
      toast.error("You can't chat with yourself.");
      return;
    }
    if (!chatUnlocked) {
      if (contextType === "food") {
        toast.message("Place an order first to start chatting with this seller.");
      } else {
        toast.message("Chat unlocks after the seller accepts your request.");
      }
      return;
    }

    try {
      let conversationId = await findConversationForListing({
        userId: user.id,
        contextType,
        contextId,
      });

      if (!conversationId && user.id !== sellerId) {
        conversationId = await getOrCreateConversation({
          buyerId: user.id,
          sellerId,
          contextType,
          contextId,
          requestId,
          listingTitle,
        });
      }

      if (!conversationId) {
        toast.error("No conversation found for this listing yet.");
        return;
      }

      navigate({ to: "/chats/$id", params: { id: conversationId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open chat");
    }
  };

  return (
    <Button variant="outline" className={className ?? "gap-2"} onClick={() => void handleClick()}>
      <MessageSquare className="h-4 w-4" />
      Chat Seller
    </Button>
  );
}
