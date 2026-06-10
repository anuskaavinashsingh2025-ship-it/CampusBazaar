import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms & Conditions — CampusBazar" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const navigate = useNavigate();

  const handleContactSupport = () => {
    // Navigate to home and then smooth-scroll to contact-us
    navigate({ to: "/" });
    // Use a small timeout to allow navigation to complete in SPA
    setTimeout(() => {
      const el = document.getElementById("contact-us");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const handleReportIssue = () => {
    navigate({ to: "/feedback" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Card className="border-orange-200 shadow-lg">
          <CardContent className="p-6 sm:p-8 md:p-10">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                <FileText className="h-8 w-8 text-orange-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Terms & Conditions</h1>
              <p className="mt-3 text-base text-gray-600 sm:text-lg">
                Please read these terms carefully before using Campus Bazar.
              </p>
            </div>

            {/* Terms Sections */}
            <div className="space-y-6">
              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">1. Valid College Account Required</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Users must register using valid college credentials and maintain accurate account
                  information.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">2. Accurate Information Only</h3>
                <p className="mt-2 text-sm text-gray-700">
                  All listings, requests, and shared content must be genuine, accurate, and
                  truthful.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">3. No Illegal or Prohibited Items</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Prohibited, illegal, counterfeit, offensive, or restricted items are strictly not
                  allowed.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">4. No Fraudulent Activities</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Any form of fraud, scam, impersonation, or misleading activity is strictly
                  prohibited.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">5. Respect Other Users</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Respectful communication is mandatory. Harassment, abuse, discrimination, or
                  inappropriate behavior will not be tolerated.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">6. Protect User Privacy</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Personal information of other users must not be shared, misused, or disclosed
                  without consent.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">7. Verify Before Transactions</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Users are responsible for verifying products, services, and transactions before
                  proceeding.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">8. Platform May Remove Listings</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Campus Bazar reserves the right to remove any listing or content that violates
                  platform policies.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">
                  9. Violations May Lead to Suspension
                </h3>
                <p className="mt-2 text-sm text-gray-700">
                  Accounts involved in suspicious activities or repeated violations may be suspended
                  or permanently banned.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="font-semibold text-gray-900">
                  10. Admins May Ban Verified Offenders
                </h3>
                <p className="mt-2 text-sm text-gray-700">
                  Users reported for suspicious activities and found violating platform policies may
                  be suspended or permanently banned by the administrators.
                </p>
              </div>
            </div>

            {/* Bottom Notice Box */}
            <div className="mt-8 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                <p className="text-sm text-gray-700">
                  By using Campus Bazar, users agree to comply with all platform rules, guidelines,
                  and terms of use.
                </p>
              </div>
            </div>

            {/* Help Section */}
            <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Need Help?</h3>
              <p className="mb-6 text-sm text-gray-600">
                If you have any questions, feel free to contact our support team.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={handleContactSupport}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
                <Button
                  variant="outline"
                  className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                  onClick={handleReportIssue}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Report an Issue
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
