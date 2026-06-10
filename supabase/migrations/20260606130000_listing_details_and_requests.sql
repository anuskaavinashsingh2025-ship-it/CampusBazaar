-- Listing view/wishlist counts, purchase request tables, extended reports

-- ===== VIEW & WISHLIST COUNTERS =====
alter table public.product_listings
  add column if not exists views_count integer not null default 0,
  add column if not exists wishlist_count integer not null default 0;

alter table public.rental_listings
  add column if not exists views_count integer not null default 0,
  add column if not exists wishlist_count integer not null default 0;

alter table public.food_listings
  add column if not exists views_count integer not null default 0,
  add column if not exists wishlist_count integer not null default 0;

alter table public.notes_listings
  add column if not exists views_count integer not null default 0,
  add column if not exists wishlist_count integer not null default 0;

-- Sync wishlist_count when items are added/removed
create or replace function public.sync_listing_wishlist_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    case new.item_type
      when 'product' then
        update public.product_listings set wishlist_count = wishlist_count + 1 where id = new.item_id;
      when 'rental' then
        update public.rental_listings set wishlist_count = wishlist_count + 1 where id = new.item_id;
      when 'food' then
        update public.food_listings set wishlist_count = wishlist_count + 1 where id = new.item_id;
      when 'notes' then
        update public.notes_listings set wishlist_count = wishlist_count + 1 where id = new.item_id;
    end case;
    return new;
  elsif tg_op = 'DELETE' then
    case old.item_type
      when 'product' then
        update public.product_listings set wishlist_count = greatest(0, wishlist_count - 1) where id = old.item_id;
      when 'rental' then
        update public.rental_listings set wishlist_count = greatest(0, wishlist_count - 1) where id = old.item_id;
      when 'food' then
        update public.food_listings set wishlist_count = greatest(0, wishlist_count - 1) where id = old.item_id;
      when 'notes' then
        update public.notes_listings set wishlist_count = greatest(0, wishlist_count - 1) where id = old.item_id;
    end case;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists wishlist_items_sync_count on public.wishlist_items;
create trigger wishlist_items_sync_count
  after insert or delete on public.wishlist_items
  for each row execute function public.sync_listing_wishlist_count();

-- Backfill wishlist counts
update public.product_listings pl
set wishlist_count = (
  select count(*)::integer from public.wishlist_items w
  where w.item_type = 'product' and w.item_id = pl.id
);

update public.rental_listings rl
set wishlist_count = (
  select count(*)::integer from public.wishlist_items w
  where w.item_type = 'rental' and w.item_id = rl.id
);

update public.food_listings fl
set wishlist_count = (
  select count(*)::integer from public.wishlist_items w
  where w.item_type = 'food' and w.item_id = fl.id
);

update public.notes_listings nl
set wishlist_count = (
  select count(*)::integer from public.wishlist_items w
  where w.item_type = 'notes' and w.item_id = nl.id
);

-- Increment view counter (callable by guests and authenticated users)
create or replace function public.increment_listing_view(p_item_type text, p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  case p_item_type
    when 'product' then
      update public.product_listings set views_count = views_count + 1 where id = p_item_id;
    when 'rental' then
      update public.rental_listings set views_count = views_count + 1 where id = p_item_id;
    when 'food' then
      update public.food_listings set views_count = views_count + 1 where id = p_item_id;
    when 'notes' then
      update public.notes_listings set views_count = views_count + 1 where id = p_item_id;
    else
      raise exception 'Unknown item type: %', p_item_type;
  end case;
end;
$$;

grant execute on function public.increment_listing_view(text, uuid) to anon, authenticated;

-- ===== RENTAL REQUEST: add cancelled status =====
alter type public.rental_request_status add value if not exists 'cancelled';

-- ===== PRODUCT PURCHASE REQUESTS =====
create type public.product_request_status as enum (
  'pending',
  'accepted',
  'rejected',
  'completed',
  'cancelled'
);

create type public.product_request_type as enum ('buy', 'offer');

create table public.product_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  request_type public.product_request_type not null default 'buy',
  offered_price numeric(12,2) null check (offered_price is null or offered_price >= 0),
  message text null,
  status public.product_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, buyer_id)
);

