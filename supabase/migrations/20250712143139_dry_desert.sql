/*
  # Rename profiles to businesses and update foreign keys
  
  1. Changes
     - Rename profiles table to businesses
     - Update all foreign key references to the businesses table
     - Rename constraints and indexes
  
  2. Security
     - Temporarily disables RLS during schema changes
     - Re-enables RLS at the end
*/

-- Disable RLS temporarily to allow schema changes
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_actions DISABLE ROW LEVEL SECURITY;

-- Drop existing foreign key constraints that reference public.profiles
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_business_id_fkey;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_business_id_fkey;
ALTER TABLE public.inventory_imports DROP CONSTRAINT IF EXISTS inventory_imports_business_id_fkey;
ALTER TABLE public.inventory_imports DROP CONSTRAINT IF EXISTS inventory_imports_imported_by_fkey;
ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_business_id_fkey;
ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_created_by_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_business_id_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_created_by_fkey;
ALTER TABLE public.expense_categories DROP CONSTRAINT IF EXISTS expense_categories_business_id_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_business_id_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.sale_actions DROP CONSTRAINT IF EXISTS sale_actions_performed_by_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Rename the profiles table to businesses
ALTER TABLE public.profiles RENAME TO businesses;

-- Rename the primary key constraint
ALTER TABLE public.businesses RENAME CONSTRAINT profiles_pkey TO businesses_pkey;

-- Rename the role check constraint if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
        ALTER TABLE public.businesses RENAME CONSTRAINT profiles_role_check TO businesses_role_check;
    END IF;
END
$$;

-- Recreate foreign key constraints to reference the new 'businesses' table
ALTER TABLE public.customers ADD CONSTRAINT customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
ALTER TABLE public.products ADD CONSTRAINT products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
ALTER TABLE public.inventory_imports ADD CONSTRAINT inventory_imports_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
ALTER TABLE public.inventory_imports ADD CONSTRAINT inventory_imports_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.businesses(id);
ALTER TABLE public.carts ADD CONSTRAINT carts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
ALTER TABLE public.carts ADD CONSTRAINT carts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.businesses(id);
ALTER TABLE public.sales ADD CONSTRAINT sales_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
ALTER TABLE public.sales ADD CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.businesses(id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.businesses(id);
ALTER TABLE public.sale_actions ADD CONSTRAINT sale_actions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.businesses(id);

-- Rename the foreign key constraint on the 'businesses' table itself
ALTER TABLE public.businesses ADD CONSTRAINT businesses_owner_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Rename index if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_user_id') THEN
        ALTER INDEX idx_profiles_user_id RENAME TO idx_businesses_owner_user_id;
    END IF;
END
$$;

-- Re-enable RLS (policies will be updated in a later migration)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_actions ENABLE ROW LEVEL SECURITY;