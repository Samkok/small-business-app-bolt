/*
  # Update Row Level Security (RLS) policies for multi-business support

  1. Security Changes
    - Update RLS policies on all business-related tables
    - Replace direct user_id checks with checks against user_business_roles
    - Ensure users can only access data for businesses they are authorized for
*/

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can manage business customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage business products" ON public.products;
DROP POLICY IF EXISTS "Users can manage business inventory imports" ON public.inventory_imports;
DROP POLICY IF EXISTS "Users can manage business carts" ON public.carts;
DROP POLICY IF EXISTS "Users can manage business sales" ON public.sales;
DROP POLICY IF EXISTS "Users can manage business expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Users can manage business expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can manage sale actions" ON public.sale_actions;
DROP POLICY IF EXISTS "Users can manage import costs" ON public.import_costs;
DROP POLICY IF EXISTS "Users can manage cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.businesses;
DROP POLICY IF EXISTS "Users can read own profile" ON public.businesses;
DROP POLICY IF EXISTS "Users can update own profile" ON public.businesses;

-- Create new RLS policies for businesses table
CREATE POLICY "Users can read businesses they belong to" ON public.businesses
  FOR SELECT USING (
    id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert businesses they own" ON public.businesses
  FOR INSERT WITH CHECK (
    owner_user_id = auth.uid()
  );

CREATE POLICY "Business admins can update business details" ON public.businesses
  FOR UPDATE USING (
    id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create new RLS policies for customers
CREATE POLICY "Users can manage business customers" ON public.customers
  FOR ALL USING (
    business_id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );

-- Create new RLS policies for products
CREATE POLICY "Users can manage business products" ON public.products
  FOR ALL USING (
    business_id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );

-- Create new RLS policies for inventory_imports
CREATE POLICY "Users can manage business inventory imports" ON public.inventory_imports
  FOR ALL USING (
    business_id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );

-- Create new RLS policies for import_costs
CREATE POLICY "Users can manage import costs" ON public.import_costs
  FOR ALL USING (
    import_id IN (
      SELECT id
      FROM public.inventory_imports
      WHERE business_id IN (
        SELECT business_id
        FROM public.user_business_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create new RLS policies for carts
CREATE POLICY "Users can manage business carts" ON public.carts
  FOR ALL USING (
    business_id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );

-- Create new RLS policies for cart_items
CREATE POLICY "Users can manage cart items" ON public.cart_items
  FOR ALL USING (
    cart_id IN (
      SELECT id
      FROM public.carts
      WHERE business_id IN (
        SELECT business_id
        FROM public.user_business_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create new RLS policies for sales
CREATE POLICY "Users can manage business sales" ON public.sales
  FOR ALL USING (
    business_id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );

-- Create new RLS policies for sale_actions
CREATE POLICY "Users can manage sale actions" ON public.sale_actions
  FOR ALL USING (
    sale_id IN (
      SELECT id
      FROM public.sales
      WHERE business_id IN (
        SELECT business_id
        FROM public.user_business_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create new RLS policies for expense_categories
CREATE POLICY "Users can manage business expense categories" ON public.expense_categories
  FOR ALL USING (
    business_id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );

-- Create new RLS policies for expenses
CREATE POLICY "Users can manage business expenses" ON public.expenses
  FOR ALL USING (
    business_id IN (
      SELECT business_id
      FROM public.user_business_roles
      WHERE user_id = auth.uid()
    )
  );