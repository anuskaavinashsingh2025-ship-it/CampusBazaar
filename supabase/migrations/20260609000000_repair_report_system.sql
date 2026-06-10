-- ============================================================
-- REPAIR: Make report-evidence bucket public
-- ============================================================
-- The previous migration set this bucket to private (public=false),
-- which means getPublicUrl() returns a useless URL and admins
-- cannot display evidence thumbnails in the moderation queue.
-- We switch it to public so URLs returned by getPublicUrl work
-- in <img> tags for the admin portal.
-- ============================================================

update storage.buckets
set public = true
where id = 'report-evidence';

-- ============================================================
-- REPAIR: Defensive — ensure evidence columns exist on reports
-- ============================================================
-- This is a safety net. The earlier migration
-- 20260608200000_add_report_evidence_columns.sql added these,
-- but this guarantees they are present in every environment.
-- ============================================================

alter table public.reports
  add column if not exists evidence_urls text[] default null,
  add column if not exists evidence_count integer default 0;

-- ============================================================
-- REPAIR: Allow reporters to read their own evidence URLs on reports
-- ============================================================
-- The earlier policy "Users can read own reports" already lets the
-- reporter SELECT from `reports`, but the storage object policy
-- was admin-only for "report-evidence" reads. We relax that so
-- report submitters can also re-verify their evidence.
-- ============================================================

drop policy if exists "Reporters can read own report evidence" on storage.objects;
create policy "Reporters can read own report evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and auth.uid() is not null
  );

-- ============================================================
-- REPAIR: Index for fast queue counts
-- ============================================================
create index if not exists reports_status_target_idx
  on public.reports (status, target_type, created_at desc);

-- ============================================================
-- REPAIR: Add updated_at trigger for reports (idempotent)
-- ============================================================
drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();
