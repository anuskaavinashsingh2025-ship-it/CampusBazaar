import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [{ title: "All Reports — Admin Portal — CampusBazar" }],
  }),
  component: AdminReportsPage,
});

type ReportTargetType = "product" | "seller" | "rental" | "food" | "notes";

type ReportRow = {
  id: string;
  target_type: ReportTargetType;
  reason: string;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
  reporter_id: string;
  seller_user_id: string | null;
};

const PAGE_SIZE = 10;

function AdminReportsPage() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, isAdmin, navigate]);

  const { data: reports = [] } = useQuery({
    queryKey: ["admin", "reports", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports" as never)
        .select(
          "id,target_type,reason,details,status,created_at,reporter_id,seller_user_id",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReportRow[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesQuery =
        !query ||
        report.reason.toLowerCase().includes(query) ||
        report.details?.toLowerCase().includes(query) ||
        report.target_type.toLowerCase().includes(query) ||
        report.id.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || report.status === statusFilter;
      const matchesTarget = targetFilter === "all" || report.target_type === targetFilter;

      return matchesQuery && matchesStatus && matchesTarget;
    });
  }, [reports, searchTerm, statusFilter, targetFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedReports = filteredReports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, targetFilter]);

  if (loading || !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center text-sm text-muted-foreground">
        {loading ? "Loading…" : "Redirecting…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review every report with search, filters, and pagination.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin">Back to Admin Portal</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reason, details, or report ID"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={targetFilter} onValueChange={(value) => setTargetFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Target type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Targets</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="rental">Rental</SelectItem>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="notes">Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredReports.length} report{filteredReports.length === 1 ? "" : "s"}.
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No reports match the current search or filters.
            </div>
          ) : (
            <div className="space-y-3">
              {pagedReports.map((report) => (
                <article key={report.id} className="rounded-xl border p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{report.target_type}</Badge>
                        <Badge
                          variant={report.status === "pending" ? "default" : "outline"}
                          className={
                            report.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : ""
                          }
                        >
                          {report.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>
                      <h2 className="text-base font-semibold">{report.reason}</h2>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {report.details || "No additional details were provided."}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Report ID: {report.id}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="text-sm text-muted-foreground">
              Page {safePage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
