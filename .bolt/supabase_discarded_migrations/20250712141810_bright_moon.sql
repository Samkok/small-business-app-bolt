/*
  # Update database functions for multi-business support

  1. Function Updates
    - Modify existing functions to work with the new schema
    - Update any references to the old profiles table
    - Ensure compatibility with the new user_business_roles relationship
*/

-- Update the update_product_cost_per_unit function if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_product_cost_per_unit') THEN
        CREATE OR REPLACE FUNCTION update_product_cost_per_unit()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Calculate the new cost per unit based on the weighted average
            UPDATE products
            SET cost_per_unit = (
                SELECT CASE
                    WHEN (p.current_stock - OLD.quantity + NEW.quantity) <= 0 THEN NEW.final_unit_cost
                    ELSE ((p.current_stock - OLD.quantity) * p.cost_per_unit + NEW.quantity * NEW.final_unit_cost) / 
                         NULLIF((p.current_stock - OLD.quantity + NEW.quantity), 0)
                END
                FROM products p
                WHERE p.id = NEW.product_id
            )
            WHERE id = NEW.product_id;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Update the handle_import_update function if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_import_update') THEN
        CREATE OR REPLACE FUNCTION handle_import_update()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Only update product stock if status changed from 'pending' to 'completed'
            IF OLD.status = 'pending' AND NEW.status = 'completed' THEN
                -- Update product stock
                UPDATE products
                SET current_stock = current_stock + NEW.quantity
                WHERE id = NEW.product_id;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Update the handle_import_delete function if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_import_delete') THEN
        CREATE OR REPLACE FUNCTION handle_import_delete()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Only reduce stock if the import was completed
            IF OLD.status = 'completed' THEN
                -- Update product stock
                UPDATE products
                SET current_stock = GREATEST(0, current_stock - OLD.quantity)
                WHERE id = OLD.product_id;
            END IF;
            
            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Update the update_cart_item_discount_amounts function if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_cart_item_discount_amounts') THEN
        CREATE OR REPLACE FUNCTION update_cart_item_discount_amounts()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Calculate original subtotal
            NEW.original_subtotal := NEW.quantity * NEW.unit_price;
            
            -- Calculate discount amount if applicable
            IF NEW.item_discount_type = 'percentage' AND NEW.item_discount_value IS NOT NULL THEN
                NEW.item_discount_amount := NEW.original_subtotal * (NEW.item_discount_value / 100);
            ELSIF NEW.item_discount_type = 'fixed' AND NEW.item_discount_value IS NOT NULL THEN
                NEW.item_discount_amount := LEAST(NEW.item_discount_value, NEW.original_subtotal);
            ELSE
                NEW.item_discount_amount := 0;
            END IF;
            
            -- Calculate final subtotal
            NEW.subtotal := NEW.original_subtotal - NEW.item_discount_amount;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Update the update_updated_at_column function if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Create a function to check if a user has access to a business
CREATE OR REPLACE FUNCTION user_has_business_access(user_uid uuid, business_id_param uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE user_id = user_uid AND business_id = business_id_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;