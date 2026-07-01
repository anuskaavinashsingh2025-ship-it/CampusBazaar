import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppSidebar } from "@/components/app-sidebar";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";
import ThemeToggle from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useNotificationRealtime, useUnreadNotificationCount } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { useSidebar } from "@/components/ui/sidebar";

function AppHeader({ user, profile, unreadCount, sellerProfile, initials, handleSignOut, handleSellerProfileClick }: {
  user: any; profile: any; unreadCount: number; sellerProfile: any;
  initials: string; handleSignOut: () => void; handleSellerProfileClick: () => void;
}) {
  const { state } = useSidebar();
  const navigate = useNavigate();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        {state === "collapsed" && (
          <Link to="/" aria-label="CampusBazar home" className="flex items-center">
            <CampusBazarLogo compact showText />
          </Link>
        )}
      </div>
      <div className="flex flex-1 items-center justify-end gap-1">
        {user && (
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="/notifications" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Link>
            </Button>
          </div>
        )}
      </div>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {profile?.full_name ?? "Student"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span>{profile?.full_name ?? "Student"}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {profile?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">User profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSellerProfileClick}>
              Seller profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button variant="outline" size="sm" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      )}
    </header>
  );
}

  export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(user?.id);

  const initials = (profile?.full_name ?? user?.email ?? "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller_profile_self", user?.id ?? null],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("slug")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const handleSellerProfileClick = () => {
    if (sellerProfile?.slug) {
      navigate({ to: "/seller/$slug", params: { slug: sellerProfile.slug } });
    } else {
      navigate({ to: "/seller-profile" });
    }
  };

  return (
      <SidebarProvider>
        <AppSidebar />
<SidebarInset className="min-w-0">
          <AppHeader
            user={user}
            profile={profile}
            unreadCount={unreadCount}
            sellerProfile={sellerProfile}
            initials={initials}
            handleSignOut={handleSignOut}
            handleSellerProfileClick={handleSellerProfileClick}
          />
          <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
        </SidebarInset>
      </SidebarProvider>
  );
}     