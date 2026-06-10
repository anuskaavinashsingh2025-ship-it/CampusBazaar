import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";

/** After OAuth redirect, send incomplete profiles to complete-profile before protected routes. */
export function AuthPostLoginRedirect() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, isProfileComplete } = useAuth();

  useEffect(() => {
    if (loading || !user || isProfileComplete) return;
    if (pathname === "/complete-profile" || pathname === "/login") return;

    const params = new URLSearchParams(window.location.search);
    const isOAuthReturn =
      params.has("code") ||
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("refresh_token");

    if (isOAuthReturn) {
      navigate({ to: "/complete-profile", replace: true });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loading, user, isProfileComplete, pathname, navigate]);

  return null;
}
