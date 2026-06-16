import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Search,
  Plus,
  BookOpen,
  FileText,
  FlaskConical,
  HelpCircle,
  Layers,
  Package,
  Archive,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useRespondToNotesRequest } from "@/lib/notes-respond";
import { createNotification } from "@/lib/notifications";
import ListingActions from "@/components/listing/listing-actions";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HubNavStrip } from "@/components/hub-nav-strip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [{ title: "Notes Hub — CampusBazar" }],
  }),
  component: NotesHubPage,
});

type NotesListingRow = {
  id: string;
  listing_type: "sell" | "rent";
  title: string;
  description: string;
  category: string;
  subject: string | null;
  faculty: string | null;
  semester: string | null;
  branch: string | null;
  daily_rental_price: number | string | null;
  is_digital: boolean;
  is_free: boolean;
  status: string;
  seller_id: string;
  created_at: string;
};

type NotesRequestRow = {
  id: string;
  requester_id: string;
  subject: string;
  request_type: string;
  description: string;
  urgency_level: string;
  semester: string | null;
  branch: string | null;
  status: string;
  created_at: string;
  requester?: { display_name: string; avatar_url: string | null; is_vit_verified: boolean; slug?: string };
};

const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];
const NOTES_REQUESTS_TABLE = "notes_requests" as unknown as keyof Database["public"]["Tables"];
const ACTIVE_NOTES_REQUEST_STATUSES = ["open"] as const;
const HIDDEN_NOTES_REQUEST_STATUSES = new Set([
  "fulfilled",
  "expired",
  "closed",
]);

const CATEGORY_OPTIONS = [
  { key: "Handwritten Notes", icon: FileText, color: "bg-blue-100 text-blue-600" },
  { key: "Previous Year Questions (PYQs)", icon: HelpCircle, color: "bg-purple-100 text-purple-600" },
  { key: "Cheat Sheets", icon: Layers, color: "bg-orange-100 text-orange-600" },
  { key: "Textbooks", icon: BookOpen, color: "bg-green-100 text-green-600" },
  { key: "Lab Material", icon: FlaskConical, color: "bg-sky-100 text-sky-600" },
  { key: "Exam Kits", icon: Package, color: "bg-amber-100 text-amber-600" },
] as const;

function NotesHubPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/notes" });
  const requestId = (search as any)?.requestId as string | undefined;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"sell" | "rent" | "requests">("sell");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [requestTab, setRequestTab] = useState<"open" | "my">("open");

  // Handle requestId param - switch to requests tab and scroll to/highlight the request
  useEffect(() => {
    if (requestId) {
      setTab("requests");
      setRequestTab("open");
      // Scroll to and highlight the request card after a short delay to ensure it's rendered
      setTimeout(() => {
        const element = document.getElementById(`request-${requestId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
          }, 3000);
        }
      }, 500);
    }
  }, [requestId]);

  // Notes Request → Chat integration.
  // When a seller clicks "Respond" on a request, this hook:
  //   1. finds-or-creates a conversation in the existing `conversations`
  //      table (reusing the same chat infrastructure as every other hub).
  //   2. inserts the initial system message and the auto first message.
  //   3. marks the request as "in_progress".
  //   4. invalidates the relevant React Query caches.
  // The mutation's `onSuccess` then navigates to /chats/$id.
  const respond = useRespondToNotesRequest();

  const handleRespond = (r: NotesRequestRow) => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.id === r.requester_id) {
      toast.error("You cannot respond to your own notes request.");
      return;
    }
    respond.mutate(
      {
        requestId: r.id,
        requestCreatorId: r.requester_id,
        requestSubject: r.subject,
        responderId: user.id,
      },
      {
        onSuccess: ({ conversationId }) => {
          if (conversationId) {
            navigate({
              to: "/chats/$id",
              params: { id: conversationId },
              search: { focus: "1" } as never,
            });
          }
        },
      },
    );
  };

  const handleMarkFulfilled = async (r: NotesRequestRow) => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.id !== r.requester_id) {
      toast.error("Only the request owner can mark it as fulfilled.");
      return;
    }

    try {
      const { error } = await supabase
        .from(NOTES_REQUESTS_TABLE)
        .update({ status: "fulfilled" })
        .eq("id", r.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["notes", "requests"] });

      // Send notification to the request owner
      await createNotification({
        userId: user.id,
        title: "Request Fulfilled",
        description: "Your request has been marked as fulfilled and removed from public listings.",
        priority: "informational",
        module: "notes",
        metadata: {
          requestId: r.id,
          subject: r.subject,
        },
      });

      toast.success("Request marked as fulfilled");
    } catch (error) {
      console.error("[Mark Fulfilled] Error:", error);
      toast.error("Failed to mark request as fulfilled");
    }
  };

  const { data: listings, isLoading: loadingListings } = useQuery({
    queryKey: ["notes", "listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(NOTES_LISTINGS_TABLE)
        .select(
          "id,listing_type,title,description,category,subject,faculty,semester,branch,daily_rental_price,is_digital,is_free,status,seller_id,created_at",
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as NotesListingRow[];
      
      // Fetch images for all listings
      const ids = rows.map((r) => r.id);
      const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
      
      const [{ data: images }, { data: sellers }] = await Promise.all([
        ids.length
          ? supabase
              .from("notes_assets")
              .select("listing_id,storage_path,sort_index")
              .eq("kind", "image")
              .in("listing_id", ids)
          : Promise.resolve({ data: [] }),
        sellerIds.length
          ? supabase
              .from("seller_profiles")
              .select("user_id,slug,display_name,avatar_url")
              .in("user_id", sellerIds)
          : Promise.resolve({ data: [] }),
      ]);
      
      return {
        rows,
        images: images ?? [],
        sellers: sellers ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        const row = img as { listing_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.listing_id)) {
          imageMap.set(
            row.listing_id,
            supabase.storage.from("notes-assets").getPublicUrl(row.storage_path).data.publicUrl,
          );
        }
      }
      
      const sellerMap = new Map(
        data.sellers.map((s: any) => [s.user_id, { user_id: s.user_id, slug: s.slug, display_name: s.display_name, avatar_url: s.avatar_url }]),
      );
      
      return data.rows.map((r) => ({
        ...r,
        coverUrl: imageMap.get(r.id) ?? null,
        seller: sellerMap.get(r.seller_id),
      }));
    },
  });

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["notes", "requests"],
    queryFn: async () => {
      const { data, error } = await supabase
  .from("notes_requests")
  .select("*")
  .eq("status", "open")
  .order("created_at", { ascending: false });

console.log(data, error);
      if (error) throw error;
      const rows = (data ?? []) as unknown as NotesRequestRow[];
      
      // Fetch seller profiles for all requesters
      const requesterIds = [...new Set(rows.map((r) => r.requester_id))];
      const { data: sellers } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url")
        .in("user_id", requesterIds);
      
      // Fetch email from profiles to compute VIT verification status
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,email")
        .in("id", requesterIds);

      return {
        rows,
        sellers: sellers ?? [],
        profiles: profiles ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      type SellerProfile = { user_id: string; slug: string; display_name: string; avatar_url: string | null };
      const sellerMap = new Map<string, SellerProfile>(
        data.sellers.map((s: SellerProfile) => [
          s.user_id,
          { slug: s.slug, display_name: s.display_name, avatar_url: s.avatar_url }
        ])
      );

      type ProfileData = { id: string; email: string };
      const profileMap = new Map<string, boolean>(
        data.profiles.map((p: ProfileData) => [p.id, p.email.toLowerCase().endsWith("@vitstudent.ac.in")])
      );

      return data.rows.map((r) => {
        const seller = sellerMap.get(r.requester_id);
        const isVerified = profileMap.get(r.requester_id) ?? r.requester?.is_vit_verified ?? false;
        return {
          ...r,
          requester: {
            display_name: seller?.display_name || r.requester?.display_name || "Unknown",
            avatar_url: seller?.avatar_url ?? r.requester?.avatar_url ?? null,
            is_vit_verified: isVerified,
            slug: seller?.slug,
          }
        };
      });
    },
  });

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = (listings ?? []).filter((l) => l.listing_type === tab);
    
    // Apply category filter
    if (categoryFilter !== "all") {
      base = base.filter((l) => l.category === categoryFilter);
    }
    
    if (!q) return base;
    return base.filter((l) => {
      return (
        l.title.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        (l.subject ?? "").toLowerCase().includes(q) ||
        (l.faculty ?? "").toLowerCase().includes(q)
      );
    });
  }, [listings, query, tab, categoryFilter]);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = (requests ?? []).filter(
      (r) => !HIDDEN_NOTES_REQUEST_STATUSES.has(String(r.status ?? "").toLowerCase()),
    );

    // Filter by tab
    if (requestTab === "open") {
  console.log("Current User:", user?.id);

  base = base.filter((r) => {
    console.log(
      "Request:",
      r.id,
      "Requester:",
      r.requester_id,
      "Match:",
      r.requester_id === user?.id
    );

    return r.requester_id !== user?.id;
  });
} else if (requestTab === "my") {
      base = base.filter((r) => r.requester_id === user?.id);
    }

    if (!q) return base;
    return base.filter((r) => {
      return (
        r.subject.toLowerCase().includes(q) ||
        r.request_type.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [requests, query, requestTab, user?.id]);

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const urgencyBadge = (level: string) => {
    const l = level.toLowerCase();
    if (l.includes("urgent")) return { emoji: "🔴", label: "Urgent", className: "bg-red-50 text-red-700 border-red-200" };
    if (l.includes("high")) return { emoji: "🟠", label: "High", className: "bg-orange-50 text-orange-700 border-orange-200" };
    return { emoji: "🟢", label: "Normal", className: "bg-green-50 text-green-700 border-green-200" };
  };

  const getNeededByChip = (urgency: string) => {
    const l = urgency.toLowerCase();
    if (l.includes("today")) return "Needed Today";
    if (l.includes("tonight")) return "Needed Tonight";
    if (l.includes("tomorrow")) return "Needed Tomorrow";
    if (l.includes("cat")) return "Needed Before CAT";
    if (l.includes("exam")) return "Needed Before Exam";
    return null;
  };

  const timeAgo = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const getNotesBadgeLabel = (
    mode: "sell" | "rent" | "requests",
    listingType?: NotesListingRow["listing_type"],
  ) => {
    if (mode === "requests") return "Requested";
    return listingType === "rent" ? "For Rent" : "For Sale";
  };

  const openDetailsForm = (mode: "sell" | "rent" | "requests") => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (mode === "requests") {
      navigate({ to: "/upload-notes-request" });
      return;
    }
    navigate({ to: "/upload-notes", search: { type: mode } as never });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/" })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link
            to="/"
            aria-label="CampusBazar home"
            className="flex items-center justify-center"
          >
            <CampusBazarLogo compact showText={false} />
          </Link>

          <div className="relative ml-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search subjects, faculty, keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Button
            size="icon"
            className="rounded-full"
            aria-label="Create"
            onClick={() => openDetailsForm(tab)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <HubNavStrip active="notes" className="mb-4" />

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Browse Categories</h2>
          </div>
          <div className="sticky top-0 z-10 flex gap-3 overflow-x-auto pb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "flex shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-xs",
                categoryFilter === "all" ? "border-primary bg-primary/10" : "bg-card",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <BookOpen className="h-5 w-5" />
              </div>
              All
            </button>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat.key ? "all" : cat.key)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-xs",
                  categoryFilter === cat.key ? "border-primary bg-primary/10" : "bg-card",
                )}
              >
                <div
                  className={cn("flex h-10 w-10 items-center justify-center rounded-lg", cat.color)}
                >
                  <cat.icon className="h-5 w-5" />
                </div>
                {cat.key.split(" ")[0]}
              </button>
            ))}
          </div>
        </section>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => openDetailsForm("sell")}>
            Sell details
          </Button>
          <Button variant="outline" onClick={() => openDetailsForm("rent")}>
            Rent details
          </Button>
          <Button variant="outline" onClick={() => openDetailsForm("requests")}>
            Request details
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setVisibleCount(12); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sell">Sell</TabsTrigger>
            <TabsTrigger value="rent">Rent</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="sell" className="mt-4">
            {loadingListings ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredListings.length ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredListings.slice(0, visibleCount).map((l) => (
                    <Card
                      key={l.id}
                      className="overflow-hidden border-border/60 shadow-sm"
                    >
                      <CardContent className="p-0">
                        <div className="relative">
                          <div
                            className="absolute left-2 top-2 z-20"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <ListingActions
                              itemType="notes"
                              itemId={l.id}
                              ownerId={l.seller_id}
                              onEdit={() => {
                                console.log("[ListingActions] onEdit notes", l.id);
                                window.location.assign(`/upload-notes?edit=${l.id}`);
                              }}
                            />
                          </div>
                          <div
                            className="cursor-pointer"
                            onClick={() => navigate({ to: "/notes/$id", params: { id: l.id } })}
                          >
                            {(l as any).coverUrl ? (
                              <img
                                src={(l as any).coverUrl}
                                alt={l.title}
                                className="h-40 w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-40 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                          <div
                            className="absolute right-2 top-2 z-20"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <WishlistButton listingId={l.id} />
                          </div>
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold">{l.title}</div>
                            <Badge className="bg-emerald-500 text-white text-xs">
                              {getNotesBadgeLabel(tab, l.listing_type)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {l.description}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{l.category}</Badge>
                            <Badge variant="outline">
                              {l.daily_rental_price != null
                                ? `${formatInr(Number(l.daily_rental_price))} / day`
                                : "—"}
                            </Badge>
                            {l.is_digital ? (
                              <Badge variant="outline">Digital</Badge>
                            ) : (
                              <Badge variant="outline">Physical</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {visibleCount < filteredListings.length && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" onClick={() => setVisibleCount((c) => c + 12)}>
                      Load More
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No notes listings yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="rent" className="mt-4">
            {loadingListings ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredListings.length ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredListings.slice(0, visibleCount).map((l) => (
                    <Card
                      key={l.id}
                      className="overflow-hidden border-border/60 shadow-sm"
                    >
                      <CardContent className="p-0">
                        <div className="relative">
                          <div
                            className="absolute left-2 top-2 z-20"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <ListingActions
                              itemType="notes"
                              itemId={l.id}
                              ownerId={l.seller_id}
                              onEdit={() => {
                                console.log("[ListingActions] onEdit notes", l.id);
                                window.location.assign(`/upload-notes?edit=${l.id}`);
                              }}
                            />
                          </div>
                          <div
                            className="cursor-pointer"
                            onClick={() => navigate({ to: "/notes/$id", params: { id: l.id } })}
                          >
                            {(l as any).coverUrl ? (
                              <img
                                src={(l as any).coverUrl}
                                alt={l.title}
                                className="h-40 w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-40 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                          <div
                            className="absolute right-2 top-2 z-20"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <WishlistButton listingId={l.id} />
                          </div>
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold">{l.title}</div>
                            <Badge className="bg-sky-500 text-white text-xs">
                              {getNotesBadgeLabel(tab, l.listing_type)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {l.description}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{l.category}</Badge>
                            <Badge variant="outline">
                              {l.daily_rental_price != null
                                ? `${formatInr(Number(l.daily_rental_price))} / day`
                                : "—"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {visibleCount < filteredListings.length && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" onClick={() => setVisibleCount((c) => c + 12)}>
                      Load More
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No rental notes yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <Tabs value={requestTab} onValueChange={(v) => setRequestTab(v as "open" | "my")} className="mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="open">Open Requests</TabsTrigger>
                <TabsTrigger value="my">My Requests</TabsTrigger>
              </TabsList>
            </Tabs>

            {loadingRequests ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredRequests.length ? (
              <div className="space-y-3">
                {filteredRequests.map((r) => {
                  const badge = urgencyBadge(r.urgency_level);
                  const neededBy = getNeededByChip(r.urgency_level);
                  return (
                    <Card key={r.id} id={`request-${r.id}`} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {r.requester?.slug ? (
                              <Link to="/seller/$slug" params={{ slug: r.requester.slug }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                <Avatar className="h-7 w-7">
                                  {r.requester?.avatar_url ? (
                                    <AvatarImage
                                      src={`${r.requester.avatar_url}${(r.requester.avatar_url as string).includes("?") ? "&" : "?"}t=${Date.now()}`}
                                      alt=""
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-[10px]">
                                    {(r.requester?.display_name ?? "U").slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-foreground hover:underline">
                                    {r.requester?.display_name ?? "Unknown"}
                                  </span>
                                  {r.requester?.is_vit_verified && (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  )}
                                </div>
                              </Link>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  {r.requester?.avatar_url ? (
                                    <AvatarImage
                                      src={`${r.requester.avatar_url}${(r.requester.avatar_url as string).includes("?") ? "&" : "?"}t=${Date.now()}`}
                                      alt=""
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-[10px]">
                                    {(r.requester?.display_name ?? "U").slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-foreground">
                                    {r.requester?.display_name ?? "Unknown"}
                                  </span>
                                  {r.requester?.is_vit_verified && (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                        </div>

                        {/* Body */}
                        <div className="mb-2">
                          <h3 className="text-sm font-semibold text-foreground mb-1">{r.subject}</h3>
                          {neededBy && (
                            <Badge variant="outline" className="text-[10px] mb-1">
                              {neededBy}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground mb-1">
                            {r.request_type} · {r.branch ?? "Any Branch"} · {r.semester ?? "Any Semester"}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                          {requestTab === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-3"
                              onClick={() => handleRespond(r)}
                              disabled={respond.isPending || (!!user && user.id === r.requester_id)}
                            >
                              {respond.isPending ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  Opening…
                                </>
                              ) : (
                                "I Have This"
                              )}
                            </Button>
                          )}
                          {requestTab === "my" && (
                            <div className="flex items-center gap-2">
                              <Badge variant={r.status === "open" ? "default" : "secondary"} className="text-[10px]">
                                {r.status === "open" ? "Open" : r.status}
                              </Badge>
                              {r.status === "open" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs px-2"
                                  onClick={() => handleMarkFulfilled(r)}
                                >
                                  Mark Fulfilled
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {requestTab === "open" ? "No Notes Requests Yet" : "No requests yet"}
                </p>
                {requestTab === "open" && (
                  <>
                    <p className="text-xs text-muted-foreground mb-4">Need notes before CAT? Create a request.</p>
                    <Button onClick={() => openDetailsForm("requests")}>Create Request</Button>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
