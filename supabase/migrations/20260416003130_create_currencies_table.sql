/*
  # Create currencies table for multi-currency support

  1. New Tables
    - `currencies`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `code` (text, e.g. "USD", "EUR")
      - `name` (text, e.g. "US Dollar")
      - `symbol` (text, e.g. "$", "EUR")
      - `exchange_rate_to_usd` (numeric, NOT NULL, default 1)
      - `is_default` (boolean, NOT NULL, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Constraints
    - Unique constraint on (code, business_id) to prevent duplicate currency codes per business
    - Partial unique index ensuring only one default currency per business

  3. Security
    - RLS enabled on currencies table
    - SELECT/INSERT/UPDATE/DELETE policies for authenticated users who belong to the business

  4. Data Migration
    - Inserts a default USD currency for every existing business
    - Creates a trigger to auto-insert USD currency when a new business is created
*/

CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  exchange_rate_to_usd numeric NOT NULL DEFAULT 1,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_currencies_unique_code_per_business
  ON currencies (code, business_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_currencies_one_default_per_business
  ON currencies (business_id)
  WHERE is_default = true;

ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business currencies"
  ON currencies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = currencies.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert business currencies"
  ON currencies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = currencies.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update business currencies"
  ON currencies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = currencies.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = currencies.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete business currencies"
  ON currencies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = currencies.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

INSERT INTO currencies (business_id, code, name, symbol, exchange_rate_to_usd, is_default)
SELECT id, 'USD', 'US Dollar', '$', 1, true
FROM businesses
WHERE NOT EXISTS (
  SELECT 1 FROM currencies WHERE currencies.business_id = businesses.id AND currencies.is_default = true
);

CREATE OR REPLACE FUNCTION auto_create_default_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO currencies (business_id, code, name, symbol, exchange_rate_to_usd, is_default)
  VALUES (NEW.id, 'USD', 'US Dollar', '$', 1, true);

  RETURN NEW;

END;

$$;

DROP TRIGGER IF EXISTS trg_auto_create_default_currency ON businesses;

CREATE TRIGGER trg_auto_create_default_currency
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_default_currency();

;
