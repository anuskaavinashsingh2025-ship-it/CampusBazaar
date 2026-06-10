-- Add evidence columns to reports table
alter table public.reports
  add column if not exists evidence_urls text[] default null,
  add column if not exists evidence_count integer default 0;
