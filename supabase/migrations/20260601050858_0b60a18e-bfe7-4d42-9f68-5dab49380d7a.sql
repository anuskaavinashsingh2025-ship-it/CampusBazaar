-- Fix mutable search_path on updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Lock down trigger-only functions (never called directly)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.generate_seller_slug(text) from public, anon, authenticated;

-- Auto-assign seller slug via trigger so the generator is never client-callable
create or replace function public.assign_seller_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.generate_seller_slug(new.display_name);
  end if;
  return new;
end;
$$;

revoke execute on function public.assign_seller_slug() from public, anon, authenticated;

create trigger seller_profiles_assign_slug
  before insert on public.seller_profiles
  for each row execute function public.assign_seller_slug();

-- has_role must stay executable by signed-in users (used by RLS policies),
-- but should not be callable anonymously
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;