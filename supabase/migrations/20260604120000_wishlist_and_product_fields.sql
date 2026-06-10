-- Wishlist + product listing extras + profile avatar storage

-- ===== WISHLIST =====
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('product', 'rental', 'food', 'notes')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (user_id, created_at desc);

alter table public.wishlist_items enable row level security;

create policy "Users can read own wishlist"
  on public.wishlist_items for select to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own wishlist items"
  on public.wishlist_items for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete own wishlist items"
  on public.wishlist_items for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.wishlist_items to authenticated;
grant all on public.wishlist_items to service_role;

-- ===== PRODUCT LISTING EXTRAS =====
alter table public.product_listings
  add column if not exists is_negotiable boolean not null default false,
  add column if not exists location text;

-- ===== PROFILE AVATARS STORAGE =====
insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do nothing;

create policy "Anyone can read profile avatars"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

create policy "Users can upload own profile avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own profile avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own profile avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
