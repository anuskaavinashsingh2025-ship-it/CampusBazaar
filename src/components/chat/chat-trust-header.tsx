import { BadgeCheck, Mail, Star, ShoppingBag, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type { ParticipantTrustInfo } from "@/lib/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type ChatTrustHeaderProps = {
  trust: ParticipantTrustInfo;
  listingTitle: string;
  isOnline: boolean;
};

export function ChatTrustHeader({ trust, listingTitle, isOnline }: ChatTrustHeaderProps) {
  const successfulTransactions = trust.total_sold + trust.total_rented_out;

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller_profile_by_user_id", trust.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("slug")
        .eq("user_id", trust.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(trust.user_id),
  });

  const sellerUrl = sellerProfile?.slug
    ? `/seller/${sellerProfile.slug}`
    : `/seller/${trust.user_id}`;

  return (
    <div className="border-b bg-card/95 px-4 py-3 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="relative">
          <a href={sellerUrl} className="block">
            <Avatar className="h-11 w-11">
              {trust.avatar_url ? (
                <AvatarImage src={`${trust.avatar_url}?t=${Date.now()}`} alt="" />
              ) : null}
              <AvatarFallback>{trust.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </a>
          <span
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
              isOnline ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={sellerUrl} className="hover:underline">
              <h2 className="truncate text-sm font-semibold">{trust.display_name}</h2>
            </a>
            {trust.is_seller_verified && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <BadgeCheck className="h-3 w-3" />
                Verified Seller
              </Badge>
            )}
            {trust.is_vit_verified && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Mail className="h-3 w-3" />
                VIT Email
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{listingTitle}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Member since {new Date(trust.member_since).toLocaleDateString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500" />
              {trust.rating_avg > 0 ? trust.rating_avg.toFixed(1) : "—"} ({trust.rating_count})
            </span>
            <span className="inline-flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              {successfulTransactions} successful
            </span>
          </div>
        </div>
        <Badge variant={isOnline ? "default" : "outline"} className="shrink-0 text-[10px]">
          {isOnline ? "Online" : "Offline"}
        </Badge>
      </div>
    </div>
  );
}
