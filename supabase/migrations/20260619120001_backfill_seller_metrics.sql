-- Backfill seller_profiles total_sold and total_rented_out from actual completed transactions
-- This one-time migration corrects historical counts that may be incorrect

-- First, reset the counters to 0
update public.seller_profiles
set
  total_sold = 0,
  total_rented_out = 0,
  counted_conversations = '{}';

-- Recalculate total_sold from actual completed product transactions
update public.seller_profiles sp
set total_sold = (
  select count(distinct c.id)
  from public.conversations c
  join public.product_requests pr on pr.conversation_id = c.id
  where c.seller_id = sp.user_id
    and pr.status = 'completed'
);

-- Recalculate total_sold from actual completed food transactions
update public.seller_profiles sp
set total_sold = total_sold + (
  select count(distinct c.id)
  from public.conversations c
  join public.food_orders fo on fo.conversation_id = c.id
  where c.seller_id = sp.user_id
    and fo.status = 'completed'
);

-- Recalculate total_sold from actual completed notes purchase transactions
update public.seller_profiles sp
set total_sold = total_sold + (
  select count(distinct c.id)
  from public.conversations c
  join public.notes_purchases np on np.conversation_id = c.id
  join public.notes_listings nl on nl.id = c.context_id
  where c.seller_id = sp.user_id
    and np.status = 'completed'
    and nl.listing_type = 'sell'
);

-- Recalculate total_rented_out from actual completed rental transactions
update public.seller_profiles sp
set total_rented_out = (
  select count(distinct c.id)
  from public.conversations c
  join public.rental_requests rr on rr.conversation_id = c.id
  where c.seller_id = sp.user_id
    and rr.status = 'completed'
);

-- Recalculate total_rented_out from actual completed notes rental transactions
update public.seller_profiles sp
set total_rented_out = total_rented_out + (
  select count(distinct c.id)
  from public.conversations c
  join public.notes_rentals nr on nr.conversation_id = c.id
  join public.notes_listings nl on nl.id = c.context_id
  where c.seller_id = sp.user_id
    and nr.status = 'completed'
    and nl.listing_type = 'rent'
);

-- Populate counted_conversations with all completed transaction IDs
update public.seller_profiles sp
set counted_conversations = (
  select array_agg(distinct c.id)
  from public.conversations c
  where c.seller_id = sp.user_id
    and (
      -- Product transactions
      exists (
        select 1 from public.product_requests pr
        where pr.conversation_id = c.id and pr.status = 'completed'
      )
      -- Food transactions
      or exists (
        select 1 from public.food_orders fo
        where fo.conversation_id = c.id and fo.status = 'completed'
      )
      -- Notes purchase transactions
      or exists (
        select 1 from public.notes_purchases np
        join public.notes_listings nl on nl.id = c.context_id
        where np.conversation_id = c.id and np.status = 'completed' and nl.listing_type = 'sell'
      )
      -- Rental transactions
      or exists (
        select 1 from public.rental_requests rr
        where rr.conversation_id = c.id and rr.status = 'completed'
      )
      -- Notes rental transactions
      or exists (
        select 1 from public.notes_rentals nr
        join public.notes_listings nl on nl.id = c.context_id
        where nr.conversation_id = c.id and nr.status = 'completed' and nl.listing_type = 'rent'
      )
    )
);
