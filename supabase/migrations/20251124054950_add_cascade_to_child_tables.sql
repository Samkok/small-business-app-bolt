/*
  # Add CASCADE to Child Table Foreign Keys

  1. Changes
    - Add ON DELETE CASCADE to foreign keys in child tables
    - These tables reference parent tables that already have CASCADE to businesses
    - This ensures complete cascading deletion chain

  2. Affected Tables and Relationships
    
    **cart_items**
    - cart_id → carts(id) [carts has CASCADE to businesses]
    - product_id → products(id) [products has CASCADE to businesses]
    
    **sale_actions**
    - sale_id → sales(id) [sales has CASCADE to businesses]
    
    **import_costs**
    - batch_id → inventory_batches(id) [inventory_batches has CASCADE to businesses]

  3. Cascade Chain
    DELETE business →
      CASCADE deletes sales →
        CASCADE deletes sale_actions ✓
      CASCADE deletes carts →
        CASCADE deletes cart_items ✓
      CASCADE deletes inventory_batches →
        CASCADE deletes import_costs ✓

  4. Notes
    - Each foreign key is dropped and recreated with CASCADE
    - Migration is idempotent (uses IF EXISTS)
    - Ensures complete cleanup when business is deleted
*/

-- cart_items.cart_id → carts(id)
ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_id_fkey;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_cart_id_fkey
  FOREIGN KEY (cart_id)
  REFERENCES public.carts(id)
  ON DELETE CASCADE;

-- cart_items.product_id → products(id)
ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE CASCADE;

-- sale_actions.sale_id → sales(id)
ALTER TABLE public.sale_actions
  DROP CONSTRAINT IF EXISTS sale_actions_sale_id_fkey;

ALTER TABLE public.sale_actions
  ADD CONSTRAINT sale_actions_sale_id_fkey
  FOREIGN KEY (sale_id)
  REFERENCES public.sales(id)
  ON DELETE CASCADE;

-- import_costs.batch_id → inventory_batches(id)
ALTER TABLE public.import_costs
  DROP CONSTRAINT IF EXISTS fk_import_costs_batch;

ALTER TABLE public.import_costs
  ADD CONSTRAINT fk_import_costs_batch
  FOREIGN KEY (batch_id)
  REFERENCES public.inventory_batches(id)
  ON DELETE CASCADE;