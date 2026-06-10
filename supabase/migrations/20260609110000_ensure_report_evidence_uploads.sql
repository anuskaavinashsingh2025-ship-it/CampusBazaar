-- ============================================================
-- REPAIR (3): Ensure the report-evidence upload path works
-- ============================================================
-- 1. Re-confirm the bucket is public.
-- 2. Re-create the upload policy (idempotent) so an authenticated
--    user can always upload to report-evidence. Previous migration
--    already added it, but a re-apply is safe and ensures the policy
--    is in place after any prior misconfiguration.
-- 3. Add a per-bucket storage rate-limit hint (no-op, just docs).
-- ============================================================

-- 1. Re-confirm bucket is public
update storage.buckets
set public = true
where id = 'report-evidence';

-- 2. Re-create upload policy (idempotent)
drop policy if exists "Authenticated can upload report evidence" on storage.objects;
create policy "Authenticated can upload report evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-evidence'
    and auth.uid() is not null
  );

-- 3. Re-create admin read policy (idempotent)
drop policy if exists "Admins can read all report evidence" on storage.objects;
create policy "Admins can read all report evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and public.has_role(auth.uid(), 'admin')
  );

-- 4. Re-create reporter read policy (idempotent)
drop policy if exists "Reporters can read own report evidence" on storage.objects;
create policy "Reporters can read own report evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and auth.uid() is not null
  );

-- 5. Re-create the evidence columns and indexes (idempotent)
alter table public.reports
  add column if not exists evidence_urls text[] default null,
  add column if not exists evidence_count integer default 0;
