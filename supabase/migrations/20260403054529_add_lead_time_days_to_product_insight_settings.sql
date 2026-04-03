/*
  # Add lead_time_days to product_insight_settings

  Adds a supplier lead time field so the "Must Order" classification can account
  for the time it takes for an order to arrive.

  1. Changes
    - `product_insight_settings`
      - `lead_time_days` (integer, default 0) - estimated days from order to delivery.
        When > 0, Must Order is triggered when stock will run out within
        (reorder_warning_days + lead_time_days), ensuring an order is placed early enough.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_insight_settings' AND column_name = 'lead_time_days'
  ) THEN
    ALTER TABLE product_insight_settings
      ADD COLUMN lead_time_days integer NOT NULL DEFAULT 0;
  END IF;
END $$;
