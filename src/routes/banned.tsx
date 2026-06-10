import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertTriangle, LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/banned")({
  head: () => ({
    meta: [{ title: "Account Banned — CampusBazar" }],
  }),
  component: BannedPage,
});

function BannedPage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      navigate({ to: "/login" as any });
    }
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" as any });
  };

  // Type assertion for ban fields that will exist after migration
  const profileWithBan = profile as any;
  const isPermanent = profileWithBan?.banned_until === null && profileWithBan?.banned_at !== null;
  const banEndDate = profileWithBan?.banned_until ? new Date(profileWithBan.banned_until) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-600">Account Banned</CardTitle>
          <CardDescription>
            {isPermanent
              ? "Your account has been permanently banned."
              : `Your account is temporarily banned until ${banEndDate?.toLocaleDateString()}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileWithBan?.ban_reason && (
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">Reason:</p>
              <p className="mt-1 text-sm text-red-700">{profileWithBan.ban_reason}</p>
            </div>
          )}

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              {isPermanent
                ? "Permanent bans cannot be overturned. If you believe this is an error, please contact support."
                : "You will be able to access your account again after the ban period expires."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-center text-sm text-gray-600">
              While banned, you cannot:
            </p>
            <ul className="ml-6 list-disc space-y-1 text-sm text-gray-600">
              <li>Create listings</li>
              <li>Send messages</li>
              <li>Submit reports</li>
              <li>Access marketplace features</li>
            </ul>
          </div>

          <Button onClick={handleSignOut} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
