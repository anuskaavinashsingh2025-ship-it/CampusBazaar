import { createFileRoute } from "@tanstack/react-router";

import { useMemo } from "react";

import { Loader2, MessageSquare, Inbox, Clock, Archive, AlertTriangle, Sparkles, MessageCircle, CheckCircle2 } from "lucide-react";

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

import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [{ title: "My Chats — CampusBazar" }],
  }),

  component: ChatsPage,
});

const SECTIONS: { key: ChatSection; label: string; description: string; icon: React.ReactNode }[] = [
  { key: "new", label: "New", description: "Accepted deals waiting for the first message", icon: <Sparkles className="h-4 w-4" /> },

  { key: "ongoing", label: "Ongoing", description: "Active conversations in progress", icon: <MessageCircle className="h-4 w-4" /> },

  {
    key: "completed",
    label: "Completed",
    description: "Finished transactions",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },

  { key: "reported", label: "Reported", description: "Chats where a report has been filed", icon: <AlertTriangle className="h-4 w-4" /> },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ section }: { section: ChatSection }) {
  const sectionConfig = SECTIONS.find((s) => s.key === section);
  
  const messages: Record<ChatSection, string> = {
    new: "No new conversations yet",
    ongoing: "No ongoing conversations yet",
    completed: "No completed conversations yet",
    reported: "No reported conversations yet",
  };

  const subMessages: Record<ChatSection, string> = {
    new: "Accepted deals will appear here waiting for the first message.",
    ongoing: "Active conversations will appear here once messaging starts.",
    completed: "Completed transactions will appear here when finished.",
    reported: "Reported conversations will appear here if you file a report.",
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          {sectionConfig?.icon}
        </div>
        <h3 className="mb-2 text-lg font-semibold">{messages[section]}</h3>
        <p className="text-sm text-muted-foreground">
          {subMessages[section]}
        </p>
      </CardContent>
    </Card>
  );
}

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
          Accept a deal to unlock chat with the buyer. New chats appear under New until
          the first message is sent.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !conversations.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No chats yet</h3>
            <p className="text-sm text-muted-foreground">
              Accept a buyer&apos;s request from the Requests page to open a
              conversation here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab} key={defaultTab}>
          <TabsList className="grid w-full grid-cols-4 gap-1 bg-muted/50 p-1">
            {SECTIONS.map((s) => {
              const count = filterConversationsBySection(conversations, s.key).length;

              return (
                <TabsTrigger
                  key={s.key}
                  value={s.key}
                  className="flex flex-col gap-1 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    {s.icon}
                    {s.label}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {count}
                    </span>
                  )}
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
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-muted p-2">
                        {s.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{s.label}</CardTitle>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {items.length ? (
                      items.map((c) => <ConversationListItemRow key={c.id} conversation={c} />)
                    ) : (
                      <EmptyState section={s.key} />
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
