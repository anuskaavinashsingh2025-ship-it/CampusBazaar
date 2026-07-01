import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { bootstrapUserAccount } from "@/lib/supabase-account";
import { saveLogin } from "@/lib/saved-login";
import { checkBanStatus } from "@/lib/ban-enforcement";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export type Profile = Tables<"profiles">;
export type AppRole = "user" | "admin";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isProfileComplete: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfileAndRoles(authUser: User) {
  const [{ data: profileData }, { data: roleData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", authUser.id),
  ]);
  return {
    profile: profileData ?? null,
    roles: (roleData ?? []).map((r: { role: string }) => r.role as AppRole),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const bootstrapInFlight = useRef<Set<string>>(new Set());
  const navigate = useNavigate();

  const loadUserData = useCallback(async (authUser: User) => {
    const email = authUser.email ?? "";
    // Validate VIT email BEFORE any account creation
    if (!email.endsWith("@vitstudent.ac.in") && !email.endsWith("@vit.ac.in")) {
      await supabase.auth.signOut();
      setProfile(null);
      setRoles([]);
      navigate({ to: "/login" as any, search: { error: "non_vit_email" } as any });
      return;
    }
    if (!bootstrapInFlight.current.has(authUser.id)) {
      bootstrapInFlight.current.add(authUser.id);
      try {
        await bootstrapUserAccount(authUser);
      } catch (err) {
        console.error("[Auth] Account bootstrap failed:", err);
      } finally {
        bootstrapInFlight.current.delete(authUser.id);
      }
    }

    try {
      const { profile: profileData, roles: roleList } = await fetchProfileAndRoles(authUser);
      
      // Check ban status and redirect if banned
      if (profileData) {
        const banStatus = await checkBanStatus(authUser.id);
        if (banStatus.isBanned) {
          console.log("[Auth] User is banned, redirecting to /banned");
          setProfile(profileData);
          setRoles(roleList);
          // Redirect to banned page
          navigate({ to: "/banned" as any });
          return;
        }
      }
      
      setProfile(profileData);
      setRoles(roleList);
    } catch (err) {
      console.error("[Auth] Failed to load profile:", err);
      setProfile(null);
      setRoles([]);
    }
  }, [navigate]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserData(user);
    }
  }, [loadUserData, user]);

  useEffect(() => {
    let cancelled = false;

    const applySession = (nextSession: Session | null) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, nextSession: Session | null) => {
      applySession(nextSession);

      if (nextSession?.user && event === "SIGNED_IN" && nextSession.user.email) {
        saveLogin({
          email: nextSession.user.email,
          displayName:
            (nextSession.user.user_metadata?.full_name as string | undefined) ?? undefined,
          provider: nextSession.user.app_metadata?.provider === "google" ? "google" : "email",
        });
      }

      if (nextSession?.user) {
        void loadUserData(nextSession.user);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    const init = async () => {
      // getSession processes OAuth callback codes in the URL when detectSessionInUrl is enabled.
      const {
        data: { session: existing },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("[Auth] getSession failed:", error);
        if (error.message && !error.message.includes("refresh_token")) {
          toast.error(error.message || "Sign-in failed. Only VIT email addresses are allowed.");
        }
      }
      if (error?.message.includes('refresh_token')) {
        await supabase.auth.signOut();
        return;
      }

      if (cancelled) return;

      applySession(existing);

      if (existing?.user) {
        await loadUserData(existing.user);
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadUserData, navigate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      roles,
      isAdmin: roles.includes("admin"),
      isProfileComplete: profile?.is_profile_complete ?? false,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, user, profile, roles, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
