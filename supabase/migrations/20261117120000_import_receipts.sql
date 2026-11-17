-- Receipt photos on stock imports (app 2.16+). Follows 20261117090000_expense_receipts.
--
-- Additive only, so builds that do not know about receipts keep working:
--   * inventory_batches.receipt_paths is a new nullable column with no default (no table
--     rewrite or lock). Old builds read batches with select(*) and ignore it; they write
--     batches with named columns only (createBatchImport, updateBatchImport, and
--     receive_inventory_batch sets status/arrival_date), so they never clear it.
--   * Same PRIVATE bucket and layout as expenses: {business_id}/{batch_id}/{file}.jpg.
--   * Only objects created today by 20261117090000 are replaced (the upload policy and the
--     orphan finder); nothing an existing build uses changes.

-- 1. Column (same validator as expenses: at most 5, each path inside {business_id}/{batch_id}/)

ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS receipt_paths text[];

COMMENT ON COLUMN public.inventory_batches.receipt_paths IS
  'Object paths in the expense-receipts bucket ({business_id}/{batch_id}/{file}). NULL = no receipt.';

ALTER TABLE public.inventory_batches
  DROP CONSTRAINT IF EXISTS inventory_batches_receipt_paths_valid;
ALTER TABLE public.inventory_batches
  ADD CONSTRAINT inventory_batches_receipt_paths_valid
  CHECK (public.expense_receipt_paths_valid(business_id, id, receipt_paths));

-- 2. Uploads may name an expense OR a stock import of the same business

DROP POLICY IF EXISTS "Members can upload expense receipts" ON storage.objects;
CREATE POLICY "Members can upload expense receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.user_business_roles ubr
      WHERE ubr.user_id = (SELECT auth.uid())
        AND ubr.business_id::text = (storage.foldername(name))[1]
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.id::text = (storage.foldername(name))[2]
          AND e.business_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.inventory_batches b
        WHERE b.id::text = (storage.foldername(name))[2]
          AND b.business_id::text = (storage.foldername(name))[1]
      )
    )
  );
-- Read and delete policies are unchanged: any member of the business, by the first folder.

-- 3. The orphan finder keeps files that an expense OR a stock import still lists

CREATE OR REPLACE FUNCTION public.list_orphan_expense_receipts(p_older_than interval DEFAULT interval '1 day')
RETURNS TABLE (object_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'expense-receipts'
    AND o.created_at < now() - p_older_than
    AND NOT EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id::text = (storage.foldername(o.name))[2]
        AND o.name = ANY (coalesce(e.receipt_paths, '{}'))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_batches b
      WHERE b.id::text = (storage.foldername(o.name))[2]
        AND o.name = ANY (coalesce(b.receipt_paths, '{}'))
    );
$$;

REVOKE ALL ON FUNCTION public.list_orphan_expense_receipts(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_expense_receipts(interval) TO service_role;

-- Undo (only if needed):
--   restore the upload policy and orphan finder from 20261117090000_expense_receipts.sql, then
--   ALTER TABLE public.inventory_batches DROP CONSTRAINT IF EXISTS inventory_batches_receipt_paths_valid;
--   ALTER TABLE public.inventory_batches DROP COLUMN IF EXISTS receipt_paths;
