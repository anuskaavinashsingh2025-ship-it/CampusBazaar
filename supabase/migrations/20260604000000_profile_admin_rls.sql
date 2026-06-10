-- Allow client-side profile bootstrap when the auth trigger did not run.
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- Admin moderation (analytics, suspend/ban).
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete any product listing"
  on public.product_listings for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
