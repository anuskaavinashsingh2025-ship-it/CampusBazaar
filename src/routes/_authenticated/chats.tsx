import { createFileRoute } from "@tanstack/react-router";

import { useMemo } from "react";

import { Loader2, MessageSquare } from "lucide-react";

import { useAuth } from "@/lib/auth";

import {
  filterConversationsBySection,
  getDefaultChatSection,
  useConversationRealtime,
  useConversations,
  useUpdatePresence,
  type ChatSection,
} from "@/lib/chat";

import { ConversationListItemRow } from "@/components/chat/conversation-list-item";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [{ title: "My Chats — CampusBazar" }],
  }),

  component: ChatsPage,
});

const SECTIONS: { key: ChatSection; label: string; description: string }[] = [
  { key: "active", label: "Active Chats", description: "Ongoing conversations" },

  { key: "rental", label: "Rental Chats", description: "Conversations related to rental listings" },

  {
    key: "request",
    label: "Request Chats",
    description: "Conversations originating from accepted requests",
  },

  {
    key: "archived",
    label: "Archived Chats",
    description: "Completed and auto-archived conversations — these are deleted 30 days after archiving",
  },

  { key: "reported", label: "Reported Chats", description: "Chats where a report has been filed" },
];

function ChatsPage() {
  const { user } = useAuth();

  const { data: conversations = [], isLoading } = useConversations(user?.id);

  useConversationRealtime(user?.id);

  useUpdatePresence(user?.id);

  const defaultTab = useMemo(() => getDefaultChatSection(conversations), [conversations]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          My Chats
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Accept a deal to unlock chat with the buyer. New chats appear under Request Chats until
          the first message is sent.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !conversations.length ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No chats yet. Accept a buyer&apos;s request from the Requests page to open a
            conversation here.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab} key={defaultTab}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {SECTIONS.map((s) => {
              const count = filterConversationsBySection(conversations, s.key).length;

              return (
                <TabsTrigger key={s.key} value={s.key} className="text-xs">
                  {s.label}

                  {count > 0 && ` (${count})`}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {SECTIONS.map((s) => {
            const items = filterConversationsBySection(conversations, s.key);

            return (
              <TabsContent key={s.key} value={s.key} className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{s.label}</CardTitle>

                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    {items.length ? (
                      items.map((c) => <ConversationListItemRow key={c.id} conversation={c} />)
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No {s.label.toLowerCase()} yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
