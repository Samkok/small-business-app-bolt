/*
  # Add Void/Return Adjustment Fields

  1. Changes to `sale_actions` table
    - Add `delivery_cost_included` (boolean) - Whether delivery cost was included in void/return
    - Add `delivery_cost_amount` (numeric) - The delivery cost amount that was included
    - Add `loss_amount` (numeric) - Total loss/adjustment amount
    - Add `loss_percentage` (numeric) - Loss percentage if calculated that way
    - Add `loss_type` (text) - 'fixed' or 'percentage' or null
    - Add `adjusted_amount` (numeric) - Final amount after all adjustments
    - Add `items_metadata` (jsonb) - Store per-item loss details for returns

  2. Purpose
    - Track whether delivery cost is included when voiding/returning sales
    - Record loss adjustments for damaged or depreciated items
    - Maintain detailed audit trail for financial reporting
    - Support both fixed amount and percentage-based loss calculations

  3. Notes
    - All new fields are optional (nullable) for backward compatibility
    - Existing records will have null values for new fields
    - `loss_type` has check constraint for valid values
    - `loss_percentage` must be between 0 and 100
    - `adjusted_amount` cannot be negative
*/

-- Add new columns to sale_actions table
DO $$
BEGIN
  -- Add delivery_cost_included column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_actions' AND column_name = 'delivery_cost_included'
  ) THEN
    ALTER TABLE sale_actions
    ADD COLUMN delivery_cost_included boolean DEFAULT false;
  END IF;

  -- Add delivery_cost_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_actions' AND column_name = 'delivery_cost_amount'
  ) THEN
    ALTER TABLE sale_actions
    ADD COLUMN delivery_cost_amount numeric(10,2) DEFAULT 0;
  END IF;

  -- Add loss_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_actions' AND column_name = 'loss_amount'
  ) THEN
    ALTER TABLE sale_actions
    ADD COLUMN loss_amount numeric(10,2) DEFAULT 0;
  END IF;

  -- Add loss_percentage column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_actions' AND column_name = 'loss_percentage'
  ) THEN
    ALTER TABLE sale_actions
    ADD COLUMN loss_percentage numeric(5,2) DEFAULT 0;
  END IF;

  -- Add loss_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_actions' AND column_name = 'loss_type'
  ) THEN
    ALTER TABLE sale_actions
    ADD COLUMN loss_type text;
  END IF;

  -- Add adjusted_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_actions' AND column_name = 'adjusted_amount'
  ) THEN
    ALTER TABLE sale_actions
    ADD COLUMN adjusted_amount numeric(10,2);
  END IF;

  -- Add items_metadata column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_actions' AND column_name = 'items_metadata'
  ) THEN
    ALTER TABLE sale_actions
    ADD COLUMN items_metadata jsonb;
  END IF;
END $$;

-- Add check constraints
DO $$
BEGIN
  -- Check constraint for loss_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'sale_actions_loss_type_check'
  ) THEN
    ALTER TABLE sale_actions
    ADD CONSTRAINT sale_actions_loss_type_check
    CHECK (loss_type IS NULL OR loss_type IN ('fixed', 'percentage'));
  END IF;

  -- Check constraint for loss_percentage range
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'sale_actions_loss_percentage_check'
  ) THEN
    ALTER TABLE sale_actions
    ADD CONSTRAINT sale_actions_loss_percentage_check
    CHECK (loss_percentage >= 0 AND loss_percentage <= 100);
  END IF;

  -- Check constraint for adjusted_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'sale_actions_adjusted_amount_check'
  ) THEN
    ALTER TABLE sale_actions
    ADD CONSTRAINT sale_actions_adjusted_amount_check
    CHECK (adjusted_amount IS NULL OR adjusted_amount >= 0);
  END IF;

  -- Check constraint for loss_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'sale_actions_loss_amount_check'
  ) THEN
    ALTER TABLE sale_actions
    ADD CONSTRAINT sale_actions_loss_amount_check
    CHECK (loss_amount >= 0);
  END IF;

  -- Check constraint for delivery_cost_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'sale_actions_delivery_cost_amount_check'
  ) THEN
    ALTER TABLE sale_actions
    ADD CONSTRAINT sale_actions_delivery_cost_amount_check
    CHECK (delivery_cost_amount >= 0);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN sale_actions.delivery_cost_included IS 'Whether delivery cost was included in the void/return amount';
COMMENT ON COLUMN sale_actions.delivery_cost_amount IS 'The delivery cost amount included in the action';
COMMENT ON COLUMN sale_actions.loss_amount IS 'Total loss/adjustment amount for damaged or depreciated items';
COMMENT ON COLUMN sale_actions.loss_percentage IS 'Loss percentage if calculated as percentage (0-100)';
COMMENT ON COLUMN sale_actions.loss_type IS 'Type of loss calculation: fixed amount or percentage';
COMMENT ON COLUMN sale_actions.adjusted_amount IS 'Final amount after applying delivery cost and loss adjustments';
COMMENT ON COLUMN sale_actions.items_metadata IS 'Per-item details for returns including individual loss adjustments';
