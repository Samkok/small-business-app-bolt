-- Receipt photos on expenses (app 2.16+).
--
-- Additive only, so builds that do not know about receipts keep working:
--   * expenses.receipt_paths is a new nullable column with no default. Adding it does not
--     rewrite or lock the table. Old builds read expenses with select(*) and ignore it;
--     they write expenses with named columns only, so they never clear it.
--   * expense-receipts is a new PRIVATE bucket. The three existing public buckets and
--     their policies are not touched.
--   * No existing column, policy, trigger or function is changed.
--
-- Storage layout: {business_id}/{expense_id}/{file}.jpg
-- A member of the business can read, upload and delete files under that business's
-- folder, matching the "Users can manage business expenses" policy on public.expenses.
-- An upload must name an expense that exists in that business, so files cannot be
-- parked under made-up folders.

-- 1. Column ---------------------------------------------------------------------------

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS receipt_paths text[];

COMMENT ON COLUMN public.expenses.receipt_paths IS
  'Object paths in the expense-receipts bucket ({business_id}/{expense_id}/{file}). NULL = no receipt.';

-- Every path must sit in this expense's own folder, at most 5 per expense.
-- IMMUTABLE and plain SQL so it can back a CHECK constraint.
CREATE OR REPLACE FUNCTION public.expense_receipt_paths_valid(
  p_business_id uuid,
  p_expense_id uuid,
  p_paths text[]
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT p_paths IS NULL
      OR (
        cardinality(p_paths) <= 5
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(p_paths) AS p
          WHERE p IS NULL
             OR p NOT LIKE (p_business_id::text || '/' || p_expense_id::text || '/%')
             OR p LIKE '%..%'
             OR length(p) > 300
        )
      );
$$;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_receipt_paths_valid;
-- All 344 existing rows are NULL, so validation is instant.
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_receipt_paths_valid
  CHECK (public.expense_receipt_paths_valid(business_id, id, receipt_paths));

-- 2. Private bucket -------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,
  2097152, -- 2 MB; the app uploads ~200 KB JPEGs
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies (authenticated members of the business only) ------------------

DROP POLICY IF EXISTS "Members can read expense receipts" ON storage.objects;
CREATE POLICY "Members can read expense receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.user_business_roles ubr
      WHERE ubr.user_id = (SELECT auth.uid())
        AND ubr.business_id::text = (storage.foldername(name))[1]
    )
  );

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
    AND EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id::text = (storage.foldername(name))[2]
        AND e.business_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete expense receipts" ON storage.objects;
CREATE POLICY "Members can delete expense receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.user_business_roles ubr
      WHERE ubr.user_id = (SELECT auth.uid())
        AND ubr.business_id::text = (storage.foldername(name))[1]
    )
  );
-- No UPDATE policy: the app never overwrites a receipt, it uploads a new file.

-- 4. Orphan finder for the cleanup job -----------------------------------------------
-- Files whose expense no longer exists (deleted from an old build, or with its business).
-- Storage files must be removed through the Storage API, so a service-role job calls
-- this and deletes what it returns. Hidden from the app's keys.

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
    );
$$;

REVOKE ALL ON FUNCTION public.list_orphan_expense_receipts(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_expense_receipts(interval) TO service_role;

-- Undo (only if needed; old builds are unaffected either way):
--   DROP FUNCTION IF EXISTS public.list_orphan_expense_receipts(interval);
--   DROP POLICY IF EXISTS "Members can read expense receipts" ON storage.objects;
--   DROP POLICY IF EXISTS "Members can upload expense receipts" ON storage.objects;
--   DROP POLICY IF EXISTS "Members can delete expense receipts" ON storage.objects;
--   -- empty the bucket from the dashboard first, then:
--   DELETE FROM storage.buckets WHERE id = 'expense-receipts';
--   ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_receipt_paths_valid;
--   ALTER TABLE public.expenses DROP COLUMN IF EXISTS receipt_paths;
--   DROP FUNCTION IF EXISTS public.expense_receipt_paths_valid(uuid, uuid, text[]);
