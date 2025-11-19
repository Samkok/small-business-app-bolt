/*
  # Optimize RLS Policies - Auth Function Calls

  1. Performance Improvements
    - Replace `auth.uid()` with `(select auth.uid())` in all RLS policies
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale

  2. Tables Updated
    - user_profiles
    - businesses
    - customers
    - products
    - carts
    - cart_items
    - sales
    - sale_actions
    - expense_categories
    - expenses
    - user_business_roles
    - product_history
    - inventory_batches
    - import_costs
    - inventory_imports

  3. Notes
    - All policies are dropped and recreated with optimized auth function calls
    - Security logic remains exactly the same
    - Only performance is improved
*/

-- ============================================================================
-- USER_PROFILES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own user profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own user profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own user profile" ON user_profiles;
DROP POLICY IF EXISTS "Business admins can read user profiles for invitations" ON user_profiles;

CREATE POLICY "Users can insert own user profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can read own user profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own user profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Business admins can read user profiles for invitations"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = (select auth.uid())
      AND user_business_roles.role = 'admin'
    )
  );

-- ============================================================================
-- BUSINESSES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can read businesses they belong to" ON businesses;
DROP POLICY IF EXISTS "Users can insert businesses they own" ON businesses;
DROP POLICY IF EXISTS "Business admins can update business details" ON businesses;

CREATE POLICY "Users can read businesses they belong to"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = businesses.id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert businesses they own"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = owner_user_id);

CREATE POLICY "Business admins can update business details"
  ON businesses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = businesses.id
      AND user_business_roles.user_id = (select auth.uid())
      AND user_business_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = businesses.id
      AND user_business_roles.user_id = (select auth.uid())
      AND user_business_roles.role = 'admin'
    )
  );

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage business customers" ON customers;

CREATE POLICY "Users can manage business customers"
  ON customers
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = customers.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = customers.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage business products" ON products;

CREATE POLICY "Users can manage business products"
  ON products
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = products.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = products.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- CARTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage business carts" ON carts;

CREATE POLICY "Users can manage business carts"
  ON carts
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = carts.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = carts.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- CART_ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage cart items" ON cart_items;

CREATE POLICY "Users can manage cart items"
  ON cart_items
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carts
      INNER JOIN user_business_roles ON user_business_roles.business_id = carts.business_id
      WHERE carts.id = cart_items.cart_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      INNER JOIN user_business_roles ON user_business_roles.business_id = carts.business_id
      WHERE carts.id = cart_items.cart_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- SALES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage business sales" ON sales;

CREATE POLICY "Users can manage business sales"
  ON sales
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = sales.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = sales.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- SALE_ACTIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage sale actions" ON sale_actions;

CREATE POLICY "Users can manage sale actions"
  ON sale_actions
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      INNER JOIN user_business_roles ON user_business_roles.business_id = sales.business_id
      WHERE sales.id = sale_actions.sale_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      INNER JOIN user_business_roles ON user_business_roles.business_id = sales.business_id
      WHERE sales.id = sale_actions.sale_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- EXPENSE_CATEGORIES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage business expense categories" ON expense_categories;

CREATE POLICY "Users can manage business expense categories"
  ON expense_categories
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = expense_categories.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = expense_categories.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage business expenses" ON expenses;

CREATE POLICY "Users can manage business expenses"
  ON expenses
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = expenses.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = expenses.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- USER_BUSINESS_ROLES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can read their own business roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business admins can insert user roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business admins can update user roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business admins can delete user roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business admins can read all team member roles" ON user_business_roles;

CREATE POLICY "Users can read their own business roles"
  ON user_business_roles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Business admins can read all team member roles"
  ON user_business_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles ubr
      WHERE ubr.business_id = user_business_roles.business_id
      AND ubr.user_id = (select auth.uid())
      AND ubr.role = 'admin'
    )
  );

CREATE POLICY "Business admins can insert user roles"
  ON user_business_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles ubr
      WHERE ubr.business_id = user_business_roles.business_id
      AND ubr.user_id = (select auth.uid())
      AND ubr.role = 'admin'
    )
  );

CREATE POLICY "Business admins can update user roles"
  ON user_business_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles ubr
      WHERE ubr.business_id = user_business_roles.business_id
      AND ubr.user_id = (select auth.uid())
      AND ubr.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles ubr
      WHERE ubr.business_id = user_business_roles.business_id
      AND ubr.user_id = (select auth.uid())
      AND ubr.role = 'admin'
    )
  );

CREATE POLICY "Business admins can delete user roles"
  ON user_business_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles ubr
      WHERE ubr.business_id = user_business_roles.business_id
      AND ubr.user_id = (select auth.uid())
      AND ubr.role = 'admin'
    )
  );

-- ============================================================================
-- PRODUCT_HISTORY TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage product history for their businesses" ON product_history;

CREATE POLICY "Users can manage product history for their businesses"
  ON product_history
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = product_history.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = product_history.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- INVENTORY_BATCHES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage inventory batches for their businesses" ON inventory_batches;

CREATE POLICY "Users can manage inventory batches for their businesses"
  ON inventory_batches
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = inventory_batches.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = inventory_batches.business_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- IMPORT_COSTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage import costs" ON import_costs;

CREATE POLICY "Users can manage import costs"
  ON import_costs
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_batches
      INNER JOIN user_business_roles ON user_business_roles.business_id = inventory_batches.business_id
      WHERE inventory_batches.id = import_costs.batch_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_batches
      INNER JOIN user_business_roles ON user_business_roles.business_id = inventory_batches.business_id
      WHERE inventory_batches.id = import_costs.batch_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- INVENTORY_IMPORTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage business inventory imports" ON inventory_imports;

CREATE POLICY "Users can manage business inventory imports"
  ON inventory_imports
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_batches
      INNER JOIN user_business_roles ON user_business_roles.business_id = inventory_batches.business_id
      WHERE inventory_batches.id = inventory_imports.batch_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_batches
      INNER JOIN user_business_roles ON user_business_roles.business_id = inventory_batches.business_id
      WHERE inventory_batches.id = inventory_imports.batch_id
      AND user_business_roles.user_id = (select auth.uid())
    )
  );