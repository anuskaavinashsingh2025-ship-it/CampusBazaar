-- ===== Admin + Food Hub Foundation =====

create type public.report_target_type as enum ('product', 'seller');
create type public.report_status as enum ('pending', 'resolved', 'dismissed');
create type public.admin_action_type as enum ('suspend_user', 'ban_user', 'remove_product');

-- ===== REPORTS =====
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type public.report_target_type not null,

  product_id uuid null references public.product_listings(id) on delete cascade,
  seller_user_id uuid null references auth.users(id) on delete cascade,

  reason text not null,
  details text null,
  status public.report_status not null default 'pending',

  resolved_by uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (target_type = 'product' and product_id is not null and seller_user_id is null) or
    (target_type = 'seller' and seller_user_id is not null and product_id is null)
  )
);

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);

alter table public.reports enable row level security;

create policy "Users can create reports"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "Users can read own reports"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

create policy "Admins can read all reports"
  on public.reports for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update reports"
  on public.reports for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ===== SUSPICIOUS FLAGS =====
create table public.suspicious_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flag_type text not null,
  score integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suspicious_flags_resolved_created_at_idx
  on public.suspicious_flags (resolved, created_at desc);

alter table public.suspicious_flags enable row level security;

create policy "Admins can manage suspicious flags"
  on public.suspicious_flags for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant all on public.suspicious_flags to authenticated, service_role;

create trigger suspicious_flags_set_updated_at
  before update on public.suspicious_flags
  for each row execute function public.set_updated_at();

-- ===== ADMIN ACTION LOG =====
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  action_type public.admin_action_type not null,
  target_user_id uuid null references auth.users(id) on delete set null,
  product_id uuid null references public.product_listings(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

create policy "Admins can insert admin actions"
  on public.admin_actions for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') and admin_user_id = auth.uid());

create policy "Admins can read admin actions"
  on public.admin_actions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert on public.admin_actions to authenticated;
grant all on public.admin_actions to service_role;

-- ===== FOOD HUB =====
create type public.food_listing_status as enum ('available', 'hidden', 'expired', 'sold');
create type public.food_request_status as enum ('open', 'fulfilled', 'expired', 'closed');

create table public.food_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,

  product_name text not null,
  brand_name text not null,
  category text not null,
  quantity text not null,
  price numeric(12, 2) not null check (price >= 0),
  description text not null,

  expiry_date date not null,
  status public.food_listing_status not null default 'available',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_listings_status_created_at_idx
  on public.food_listings (status, created_at desc);

alter table public.food_listings enable row level security;

create policy "Guests can read available and non-expired food listings"
  on public.food_listings for select to anon
  using (status = 'available' and expiry_date >= current_date);

create policy "Users can read available/non-expired or own food listings"
  on public.food_listings for select to authenticated
  using ((status = 'available' and expiry_date >= current_date) or seller_id = auth.uid());

create policy "Users can insert own food listings"
  on public.food_listings for insert to authenticated
  with check (seller_id = auth.uid());

create policy "Users can update own food listings"
  on public.food_listings for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "Users can delete own food listings"
  on public.food_listings for delete to authenticated
  using (seller_id = auth.uid());

grant select on public.food_listings to anon, authenticated;
grant insert, update, delete on public.food_listings to authenticated;
grant all on public.food_listings to service_role;

create trigger food_listings_set_updated_at
  before update on public.food_listings
  for each row execute function public.set_updated_at();

create table public.food_images (
  id uuid primary key default gen_random_uuid(),
  food_listing_id uuid not null references public.food_listings(id) on delete cascade,
  storage_path text not null,
  sort_index integer not null check (sort_index >= 0 and sort_index <= 4),
  created_at timestamptz not null default now()
);

create unique index if not exists food_images_listing_sort_idx
  on public.food_images (food_listing_id, sort_index);

alter table public.food_images enable row level security;

create policy "Guests can read images for available and non-expired food listings"
  on public.food_images for select to anon
  using (
    exists (
      select 1 from public.food_listings fl
      where fl.id = food_listing_id
        and fl.status = 'available'
        and fl.expiry_date >= current_date
    )
  );

create policy "Users can read images for available/non-expired or own food listings"
  on public.food_images for select to authenticated
  using (
    exists (
      select 1 from public.food_listings fl
      where fl.id = food_listing_id
        and ((fl.status = 'available' and fl.expiry_date >= current_date) or fl.seller_id = auth.uid())
    )
  );

create policy "Users can insert images for own food listings"
  on public.food_images for insert to authenticated
  with check (
    exists (
      select 1 from public.food_listings fl
      where fl.id = food_listing_id
        and fl.seller_id = auth.uid()
    )
  );

create policy "Users can delete images for own food listings"
  on public.food_images for delete to authenticated
  using (
    exists (
      select 1 from public.food_listings fl
      where fl.id = food_listing_id
        and fl.seller_id = auth.uid()
    )
  );

grant select on public.food_images to anon, authenticated;
grant insert, delete on public.food_images to authenticated;
grant all on public.food_images to service_role;

create table public.food_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  category text not null,
  quantity_needed text not null,
  description text not null,
  urgency_level text not null default 'normal',
  status public.food_request_status not null default 'open',
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_requests_status_created_at_idx
  on public.food_requests (status, created_at desc);

alter table public.food_requests enable row level security;

create policy "Guests can read open food requests"
  on public.food_requests for select to anon
  using (status = 'open');

create policy "Users can read open or own food requests"
  on public.food_requests for select to authenticated
  using (status = 'open' or requester_id = auth.uid());

create policy "Users can create food requests"
  on public.food_requests for insert to authenticated
  with check (requester_id = auth.uid());

create policy "Users can update own food requests"
  on public.food_requests for update to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

grant select on public.food_requests to anon, authenticated;
grant insert, update on public.food_requests to authenticated;
grant all on public.food_requests to service_role;

create trigger food_requests_set_updated_at
  before update on public.food_requests
  for each row execute function public.set_updated_at();

-- ===== FOOD IMAGES STORAGE BUCKET =====
insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', false)
on conflict (id) do nothing;

create policy "Anon can read food images for available and non-expired listings"
  on storage.objects for select to anon
  using (
    bucket_id = 'food-images'
    and exists (
      select 1 from public.food_listings fl
      where fl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and fl.status = 'available'
      and fl.expiry_date >= current_date
    )
  );

create policy "Authenticated can read food images for available/non-expired or own listings"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'food-images'
    and exists (
      select 1 from public.food_listings fl
      where fl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and ((fl.status = 'available' and fl.expiry_date >= current_date) or fl.seller_id = auth.uid())
    )
  );

create policy "Seller can upload food images for own listings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'food-images'
    and exists (
      select 1 from public.food_listings fl
      where fl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and fl.seller_id = auth.uid()
    )
  );

create policy "Seller can delete food images for own listings"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'food-images'
    and exists (
      select 1 from public.food_listings fl
      where fl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and fl.seller_id = auth.uid()
    )
  );

