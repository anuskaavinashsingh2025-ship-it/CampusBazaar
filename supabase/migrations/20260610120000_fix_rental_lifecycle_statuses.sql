-- Fix lifecycle statuses for rental and notes rental flows

alter type public.rental_request_status add value if not exists 'active_rental';
alter type public.rental_request_status add value if not exists 'return_requested';

alter type public.notes_purchase_status add value if not exists 'returned';
alter type public.notes_purchase_status add value if not exists 'active_rental';
alter type public.notes_purchase_status add value if not exists 'return_requested';
