-- Ensure feedback-screenshots bucket exists
-- This migration is a safety net to ensure the bucket exists even if the original migration wasn't run

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;
