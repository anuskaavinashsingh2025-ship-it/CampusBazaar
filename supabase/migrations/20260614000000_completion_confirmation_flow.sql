-- Completion Confirmation Flow & Auto-Delete Completed Chats
-- This migration adds support for two-party completion confirmation
-- and automatic deletion of completed conversations after 5 days

-- ===== ADD COMPLETION STATUS FIELD =====
alter table public.conversations
add column completion_requested_by uuid null references auth.users(id) on delete set null,
add column completion_requested_at timestamptz null,
add column completion_confirmed_by uuid null references auth.users(id) on delete set null,
add column completion_confirmed_at timestamptz null,
add column archive_reason text null;

-- ===== UPDATE CONVERSATION STATUS ENUM =====
-- Note: We need to add 'completion_pending' to the enum
drop type if exists public.conversation_status cascade;
create type public.conversation_status as enum ('active', 'archived', 'reported', 'completed', 'auto_archived', 'completion_pending');

-- ===== UPDATE MESSAGE SENDING POLICY =====
-- Allow messaging during completion confirmation
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.status in ('active', 'reported', 'completion_pending')
    )
  );

-- ===== ADD INDEX FOR COMPLETION CLEANUP =====
create index conversations_completed_at_idx
  on public.conversations (completed_at)
  where completed_at is not null;

-- ===== FUNCTION: REQUEST COMPLETION =====
create or replace function public.request_conversation_completion(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_current_status public.conversation_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select buyer_id, seller_id, status into v_buyer_id, v_seller_id, v_current_status
  from public.conversations where id = p_conversation_id;

  if auth.uid() not in (v_buyer_id, v_seller_id) then
    raise exception 'Not authorized';
  end if;

  if v_current_status not in ('active', 'completion_pending') then
    raise exception 'Conversation must be active to request completion';
  end;

  -- If already in completion_pending state and the other user requested it
  if v_current_status = 'completion_pending' and completion_requested_by <> auth.uid() then
    -- Both parties have confirmed - complete the conversation
    update public.conversations
    set
      status = 'completed',
      completion_confirmed_by = auth.uid(),
      completion_confirmed_at = now(),
      completed_at = now(),
      updated_at = now()
    where id = p_conversation_id;
  else
    -- First completion request
    update public.conversations
    set
      status = 'completion_pending',
      completion_requested_by = auth.uid(),
      completion_requested_at = now(),
      updated_at = now()
    where id = p_conversation_id;
  end if;
end;
$$;

grant execute on function public.request_conversation_completion(uuid) to authenticated;

-- ===== FUNCTION: DECLINE COMPLETION =====
create or replace function public.decline_conversation_completion(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_seller_id;
  v_current_status public.conversation_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select buyer_id, seller_id, status into v_buyer_id, v_seller_id, v_current_status
  from public.conversations where id = p_conversation_id;

  if auth.uid() not in (v_buyer_id, v_seller_id) then
    raise exception 'Not authorized';
  end if;

  if v_current_status != 'completion_pending' then
    raise exception 'Conversation is not in completion pending state';
  end if;

  if completion_requested_by = auth.uid() then
    raise exception 'Cannot decline your own completion request';
  end if;

  -- Cancel completion request and return to active
  update public.conversations
  set
    status = 'active',
    completion_requested_by = null,
    completion_requested_at = null,
    updated_at = now()
  where id = p_conversation_id;
end;
$$;

grant execute on function public.decline_conversation_completion(uuid) to authenticated;

-- ===== FUNCTION: CLEANUP OLD COMPLETED CONVERSATIONS =====
create or replace function public.cleanup_completed_conversations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_ids uuid[];
begin
  -- Find conversations completed more than 5 days ago
  select array_agg(id) into v_conversation_ids
  from public.conversations
  where completed_at is not null
    and completed_at <= now() - interval '5 days';

  if v_conversation_ids is null or array_length(v_conversation_ids, 1) = 0 then
    return;
  end if;

  -- Delete in safe order to prevent orphaned records
  -- 1. Delete message attachments from storage (if any)
  -- 2. Delete messages (cascade will handle read status)
  -- 3. Delete conversation ratings
  -- 4. Delete chat reports
  -- 5. Delete admin access logs
  -- 6. Delete conversations

  delete from public.messages
  where conversation_id = any(v_conversation_ids);

  delete from public.conversation_ratings
  where conversation_id = any(v_conversation_ids);

  delete from public.chat_reports
  where conversation_id = any(v_conversation_ids);

  delete from public.chat_admin_access_logs
  where conversation_id = any(v_conversation_ids);

  delete from public.conversations
  where id = any(v_conversation_ids);
end;
$$;

grant execute on function public.cleanup_completed_conversations() to service_role;

-- ===== SCHEDULED CLEANUP (via pg_cron if available) =====
-- Note: This requires pg_cron extension to be enabled
-- Uncomment if pg_cron is available in your Supabase instance
/*
select cron.schedule(
  'cleanup-completed-conversations',
  '0 2 * * *', -- Run daily at 2 AM UTC
  'select public.cleanup_completed_conversations()'
);
*/
