import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  FEEDBACK_CATEGORIES,
  useAllFeedback,
  type FeedbackStatus,
} from "@/lib/feedback";

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

export const Route = createFileRoute("/_authenticated/admin/feedback")({
  head: () => ({
    meta: [{ title: "All Feedback — Admin Portal — CampusBazar" }],
  }),
  component: AdminFeedbackPage,
});

const PAGE_SIZE = 8;

function AdminFeedbackPage() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const { data: allFeedback = [] } = useAllFeedback();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, isAdmin, navigate]);

  const filteredFeedback = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return [...allFeedback]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((feedback) => {
        const matchesQuery =
          !query ||
          feedback.message.toLowerCase().includes(query) ||
          feedback.category.toLowerCase().includes(query) ||
          feedback.user_id.toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" || feedback.status === statusFilter;
        const matchesCategory =
          categoryFilter === "all" || feedback.category === categoryFilter;
        const matchesRating =
          ratingFilter === "all" || feedback.rating === Number(ratingFilter);

        return matchesQuery && matchesStatus && matchesCategory && matchesRating;
      });
  }, [allFeedback, categoryFilter, ratingFilter, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredFeedback.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedFeedback = filteredFeedback.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, categoryFilter, ratingFilter]);

  const statusBadge = (status: FeedbackStatus) => {
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
          <h1 className="text-2xl font-bold tracking-tight">All Feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse every feedback entry with search, filters, and pagination.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin">Back to Admin Portal</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feedback List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search message, category, or user ID"
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
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {FEEDBACK_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={(value) => setRatingFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredFeedback.length} feedback entr{filteredFeedback.length === 1 ? "y" : "ies"}, newest first.
          </div>

          {filteredFeedback.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No feedback matches the current search or filters.
            </div>
          ) : (
            <div className="space-y-3">
              {pagedFeedback.map((feedback) => (
                <article key={feedback.id} className="rounded-xl border p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={`${feedback.id}-${star}`}
                              className={`h-4 w-4 ${
                                star <= feedback.rating
                                  ? "fill-orange-500 text-orange-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <Badge variant="outline">{feedback.category}</Badge>
                        {statusBadge(feedback.status as FeedbackStatus)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(feedback.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">User ID: {feedback.user_id}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedback.message}</p>
                      {feedback.admin_notes && (
                        <div className="rounded-md bg-blue-50 p-2 text-sm text-blue-700">
                          <span className="font-semibold">Admin note:</span> {feedback.admin_notes}
                        </div>
                      )}
                    </div>
                    {feedback.screenshot_url && (
                      <img
                        src={feedback.screenshot_url}
                        alt="Feedback screenshot"
                        className="h-24 w-24 rounded-md border object-cover"
                      />
                    )}
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
