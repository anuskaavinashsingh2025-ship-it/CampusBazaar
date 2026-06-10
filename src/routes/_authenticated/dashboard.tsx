import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Package, CalendarClock, Heart, Star, Store, User } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useUnreadChatCount } from "@/lib/chat";
import { fetchWishlist } from "@/lib/wishlist";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — CampusBazar" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, profile, isAdmin } = useAuth();
  const firstName = (profile?.full_name ?? "there").split(" ")[0];

  const { data: wishlistCount = 0 } = useQuery({
    queryKey: ["wishlist_count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const rows = await fetchWishlist(user.id);
      return rows.length;
    },
    enabled: Boolean(user?.id),
  });

  const { data: listingCount = 0 } = useQuery({
    queryKey: ["my_product_count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("product_listings" as never)
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "available");
      return count ?? 0;
    },
    enabled: Boolean(user?.id),
  });

  const { data: rentalCount = 0 } = useQuery({
    queryKey: ["my_rental_count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("rental_listings" as never)
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "available");
      return count ?? 0;
    },
    enabled: Boolean(user?.id),
  });

  const { data: unreadChats = 0 } = useUnreadChatCount(user?.id);

  const { data: sellerRating = "—" } = useQuery({
    queryKey: ["seller_rating", user?.id],
    queryFn: async () => {
      if (!user) return "—";
      const { data } = await supabase
        .from("seller_profiles")
        .select("rating_avg")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data?.rating_avg) return "—";
      return Number(data.rating_avg).toFixed(1);
    },
    enabled: Boolean(user?.id),
  });

  const stats = [
    { label: "Active listings", value: listingCount, icon: Package },
    { label: "Active rentals", value: rentalCount, icon: CalendarClock },
    { label: "Wishlist items", value: wishlistCount, icon: Heart },
    { label: "Seller rating", value: sellerRating, icon: Star },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your CampusBazar account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && <Badge variant="secondary">Admin</Badge>}
          <Button variant="outline" asChild>
            <Link to="/profile">
              <User className="h-4 w-4" />
              My profile
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/seller-profile">
              <Store className="h-4 w-4" />
              Seller profile
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            My Chats
            {unreadChats > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {unreadChats} unread
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Chats unlock after a seller accepts your request. No open DMs — every conversation is
            tied to a listing.
          </p>
          <Button asChild>
            <Link to="/chats">Open My Chats</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/chats">My Chats</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/wishlist">Wishlist</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/upload-product">Sell an item</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/food">Food Hub</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/rent">Rent</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/rental-requests">Rental Requests</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/notifications">Notifications</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
