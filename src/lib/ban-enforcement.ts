import { supabase } from "@/integrations/supabase/client";

export type BanStatus = {
  isBanned: boolean;
  isPermanent: boolean;
  bannedAt: string | null;
  bannedUntil: string | null;
  banReason: string | null;
  bannedBy: string | null;
};

/**
 * Check if a user is currently banned
 */
export async function checkBanStatus(userId: string): Promise<BanStatus> {
  console.log("[BAN ENFORCEMENT] Checking ban status for user:", userId);

  const { data, error } = await supabase
    .from("profiles")
    .select("banned_at, banned_until, ban_reason, banned_by, status")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[BAN ENFORCEMENT] Error checking ban status:", error);
    return {
      isBanned: false,
      isPermanent: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      bannedBy: null,
    };
  }

  if (!data) {
    console.log("[BAN ENFORCEMENT] No profile found for user");
    return {
      isBanned: false,
      isPermanent: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      bannedBy: null,
    };
  }

  const hasActiveBan =
    data.banned_at !== null &&
    (data.banned_until === null || new Date(data.banned_until) > new Date());

  // Check if user is banned. Older rows may have ban metadata even if
  // status drifted, so treat the ban columns as authoritative too.
  if (data.status !== "banned" && !hasActiveBan) {
    console.log("[BAN ENFORCEMENT] User is not banned (status:", data.status + ")");
    return {
      isBanned: false,
      isPermanent: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      bannedBy: null,
    };
  }

  // Check if ban has expired
  if (data.banned_until) {
    const now = new Date();
    const bannedUntil = new Date(data.banned_until);
    
    if (now > bannedUntil) {
      console.log("[BAN ENFORCEMENT] Ban has expired, unbanning user");
      // Auto-unban user
      await supabase
        .from("profiles")
        .update({
          status: "active",
          banned_at: null,
          banned_until: null,
          ban_reason: null,
          banned_by: null,
        })
        .eq("id", userId);
      
      return {
        isBanned: false,
        isPermanent: false,
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
        bannedBy: null,
      };
    }
  }

  const isPermanent = data.banned_until === null && data.banned_at !== null;
  
  console.log("[BAN ENFORCEMENT] User is banned:", {
    isPermanent,
    bannedAt: data.banned_at,
    bannedUntil: data.banned_until,
    banReason: data.ban_reason,
  });

  return {
    isBanned: true,
    isPermanent,
    bannedAt: data.banned_at,
    bannedUntil: data.banned_until,
    banReason: data.ban_reason,
    bannedBy: data.banned_by,
  };
}

/**
 * Check if user is banned and throw error if so
 * Use this in server functions to enforce bans
 */
export async function enforceBanCheck(userId: string, action: string = "perform this action") {
  const banStatus = await checkBanStatus(userId);
  
  if (banStatus.isBanned) {
    const message = banStatus.isPermanent
      ? "Your account has been permanently banned."
      : `Your account is banned until ${new Date(banStatus.bannedUntil!).toLocaleDateString()}.`;
    
    console.log(`[BAN ENFORCEMENT] Blocked ${action} for banned user:`, userId);
    throw new Error(`${message} Reason: ${banStatus.banReason || "No reason provided"}`);
  }
}

/**
 * Check if user can perform a specific action while banned
 * Permanent bans block all actions
 * Temporary bans may allow some actions (configure as needed)
 */
export async function canPerformAction(userId: string, action: "login" | "create_listing" | "chat" | "report" | "marketplace"): Promise<boolean> {
  const banStatus = await checkBanStatus(userId);
  
  if (!banStatus.isBanned) {
    return true;
  }

  // Permanent bans block everything
  if (banStatus.isPermanent) {
    return false;
  }

  // Temporary bans - currently block everything
  // You can configure this to allow certain actions for temporary bans
  return false;
}
