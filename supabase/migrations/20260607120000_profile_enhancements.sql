-- Add profile enhancement fields
alter table public.profiles 
  add column if not exists hostel_type text,
  add column if not exists room_number text,
  add column if not exists phone_number text;

-- Add comments
comment on column public.profiles.hostel_type is 'Hostel type: Ladies Hostel or Men''s Hostel';
comment on column public.profiles.hostel_block is 'Hostel block code (e.g., LHA, MHA, etc.)';
comment on column public.profiles.room_number is 'Room number (optional)';
comment on column public.profiles.phone_number is 'Phone number (optional)';
