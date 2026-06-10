-- Bootstrap seller_profiles on signup and allow client-side user_roles insert fallback.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  if new.email is null or lower(new.email) not like '%@vitstudent.ac.in' then
    raise exception 'Only VIT student emails (@vitstudent.ac.in) are allowed';
  end if;

  v_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    v_display_name,
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  insert into public.seller_profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    v_display_name,
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;

create policy "Users can insert own role"
  on public.user_roles for insert to authenticated
  with check (auth.uid() = user_id and role = 'user');
