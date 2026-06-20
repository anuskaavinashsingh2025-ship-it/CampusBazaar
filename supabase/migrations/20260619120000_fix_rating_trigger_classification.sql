-- Fix seller_profiles trigger to correctly classify transaction types
-- PRODUCT → total_sold += 1
-- FOOD → total_sold += 1
-- NOTES_PURCHASE → total_sold += 1
-- RENTAL → total_rented_out += 1
-- NOTES_RENTAL → total_rented_out += 1

-- Add a column to track which conversations have already been counted
-- This prevents double counting when multiple reviews are submitted for the same conversation
alter table public.seller_profiles 
add column if not exists counted_conversations uuid[] default '{}';

-- Drop the old trigger
drop trigger if exists conversation_ratings_after_insert on public.conversation_ratings;

-- Replace the function with correct classification logic
create or replace function public.on_conversation_rating_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_context_type public.chat_context_type;
  v_new_avg numeric;
  v_new_count integer;
  v_counted_conversations uuid[];
begin
  -- Get seller_id and context_type from the conversation
  select seller_id, context_type into v_seller_id, v_context_type
  from public.conversations where id = new.conversation_id;
  
  -- Check if this conversation has already been counted for this seller
  select counted_conversations into v_counted_conversations
  from public.seller_profiles 
  where user_id = v_seller_id;
  
  -- Only increment counters if this conversation hasn't been counted yet
  if not (v_counted_conversations @> array[new.conversation_id]) then
    -- Increment the appropriate counter based on context_type
    if v_context_type = 'product' or v_context_type = 'food' then
      update public.seller_profiles
      set
        total_sold = total_sold + 1,
        counted_conversations = array_append(counted_conversations, new.conversation_id)
      where user_id = v_seller_id;
    elsif v_context_type = 'rental' then
      update public.seller_profiles
      set
        total_rented_out = total_rented_out + 1,
        counted_conversations = array_append(counted_conversations, new.conversation_id)
      where user_id = v_seller_id;
    elsif v_context_type = 'notes' then
      -- For notes, we need to determine if it's a purchase or rental
      -- This information is stored in the notes_listings table
      declare
        v_listing_type text;
      begin
        select listing_type into v_listing_type
        from public.notes_listings
        where id = (
          select context_id from public.conversations where id = new.conversation_id
        );
        
        if v_listing_type = 'sell' then
          -- Notes purchase counts as sold
          update public.seller_profiles
          set
            total_sold = total_sold + 1,
            counted_conversations = array_append(counted_conversations, new.conversation_id)
          where user_id = v_seller_id;
        elsif v_listing_type = 'rent' then
          -- Notes rental counts as rented out
          update public.seller_profiles
          set
            total_rented_out = total_rented_out + 1,
            counted_conversations = array_append(counted_conversations, new.conversation_id)
          where user_id = v_seller_id;
        end if;
      end;
    end if;
  end if;
  
  -- Always update rating_avg and rating_count
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
    rating_count = coalesce(v_new_count, 0)
  where user_id = v_seller_id;

  return new;
end;
$$;

-- Recreate the trigger
create trigger conversation_ratings_after_insert
  after insert on public.conversation_ratings
  for each row execute function public.on_conversation_rating_insert();
