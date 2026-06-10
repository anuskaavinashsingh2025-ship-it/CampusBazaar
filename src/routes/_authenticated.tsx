import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { checkBanStatus } from "@/lib/ban-enforcement";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { user, loading, isProfileComplete, profile } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    if (profile?.status === "banned" || profile?.banned_at) {
      void checkBanStatus(user.id).then((banStatus) => {
        if (banStatus.isBanned) navigate({ to: "/banned" as any });
      });
      return;
    }

    if (!isProfileComplete) {
      navigate({ to: "/complete-profile" });
    }
  }, [loading, user, profile, isProfileComplete, navigate]);

  if (loading || !user || !isProfileComplete) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Outlet />
    </div>
  );
}
