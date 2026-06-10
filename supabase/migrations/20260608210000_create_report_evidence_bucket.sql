-- Create report-evidence storage bucket
insert into storage.buckets (id, name, public)
values ('report-evidence', 'report-evidence', false)
on conflict (id) do nothing;

-- RLS policies for report-evidence bucket

-- Authenticated users can upload evidence when creating a report
create policy "Authenticated can upload report evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-evidence'
    and auth.uid() is not null
  );

-- Admins can read all report evidence
create policy "Admins can read all report evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and public.has_role(auth.uid(), 'admin')
  );

-- Reporters can read their own evidence
create policy "Reporters can read own report evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and auth.uid() is not null
  );
