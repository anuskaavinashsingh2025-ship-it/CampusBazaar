import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bike,
  FileText,
  Heart,
  HelpCircle,
  Home,
  LogOut,
  MessageSquare,
  Package,
  Shield,
  Store,
  Tag,
  User,
  UtensilsCrossed,
  MessageCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";
import { useAuth } from "@/lib/auth";
import { useUnreadChatCount } from "@/lib/chat";
import { useNotificationRealtime, useUnreadNotificationCount } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";

const mainItems = [
  { title: "Home", url: "/", icon: Home, external: true },
  { title: "Rent", url: "/rent", icon: Bike, external: true },
  { title: "Food Hub", url: "/food", icon: UtensilsCrossed, external: true },
  { title: "Sell", url: "/upload-product", icon: Tag },
  { title: "Notes Hub", url: "/notes", icon: FileText, external: true },
  { title: "Chats", url: "/chats", icon: MessageSquare, showBadge: true },
  { title: "Requests", url: "/requests", icon: Shield },
  { title: "Seller Profile", url: "/seller-profile", icon: Store, isSellerProfile: true },
] as const;

const secondaryItems = [
  { title: "Notifications", url: "/notifications", icon: Bell, showBadge: true },
  { title: "Wishlist", url: "/wishlist", icon: Heart },
  { title: "Profile", url: "/profile", icon: User },
] as const;

function isNavActive(pathname: string, url: string, external?: boolean) {
  if (url === "/") return pathname === "/";
  if (external) return pathname === url || pathname.startsWith(`${url}/`);
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: unreadCount = 0 } = useUnreadNotificationCount(user?.id);
  const { data: unreadChats = 0 } = useUnreadChatCount(user?.id);
  useNotificationRealtime(user?.id);

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
    navigate({ to: "/login" });
  };

  const handleAuthAction = async () => {
    if (user) {
      await handleSignOut();
    } else {
      navigate({ to: "/login" });
    }
  };

  const handleSellerProfileClick = () => {
    if (sellerProfile?.slug) {
      navigate({ to: "/seller/$slug", params: { slug: sellerProfile.slug } });
    } else {
      navigate({ to: "/seller-profile" });
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/"
          aria-label="CampusBazar home"
          className="group/sidebar-logo flex items-center justify-center px-2 py-2"
        >
          <CampusBazarLogo size="lg" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {"isSellerProfile" in item && item.isSellerProfile ? (
                    <SidebarMenuButton
                      isActive={
                        !!(
                          pathname === "/seller-profile" ||
                          (sellerProfile?.slug && pathname === `/seller/${sellerProfile.slug}`)
                        )
                      }
                      onClick={handleSellerProfileClick}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={isNavActive(
                        pathname,
                        item.url,
                        "external" in item ? item.external : undefined,
                      )}
                    >
                      <Link
                        to={item.url}
                        className="flex items-center gap-2"
                        {...("external" in item && item.external ? { target: "_self" } : {})}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {"showBadge" in item && item.showBadge && unreadChats > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[10px]"
                          >
                            {unreadChats > 99 ? "99+" : unreadChats}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {"showBadge" in item && item.showBadge && unreadCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[10px]"
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"}>
                    <Link to="/admin" className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>Admin Portal</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/feedback"}>
              <Link to="/feedback" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>Give Feedback</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/terms"}>
              <Link to="/terms" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Terms &amp; Conditions</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleAuthAction}
              className={user ? "text-destructive hover:text-destructive" : undefined}
            >
              <LogOut className="h-4 w-4" />
              <span>{user ? "Log Out" : "Sign In"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
