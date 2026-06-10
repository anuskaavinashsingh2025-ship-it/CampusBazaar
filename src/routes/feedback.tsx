import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Star, Upload, X, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

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
import { Input } from "@/components/ui/input";
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

    // Reset form
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

  const getStatusIcon = (status: FeedbackStatus) => {
    switch (status) {
      case "submitted":
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case "under_review":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Card className="border-orange-200 shadow-lg">
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">Please login to submit feedback.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Feedback Form */}
        <Card className="border-orange-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardTitle className="text-2xl font-bold">Feedback</CardTitle>
            <p className="text-orange-100 mt-1">
              Help us improve Campus Bazar by sharing your valuable feedback.
            </p>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star Rating */}
              <div>
                <Label className="text-base font-semibold text-gray-900">Rating *</Label>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= rating ? "fill-orange-500 text-orange-500" : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating === 0 && (
                  <p className="mt-1 text-sm text-red-500">Please select a rating</p>
                )}
              </div>

              {/* Category Dropdown */}
              <div>
                <Label htmlFor="category" className="text-base font-semibold text-gray-900">
                  Category *
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as FeedbackCategory)}
                >
                  <SelectTrigger className="mt-2">
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
                {!category && <p className="mt-1 text-sm text-red-500">Please select a category</p>}
              </div>

              {/* Feedback Text Area */}
              <div>
                <Label htmlFor="message" className="text-base font-semibold text-gray-900">
                  Feedback Message *
                </Label>
                <Textarea
                  id="message"
                  placeholder="Share your experience, issue, suggestion, or feedback here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-2 min-h-[120px]"
                  maxLength={500}
                />
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-gray-500">
                    {message.length < 10 && (
                      <span className="text-red-500">Minimum 10 characters</span>
                    )}
                  </span>
                  <span className={message.length > 500 ? "text-red-500" : "text-gray-500"}>
                    {message.length}/500
                  </span>
                </div>
              </div>

              {/* Screenshot Upload */}
              <div>
                <Label className="text-base font-semibold text-gray-900">
                  Screenshot (Optional)
                </Label>
                <div className="mt-2">
                  {screenshotPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="h-32 w-32 rounded-lg border border-gray-300 object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6">
                      <label htmlFor="screenshot" className="cursor-pointer">
                        <div className="flex flex-col items-center">
                          <Upload className="h-8 w-8 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">
                            Click to upload or drag and drop
                          </p>
                          <p className="mt-1 text-xs text-gray-500">PNG, JPG, JPEG (max 5MB)</p>
                        </div>
                        <input
                          id="screenshot"
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleScreenshotChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700"
                disabled={submitFeedback.isPending}
              >
                {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User Feedback History */}
        {userFeedback.length > 0 && (
          <Card className="border-orange-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900">My Feedback</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {userFeedback.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
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
                          <Badge variant="outline" className="text-xs">
                            {feedback.category}
                          </Badge>
                          {getStatusBadge(feedback.status as FeedbackStatus)}
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{feedback.message}</p>
                        {feedback.screenshot_url && (
                          <img
                            src={feedback.screenshot_url}
                            alt="Screenshot"
                            className="mt-2 h-24 w-24 rounded border border-gray-300 object-cover"
                          />
                        )}
                        {feedback.admin_notes && (
                          <div className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-700">
                            <span className="font-semibold">Admin Note:</span>{" "}
                            {feedback.admin_notes}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
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
