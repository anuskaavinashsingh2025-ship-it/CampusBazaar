-- CampusBazar Chat & Communication System
-- Request-gated conversations between buyers and sellers only.

-- ===== ENUMS =====
create type public.chat_context_type as enum ('product', 'rental', 'food', 'notes');
create type public.conversation_status as enum ('active', 'archived', 'reported', 'completed');
create type public.message_type as enum ('text', 'image');
create type public.message_delivery_status as enum ('sent', 'delivered', 'read');
create type public.chat_report_target as enum ('user', 'conversation', 'listing');
create type public.chat_report_reason as enum (
  'spam',
  'abuse',
  'harassment',
  'scam',
  'fake_listing',
  'inappropriate',
  'other'
);

-- ===== CONVERSATIONS =====
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  context_type public.chat_context_type not null,
  context_id uuid not null,
  request_id uuid null,
  listing_title text not null,
  status public.conversation_status not null default 'active',
  is_reported boolean not null default false,
  last_message_at timestamptz null,
  last_message_preview text null,
  last_message_sender_id uuid null references auth.users(id) on delete set null,
  buyer_unread_count integer not null default 0,
  seller_unread_count integer not null default 0,
  completed_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_buyer_seller_distinct check (buyer_id <> seller_id),
  constraint conversations_unique_listing_buyer unique (buyer_id, context_type, context_id)
);

create index conversations_participants_idx
  on public.conversations (buyer_id, seller_id, last_message_at desc nulls last);

create index conversations_seller_idx
  on public.conversations (seller_id, last_message_at desc nulls last);

create index conversations_status_idx
  on public.conversations (status, last_message_at desc nulls last);

-- ===== MESSAGES =====
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message_type public.message_type not null default 'text',
  content text not null,
  delivery_status public.message_delivery_status not null default 'sent',
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

-- ===== USER PRESENCE (online / typing) =====
create table public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  typing_conversation_id uuid null references public.conversations(id) on delete set null,
  typing_updated_at timestamptz null,
  updated_at timestamptz not null default now()
);

-- ===== CHAT REPORTS =====
create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  report_target public.chat_report_target not null,
  reported_user_id uuid null references auth.users(id) on delete set null,
  reason public.chat_report_reason not null,
  details text null,
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index chat_reports_conversation_idx
  on public.chat_reports (conversation_id, created_at desc);

create index chat_reports_pending_idx
  on public.chat_reports (status, created_at desc)
  where status = 'pending';

-- ===== ADMIN ACCESS AUDIT LOG =====
create table public.chat_admin_access_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ===== POST-TRANSACTION RATINGS =====
create table public.conversation_ratings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text null,
  created_at timestamptz not null default now(),
  unique (conversation_id, rater_id)
);

-- ===== TRIGGERS =====
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create trigger user_presence_set_updated_at
  before update on public.user_presence
  for each row execute function public.set_updated_at();

-- Update conversation metadata when a message is sent
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_preview text;
begin
  select buyer_id, seller_id into v_buyer_id, v_seller_id
  from public.conversations where id = new.conversation_id;

  if new.message_type = 'image' then
    v_preview := '📷 Image';
  else
    v_preview := left(new.content, 120);
  end if;

  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_preview = v_preview,
    last_message_sender_id = new.sender_id,
    buyer_unread_count = case
      when new.sender_id = v_seller_id then buyer_unread_count + 1
      else buyer_unread_count
    end,
    seller_unread_count = case
      when new.sender_id = v_buyer_id then seller_unread_count + 1
      else seller_unread_count
    end,
    updated_at = now()
  where id = new.conversation_id;

  -- Mark as delivered immediately for recipient visibility
  new.delivery_status := 'delivered';

  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.on_message_insert();

-- Update seller reputation when a rating is submitted
create or replace function public.on_conversation_rating_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_new_avg numeric;
  v_new_count integer;
begin
  select seller_id into v_seller_id
  from public.conversations where id = new.conversation_id;

  select
    round(avg(cr.rating)::numeric, 2),
    count(*)::integer
  into v_new_avg, v_new_count
  from public.conversation_ratings cr
  join public.conversations c on c.id = cr.conversation_id
  where c.seller_id = v_seller_id;

  update public.seller_profiles
  set
    rating_avg = coalesce(v_new_avg, 0),
    rating_count = coalesce(v_new_count, 0),
    total_sold = total_sold + 1
  where user_id = v_seller_id;

  return new;
end;
$$;

create trigger conversation_ratings_after_insert
  after insert on public.conversation_ratings
  for each row execute function public.on_conversation_rating_insert();

