-- Make listing image buckets public so getPublicUrl works in <img> tags
update storage.buckets
set public = true
where id in ('product-images', 'rental-images', 'food-images', 'notes-assets');

-- ===== NOTIFICATIONS =====
create type public.notification_priority as enum ('critical', 'important', 'informational');

create type public.notification_module as enum (
  'marketplace',
  'rentals',
  'notes',
  'food',
  'chats',
  'requests',
  'system'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  priority public.notification_priority not null default 'informational',
  module public.notification_module not null,
  read boolean not null default false,
  action_url text null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read)
  where read = false;

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Authenticated can insert notifications for any user"
  on public.notifications for insert to authenticated
  with check (true);

grant select, update, insert on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ===== NOTIFICATION PREFERENCES =====
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketplace boolean not null default true,
  rentals boolean not null default true,
  notes boolean not null default true,
  food boolean not null default true,
  chats boolean not null default true,
  requests boolean not null default true,
  system boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  desktop_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "Users can read own notification preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

create policy "Users can upsert own notification preferences"
  on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own notification preferences"
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
