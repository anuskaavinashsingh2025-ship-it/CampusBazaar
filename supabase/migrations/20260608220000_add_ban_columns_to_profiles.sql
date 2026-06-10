-- Add ban columns to profiles table
alter table public.profiles
  add column if not exists banned_at timestamptz null,
  add column if not exists banned_until timestamptz null,
  add column if not exists ban_reason text null,
  add column if not exists banned_by uuid null references auth.users(id) on delete set null;

-- Create index for efficient ban status queries
create index if not exists profiles_banned_until_idx
  on public.profiles (banned_until)
  where banned_until is not null;

-- Create index for permanent bans
create index if not exists profiles_permanent_ban_idx
  on public.profiles (banned_at)
  where banned_until is null and banned_at is not null;
