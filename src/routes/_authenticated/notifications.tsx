import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bell,
  Filter,
  Loader2,
  MessageSquare,
  Package,
  Search,
  Settings,
  Shield,
  Target,
  UtensilsCrossed,
  FileText,
  Bike,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  MODULE_LABELS,
  PRIORITY_STYLES,
  timeAgo,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationModule,
  type NotificationRow,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — CampusBazar" }],
  }),
  component: NotificationsPage,
});

const TABS: Array<{ key: string; label: string; filter?: (n: NotificationRow) => boolean }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread", filter: (n) => !n.read },
  { key: "marketplace", label: "Marketplace", filter: (n) => n.module === "marketplace" },
  { key: "rentals", label: "Rentals", filter: (n) => n.module === "rentals" },
  { key: "notes", label: "Notes", filter: (n) => n.module === "notes" },
  { key: "food", label: "Food", filter: (n) => n.module === "food" },
  { key: "chats", label: "Chats", filter: (n) => n.module === "chats" },
  { key: "requests", label: "Requests", filter: (n) => n.module === "requests" },
  { key: "system", label: "System", filter: (n) => n.module === "system" },
];

const MODULE_ICONS: Record<NotificationModule, typeof Bell> = {
  marketplace: Package,
  rentals: Bike,
  notes: FileText,
  food: UtensilsCrossed,
  chats: MessageSquare,
  requests: Shield,
  system: Target,
};

function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useNotifications(user?.id);
  const markRead = useMarkNotificationRead(user?.id);
  const markAllRead = useMarkAllNotificationsRead(user?.id);

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState<NotificationModule | "all">("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");

  const priorityCounts = useMemo(() => {
    const unread = notifications.filter((n) => !n.read);
    return {
      critical: unread.filter((n) => n.priority === "critical").length,
      important: unread.filter((n) => n.priority === "important").length,
      informational: unread.filter((n) => n.priority === "informational").length,
    };
  }, [notifications]);

  const filtered = useMemo(() => {
    let items = [...notifications];
    const tab = TABS.find((t) => t.key === activeTab);
    if (tab?.filter) items = items.filter(tab.filter);
    if (filterModule !== "all") items = items.filter((n) => n.module === filterModule);
    if (filterPriority !== "all") items = items.filter((n) => n.priority === filterPriority);
    if (filterRead === "unread") items = items.filter((n) => !n.read);
    if (filterRead === "read") items = items.filter((n) => n.read);
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          MODULE_LABELS[n.module].toLowerCase().includes(q),
      );
    }
    return items;
  }, [notifications, activeTab, search, filterModule, filterPriority, filterRead]);

  const handleOpen = (n: NotificationRow) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.action_url) {
      void navigate({ to: n.action_url as "/rental-requests" });
    }
  };

  const openAction = (n: NotificationRow, url: string) => {
    if (!n.read) markRead.mutate(n.id);
    void navigate({ to: url as "/rental-requests" });
  };

  const applyFilters = () => {
    /* sheet closes automatically */
  };

  const resetFilters = () => {
    setFilterModule("all");
    setFilterPriority("all");
    setFilterRead("all");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stay updated on marketplace activity, rentals, and more.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/notification-settings">
              <Settings className="mr-1 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!notifications.some((n) => !n.read)}
            onClick={() => markAllRead.mutate()}
          >
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { key: "critical", icon: Shield, color: "border-red-200 bg-red-50" },
            { key: "important", icon: Bell, color: "border-orange-200 bg-orange-50" },
            { key: "informational", icon: Target, color: "border-blue-200 bg-blue-50" },
          ] as const
        ).map(({ key, icon: Icon, color }) => (
          <Card key={key} className={cn("border", color)}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{priorityCounts[key]}</div>
                <div className="text-xs capitalize text-muted-foreground">{key}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Filter">
              <Filter className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Notifications</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div>
                <Label className="mb-3 block text-sm font-semibold">Category</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      "marketplace",
                      "rentals",
                      "notes",
                      "food",
                      "chats",
                      "requests",
                      "system",
                    ] as const
                  ).map((mod) => {
                    const Icon = MODULE_ICONS[mod];
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setFilterModule(filterModule === mod ? "all" : mod)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs",
                          filterModule === mod ? "border-primary bg-primary/10" : "",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {MODULE_LABELS[mod]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="mb-3 block text-sm font-semibold">Priority</Label>
                <RadioGroup value={filterPriority} onValueChange={setFilterPriority}>
                  {["all", "critical", "important", "informational"].map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <RadioGroupItem value={p} id={`priority-${p}`} />
                      <Label htmlFor={`priority-${p}`} className="capitalize">
                        {p === "all" ? "All priorities" : p}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-3 block text-sm font-semibold">Read status</Label>
                <RadioGroup value={filterRead} onValueChange={setFilterRead}>
                  {[
                    { value: "all", label: "All notifications" },
                    { value: "unread", label: "Unread only" },
                    { value: "read", label: "Read only" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`read-${opt.value}`} />
                      <Label htmlFor={`read-${opt.value}`}>{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={applyFilters}>Apply Filters</Button>
                <Button variant="outline" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((n) => {
            const Icon = MODULE_ICONS[n.module];
            const style = PRIORITY_STYLES[n.priority];
            const actions = Array.isArray(n.metadata?.actions)
              ? (n.metadata.actions as Array<{ label?: unknown; url?: unknown }>).filter(
                  (action): action is { label: string; url: string } =>
                    typeof action.label === "string" && typeof action.url === "string",
                )
              : [];
            return (
              <Card
                key={n.id}
                className={cn(
                  "cursor-pointer border-border/60 transition-shadow hover:shadow-md",
                  !n.read && "border-l-4 border-l-primary bg-primary/5",
                )}
                onClick={() => handleOpen(n)}
              >
                <CardContent className="flex gap-3 p-4">
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {!n.read && (
                      <span
                        className={cn(
                          "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full",
                          style.dot,
                        )}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{n.title}</span>
                      <Badge variant="secondary" className={cn("text-[10px]", style.badge)}>
                        {style.label}
                      </Badge>
                      {!n.read && (
                        <Badge variant="outline" className="text-[10px]">
                          Unread
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {n.description}
                    </p>
                    {actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {actions.map((action) => (
                          <Button
                            key={`${n.id}-${action.label}`}
                            type="button"
                            variant={action.label === "Open Chat" ? "default" : "outline"}
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAction(n, action.url);
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {timeAgo(n.created_at)} · {MODULE_LABELS[n.module]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No notifications match your filters.
        </div>
      )}
    </div>
  );
}
