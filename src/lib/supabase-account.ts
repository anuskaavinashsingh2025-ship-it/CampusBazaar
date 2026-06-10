import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export function isVitStudentEmail(email: string | undefined | null): boolean {
  return Boolean(email && email.toLowerCase().endsWith("@vitstudent.ac.in"));
}

function profileMeta(user: User) {
  const meta = user.user_metadata ?? {};
  return {
    full_name: (meta.full_name ?? meta.name ?? null) as string | null,
    avatar_url: (meta.avatar_url ?? meta.picture ?? null) as string | null,
  };
}

function defaultDisplayName(user: User): string {
  const { full_name } = profileMeta(user);
  return full_name ?? user.email?.split("@")[0] ?? "Student";
}

/** Create a profiles row for the signed-in user when the DB trigger did not. */
export async function ensureProfile(user: User): Promise<void> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return;

  const { full_name, avatar_url } = profileMeta(user);
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email ?? "",
    full_name,
    avatar_url,
  });

  if (error?.code === "23505") return;
  if (error) throw error;
}

async function ensureUserRole(userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    role: "user",
  });

  if (error?.code === "23505") return;
  if (error) throw error;
}

export type SellerBootstrap = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

/** Ensure seller_profiles exists before listing inserts (FK). */
export async function ensureSellerProfile(seller: SellerBootstrap): Promise<void> {
  const { data: existing } = await supabase
    .from("seller_profiles")
    .select("user_id")
    .eq("user_id", seller.user_id)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("seller_profiles").insert({
    user_id: seller.user_id,
    display_name: seller.display_name,
    avatar_url: seller.avatar_url,
  });

  if (error?.code === "23505") return;
  if (error) throw error;
}

/** Ensure seller_profiles from auth user metadata (post sign-up / OAuth). */
export async function ensureSellerProfileFromUser(user: User): Promise<void> {
  const { avatar_url } = profileMeta(user);
  await ensureSellerProfile({
    user_id: user.id,
    display_name: defaultDisplayName(user),
    avatar_url,
  });
}

/** Full account bootstrap after sign-in when DB triggers may not have run. */
export async function bootstrapUserAccount(user: User): Promise<void> {
  if (!isVitStudentEmail(user.email)) {
    throw new Error("Only VIT student emails (@vitstudent.ac.in) are allowed.");
  }

  await ensureProfile(user);
  await ensureUserRole(user.id);
  await ensureSellerProfileFromUser(user);
}