-- ===== RPC: get or create conversation =====
create or replace function public.get_or_create_conversation(
  p_buyer_id uuid,
  p_seller_id uuid,
  p_context_type public.chat_context_type,
  p_context_id uuid,
  p_request_id uuid,
  p_listing_title text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_buyer_id = p_seller_id then
    raise exception 'Cannot create conversation with yourself';
  end if;

  if auth.uid() is not null and auth.uid() not in (p_buyer_id, p_seller_id) then
    raise exception 'Not authorized to create this conversation';
  end if;

  select id into v_id
  from public.conversations
  where buyer_id = p_buyer_id
    and context_type = p_context_type
    and context_id = p_context_id;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversations (
    buyer_id, seller_id, context_type, context_id, request_id, listing_title
  ) values (
    p_buyer_id, p_seller_id, p_context_type, p_context_id, p_request_id, p_listing_title
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_or_create_conversation(
  uuid, uuid, public.chat_context_type, uuid, uuid, text
) to authenticated;

-- ===== RPC: mark conversation read =====
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
begin
  select buyer_id, seller_id into v_buyer_id, v_seller_id
  from public.conversations where id = p_conversation_id;

  if auth.uid() is null or auth.uid() not in (v_buyer_id, v_seller_id) then
    raise exception 'Not authorized';
  end if;

  update public.messages
  set delivery_status = 'read', read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and delivery_status <> 'read';

  if auth.uid() = v_buyer_id then
    update public.conversations set buyer_unread_count = 0 where id = p_conversation_id;
  else
    update public.conversations set seller_unread_count = 0 where id = p_conversation_id;
  end if;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ===== RPC: admin access with audit log =====
create or replace function public.admin_access_conversation(
  p_conversation_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_reported boolean;
  v_has_pending_report boolean;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;

  select is_reported into v_is_reported
  from public.conversations where id = p_conversation_id;

  select exists (
    select 1 from public.chat_reports
    where conversation_id = p_conversation_id and status = 'pending'
  ) into v_has_pending_report;

  if not coalesce(v_is_reported, false) and not v_has_pending_report then
    raise exception 'Admin access only allowed for reported conversations';
  end if;

  insert into public.chat_admin_access_logs (conversation_id, admin_id, reason)
  values (p_conversation_id, auth.uid(), p_reason);
end;
$$;

grant execute on function public.admin_access_conversation(uuid, text) to authenticated;

-- ===== RLS HELPERS =====
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and auth.uid() in (c.buyer_id, c.seller_id)
  );
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;

create or replace function public.can_admin_read_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin')
    and exists (
      select 1 from public.conversations c
      where c.id = p_conversation_id
        and (c.is_reported = true or exists (
          select 1 from public.chat_reports cr
          where cr.conversation_id = c.id and cr.status = 'pending'
        ))
    );
$$;

grant execute on function public.can_admin_read_conversation(uuid) to authenticated;

-- ===== ROW LEVEL SECURITY =====
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_presence enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_admin_access_logs enable row level security;
alter table public.conversation_ratings enable row level security;

-- Conversations: participants only; admins only for reported
create policy "Participants can read own conversations"
  on public.conversations for select to authenticated
  using (
    auth.uid() in (buyer_id, seller_id)
    or public.can_admin_read_conversation(id)
  );

create policy "Participants can update own conversations"
  on public.conversations for update to authenticated
  using (auth.uid() in (buyer_id, seller_id))
  with check (auth.uid() in (buyer_id, seller_id));

create policy "Authenticated can insert conversations via RPC"
  on public.conversations for insert to authenticated
  with check (auth.uid() in (buyer_id, seller_id));

-- Messages: participants only; admins for reported conversations
create policy "Participants can read messages"
  on public.messages for select to authenticated
  using (
    public.is_conversation_participant(conversation_id)
    or public.can_admin_read_conversation(conversation_id)
  );

create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.status in ('active', 'reported')
    )
  );

create policy "Participants can update message read status"
  on public.messages for update to authenticated
  using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));

-- Presence: all authenticated can read; users update own row
create policy "Authenticated can read presence"
  on public.user_presence for select to authenticated
  using (true);

create policy "Users can upsert own presence"
  on public.user_presence for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own presence"
  on public.user_presence for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Chat reports
create policy "Participants can file chat reports"
  on public.chat_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

create policy "Participants can read own chat reports"
  on public.chat_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or public.can_admin_read_conversation(conversation_id)
  );

create policy "Admins can update chat reports"
  on public.chat_reports for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Admin access logs
create policy "Admins can read access logs"
  on public.chat_admin_access_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can insert access logs via RPC"
  on public.chat_admin_access_logs for insert to authenticated
  with check (admin_id = auth.uid() and public.has_role(auth.uid(), 'admin'));

-- Ratings
create policy "Participants can read ratings"
  on public.conversation_ratings for select to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "Participants can submit ratings"
  on public.conversation_ratings for insert to authenticated
  with check (
    rater_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.status = 'completed'
    )
  );

-- ===== GRANTS =====
grant select, insert, update on public.conversations to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert, update on public.user_presence to authenticated;
grant select, insert, update on public.chat_reports to authenticated;
grant select, insert on public.chat_admin_access_logs to authenticated;
grant select, insert on public.conversation_ratings to authenticated;

grant all on public.conversations to service_role;
grant all on public.messages to service_role;
grant all on public.user_presence to service_role;
grant all on public.chat_reports to service_role;
grant all on public.chat_admin_access_logs to service_role;
grant all on public.conversation_ratings to service_role;

-- ===== STORAGE: chat images only (no executables/archives) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Chat participants can upload images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated can read chat images"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-images');

create policy "Users can delete own chat images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ===== REALTIME =====
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.user_presence;
