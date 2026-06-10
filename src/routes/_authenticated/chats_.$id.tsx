import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Archive, Loader2, Star } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  useArchiveConversation,
  useCompleteConversation,
  useConversation,
  useIsTyping,
  useMarkConversationRead,
  useMessageRealtime,
  useMessages,
  useParticipantTrust,
  usePresence,
  usePresenceRealtime,
  useSubmitRating,
  useUpdatePresence,
} from "@/lib/chat";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatReportDialog } from "@/components/chat/chat-report-dialog";
import { ChatTrustHeader } from "@/components/chat/chat-trust-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/chats_/$id")({
  head: () => ({
    meta: [{ title: "Chat — CampusBazar" }],
  }),
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = Route.useParams();
  // The `?focus=1` search param is added by the "Notes Request → Chat"
  // integration so the message input is auto-focused after redirect.
  const search = Route.useSearch() as unknown as { focus?: string } | undefined;
  const shouldFocus = search?.focus === "1";
  const composerRef = useRef<{ focus: () => void } | null>(null);
  const { data: conversation, isLoading: loadingConv } = useConversation(id, user?.id);
  const { data: messages = [], isLoading: loadingMsgs } = useMessages(id);
  const markRead = useMarkConversationRead(user?.id);
  const archive = useArchiveConversation(user?.id);
  const complete = useCompleteConversation(user?.id);
  const submitRating = useSubmitRating(user?.id);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState("5");
  const [review, setReview] = useState("");

  useMessageRealtime(id);
  useUpdatePresence(user?.id);

  // Belt-and-braces: if the chat page renders after the composer has
  // mounted but the user just landed from the Respond button, re-focus
  // the composer once the messages + conversation are ready.
  useEffect(() => {
    if (!shouldFocus) return;
    if (loadingConv || loadingMsgs) return;
    if (!conversation) return;
    const t = window.setTimeout(() => {
      composerRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [shouldFocus, loadingConv, loadingMsgs, conversation?.id]);

  const otherUserId =
    conversation && user
      ? conversation.buyer_id === user.id
        ? conversation.seller_id
        : conversation.buyer_id
      : undefined;

  const { data: trust } = useParticipantTrust(otherUserId);
  const { data: presence } = usePresence(otherUserId);
  usePresenceRealtime(otherUserId);
  const isTyping = useIsTyping(presence, id);

  useEffect(() => {
    if (id && user?.id && conversation) {
      void markRead.mutateAsync(id);
    }
  }, [id, user?.id, conversation?.id]);

  if (loadingConv || loadingMsgs) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation || !user) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">Conversation not found or access denied.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/chats">Back to chats</Link>
        </Button>
      </div>
    );
  }

  const canSend = conversation.status === "active" || conversation.status === "reported";
  const isCompleted = conversation.status === "completed";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/chats" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">Conversation</span>
        <div className="ml-auto flex items-center gap-1">
          {isCompleted && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setRatingOpen(true)}
            >
              <Star className="h-3.5 w-3.5" />
              Rate
            </Button>
          )}
          <ChatReportDialog
            userId={user.id}
            conversationId={conversation.id}
            otherUserId={otherUserId!}
            listingTitle={conversation.listing_title}
          />
          {conversation.status === "active" && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => complete.mutate(conversation.id)}
            >
              Complete
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => archive.mutate(conversation.id)}
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      </div>

      {trust && (
        <ChatTrustHeader
          trust={trust}
          listingTitle={conversation.listing_title}
          isOnline={presence?.is_online ?? false}
        />
      )}

      <ChatMessageList
        messages={messages}
        currentUserId={user.id}
        isTyping={isTyping}
        otherUserName={trust?.display_name}
      />

      <ChatComposer
        ref={composerRef}
        userId={user.id}
        conversationId={conversation.id}
        recipientId={otherUserId!}
        listingTitle={conversation.listing_title}
        disabled={!canSend}
        autoFocus={shouldFocus}
      />

      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
            <DialogDescription>
              Rate your experience with {trust?.display_name ?? "the seller"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rating (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Review (optional)</Label>
              <Textarea value={review} onChange={(e) => setReview(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                submitRating.mutate(
                  {
                    conversationId: conversation.id,
                    rating: Number(rating),
                    review,
                  },
                  { onSuccess: () => setRatingOpen(false) },
                )
              }
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
