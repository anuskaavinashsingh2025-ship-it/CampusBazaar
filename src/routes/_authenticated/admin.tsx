import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Star,
  Search,
  Trash2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User as UserIcon,
  ShieldAlert,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  useAllFeedback,
  useUpdateFeedbackStatus,
  useDeleteFeedback,
  FEEDBACK_CATEGORIES,
  type FeedbackStatus,
} from "@/lib/feedback";
import { ImagePreviewModal } from "@/components/admin/image-preview-modal";
import { BanModal } from "@/components/admin/ban-modal";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin Portal — CampusBazar" }],
  }),
  component: AdminPortalPage,
});

type ReportTargetType = "product" | "seller" | "rental" | "food" | "notes";

type ReportRow = {
  id: string;
  target_type: ReportTargetType;
  product_id: string | null;
  rental_id: string | null;
  food_listing_id: string | null;
  notes_listing_id: string | null;
  seller_user_id: string | null;
  reason: string;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
  reporter_id: string;
  evidence_urls: string[] | null;
  evidence_count: number | null;
  resolved_by: string | null;
  resolved_at: string | null;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string | null;
  role: string | null;
  created_at: string | null;
  banned_at: string | null;
  banned_until: string | null;
  ban_reason: string | null;
};

function AdminPortalPage() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { isAdmin, user, loading } = useAuth();
  
  // Check if we're on the base /admin route (not a child route like /admin/reports)
  const isDashboardView = routerState.location.pathname === "/admin";
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [signedScreenshotUrls, setSignedScreenshotUrls] = useState<Record<string, string>>({});
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banTargetUserId, setBanTargetUserId] = useState<string | null>(null);
  const [banTargetUserName, setBanTargetUserName] = useState<string | null>(null);
  const [banCurrentReport, setBanCurrentReport] = useState<ReportRow | null>(null);

  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

  const [reporterModal, setReporterModal] = useState<{
    open: boolean;
    profile: ProfileLite | null;
    reportsSubmitted: number;
  }>({ open: false, profile: null, reportsSubmitted: 0 });

  const [sellerModal, setSellerModal] = useState<{
    open: boolean;
    profile: ProfileLite | null;
    totalListings: number;
    totalReportsReceived: number;
  }>({ open: false, profile: null, totalListings: 0, totalReportsReceived: 0 });

  const { data: allFeedback } = useAllFeedback();
  const updateFeedbackStatus = useUpdateFeedbackStatus();
  const deleteFeedback = useDeleteFeedback();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    const generateSignedUrls = async () => {
      if (!allFeedback) return;
      const urls: Record<string, string> = {};
      for (const feedback of allFeedback) {
        if (feedback.screenshot_url) {
          try {
            const urlParts = feedback.screenshot_url.split("/feedback-screenshots/");
            if (urlParts.length === 2) {
              const path = urlParts[1];
              const { data, error } = await supabase.storage
                .from("feedback-screenshots")
                .createSignedUrl(path, 3600);
              if (data?.signedUrl) urls[feedback.id] = data.signedUrl;
              if (error) console.error("[ADMIN] signed url error:", error);
            }
          } catch (err) {
            console.error("[ADMIN] signed url exception:", err);
          }
        }
      }
      setSignedScreenshotUrls(urls);
    };
    generateSignedUrls();
  }, [allFeedback]);

  const { data: analytics } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: totalProducts },
        { count: pendingReports },
        { count: bannedUsers },
        { count: suspicious },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("product_listings" as never).select("*", { count: "exact", head: true }),
        supabase
          .from("reports" as never)
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("status", "banned"),
        supabase
          .from("suspicious_flags" as never)
          .select("*", { count: "exact", head: true })
          .eq("resolved", false),
      ]);
      return {
        totalUsers: totalUsers ?? 0,
        totalProducts: totalProducts ?? 0,
        pendingReports: pendingReports ?? 0,
        bannedUsers: bannedUsers ?? 0,
        suspicious: suspicious ?? 0,
      };
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: reportsRaw } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports" as never)
        .select(
          "id,target_type,product_id,rental_id,food_listing_id,notes_listing_id,seller_user_id,reason,details,status,created_at,reporter_id,evidence_urls,evidence_count,resolved_by,resolved_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ReportRow[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const reporterIds = useMemo(
    () => Array.from(new Set((reportsRaw ?? []).map((r) => r.reporter_id).filter(Boolean))),
    [reportsRaw],
  );
  const sellerIds = useMemo(
    () =>
      Array.from(
        new Set(
          (reportsRaw ?? []).map((r) => r.seller_user_id).filter(Boolean) as string[],
        ),
      ),
    [reportsRaw],
  );

  const { data: reporterProfiles } = useQuery({
    queryKey: ["admin", "reporters", reporterIds.join(",")],
    queryFn: async () => {
      if (!reporterIds.length) return {} as Record<string, ProfileLite>;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url,status,created_at,banned_at,banned_until,ban_reason")
        .in("id", reporterIds);
      if (error) {
        console.error("[ADMIN] fetch reporters failed:", error);
        return {} as Record<string, ProfileLite>;
      }
      const map: Record<string, ProfileLite> = {};
      for (const p of (data ?? []) as ProfileLite[]) map[p.id] = p;
      return map;
    },
    enabled: Boolean(reporterIds.length),
    refetchInterval: 15000,
  });

  const { data: sellerProfiles } = useQuery({
    queryKey: ["admin", "sellers", sellerIds.join(",")],
    queryFn: async () => {
      if (!sellerIds.length) return {} as Record<string, ProfileLite>;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url,status,created_at,banned_at,banned_until,ban_reason")
        .in("id", sellerIds);
      if (error) {
        console.error("[ADMIN] fetch sellers failed:", error);
        return {} as Record<string, ProfileLite>;
      }
      const map: Record<string, ProfileLite> = {};
      for (const p of (data ?? []) as ProfileLite[]) map[p.id] = p;
      return map;
    },
    enabled: Boolean(sellerIds.length),
    refetchInterval: 15000,
  });

  // Fetch the public seller_profiles (slug) for each seller id so the
  // "Open Seller Profile" button can build the correct /seller/$slug URL.
  const { data: sellerSlugs } = useQuery({
    queryKey: ["admin", "seller-slugs", sellerIds.join(",")],
    queryFn: async () => {
      if (!sellerIds.length) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("seller_profiles" as never)
        .select("user_id,slug")
        .in("user_id", sellerIds);
      if (error) {
        console.error("[ADMIN] fetch seller slugs failed:", error);
        return {} as Record<string, string>;
      }
      const map: Record<string, string> = {};
      for (const sp of (data ?? []) as Array<{ user_id: string; slug: string }>) {
        map[sp.user_id] = sp.slug;
      }
      return map;
    },
    enabled: Boolean(sellerIds.length),
    refetchInterval: 30000,
  });

  const { data: reporterRoles } = useQuery({
    queryKey: ["admin", "reporter-roles", reporterIds.join(",")],
    queryFn: async () => {
      if (!reporterIds.length) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", reporterIds);
      if (error) return {} as Record<string, string>;
      const map: Record<string, string> = {};
      for (const r of (data ?? []) as Array<{ user_id: string; role: string }>) {
        map[r.user_id] = r.role;
      }
      return map;
    },
    enabled: Boolean(reporterIds.length),
    refetchInterval: 30000,
  });

  const pending = useMemo(
    () => (reportsRaw ?? []).filter((r) => r.status === "pending"),
    [reportsRaw],
  );

  const latestReports = useMemo(
    () =>
      [...pending]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [pending],
  );

  const latestFeedbackPreview = useMemo(
    () =>
      [...(allFeedback ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [allFeedback],
  );

  const handleOpenAllReports = () => {
    navigate({ to: "/admin/reports" });
  };

  const handleOpenAllFeedback = () => {
    navigate({ to: "/admin/feedback" });
  };

  const handleStatusUpdate = (feedbackId: string, status: FeedbackStatus) => {
    updateFeedbackStatus.mutate({
      feedbackId,
      status,
      adminNotes: adminNotes || undefined,
    });
    setAdminNotes("");
    setSelectedFeedbackId(null);
  };

  const handleDeleteFeedback = (feedbackId: string) => {
    if (confirm("Are you sure you want to delete this feedback?")) {
      deleteFeedback.mutate(feedbackId);
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case "submitted":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Submitted
          </Badge>
        );
      case "under_review":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Under Review
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const updateReportStatus = async (id: string, status: "resolved" | "dismissed") => {
    const { error } = await supabase
      .from("reports" as never)
      .update({
        status,
        resolved_by: user?.id ?? null,
        resolved_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success(`Report ${status}`);
  };

  const removeProduct = async (productId: string) => {
    const { error } = await supabase
      .from("product_listings" as never)
      .delete()
      .eq("id", productId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("admin_actions" as never).insert({
      admin_user_id: user?.id,
      action_type: "remove_product",
      product_id: productId,
      notes: "Removed via admin portal",
    } as never);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success("Product removed");
  };

  const setUserStatus = async (
    targetUserId: string,
    status: "suspended" | "banned",
    actionType: "suspend_user" | "ban_user",
  ) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", targetUserId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("admin_actions" as never).insert({
      admin_user_id: user?.id,
      action_type: actionType,
      target_user_id: targetUserId,
      notes: `Set status to ${status}`,
    } as never);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success(`User ${status}`);
  };

  const toggleExpanded = (id: string) => {
    setExpandedReports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleViewReporter = async (reporterId: string) => {
    let profile = reporterProfiles?.[reporterId] ?? null;
    if (!profile) {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url,status,created_at,banned_at,banned_until,ban_reason")
        .eq("id", reporterId)
        .maybeSingle();
      profile = (data as ProfileLite | null) ?? null;
    }
    const { count } = await supabase
      .from("reports" as never)
      .select("*", { count: "exact", head: true })
      .eq("reporter_id", reporterId);
    setReporterModal({
      open: true,
      profile: profile ? { ...profile, role: reporterRoles?.[reporterId] ?? "user" } : null,
      reportsSubmitted: count ?? 0,
    });
  };

  const handleViewSeller = async (sellerId: string) => {
    let profile = sellerProfiles?.[sellerId] ?? null;
    if (!profile) {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url,status,created_at,banned_at,banned_until,ban_reason")
        .eq("id", sellerId)
        .maybeSingle();
      profile = (data as ProfileLite | null) ?? null;
    }
    const { count: reportsReceived } = await supabase
      .from("reports" as never)
      .select("*", { count: "exact", head: true })
      .eq("seller_user_id", sellerId);

    const [pRes, rRes, fRes, nRes] = await Promise.all([
      supabase
        .from("product_listings" as never)
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId),
      supabase
        .from("rental_listings" as never)
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId),
      supabase
        .from("food_listings" as never)
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId),
      supabase
        .from("notes_listings" as never)
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId),
    ]);
    const totalListings =
      (pRes.count ?? 0) + (rRes.count ?? 0) + (fRes.count ?? 0) + (nRes.count ?? 0);

    setSellerModal({
      open: true,
      profile,
      totalListings,
      totalReportsReceived: reportsReceived ?? 0,
    });
  };

  /**
   * Returns the target "open" descriptor for a report.  For seller
   * reports the route is /seller/$slug (not /seller/$id) so we look up
   * the slug from the cached `sellerSlugs` map (one query for all
   * reported sellers).
   */
  const targetFor = (
    r: ReportRow,
  ): { url: string; asSellerLink?: { to: string; params: { slug: string } } } | null => {
    switch (r.target_type) {
      case "product":
        return r.product_id ? { url: `/product/${r.product_id}` } : null;
      case "rental":
        return r.rental_id ? { url: `/rent/${r.rental_id}` } : null;
      case "food":
        return r.food_listing_id ? { url: `/food/${r.food_listing_id}` } : null;
      case "notes":
        return r.notes_listing_id ? { url: `/notes/${r.notes_listing_id}` } : null;
      case "seller": {
        if (!r.seller_user_id) return null;
        const slug = sellerSlugs?.[r.seller_user_id];
        if (!slug) return null;
        return {
          url: `/seller/${slug}`,
          asSellerLink: { to: "/seller/$slug", params: { slug } },
        };
      }
      default:
        return null;
    }
  };

  /**
   * Programmatic fallback for the "Open Seller Profile" button. Uses
   * the same `navigate({ to, params })` shape the marketplace uses
   * (see product-card.tsx, seller-quick-view.tsx) and toasts the
   * exact reason on failure.
   */
  const handleOpenSeller = (r: ReportRow) => {
    if (!r.seller_user_id) {
      toast.error("Cannot open seller profile: no seller_user_id on this report.");
      return;
    }
    const slug = sellerSlugs?.[r.seller_user_id];
    console.log("[ADMIN] Open seller profile", {
      seller_user_id: r.seller_user_id,
      slug: slug ?? "(missing)",
      target: slug ? `/seller/${slug}` : "(no slug)",
    });
    if (!slug) {
      toast.error(
        "Cannot open seller profile: this seller has no public slug yet.",
      );
      return;
    }
    try {
      navigate({
        to: "/seller/$slug",
        params: { slug },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ADMIN] navigate to /seller/$slug failed", err);
      toast.error(`Could not open seller profile: ${msg}`);
    }
  };

  const targetLabelFor = (r: ReportRow): string => {
    switch (r.target_type) {
      case "product": return "Open product page";
      case "rental": return "Open rental page";
      case "food": return "Open food page";
      case "notes": return "Open notes page";
      case "seller": return "Open seller profile";
      default: return "Open item";
    }
  };

  const reporterName = (r: ReportRow): string => {
    const p = reporterProfiles?.[r.reporter_id];
    return p?.full_name || (p?.email ? p.email.split("@")[0] : "Unknown reporter");
  };
  const reporterEmail = (r: ReportRow): string | null =>
    reporterProfiles?.[r.reporter_id]?.email ?? null;
  const sellerName = (r: ReportRow): string | null => {
    if (!r.seller_user_id) return null;
    const p = sellerProfiles?.[r.seller_user_id];
    return p?.full_name || (p?.email ? p.email.split("@")[0] : null);
  };
  const sellerEmail = (r: ReportRow): string | null =>
    r.seller_user_id ? (sellerProfiles?.[r.seller_user_id]?.email ?? null) : null;

  if (loading || !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center text-sm text-muted-foreground">
        {loading ? "Loading…" : "Redirecting…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      {isDashboardView ? (
        <div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
            <p className="mt-1 text-sm text-muted-foreground">Trust, safety and moderation controls.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total users" value={analytics?.totalUsers ?? 0} />
            <StatCard label="Total products" value={analytics?.totalProducts ?? 0} />
            <StatCard label="Pending reports" value={analytics?.pendingReports ?? 0} />
            <StatCard label="Banned users" value={analytics?.bannedUsers ?? 0} />
            <StatCard label="Suspicious flags" value={analytics?.suspicious ?? 0} />
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Report Queue</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showing the latest {latestReports.length} of {pending.length} pending reports.
                </p>
              </div>
              <Button variant="outline" onClick={handleOpenAllReports}>
                View All Reports
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestReports.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No pending reports.
                </div>
              ) : (
                latestReports.map((r) => {
                  const isExpanded = expandedReports.has(r.id);
                  const target = targetFor(r);
                  const targetUrl = target?.url ?? null;
                  const reporterHasProfile = Boolean(reporterProfiles?.[r.reporter_id]);
                  const sellerHasProfile = Boolean(
                    r.seller_user_id && sellerProfiles?.[r.seller_user_id],
                  );
                  return (
                    <div key={r.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{r.target_type}</Badge>
                        <Badge variant="outline">{r.reason}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpanded(r.id)}
                          className="ml-auto gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" /> Hide details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" /> Show details
                            </>
                          )}
                        </Button>
                      </div>

                      {r.details && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Description: </span>
                          {r.details}
                        </div>
                      )}

                      {r.evidence_urls && r.evidence_urls.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-2 text-xs font-medium text-muted-foreground">
                            Evidence ({r.evidence_count ?? r.evidence_urls.length} images)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {r.evidence_urls.map((url, index) => (
                              <img
                                key={`${r.id}-${index}`}
                                src={url}
                                alt={`Evidence ${index + 1}`}
                                className="h-16 w-16 cursor-pointer rounded-md object-cover hover:opacity-80"
                                onClick={() => {
                                  setPreviewImages(r.evidence_urls!);
                                  setPreviewIndex(index);
                                  setPreviewOpen(true);
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-md border bg-background p-3">
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Reporter
                              </div>
                              <div className="font-medium">{reporterName(r)}</div>
                              {reporterEmail(r) && (
                                <div className="text-xs text-muted-foreground">{reporterEmail(r)}</div>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 gap-1"
                                onClick={() => void handleViewReporter(r.reporter_id)}
                              >
                                <UserIcon className="h-3.5 w-3.5" /> View reporter
                              </Button>
                              {!reporterHasProfile && (
                                <div className="mt-2 text-[10px] text-muted-foreground">
                                  (profile not yet loaded)
                                </div>
                              )}
                            </div>
                            {r.seller_user_id ? (
                              <div className="rounded-md border bg-background p-3">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Seller
                                </div>
                                <div className="font-medium">{sellerName(r) ?? "Unknown seller"}</div>
                                {sellerEmail(r) && (
                                  <div className="text-xs text-muted-foreground">{sellerEmail(r)}</div>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 gap-1"
                                  onClick={() => void handleViewSeller(r.seller_user_id!)}
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" /> View seller
                                </Button>
                                {!sellerHasProfile && (
                                  <div className="mt-2 text-[10px] text-muted-foreground">
                                    (profile not yet loaded)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                                No seller associated with this report.
                              </div>
                            )}
                          </div>

                          <div className="rounded-md border bg-background p-3">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Report metadata
                            </div>
                            <div className="grid gap-2 text-xs sm:grid-cols-2">
                              <div><span className="text-muted-foreground">Type:</span> {r.target_type}</div>
                              <div><span className="text-muted-foreground">Reason:</span> {r.reason}</div>
                              <div><span className="text-muted-foreground">Status:</span> {r.status}</div>
                              <div>
                                <span className="text-muted-foreground">Submitted:</span>{" "}
                                {new Date(r.created_at).toLocaleString()}
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-muted-foreground">Full description:</span>{" "}
                                <span className="whitespace-pre-wrap">{r.details || "(none)"}</span>
                              </div>
                            </div>
                          </div>

                          {targetUrl && (
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm" variant="secondary" className="gap-1">
                                <Link to={targetUrl as never}>
                                  <ExternalLink className="h-3.5 w-3.5" /> {targetLabelFor(r)}
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => updateReportStatus(r.id, "resolved")}>
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateReportStatus(r.id, "dismissed")}
                        >
                          Dismiss
                        </Button>
                        {targetUrl && !isExpanded && (
                          <Button asChild size="sm" variant="ghost" className="gap-1">
                            <Link to={targetUrl as never}>
                              <ExternalLink className="h-3.5 w-3.5" /> {targetLabelFor(r)}
                            </Link>
                          </Button>
                        )}

                        {r.target_type === "product" && r.product_id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeProduct(r.product_id!)}
                          >
                            Remove Product
                          </Button>
                        )}

                        {r.seller_user_id && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setUserStatus(r.seller_user_id!, "suspended", "suspend_user")
                              }
                            >
                              Suspend User
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setBanTargetUserId(r.seller_user_id!);
                                setBanTargetUserName(sellerName(r) ?? "reported seller");
                                setBanCurrentReport(r);
                                setBanModalOpen(true);
                              }}
                            >
                              Ban Seller
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Dialog
            open={reporterModal.open}
            onOpenChange={(o) => setReporterModal((s) => ({ ...s, open: o }))}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reporter details</DialogTitle>
                <DialogDescription>
                  Account information for the user who filed this report.
                </DialogDescription>
              </DialogHeader>
              {reporterModal.profile ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Name</div>
                    <div className="font-medium">{reporterModal.profile.full_name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="font-medium">{reporterModal.profile.email || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="font-medium">
                      <Badge variant="outline">{reporterModal.profile.role || "user"}</Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="font-medium">
                      <Badge variant="outline">{reporterModal.profile.status || "active"}</Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Join date</div>
                    <div className="font-medium">
                      {reporterModal.profile.created_at
                        ? new Date(reporterModal.profile.created_at).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Reports submitted</div>
                    <div className="font-medium">{reporterModal.reportsSubmitted}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Reporter profile not available (the user may have been deleted).
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={sellerModal.open}
            onOpenChange={(o) => setSellerModal((s) => ({ ...s, open: o }))}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Seller details</DialogTitle>
                <DialogDescription>
                  Account information for the seller associated with this report.
                </DialogDescription>
              </DialogHeader>
              {sellerModal.profile ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Name</div>
                    <div className="font-medium">{sellerModal.profile.full_name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="font-medium">{sellerModal.profile.email || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="font-medium">
                      <Badge variant="outline">{sellerModal.profile.status || "active"}</Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total listings</div>
                    <div className="font-medium">{sellerModal.totalListings}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Reports received</div>
                    <div className="font-medium">{sellerModal.totalReportsReceived}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Ban history</div>
                    {sellerModal.profile.banned_at ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                        <div>
                          <span className="font-semibold">Banned at:</span>{" "}
                          {new Date(sellerModal.profile.banned_at).toLocaleString()}
                        </div>
                        {sellerModal.profile.banned_until && (
                          <div>
                            <span className="font-semibold">Banned until:</span>{" "}
                            {new Date(sellerModal.profile.banned_until).toLocaleString()}
                          </div>
                        )}
                        {sellerModal.profile.ban_reason && (
                          <div>
                            <span className="font-semibold">Reason:</span>{" "}
                            {sellerModal.profile.ban_reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No ban on record.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Seller profile not available (the user may have been deleted).
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Feedback Management
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showing the latest {latestFeedbackPreview.length} feedback entries, newest first.
                </p>
              </div>
              <Button variant="outline" onClick={handleOpenAllFeedback}>
                View All Feedback
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestFeedbackPreview.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No feedback found.</div>
              ) : (
                <div className="space-y-3">
                  {latestFeedbackPreview.map((feedback: any) => (
                    <div key={feedback.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= feedback.rating
                                      ? "fill-orange-500 text-orange-500"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                            <Badge variant="outline">{feedback.category}</Badge>
                            {getStatusBadge(feedback.status)}
                            <span className="text-xs text-muted-foreground">
                              {new Date(feedback.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="mb-2">
                            <span className="text-sm font-medium">User ID: {feedback.user_id}</span>
                          </div>

                          <p className="text-sm text-gray-700">{feedback.message}</p>

                          {feedback.screenshot_url && (
                            <img
                              src={signedScreenshotUrls[feedback.id] || feedback.screenshot_url}
                              alt="Screenshot"
                              className="mt-2 h-24 w-24 rounded border border-gray-300 object-cover"
                            />
                          )}

                          {feedback.admin_notes && (
                            <div className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-700">
                              <span className="font-semibold">Admin Note:</span> {feedback.admin_notes}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedFeedbackId(feedback.id)}
                              >
                                Add Notes
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add Admin Notes</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <Textarea
                                  placeholder="Enter admin notes..."
                                  value={selectedFeedbackId === feedback.id ? adminNotes : ""}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  className="min-h-[100px]"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleStatusUpdate(feedback.id, "under_review")}
                                  >
                                    Mark Under Review
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleStatusUpdate(feedback.id, "resolved")}
                                  >
                                    Mark Resolved
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteFeedback(feedback.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ImagePreviewModal
            images={previewImages}
            initialIndex={previewIndex}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
          />

          <BanModal
            open={banModalOpen}
            onOpenChange={setBanModalOpen}
            targetUserId={banTargetUserId ?? ""}
            targetUserName={banTargetUserName ?? undefined}
            reportContext={banCurrentReport ? {
              reportId: banCurrentReport.id,
              targetType: banCurrentReport.target_type,
              reporterId: banCurrentReport.reporter_id,
              sellerUserId: banCurrentReport.seller_user_id,
            } : null}
            onBanned={async () => {
              await queryClient.invalidateQueries({ queryKey: ["admin"] });
              setBanCurrentReport(null);
            }}
          />
        </div>
      ) : null}
      {!isDashboardView && <Outlet />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
