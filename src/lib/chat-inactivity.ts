import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications";

const CONVERSATIONS_TABLE = "conversations" as never;
const MESSAGES_TABLE = "messages" as never;

// Auto-archive conversations after 7 days of inactivity
export async function autoArchiveInactiveChats() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: inactiveConversations, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("id, buyer_id, seller_id, listing_title")
    .in("status", ["active", "completion_pending"])
    .lt("last_message_at", sevenDaysAgo.toISOString())
    .not("last_message_at", "is", null);

  if (error) {
    console.error("[ChatInactivity] Error fetching inactive conversations:", error);
    return;
  }

  if (!inactiveConversations || inactiveConversations.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  for (const conversation of inactiveConversations) {
    // Archive the conversation
    const { error: updateError } = await supabase
      .from(CONVERSATIONS_TABLE)
      .update({
        status: "auto_archived",
        archived_at: now,
        archive_reason: "7 days of inactivity",
      })
      .eq("id", conversation.id);

    if (updateError) {
      console.error(`[ChatInactivity] Error archiving conversation ${conversation.id}:`, updateError);
      continue;
    }

    // Add system message
    await supabase.from(MESSAGES_TABLE).insert({
      conversation_id: conversation.id,
      sender_id: conversation.buyer_id, // System message uses buyer_id as sender
      content: "This conversation was automatically archived after 7 days of inactivity.",
      message_type: "text",
      delivery_status: "delivered",
      read_at: now,
    });

    // Send notifications to both participants
    await createNotification({
      userId: conversation.buyer_id,
      module: "chats",
      priority: "informational",
      title: "Conversation Archived",
      description: `Your conversation about "${conversation.listing_title}" has been archived due to 7 days of inactivity.`,
      metadata: { conversation_id: conversation.id },
    });

    await createNotification({
      userId: conversation.seller_id,
      module: "chats",
      priority: "informational",
      title: "Conversation Archived",
      description: `Your conversation about "${conversation.listing_title}" has been archived due to 7 days of inactivity.`,
      metadata: { conversation_id: conversation.id },
    });
  }

  console.log(`[ChatInactivity] Auto-archived ${inactiveConversations.length} conversations`);
}

// Permanently delete completed conversations after 5 days
export async function autoDeleteCompletedChats() {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const { data: completedConversations, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select("id, buyer_id, seller_id, listing_title")
    .eq("status", "completed")
    .lt("completed_at", fiveDaysAgo.toISOString())
    .not("completed_at", "is", null);

  if (error) {
    console.error("[ChatInactivity] Error fetching completed conversations:", error);
    return;
  }

  if (!completedConversations || completedConversations.length === 0) {
    return;
  }

  for (const conversation of completedConversations) {
    // Delete all messages for this conversation
    const { error: messagesError } = await supabase
      .from(MESSAGES_TABLE)
      .delete()
      .eq("conversation_id", conversation.id);

    if (messagesError) {
      console.error(`[ChatInactivity] Error deleting messages for conversation ${conversation.id}:`, messagesError);
      continue;
    }

    // Delete the conversation
    const { error: conversationError } = await supabase
      .from(CONVERSATIONS_TABLE)
      .delete()
      .eq("id", conversation.id);

    if (conversationError) {
      console.error(`[ChatInactivity] Error deleting conversation ${conversation.id}:`, conversationError);
      continue;
    }

    console.log(`[ChatInactivity] Deleted completed conversation ${conversation.id} about "${conversation.listing_title}"`);
  }

  console.log(`[ChatInactivity] Auto-deleted ${completedConversations.length} completed conversations`);
}

// Get days until deletion for completed conversations (5 days)
export function getDaysUntilDeletion(completedAt: string | null): number | null {
  if (!completedAt) return null;
  const completedDate = new Date(completedAt);
  const deletionDate = new Date(completedDate);
  deletionDate.setDate(deletionDate.getDate() + 5);
  const now = new Date();
  const diffTime = deletionDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}
