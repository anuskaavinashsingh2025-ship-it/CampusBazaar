-- Fix notification insert RLS policy
-- The original policy was correct, but we need to ensure it's properly applied
-- This policy allows any authenticated user to insert notifications for any user_id
-- which is necessary for the transaction notification system where buyers create
-- notifications for sellers and vice versa

drop policy if exists "Authenticated can insert notifications for any user" on public.notifications;

create policy "Authenticated can insert notifications for any user"
  on public.notifications for insert to authenticated
  with check (true);
