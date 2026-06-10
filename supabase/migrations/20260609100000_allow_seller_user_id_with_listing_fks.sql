-- ============================================================
-- REPAIR (2): Allow `seller_user_id` together with listing FK
-- ============================================================
-- The original CHECK constraint on `public.reports` was:
--
--   (target_type='product' AND product_id IS NOT NULL
--      AND seller_user_id IS NULL AND rental_id IS NULL
--      AND food_listing_id IS NULL AND notes_listing_id IS NULL)
--   OR ... (similarly strict for every other target type)
--
-- This forced callers to NOT pass `seller_user_id` for per-listing
-- reports, which made it impossible to link a report to both a
-- specific listing AND the seller that posted it. The application
-- layer was therefore dropping the seller association for product /
-- rental / food / notes reports.
--
-- We replace the constraint with one that REQUIRES the right FK for
-- each target type but ALLOWS `seller_user_id` to be set in
-- addition. The single hard rule is: at least the type's FK column
-- must be set, and no other LISTING FK may be set. `seller_user_id`
-- is now optional for every target type.
-- ============================================================

alter table public.reports drop constraint if exists reports_check;

alter table public.reports
  add constraint reports_check check (
    -- Exactly one LISTING FK is set, matching the target_type.
    -- seller_user_id is allowed in addition (it is purely informational).
    (
      target_type = 'product'
      and product_id is not null
      and rental_id is null
      and food_listing_id is null
      and notes_listing_id is null
    )
    or (
      target_type = 'seller'
      and seller_user_id is not null
      and product_id is null
      and rental_id is null
      and food_listing_id is null
      and notes_listing_id is null
    )
    or (
      target_type = 'rental'
      and rental_id is not null
      and product_id is null
      and food_listing_id is null
      and notes_listing_id is null
    )
    or (
      target_type = 'food'
      and food_listing_id is not null
      and product_id is null
      and rental_id is null
      and notes_listing_id is null
    )
    or (
      target_type = 'notes'
      and notes_listing_id is not null
      and product_id is null
      and rental_id is null
      and food_listing_id is null
    )
  );

-- ============================================================
-- Add an index to look up reports by seller_user_id quickly.
-- This makes the admin "Ban User" flow fast even with many reports.
-- ============================================================
create index if not exists reports_seller_user_id_idx
  on public.reports (seller_user_id)
  where seller_user_id is not null;
