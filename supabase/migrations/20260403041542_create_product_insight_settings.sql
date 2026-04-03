/*
  # Create product_insight_settings table

  Per-business settings for the Product Insight dashboard classification engine.

  1. New Tables
    - `product_insight_settings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, unique, references businesses)
      - `lookback_days` (integer, default 30) - preset time window: 7, 30, or 90
      - `custom_start_date` (timestamptz, nullable) - custom range start
      - `custom_end_date` (timestamptz, nullable) - custom range end
      - `use_custom_range` (boolean, default false) - toggle preset vs custom
      - `hot_selling_min_units_per_day` (numeric, default 1.0) - threshold for hot selling
      - `slow_selling_max_units_per_day` (numeric, default 0.1) - threshold for slow moving
      - `reorder_warning_days` (integer, default 7) - days before stock-out to flag
      - `overstock_days_threshold` (integer, default 90) - days of stock to flag overstock
      - `default_low_stock_level` (integer, default 10) - fallback min stock level
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `product_insight_settings` table
    - Add policies for users who have business access via user_business_roles
*/

CREATE TABLE IF NOT EXISTS product_insight_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  lookback_days integer NOT NULL DEFAULT 30,
  custom_start_date timestamptz,
  custom_end_date timestamptz,
  use_custom_range boolean NOT NULL DEFAULT false,
  hot_selling_min_units_per_day numeric NOT NULL DEFAULT 1.0,
  slow_selling_max_units_per_day numeric NOT NULL DEFAULT 0.1,
  reorder_warning_days integer NOT NULL DEFAULT 7,
  overstock_days_threshold integer NOT NULL DEFAULT 90,
  default_low_stock_level integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_insight_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read insight settings for their businesses"
  ON product_insight_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = product_insight_settings.business_id
      AND user_business_roles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert insight settings for their businesses"
  ON product_insight_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = product_insight_settings.business_id
      AND user_business_roles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update insight settings for their businesses"
  ON product_insight_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = product_insight_settings.business_id
      AND user_business_roles.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = product_insight_settings.business_id
      AND user_business_roles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete insight settings for their businesses"
  ON product_insight_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = product_insight_settings.business_id
      AND user_business_roles.user_id = (SELECT auth.uid())
    )
  );
