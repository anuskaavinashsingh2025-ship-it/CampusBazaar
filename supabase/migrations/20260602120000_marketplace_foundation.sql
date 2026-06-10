-- ===== Marketplace Foundation (Phase 1) =====

-- Product conditions (stored as human-readable strings to match requirements)
create type public.product_status as enum ('available', 'sold', 'hidden');

-- ===== PRODUCT LISTINGS =====
create table public.product_listings (
  id uuid primary key default gen_random_uuid(),

  -- Connect products to existing seller_profiles via seller_id.
  -- seller_profiles.user_id is UNIQUE, so it can be referenced safely.
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,

  title text not null,
  description text not null,
  category text not null,
  custom_category text null,
  price numeric(12,2) not null check (price >= 0),

  condition text not null check (condition in ('New', 'Like New', 'Good', 'Fair', 'Used')),

  urgent_sale boolean not null default false,
  status public.product_status not null default 'available',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_listings_status_created_at_idx
  on public.product_listings (status, created_at desc);

alter table public.product_listings enable row level security;

-- Only show available listings to guests.
create policy "Guests can read available product listings"
  on public.product_listings for select to anon
  using (status = 'available');

-- Authenticated can read:
-- - available listings (marketplace)
-- - their own listings (e.g. for future seller pages)
create policy "Users can read available or own product listings"
  on public.product_listings for select to authenticated
  using (status = 'available' or seller_id = auth.uid());

-- Sellers can CRUD their own listings
create policy "Users can insert own product listings"
  on public.product_listings for insert to authenticated
  with check (seller_id = auth.uid());

create policy "Users can update own product listings"
  on public.product_listings for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "Users can delete own product listings"
  on public.product_listings for delete to authenticated
  using (seller_id = auth.uid());

grant select on public.product_listings to anon, authenticated;
grant insert, update, delete on public.product_listings to authenticated;
grant all on public.product_listings to service_role;

create trigger product_listings_set_updated_at
  before update on public.product_listings
  for each row execute function public.set_updated_at();

-- ===== PRODUCT IMAGES (1-5 per product) =====
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product_listings(id) on delete cascade,
  storage_path text not null, -- stored object_name (path) inside storage bucket
  sort_index integer not null check (sort_index >= 0 and sort_index <= 4),
  created_at timestamptz not null default now()
);

create unique index if not exists product_images_product_sort_idx
  on public.product_images (product_id, sort_index);

alter table public.product_images enable row level security;

create policy "Guests can read images for available product listings"
  on public.product_images for select to anon
  using (
    exists (
      select 1 from public.product_listings pl
      where pl.id = product_id
        and pl.status = 'available'
    )
  );

create policy "Users can read images for available or own listings"
  on public.product_images for select to authenticated
  using (
    exists (
      select 1 from public.product_listings pl
      where pl.id = product_id
        and (pl.status = 'available' or pl.seller_id = auth.uid())
    )
  );

create policy "Users can insert images for their own listings"
  on public.product_images for insert to authenticated
  with check (
    exists (
      select 1 from public.product_listings pl
      where pl.id = product_id
        and pl.seller_id = auth.uid()
    )
  );

create policy "Users can delete images for their own listings"
  on public.product_images for delete to authenticated
  using (
    exists (
      select 1 from public.product_listings pl
      where pl.id = product_id
        and pl.seller_id = auth.uid()
    )
  );

grant select on public.product_images to anon, authenticated;
grant insert, delete on public.product_images to authenticated;
grant all on public.product_images to service_role;

-- ===== STORAGE BUCKET + POLICIES (product-images) =====
-- Bucket stores objects under: <product_id>/<sort_index>-<original_filename>
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

-- Ensure storage objects RLS allows image reads for available listings.
-- Uses first path segment as product_id.
create policy "Anon can read product images for available products"
  on storage.objects for select to anon
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.product_listings pl
      where pl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and pl.status = 'available'
    )
  );

create policy "Authenticated can read product images for available or own products"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.product_listings pl
      where pl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and (pl.status = 'available' or pl.seller_id = auth.uid())
    )
  );

create policy "Seller can upload product images for their own products"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.product_listings pl
      where pl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and pl.seller_id = auth.uid()
    )
  );

create policy "Seller can delete product images for their own products"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.product_listings pl
      where pl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and pl.seller_id = auth.uid()
    )
  );

