-- ============================================================
-- ENFORCE ACTIVE BANS
-- ============================================================
-- Ban metadata is stored on public.profiles:
--   banned_at, banned_until, banned_by, ban_reason, status
--
-- A ban is active when:
--   - status = 'banned' OR banned_at is present, and
--   - banned_until is null (permanent) OR still in the future.
--
-- This migration makes that rule enforceable at database write/upload/RPC
-- boundaries. Client checks are only UX; these policies are the guardrail.
-- ============================================================

create or replace function public.is_user_currently_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and (p.status = 'banned' or p.banned_at is not null)
      and (p.banned_until is null or p.banned_until > now())
  );
$$;

grant execute on function public.is_user_currently_banned(uuid) to authenticated;

-- Keep expired temporary bans from continuing to look banned.
update public.profiles
set
  status = 'active',
  banned_at = null,
  banned_until = null,
  ban_reason = null,
  banned_by = null
where (status = 'banned' or banned_at is not null)
  and banned_until is not null
  and banned_until <= now();

-- ===== Seller profile writes =====
drop policy if exists "Users can create own seller profile" on public.seller_profiles;
create policy "Users can create own seller profile"
  on public.seller_profiles for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can update own seller profile" on public.seller_profiles;
create policy "Users can update own seller profile"
  on public.seller_profiles for update to authenticated
  using (
    auth.uid() = user_id
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    auth.uid() = user_id
    and not public.is_user_currently_banned(auth.uid())
  );

-- ===== Product listings, image rows, and storage uploads =====
drop policy if exists "Users can insert own product listings" on public.product_listings;
create policy "Users can insert own product listings"
  on public.product_listings for insert to authenticated
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can update own product listings" on public.product_listings;
create policy "Users can update own product listings"
  on public.product_listings for update to authenticated
  using (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can insert images for their own listings" on public.product_images;
create policy "Users can insert images for their own listings"
  on public.product_images for insert to authenticated
  with check (
    not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.product_listings pl
      where pl.id = product_id
        and pl.seller_id = auth.uid()
    )
  );

drop policy if exists "Seller can upload product images for their own products" on storage.objects;
create policy "Seller can upload product images for their own products"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.product_listings pl
      where pl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and pl.seller_id = auth.uid()
    )
  );

-- ===== Rental listings, image rows, requests, and storage uploads =====
drop policy if exists "Users can insert own rental listings" on public.rental_listings;
create policy "Users can insert own rental listings"
  on public.rental_listings for insert to authenticated
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can update own rental listings" on public.rental_listings;
create policy "Users can update own rental listings"
  on public.rental_listings for update to authenticated
  using (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can insert images for their own rentals" on public.rental_images;
create policy "Users can insert images for their own rentals"
  on public.rental_images for insert to authenticated
  with check (
    not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.rental_listings rl
      where rl.id = rental_id
        and rl.seller_id = auth.uid()
    )
  );

drop policy if exists "Buyer can create rental requests" on public.rental_requests;
create policy "Buyer can create rental requests"
  on public.rental_requests for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Buyer or seller can update related rental requests" on public.rental_requests;
create policy "Buyer or seller can update related rental requests"
  on public.rental_requests for update to authenticated
  using (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Seller can upload rental images for own rentals" on storage.objects;
create policy "Seller can upload rental images for own rentals"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rental-images'
    and not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.rental_listings rl
      where rl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and rl.seller_id = auth.uid()
    )
  );

-- ===== Food listings, request/order rows, image rows, and storage uploads =====
drop policy if exists "Users can insert own food listings" on public.food_listings;
create policy "Users can insert own food listings"
  on public.food_listings for insert to authenticated
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can update own food listings" on public.food_listings;
create policy "Users can update own food listings"
  on public.food_listings for update to authenticated
  using (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can insert images for own food listings" on public.food_images;
create policy "Users can insert images for own food listings"
  on public.food_images for insert to authenticated
  with check (
    not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.food_listings fl
      where fl.id = food_listing_id
        and fl.seller_id = auth.uid()
    )
  );

drop policy if exists "Users can create food requests" on public.food_requests;
create policy "Users can create food requests"
  on public.food_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can update own food requests" on public.food_requests;
create policy "Users can update own food requests"
  on public.food_requests for update to authenticated
  using (
    requester_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    requester_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Buyer can create food orders" on public.food_orders;
create policy "Buyer can create food orders"
  on public.food_orders for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Buyer or seller can update food orders" on public.food_orders;
create policy "Buyer or seller can update food orders"
  on public.food_orders for update to authenticated
  using (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Seller can upload food images for own listings" on storage.objects;
create policy "Seller can upload food images for own listings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'food-images'
    and not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.food_listings fl
      where fl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and fl.seller_id = auth.uid()
    )
  );

