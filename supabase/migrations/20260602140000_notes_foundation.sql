-- ===== Notes Hub Foundation =====

create type public.notes_listing_type as enum ('sell', 'rent');
create type public.notes_status as enum ('available', 'rented_out', 'unavailable', 'hidden');
create type public.notes_request_status as enum ('open', 'fulfilled', 'expired', 'closed');

-- ===== NOTES LISTINGS (Sell/Rent) =====
create table public.notes_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,

  listing_type public.notes_listing_type not null,

  title text not null,
  description text not null,
  category text not null,

  -- Optional academic metadata (filters later)
  subject text null,
  faculty text null,
  semester text null,
  branch text null,

  -- Rent-specific fields
  daily_rental_price numeric(12, 2) null check (daily_rental_price >= 0),
  rental_duration_days integer null check (rental_duration_days >= 1),
  condition text null check (condition in ('New', 'Like New', 'Good', 'Fair', 'Used')),

  -- Physical/Digital + free/paid
  is_digital boolean not null default true,
  is_free boolean not null default false,

  status public.notes_status not null default 'available',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_listings_type_status_created_at_idx
  on public.notes_listings (listing_type, status, created_at desc);

alter table public.notes_listings enable row level security;

create policy "Guests can read available notes listings"
  on public.notes_listings for select to anon
  using (status = 'available');

create policy "Users can read available or own notes listings"
  on public.notes_listings for select to authenticated
  using (status = 'available' or seller_id = auth.uid());

create policy "Users can insert own notes listings"
  on public.notes_listings for insert to authenticated
  with check (seller_id = auth.uid());

create policy "Users can update own notes listings"
  on public.notes_listings for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "Users can delete own notes listings"
  on public.notes_listings for delete to authenticated
  using (seller_id = auth.uid());

grant select on public.notes_listings to anon, authenticated;
grant insert, update, delete on public.notes_listings to authenticated;
grant all on public.notes_listings to service_role;

create trigger notes_listings_set_updated_at
  before update on public.notes_listings
  for each row execute function public.set_updated_at();

-- ===== NOTES ASSETS =====
-- PDFs and images are stored in Storage; we keep metadata here.
create table public.notes_assets (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.notes_listings(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'image')),
  storage_path text not null,
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists notes_assets_listing_idx
  on public.notes_assets (listing_id, sort_index);

alter table public.notes_assets enable row level security;

create policy "Guests can read assets for available notes listings"
  on public.notes_assets for select to anon
  using (
    exists (
      select 1 from public.notes_listings nl
      where nl.id = listing_id
        and nl.status = 'available'
    )
  );

create policy "Users can read assets for available or own notes listings"
  on public.notes_assets for select to authenticated
  using (
    exists (
      select 1 from public.notes_listings nl
      where nl.id = listing_id
        and (nl.status = 'available' or nl.seller_id = auth.uid())
    )
  );

create policy "Users can insert assets for own notes listings"
  on public.notes_assets for insert to authenticated
  with check (
    exists (
      select 1 from public.notes_listings nl
      where nl.id = listing_id
        and nl.seller_id = auth.uid()
    )
  );

create policy "Users can delete assets for own notes listings"
  on public.notes_assets for delete to authenticated
  using (
    exists (
      select 1 from public.notes_listings nl
      where nl.id = listing_id
        and nl.seller_id = auth.uid()
    )
  );

grant select on public.notes_assets to anon, authenticated;
grant insert, delete on public.notes_assets to authenticated;
grant all on public.notes_assets to service_role;

-- ===== NOTES REQUESTS =====
create table public.notes_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,

  subject text not null,
  request_type text not null,
  description text not null,
  urgency_level text not null default 'normal',
  semester text null,
  branch text null,

  status public.notes_request_status not null default 'open',
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_requests_status_created_at_idx
  on public.notes_requests (status, created_at desc);

alter table public.notes_requests enable row level security;

create policy "Guests can read open notes requests"
  on public.notes_requests for select to anon
  using (status = 'open');

create policy "Users can read open or own notes requests"
  on public.notes_requests for select to authenticated
  using (status = 'open' or requester_id = auth.uid());

create policy "Users can create notes requests"
  on public.notes_requests for insert to authenticated
  with check (requester_id = auth.uid());

create policy "Users can update own notes requests"
  on public.notes_requests for update to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

grant select on public.notes_requests to anon, authenticated;
grant insert, update on public.notes_requests to authenticated;
grant all on public.notes_requests to service_role;

create trigger notes_requests_set_updated_at
  before update on public.notes_requests
  for each row execute function public.set_updated_at();

-- ===== STORAGE BUCKETS =====
insert into storage.buckets (id, name, public)
values ('notes-assets', 'notes-assets', false)
on conflict (id) do nothing;

-- Storage RLS mirrors product/rental patterns. Uses first path segment as listing_id.
create policy "Anon can read notes assets for available listings"
  on storage.objects for select to anon
  using (
    bucket_id = 'notes-assets'
    and exists (
      select 1 from public.notes_listings nl
      where nl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and nl.status = 'available'
    )
  );

create policy "Authenticated can read notes assets for available or own listings"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'notes-assets'
    and exists (
      select 1 from public.notes_listings nl
      where nl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and (nl.status = 'available' or nl.seller_id = auth.uid())
    )
  );

create policy "Seller can upload notes assets for own listings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'notes-assets'
    and exists (
      select 1 from public.notes_listings nl
      where nl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and nl.seller_id = auth.uid()
    )
  );

create policy "Seller can delete notes assets for own listings"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'notes-assets'
    and exists (
      select 1 from public.notes_listings nl
      where nl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and nl.seller_id = auth.uid()
    )
  );

