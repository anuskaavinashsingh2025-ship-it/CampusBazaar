import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Archive, Loader2, Star, Clock, CheckCircle2, RotateCcw, Undo2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchRentalRequestStatus,
  useArchiveConversation,
  useConfirmConversationCompletion,
  useRequestConversationCompletion,
  useWithdrawCompletionRequest,
  useDeclineConversationCompletion,
  useReopenArchivedChat,
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
import { getDaysUntilDeletion } from "@/lib/chat-inactivity";
import {
  useUpdateRentalRequest,
  type RentalRequestStatus,
} from "@/lib/rental-requests";
import {
  useUpdateNotesRental,
  type NotesRentalStatus,
} from "@/lib/notes-rental-requests";
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
  const requestCompletion = useRequestConversationCompletion(user?.id);
  const confirmCompletion = useConfirmConversationCompletion(user?.id);
  const withdrawCompletion = useWithdrawCompletionRequest(user?.id);
  const declineCompletion = useDeclineConversationCompletion(user?.id);
  const reopenChat = useReopenArchivedChat(user?.id);
  const submitRating = useSubmitRating(user?.id);
  const updateRental = useUpdateRentalRequest();
  const updateNotesRental = useUpdateNotesRental();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState("5");
  const [review, setReview] = useState("");
  const [rentalStatus, setRentalStatus] = useState<string | null>(null);
  const [loadingRentalStatus, setLoadingRentalStatus] = useState(false);
  const [rentalCompletionModalOpen, setRentalCompletionModalOpen] = useState(false);
  const [notesCompletionModalOpen, setNotesCompletionModalOpen] = useState(false);
  const [isNotesRental, setIsNotesRental] = useState(false);

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

  useEffect(() => {
    const fetchStatus = async () => {
      if (!conversation) return;
      setLoadingRentalStatus(true);
      try {
        const status = await fetchRentalRequestStatus(conversation);
        setRentalStatus(status);
      } catch (err) {
        console.error("Failed to fetch rental status:", err);
      } finally {
        setLoadingRentalStatus(false);
      }
    };
    void fetchStatus();
  }, [conversation]);

  useEffect(() => {
  const checkNotesType = async () => {
    if (!conversation || conversation.context_type !== "notes" || !conversation.request_id) {
      setIsNotesRental(false);
      return;
    }
    try {
      // Check notes_purchase_requests for rental type listing
      const { data: purchaseRequest } = await supabase
        .from("notes_purchase_requests")
        .select("id, notes_listing_id")
        .eq("id", conversation.request_id)
        .maybeSingle();

      if (purchaseRequest) {
        // Check if the underlying listing is a rental type
        const { data: listing } = await supabase
          .from("notes_listings")
          .select("listing_type")
          .eq("id", (purchaseRequest as { notes_listing_id: string }).notes_listing_id)
          .maybeSingle();
        const isRentalListing = (listing as { listing_type?: string } | null)?.listing_type === "rent";
        setIsNotesRental(isRentalListing);
      } else {
        // It's a notes_request (marketplace "I need notes" post) — treat as purchase flow
        setIsNotesRental(false);
      }
    } catch (err) {
      console.error("Failed to check notes type:", err);
      setIsNotesRental(false);
    }
  };
  void checkNotesType();
}, [conversation]);

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

  const canSend = conversation.status === "active" || conversation.status === "completion_pending";
  const isCompleted = conversation.status === "completed";
  const isArchived = conversation.status === "archived" || conversation.status === "auto_archived";
  const isAutoArchived = conversation.status === "auto_archived";
  const isCompletionPending = conversation.status === "completion_pending";
  const isRental = conversation.context_type === "rental";
  const isNotes = conversation.context_type === "notes";
  const isFood = conversation.context_type === "food";
  const isRequest = conversation.context_type === "food" || conversation.context_type === "notes";
  const isSeller = conversation.seller_id === user?.id;
  const isBuyer = conversation.buyer_id === user?.id;
  const isCompletionRequester = conversation.completion_requested_by === user?.id;
  const isCompletionConfirmer = isCompletionPending && !isCompletionRequester;


  const STATUS_STYLES: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-emerald-100 text-emerald-800",
    active_rental: "bg-green-100 text-green-800",
    return_requested: "bg-orange-100 text-orange-800",
    rejected: "bg-red-100 text-red-800",
    returned: "bg-blue-100 text-blue-800",
    completed: "bg-slate-100 text-slate-700",
    cancelled: "bg-slate-100 text-slate-500",
  };

  const handleRentalAction = (status: RentalRequestStatus, listingStatus?: "available" | "rented_out" | "unavailable") => {
    console.log("[handleRentalAction] Called with:", { status, listingStatus, requestId: conversation.request_id });
    if (!conversation.request_id) return;
    updateRental.mutate(
      {
        requestId: conversation.request_id,
        status,
        rentalId: conversation.context_id,
        listingStatus,
        notifyUserId: isSeller ? conversation.buyer_id : conversation.seller_id,
        notificationTitle: status === "active_rental" ? "Rental Started" : status === "return_requested" ? "Item Returned" : "Return Confirmed",
        notificationDescription: status === "active_rental" ? "Your rental has started." : status === "return_requested" ? "The renter has returned the item." : "Your return has been confirmed.",
      },
      { onSuccess: () => setRentalStatus(status) },
    );
  };

  const handleRentalCompletionChoice = (listingStatus: "available" | "unavailable") => {
    console.log("[handleRentalCompletionChoice] Called with:", { listingStatus, requestId: conversation.request_id });
    handleRentalAction("completed", listingStatus);
    setRentalCompletionModalOpen(false);
    // Initiate two-party completion on the conversation
    requestCompletion.mutate(conversation.id);
  };

  const handleNotesRentalAction = (status: NotesRentalStatus, listingStatus?: "available" | "rented_out" | "unavailable") => {
    console.log("[handleNotesRentalAction] Called with:", { status, listingStatus, requestId: conversation.request_id });
    if (!conversation.request_id) return;
    updateNotesRental.mutate(
      {
        requestId: conversation.request_id,
        status,
        listingStatus,
        notifyUserId: isSeller ? conversation.buyer_id : conversation.seller_id,
        notificationTitle: status === "active_rental" ? "Rental Started" : status === "return_requested" ? "Notes Returned" : "Return Confirmed",
        notificationDescription: status === "active_rental" ? "Your notes rental has started." : status === "return_requested" ? "The renter has returned the notes." : "Your return has been confirmed.",
      },
      { onSuccess: () => setRentalStatus(status) },
    );
  };

  const handleNotesCompletionChoice = (listingStatus: "available" | "unavailable") => {
    console.log("[handleNotesCompletionChoice] Called with:", { listingStatus, requestId: conversation.request_id });
    handleNotesRentalAction("completed", listingStatus);
    setNotesCompletionModalOpen(false);
    // Initiate two-party completion on the conversation
    requestCompletion.mutate(conversation.id);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/chats" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">Conversation</span>
        {(isRental || (isNotes && isNotesRental)) && rentalStatus && (
          <Badge className={cn("text-[10px] capitalize", STATUS_STYLES[rentalStatus] || "bg-slate-100 text-slate-700")}>
            {rentalStatus.replace(/_/g, " ")}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1 overflow-x-auto max-w-[70vw] scrollbar-none">
          {isCompleted && isBuyer && (
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
          {(isRental || (isNotes && isNotesRental)) && rentalStatus && (
            <>
              {isSeller && rentalStatus === "accepted" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => isRental ? handleRentalAction("active_rental", "rented_out") : handleNotesRentalAction("active_rental", "rented_out")}
                >
                  Mark as Rented Out
                </Button>
              )}
              {isBuyer && rentalStatus === "active_rental" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => isRental ? handleRentalAction("return_requested") : handleNotesRentalAction("return_requested")}
                >
                  Return {isRental ? "Item" : "Notes"}
                </Button>
              )}
              {isSeller && rentalStatus === "return_requested" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => isRental ? setRentalCompletionModalOpen(true) : setNotesCompletionModalOpen(true)}
                >
                  Confirm Return
                </Button>
              )}
            </>
          )}
          {/* Two-party completion for product, food, and notes purchase chats */}
{conversation.status === "active" && !isRental && !(isNotes && isNotesRental) && (
  <Button
    variant="ghost"
    size="sm"
    className="gap-1 text-xs"
    onClick={() => requestCompletion.mutate(conversation.id)}
    disabled={requestCompletion.isPending}
  >
    {requestCompletion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
    Complete
  </Button>
)}
          {/* Withdraw completion request — only visible to initiator */}
          {isCompletionPending && isCompletionRequester && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-amber-600"
              onClick={() => withdrawCompletion.mutate(conversation.id)}
              disabled={withdrawCompletion.isPending}
            >
              {withdrawCompletion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
              Withdraw
            </Button>
          )}
          {/* Confirm completion — only visible to the other participant */}
          {isCompletionConfirmer && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-emerald-600"
              onClick={() => confirmCompletion.mutate(conversation.id)}
              disabled={confirmCompletion.isPending}
            >
              {confirmCompletion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirm Complete
            </Button>
          )}
          {/* Decline completion — only visible to the other participant */}
          {isCompletionConfirmer && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-red-600"
              onClick={() => declineCompletion.mutate(conversation.id)}
              disabled={declineCompletion.isPending}
            >
              {declineCompletion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Decline
            </Button>
          )}
          {/* Reopen auto-archived chats */}
          {isAutoArchived && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => reopenChat.mutate(conversation.id)}
              disabled={reopenChat.isPending}
            >
              {reopenChat.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reopen Chat
            </Button>
          )}
          {isCompleted && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => archive.mutate(conversation.id)}
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {trust && (
        <ChatTrustHeader
          trust={trust}
          listingTitle={conversation.listing_title}
          isOnline={presence?.is_online ?? false}
        />
      )}

      {/* Completion pending banner */}
      {isCompletionPending && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2.5 text-sm dark:bg-amber-950/30">
          <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          {isCompletionRequester ? (
            <span className="text-amber-800 dark:text-amber-200">
              Waiting for the other participant to confirm completion.
            </span>
          ) : (
            <span className="text-amber-800 dark:text-amber-200">
              <strong>{trust?.display_name ?? "The other participant"}</strong> has requested to mark this transaction as complete. Confirm above to finish.
            </span>
          )}
        </div>
      )}

      {/* Auto-archived info banner */}
      {isAutoArchived && (
        <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2.5 text-sm dark:bg-slate-900/50">
          <Archive className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="text-slate-600 dark:text-slate-400">
            Archived due to inactivity. Click <strong>Reopen Chat</strong> to continue this conversation.
          </span>
        </div>
      )}

      {/* Completed info banner */}
      {isCompleted && (
        <div className="flex items-center gap-2 border-b bg-emerald-50 px-4 py-2.5 text-sm dark:bg-emerald-950/30">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="text-emerald-800 dark:text-emerald-200">
            Transaction completed. Chat is now locked. Deletes in {getDaysUntilDeletion(conversation.completed_at)} days.
          </span>
        </div>
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
      <Dialog open={rentalCompletionModalOpen} onOpenChange={setRentalCompletionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rental Completed Successfully</DialogTitle>
            <DialogDescription>
              The rental has been completed. Would you like to make this item available for rent again?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleRentalCompletionChoice("available")}>
              Make Available Again
            </Button>
            <Button onClick={() => handleRentalCompletionChoice("unavailable")}>
              Keep Unavailable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={notesCompletionModalOpen} onOpenChange={setNotesCompletionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes Rental Completed Successfully</DialogTitle>
            <DialogDescription>
              The notes rental has been completed. Would you like to make these notes available for rent again?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleNotesCompletionChoice("available")}>
              Make Available Again
            </Button>
            <Button onClick={() => handleNotesCompletionChoice("unavailable")}>
              Keep Unavailable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