-- ===== Notes listings, requests/purchases, asset rows, and storage uploads =====
drop policy if exists "Users can insert own notes listings" on public.notes_listings;
create policy "Users can insert own notes listings"
  on public.notes_listings for insert to authenticated
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can update own notes listings" on public.notes_listings;
create policy "Users can update own notes listings"
  on public.notes_listings for update to authenticated
  using (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    seller_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can insert assets for own notes listings" on public.notes_assets;
create policy "Users can insert assets for own notes listings"
  on public.notes_assets for insert to authenticated
  with check (
    not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.notes_listings nl
      where nl.id = listing_id
        and nl.seller_id = auth.uid()
    )
  );

drop policy if exists "Users can create notes requests" on public.notes_requests;
create policy "Users can create notes requests"
  on public.notes_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can update own notes requests" on public.notes_requests;
create policy "Users can update own notes requests"
  on public.notes_requests for update to authenticated
  using (
    requester_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    requester_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Buyer can create notes purchase requests" on public.notes_purchase_requests;
create policy "Buyer can create notes purchase requests"
  on public.notes_purchase_requests for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Buyer or seller can update notes purchase requests" on public.notes_purchase_requests;
create policy "Buyer or seller can update notes purchase requests"
  on public.notes_purchase_requests for update to authenticated
  using (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Seller can upload notes assets for own listings" on storage.objects;
create policy "Seller can upload notes assets for own listings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'notes-assets'
    and not public.is_user_currently_banned(auth.uid())
    and exists (
      select 1 from public.notes_listings nl
      where nl.id = (
        case
          when split_part(name, '/', 1) ~* '^[0-9a-fA-F\-]{36}$'
          then (split_part(name, '/', 1))::uuid
          else null
        end
      )
      and nl.seller_id = auth.uid()
    )
  );

-- ===== Product purchase requests =====
drop policy if exists "Buyer can create product requests" on public.product_requests;
create policy "Buyer can create product requests"
  on public.product_requests for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Buyer or seller can update product requests" on public.product_requests;
create policy "Buyer or seller can update product requests"
  on public.product_requests for update to authenticated
  using (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and not public.is_user_currently_banned(auth.uid())
  );

-- ===== Reports and report evidence =====
drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
  on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Reporters can attach evidence to own reports" on public.reports;
create policy "Reporters can attach evidence to own reports"
  on public.reports for update to authenticated
  using (
    reporter_id = auth.uid()
    and status = 'pending'
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Authenticated can upload report evidence" on storage.objects;
create policy "Authenticated can upload report evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-evidence'
    and auth.uid() is not null
    and not public.is_user_currently_banned(auth.uid())
  );

-- ===== Feedback and screenshots =====
drop policy if exists "Users can insert feedback" on public.feedback;
create policy "Users can insert feedback"
  on public.feedback for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Users can upload feedback screenshots" on storage.objects;
create policy "Users can upload feedback screenshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feedback-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not public.is_user_currently_banned(auth.uid())
  );

-- ===== Chat, chat reports, ratings, and chat images =====
drop policy if exists "Authenticated can insert conversations via RPC" on public.conversations;
create policy "Authenticated can insert conversations via RPC"
  on public.conversations for insert to authenticated
  with check (
    auth.uid() in (buyer_id, seller_id)
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Participants can update own conversations" on public.conversations;
create policy "Participants can update own conversations"
  on public.conversations for update to authenticated
  using (
    auth.uid() in (buyer_id, seller_id)
    and not public.is_user_currently_banned(auth.uid())
  )
  with check (
    auth.uid() in (buyer_id, seller_id)
    and not public.is_user_currently_banned(auth.uid())
  );

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.status in ('active', 'reported')
    )
  );

drop policy if exists "Participants can file chat reports" on public.chat_reports;
create policy "Participants can file chat reports"
  on public.chat_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
    and public.is_conversation_participant(conversation_id)
  );

drop policy if exists "Participants can submit ratings" on public.conversation_ratings;
create policy "Participants can submit ratings"
  on public.conversation_ratings for insert to authenticated
  with check (
    rater_id = auth.uid()
    and not public.is_user_currently_banned(auth.uid())
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.status = 'completed'
    )
  );

drop policy if exists "Chat participants can upload images" on storage.objects;
create policy "Chat participants can upload images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_user_currently_banned(auth.uid())
  );

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

  if auth.uid() is null or auth.uid() not in (p_buyer_id, p_seller_id) then
    raise exception 'Not authorized to create this conversation';
  end if;

  if public.is_user_currently_banned(auth.uid()) then
    raise exception 'Your account is banned.';
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
