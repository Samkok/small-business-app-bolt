/*
  # Add Creator Name Auto-Population Triggers
  
  ## Overview
  Automatically populate creator/actor display names when records are created or updated.
  
  ## Changes
  Creates triggers to populate display names from user_profiles:
  
  1. **sales** - Auto-populate created_by_name from user_profiles
  2. **carts** - Auto-populate created_by_name from user_profiles  
  3. **expenses** - Auto-populate created_by_name from user_profiles
  4. **inventory_batches** - Auto-populate imported_by_name from user_profiles
  
  ## Logic
  - Triggers fire BEFORE INSERT or UPDATE
  - Looks up full_name from user_profiles based on user_id
  - Falls back to email if full_name is not available
  - Only updates if the creator field (created_by/imported_by) is set
  
  ## Performance
  - Single SELECT per insert/update (minimal overhead)
  - Uses existing indexes on user_profiles(user_id)
  
  ## Security
  - No changes to RLS policies
  - Read-only operation for user data
*/

-- Function to populate creator name for sales
CREATE OR REPLACE FUNCTION populate_sale_creator_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.created_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to populate creator name for carts
CREATE OR REPLACE FUNCTION populate_cart_creator_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.created_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to populate creator name for expenses
CREATE OR REPLACE FUNCTION populate_expense_creator_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.created_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to populate importer name for inventory batches
CREATE OR REPLACE FUNCTION populate_batch_importer_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.imported_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.imported_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.imported_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS populate_sale_creator_name_trigger ON public.sales;
DROP TRIGGER IF EXISTS populate_cart_creator_name_trigger ON public.carts;
DROP TRIGGER IF EXISTS populate_expense_creator_name_trigger ON public.expenses;
DROP TRIGGER IF EXISTS populate_batch_importer_name_trigger ON public.inventory_batches;

-- Create triggers for sales
CREATE TRIGGER populate_sale_creator_name_trigger
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION populate_sale_creator_name();

-- Create triggers for carts
CREATE TRIGGER populate_cart_creator_name_trigger
  BEFORE INSERT OR UPDATE ON public.carts
  FOR EACH ROW
  EXECUTE FUNCTION populate_cart_creator_name();

-- Create triggers for expenses
CREATE TRIGGER populate_expense_creator_name_trigger
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION populate_expense_creator_name();

-- Create triggers for inventory batches
CREATE TRIGGER populate_batch_importer_name_trigger
  BEFORE INSERT OR UPDATE ON public.inventory_batches
  FOR EACH ROW
  EXECUTE FUNCTION populate_batch_importer_name();