create index if not exists product_requests_seller_status_idx
  on public.product_requests (seller_id, status, created_at desc);

create index if not exists product_requests_buyer_status_idx
  on public.product_requests (buyer_id, status, created_at desc);

alter table public.product_requests enable row level security;

create policy "Buyer or seller can read product requests"
  on public.product_requests for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyer can create product requests"
  on public.product_requests for insert to authenticated
  with check (buyer_id = auth.uid());

create policy "Buyer or seller can update product requests"
  on public.product_requests for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

grant select, insert, update on public.product_requests to authenticated;
grant all on public.product_requests to service_role;

create trigger product_requests_set_updated_at
  before update on public.product_requests
  for each row execute function public.set_updated_at();

-- ===== FOOD ORDERS =====
create type public.food_order_status as enum (
  'pending',
  'accepted',
  'rejected',
  'completed',
  'cancelled'
);

create table public.food_orders (
  id uuid primary key default gen_random_uuid(),
  food_listing_id uuid not null references public.food_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1),
  message text null,
  status public.food_order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (food_listing_id, buyer_id)
);

alter table public.food_orders enable row level security;

create policy "Buyer or seller can read food orders"
  on public.food_orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyer can create food orders"
  on public.food_orders for insert to authenticated
  with check (buyer_id = auth.uid());

create policy "Buyer or seller can update food orders"
  on public.food_orders for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

grant select, insert, update on public.food_orders to authenticated;
grant all on public.food_orders to service_role;

create trigger food_orders_set_updated_at
  before update on public.food_orders
  for each row execute function public.set_updated_at();

-- ===== NOTES PURCHASE REQUESTS =====
create type public.notes_purchase_status as enum (
  'pending',
  'accepted',
  'rejected',
  'completed',
  'cancelled'
);

create table public.notes_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  notes_listing_id uuid not null references public.notes_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  message text null,
  status public.notes_purchase_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notes_listing_id, buyer_id)
);

alter table public.notes_purchase_requests enable row level security;

create policy "Buyer or seller can read notes purchase requests"
  on public.notes_purchase_requests for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyer can create notes purchase requests"
  on public.notes_purchase_requests for insert to authenticated
  with check (buyer_id = auth.uid());

create policy "Buyer or seller can update notes purchase requests"
  on public.notes_purchase_requests for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

grant select, insert, update on public.notes_purchase_requests to authenticated;
grant all on public.notes_purchase_requests to service_role;

create trigger notes_purchase_requests_set_updated_at
  before update on public.notes_purchase_requests
  for each row execute function public.set_updated_at();

-- ===== EXTEND REPORTS =====
alter type public.report_target_type add value if not exists 'rental';
alter type public.report_target_type add value if not exists 'food';
alter type public.report_target_type add value if not exists 'notes';

alter table public.reports
  add column if not exists rental_id uuid null references public.rental_listings(id) on delete cascade,
  add column if not exists food_listing_id uuid null references public.food_listings(id) on delete cascade,
  add column if not exists notes_listing_id uuid null references public.notes_listings(id) on delete cascade;

alter table public.reports drop constraint if exists reports_check;
alter table public.reports add constraint reports_check check (
  (target_type = 'product' and product_id is not null and seller_user_id is null
    and rental_id is null and food_listing_id is null and notes_listing_id is null) or
  (target_type = 'seller' and seller_user_id is not null and product_id is null
    and rental_id is null and food_listing_id is null and notes_listing_id is null) or
  (target_type = 'rental' and rental_id is not null and product_id is null
    and seller_user_id is null and food_listing_id is null and notes_listing_id is null) or
  (target_type = 'food' and food_listing_id is not null and product_id is null
    and seller_user_id is null and rental_id is null and notes_listing_id is null) or
  (target_type = 'notes' and notes_listing_id is not null and product_id is null
    and seller_user_id is null and rental_id is null and food_listing_id is null)
);
