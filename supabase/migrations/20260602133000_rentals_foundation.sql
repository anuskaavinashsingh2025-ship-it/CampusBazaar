-- ===== Rentals Foundation =====

create type public.rental_status as enum ('available', 'rented_out', 'unavailable');
create type public.rental_request_status as enum (
  'pending',
  'accepted',
  'rejected',
  'returned',
  'completed'
);

-- ===== RENTAL LISTINGS =====
create table public.rental_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,

  title text not null,
  description text not null,
  category text not null,
  custom_category text null,
  rent_price_per_day numeric(12, 2) not null check (rent_price_per_day >= 0),
  condition text not null check (condition in ('New', 'Like New', 'Good', 'Fair', 'Used')),
  status public.rental_status not null default 'available',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rental_listings_status_created_at_idx
  on public.rental_listings (status, created_at desc);

alter table public.rental_listings enable row level security;

create policy "Guests can read available rental listings"
  on public.rental_listings for select to anon
  using (status = 'available');

create policy "Users can read available or own rental listings"
  on public.rental_listings for select to authenticated
  using (status = 'available' or seller_id = auth.uid());

create policy "Users can insert own rental listings"
  on public.rental_listings for insert to authenticated
  with check (seller_id = auth.uid());

create policy "Users can update own rental listings"
  on public.rental_listings for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "Users can delete own rental listings"
  on public.rental_listings for delete to authenticated
  using (seller_id = auth.uid());

grant select on public.rental_listings to anon, authenticated;
grant insert, update, delete on public.rental_listings to authenticated;
grant all on public.rental_listings to service_role;

create trigger rental_listings_set_updated_at
  before update on public.rental_listings
  for each row execute function public.set_updated_at();

-- ===== RENTAL IMAGES (1-5) =====
create table public.rental_images (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rental_listings(id) on delete cascade,
  storage_path text not null,
  sort_index integer not null check (sort_index >= 0 and sort_index <= 4),
  created_at timestamptz not null default now()
);

create unique index if not exists rental_images_rental_sort_idx
  on public.rental_images (rental_id, sort_index);

alter table public.rental_images enable row level security;

create policy "Guests can read images for available rentals"
  on public.rental_images for select to anon
  using (
    exists (
      select 1 from public.rental_listings rl
      where rl.id = rental_id
        and rl.status = 'available'
    )
  );

create policy "Users can read images for available or own rentals"
  on public.rental_images for select to authenticated
  using (
    exists (
      select 1 from public.rental_listings rl
      where rl.id = rental_id
        and (rl.status = 'available' or rl.seller_id = auth.uid())
    )
  );

create policy "Users can insert images for their own rentals"
  on public.rental_images for insert to authenticated
  with check (
    exists (
      select 1 from public.rental_listings rl
      where rl.id = rental_id
        and rl.seller_id = auth.uid()
    )
  );

create policy "Users can delete images for their own rentals"
  on public.rental_images for delete to authenticated
  using (
    exists (
      select 1 from public.rental_listings rl
      where rl.id = rental_id
        and rl.seller_id = auth.uid()
    )
  );

grant select on public.rental_images to anon, authenticated;
grant insert, delete on public.rental_images to authenticated;
grant all on public.rental_images to service_role;

-- ===== RENTAL REQUESTS =====
create table public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rental_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status public.rental_request_status not null default 'pending',
  message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rental_id, buyer_id)
);

alter table public.rental_requests enable row level security;

create policy "Buyer or seller can read related rental requests"
  on public.rental_requests for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyer can create rental requests"
  on public.rental_requests for insert to authenticated
  with check (buyer_id = auth.uid());

create policy "Buyer or seller can update related rental requests"
  on public.rental_requests for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

grant select, insert, update on public.rental_requests to authenticated;
grant all on public.rental_requests to service_role;

create trigger rental_requests_set_updated_at
  before update on public.rental_requests
  for each row execute function public.set_updated_at();

-- ===== STORAGE BUCKET (rental-images) =====
insert into storage.buckets (id, name, public)
values ('rental-images', 'rental-images', false)
on conflict (id) do nothing;

-- Read permissions follow the same pattern as product-images.
create policy "Anon can read rental images for available rentals"
  on storage.objects for select to anon
  using (
    bucket_id = 'rental-images'
    and exists (
      select 1 from public.rental_listings rl
      where rl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and rl.status = 'available'
    )
  );

create policy "Authenticated can read rental images for available or own rentals"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'rental-images'
    and exists (
      select 1 from public.rental_listings rl
      where rl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and (rl.status = 'available' or rl.seller_id = auth.uid())
    )
  );

create policy "Seller can upload rental images for own rentals"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rental-images'
    and exists (
      select 1 from public.rental_listings rl
      where rl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and rl.seller_id = auth.uid()
    )
  );

create policy "Seller can delete rental images for own rentals"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'rental-images'
    and exists (
      select 1 from public.rental_listings rl
      where rl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and rl.seller_id = auth.uid()
    )
  );

