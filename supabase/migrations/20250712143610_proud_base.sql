-- Disable RLS temporarily for policy updates
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories DISABLE ROW LEVEL SECURITY;

-- Drop existing policies on businesses table
DROP POLICY IF EXISTS "Business admins can update business details" ON public.businesses;
DROP POLICY IF EXISTS "Users can insert businesses they own" ON public.businesses;
DROP POLICY IF EXISTS "Users can read businesses they belong to" ON public.businesses;

-- Recreate policies for the 'businesses' table
CREATE POLICY "Users can insert businesses they own" ON public.businesses
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Business admins can update business details" ON public.businesses
  FOR UPDATE USING (
    id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );

CREATE POLICY "Users can read businesses they belong to" ON public.businesses
  FOR SELECT USING (
    id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

-- Update policies for other tables to use user_business_roles
-- First drop existing policies
DROP POLICY IF EXISTS "Users can manage business customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage business products" ON public.products;
DROP POLICY IF EXISTS "Users can manage business inventory imports" ON public.inventory_imports;
DROP POLICY IF EXISTS "Users can manage business carts" ON public.carts;
DROP POLICY IF EXISTS "Users can manage cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can manage business sales" ON public.sales;
DROP POLICY IF EXISTS "Users can manage sale actions" ON public.sale_actions;
DROP POLICY IF EXISTS "Users can manage business expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can manage business expense categories" ON public.expense_categories;

-- Recreate policies for other business-related tables
CREATE POLICY "Users can manage business customers" ON public.customers
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage business products" ON public.products
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage business inventory imports" ON public.inventory_imports
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage business carts" ON public.carts
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage cart items" ON public.cart_items
  FOR ALL USING (
    cart_id IN (
      SELECT c.id
      FROM public.carts c
      WHERE c.business_id IN (
        SELECT ubr.business_id
        FROM public.user_business_roles ubr
        WHERE ubr.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage business sales" ON public.sales
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage sale actions" ON public.sale_actions
  FOR ALL USING (
    sale_id IN (
      SELECT s.id
      FROM public.sales s
      WHERE s.business_id IN (
        SELECT ubr.business_id
        FROM public.user_business_roles ubr
        WHERE ubr.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage business expenses" ON public.expenses
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage business expense categories" ON public.expense_categories
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid()
    )
  );

-- Re-enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;