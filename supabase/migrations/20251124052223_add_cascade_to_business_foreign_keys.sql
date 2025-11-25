/*
  # Add CASCADE to Business Foreign Keys

  1. Changes
    - Add ON DELETE CASCADE to all foreign keys referencing businesses table
    - Ensures automatic cleanup of all related data when a business is deleted
    - Provides atomic, transaction-safe deletion (all-or-nothing)

  2. Affected Tables
    - customers: business_id → businesses(id)
    - products: business_id → businesses(id)
    - product_history: business_id → businesses(id)
    - inventory_imports: business_id → businesses(id)
    - inventory_batches: business_id → businesses(id)
    - carts: business_id → businesses(id)
    - sales: business_id → businesses(id)
    - expense_categories: business_id → businesses(id)
    - expenses: business_id → businesses(id)

  3. Already Have CASCADE
    - user_business_roles: business_id → businesses(id) ON DELETE CASCADE ✓
    - notifications: business_id → businesses(id) ON DELETE CASCADE ✓
    - audit_logs: business_id → businesses(id) ON DELETE CASCADE ✓

  4. Benefits
    - Automatic cleanup: No need for manual deletion of child records
    - Transaction safety: Database ensures all-or-nothing deletion
    - Performance: Database optimizes CASCADE operations internally
    - Simplicity: Delete business → database handles everything

  5. Notes
    - Each foreign key is dropped and recreated with CASCADE
    - This is required because PostgreSQL doesn't support modifying existing constraints
    - Migration is idempotent (uses IF EXISTS)
*/

-- Customers table
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_business_id_fkey;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Products table
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_business_id_fkey;

ALTER TABLE public.products
  ADD CONSTRAINT products_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Product history table
ALTER TABLE public.product_history
  DROP CONSTRAINT IF EXISTS product_history_business_id_fkey;

ALTER TABLE public.product_history
  ADD CONSTRAINT product_history_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Inventory imports table
ALTER TABLE public.inventory_imports
  DROP CONSTRAINT IF EXISTS inventory_imports_business_id_fkey;

ALTER TABLE public.inventory_imports
  ADD CONSTRAINT inventory_imports_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Inventory batches table
ALTER TABLE public.inventory_batches
  DROP CONSTRAINT IF EXISTS inventory_batches_business_id_fkey;

ALTER TABLE public.inventory_batches
  ADD CONSTRAINT inventory_batches_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Carts table
ALTER TABLE public.carts
  DROP CONSTRAINT IF EXISTS carts_business_id_fkey;

ALTER TABLE public.carts
  ADD CONSTRAINT carts_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Sales table
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_business_id_fkey;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Expense categories table
ALTER TABLE public.expense_categories
  DROP CONSTRAINT IF EXISTS expense_categories_business_id_fkey;

ALTER TABLE public.expense_categories
  ADD CONSTRAINT expense_categories_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;

-- Expenses table
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_business_id_fkey;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES public.businesses(id)
  ON DELETE CASCADE;