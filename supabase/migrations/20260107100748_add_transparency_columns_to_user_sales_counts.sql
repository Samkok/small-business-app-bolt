/*
  # Add Transparency Columns to user_sales_counts

  ## Overview
  This migration adds transparency and tracking columns to user_sales_counts table:
  - last_reconciled_at: When was the last reconciliation check performed
  - last_reconciliation_result: Result of last reconciliation (accurate, corrected)

  ## New Columns
  
  ### user_sales_counts table additions:
  - last_reconciled_at (timestamptz, nullable) - Timestamp of last reconciliation
  - last_reconciliation_result (text, nullable) - Result: 'accurate' or 'corrected'

  ## Changes
  - Adds columns if they don't exist
  - No default values to preserve existing records
  - Updated by reconciliation functions automatically
*/

-- Add transparency columns to user_sales_counts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sales_counts' AND column_name = 'last_reconciled_at'
  ) THEN
    ALTER TABLE user_sales_counts ADD COLUMN last_reconciled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sales_counts' AND column_name = 'last_reconciliation_result'
  ) THEN
    ALTER TABLE user_sales_counts ADD COLUMN last_reconciliation_result text 
      CHECK (last_reconciliation_result IN ('accurate', 'corrected'));
  END IF;
END $$;