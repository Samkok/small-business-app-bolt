-- Add purchase_date, arrival_date, and status columns to inventory_imports
ALTER TABLE inventory_imports
ADD COLUMN IF NOT EXISTS purchase_date timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS arrival_date timestamptz,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed'));

-- Remove existing triggers that handle stock and cost updates on inventory_imports
-- These will be handled in the application logic upon marking an import as 'completed'
DROP TRIGGER IF EXISTS update_product_cost_trigger ON inventory_imports;
DROP TRIGGER IF EXISTS handle_import_update_trigger ON inventory_imports;
DROP TRIGGER IF EXISTS handle_import_delete_trigger ON inventory_imports;

-- Update products table to remove default for cost_per_unit, as it will be set by logic
ALTER TABLE products ALTER COLUMN cost_per_unit DROP DEFAULT;

-- Optional: Backfill existing imports with 'completed' status and created_at as purchase/arrival date
-- This assumes all existing imports are already "arrived"
UPDATE inventory_imports
SET
  purchase_date = created_at,
  arrival_date = created_at,
  status = 'completed'
WHERE status IS NULL;

-- Add index for status for faster filtering
CREATE INDEX IF NOT EXISTS idx_inventory_imports_status ON public.inventory_imports USING btree (status);