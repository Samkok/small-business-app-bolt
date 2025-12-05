/*
  # Create Subscriptions and Sales Count Tables

  1. New Tables
    - `user_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `subscription_status` (text, enum: active, expired, cancelled, trial)
      - `subscription_product_id` (text, bizmanage.pro.month or bizmanage.pro.yearly)
      - `subscription_start_date` (timestamptz)
      - `subscription_expiration_date` (timestamptz, nullable)
      - `receipt_data` (text, encrypted receipt from Apple/Google)
      - `last_validated_at` (timestamptz)
      - `platform` (text, ios/android/web)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `user_sales_counts`
      - `user_id` (uuid, references auth.users)
      - `business_id` (uuid, references businesses)
      - `sales_count` (integer, default 0)
      - `last_counted_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Primary key: (user_id, business_id)

  2. Security
    - Enable RLS on both tables
    - Users can only read/update their own subscription data
    - Users can only read their own sales count data
    
  3. Functions
    - Function to get sales count for a user/business
    - Function to increment sales count
*/

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_status text NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('active', 'expired', 'cancelled', 'trial')),
  subscription_product_id text,
  subscription_start_date timestamptz,
  subscription_expiration_date timestamptz,
  receipt_data text,
  last_validated_at timestamptz,
  platform text CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(subscription_status);

-- Create user_sales_counts table
CREATE TABLE IF NOT EXISTS user_sales_counts (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  sales_count integer DEFAULT 0 NOT NULL,
  last_counted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, business_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sales_counts_user_id ON user_sales_counts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sales_counts_business_id ON user_sales_counts(business_id);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sales_counts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own subscription
CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscription
CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_sales_counts

-- Users can view their own sales count
CREATE POLICY "Users can view own sales count"
  ON user_sales_counts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own sales count
CREATE POLICY "Users can insert own sales count"
  ON user_sales_counts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sales count
CREATE POLICY "Users can update own sales count"
  ON user_sales_counts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to get or create sales count for a user/business
CREATE OR REPLACE FUNCTION get_or_create_sales_count(
  p_user_id uuid,
  p_business_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_count integer;
BEGIN
  -- Try to get existing count
  SELECT sales_count INTO v_sales_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  -- If not found, create entry and count actual sales
  IF v_sales_count IS NULL THEN
    -- Count actual completed sales for this user and business
    SELECT COUNT(*) INTO v_sales_count
    FROM sales
    WHERE business_id = p_business_id
      AND status = 'completed';

    -- Insert the count
    INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_counted_at)
    VALUES (p_user_id, p_business_id, v_sales_count, now())
    ON CONFLICT (user_id, business_id) 
    DO UPDATE SET 
      sales_count = EXCLUDED.sales_count,
      last_counted_at = now();
  END IF;

  RETURN COALESCE(v_sales_count, 0);
END;
$$;

-- Function to increment sales count
CREATE OR REPLACE FUNCTION increment_sales_count(
  p_user_id uuid,
  p_business_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
BEGIN
  -- Ensure entry exists
  PERFORM get_or_create_sales_count(p_user_id, p_business_id);

  -- Increment the count
  UPDATE user_sales_counts
  SET 
    sales_count = sales_count + 1,
    last_counted_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id AND business_id = p_business_id
  RETURNING sales_count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

-- Function to get current subscription status
CREATE OR REPLACE FUNCTION get_subscription_status(p_user_id uuid)
RETURNS TABLE (
  is_subscribed boolean,
  subscription_status text,
  product_id text,
  expiration_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN us.subscription_status = 'active' AND 
           (us.subscription_expiration_date IS NULL OR us.subscription_expiration_date > now())
      THEN true
      ELSE false
    END as is_subscribed,
    us.subscription_status,
    us.subscription_product_id as product_id,
    us.subscription_expiration_date as expiration_date
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;
END;
$$;