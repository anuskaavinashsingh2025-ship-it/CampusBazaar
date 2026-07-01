import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Star, Upload, X, CheckCircle2, Clock, AlertCircle } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  useUserFeedback,
  useSubmitFeedback,
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [{ title: "Feedback — CampusBazar" }],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { user } = useAuth();
  const { data: userFeedback = [] } = useUserFeedback();
  const submitFeedback = useSubmitFeedback();

  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [message, setMessage] = useState<string>("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating) {
      alert("Please select a rating");
      return;
    }
    if (!category) {
      alert("Please select a category");
      return;
    }
    if (message.length < 10) {
      alert("Message must be at least 10 characters");
      return;
    }
    if (message.length > 500) {
      alert("Message must be at most 500 characters");
      return;
    }

    submitFeedback.mutate({
      rating,
      category: category as FeedbackCategory,
      message,
      screenshotFile: screenshotFile || undefined,
    });

    setRating(0);
    setCategory("");
    setMessage("");
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
        alert("File must be PNG, JPG, or JPEG");
        return;
      }
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case "submitted":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
            Submitted
          </Badge>
        );
      case "under_review":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
            Under Review
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: FeedbackStatus) => {
    switch (status) {
      case "submitted":
        return <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
      case "under_review":
        return <Clock className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Card className="border-orange-200 dark:border-orange-900">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Please login to submit feedback.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Feedback Form */}
        <Card className="border-orange-200 dark:border-orange-900 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-none">
            <CardTitle className="text-2xl font-bold">Feedback</CardTitle>
            <p className="text-orange-100 mt-1">
              Help us improve Campus Bazar by sharing your valuable feedback.
            </p>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 bg-card">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Star Rating */}
              <div>
                <Label className="text-base font-semibold text-foreground">Rating *</Label>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          star <= (hoveredRating || rating)
                            ? "fill-orange-500 text-orange-500"
                            : "text-muted-foreground/40 dark:text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating === 0 && (
                  <p className="mt-1 text-sm text-destructive">Please select a rating</p>
                )}
              </div>

              {/* Category Dropdown */}
              <div>
                <Label htmlFor="category" className="text-base font-semibold text-foreground">
                  Category *
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as FeedbackCategory)}
                >
                  <SelectTrigger className="mt-2 bg-background border-input text-foreground">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!category && (
                  <p className="mt-1 text-sm text-destructive">Please select a category</p>
                )}
              </div>

              {/* Feedback Text Area */}
              <div>
                <Label htmlFor="message" className="text-base font-semibold text-foreground">
                  Feedback Message *
                </Label>
                <Textarea
                  id="message"
                  placeholder="Share your experience, issue, suggestion, or feedback here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-2 min-h-[120px] bg-background border-input text-foreground placeholder:text-muted-foreground resize-none"
                  maxLength={500}
                />
                <div className="mt-1 flex justify-between text-sm">
                  <span>
                    {message.length < 10 && message.length > 0 && (
                      <span className="text-destructive">Minimum 10 characters</span>
                    )}
                  </span>
                  <span className={`tabular-nums ${message.length > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                    {message.length}/500
                  </span>
                </div>
              </div>

              {/* Screenshot Upload */}
              <div>
                <Label className="text-base font-semibold text-foreground">
                  Screenshot (Optional)
                </Label>
                <div className="mt-2">
                  {screenshotPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="h-32 w-32 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="screenshot"
                      className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 p-8 transition-colors hover:border-orange-400 hover:bg-muted/60 dark:hover:border-orange-600"
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="rounded-full bg-muted p-3">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, JPEG (max 5MB)</p>
                      </div>
                      <input
                        id="screenshot"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleScreenshotChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors"
                disabled={submitFeedback.isPending}
              >
                {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User Feedback History */}
        {userFeedback.length > 0 && (
          <Card className="border-orange-200 dark:border-orange-900 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-foreground">My Feedback</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {userFeedback.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">

                        {/* Stars + badges row */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3.5 w-3.5 ${
                                  star <= feedback.rating
                                    ? "fill-orange-500 text-orange-500"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {feedback.category}
                          </Badge>
                          {getStatusBadge(feedback.status as FeedbackStatus)}
                        </div>

                        {/* Message */}
                        <p className="text-sm text-foreground leading-relaxed">{feedback.message}</p>

                        {/* Screenshot thumbnail */}
                        {feedback.screenshot_url && (
                          <img
                            src={feedback.screenshot_url}
                            alt="Screenshot"
                            className="mt-3 h-24 w-24 rounded border border-border object-cover"
                          />
                        )}

                        {/* Admin notes */}
                        {feedback.admin_notes && (
                          <div className="mt-3 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-semibold">Admin note: </span>
                            {feedback.admin_notes}
                          </div>
                        )}

                        {/* Date + status icon */}
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {getStatusIcon(feedback.status as FeedbackStatus)}
                          <span>{new Date(feedback.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}