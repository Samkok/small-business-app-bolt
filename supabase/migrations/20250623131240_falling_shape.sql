/*
  # Fix Delivery Cost Calculation

  1. Changes
    - Modify the cart_details_with_discounts view to deduct delivery cost instead of adding it
    - Update the final_total calculation in the view

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions or access control
*/

-- Update the cart_details_with_discounts view to deduct delivery cost
CREATE OR REPLACE VIEW cart_details_with_discounts AS
SELECT 
  c.id as cart_id,
  c.customer_id,
  c.status,
  c.discount_type as cart_discount_type,
  c.discount_value as cart_discount_value,
  c.delivery_cost,
  c.notes,
  c.business_id,
  c.created_by,
  c.created_at,
  c.updated_at,
  
  -- Cart totals
  COALESCE(SUM(ci.original_subtotal), 0) as items_original_total,
  COALESCE(SUM(ci.item_discount_amount), 0) as items_total_discount,
  COALESCE(SUM(ci.subtotal), 0) as items_subtotal_after_discount,
  
  -- Cart-level discount calculation
  calculate_sale_discount(
    COALESCE(SUM(ci.subtotal), 0),
    c.discount_type,
    c.discount_value
  ) as cart_discount_amount,
  
  -- Final total - DEDUCTING delivery cost instead of adding it
  GREATEST(0, 
    COALESCE(SUM(ci.subtotal), 0) - 
    calculate_sale_discount(COALESCE(SUM(ci.subtotal), 0), c.discount_type, c.discount_value) -
    COALESCE(c.delivery_cost, 0)
  ) as final_total

FROM carts c
LEFT JOIN cart_items ci ON c.id = ci.cart_id
GROUP BY c.id, c.customer_id, c.status, c.discount_type, c.discount_value, 
         c.delivery_cost, c.notes, c.business_id, c.created_by, c.created_at, c.updated_at;

-- Also update the sales_with_discount_details view for consistency
CREATE OR REPLACE VIEW sales_with_discount_details AS
SELECT 
  s.*,
  c.discount_type as cart_discount_type,
  c.discount_value as cart_discount_value,
  c.delivery_cost,
  
  -- Calculate totals from cart items
  COALESCE(SUM(ci.original_subtotal), 0) as items_original_total,
  COALESCE(SUM(ci.item_discount_amount), 0) as items_total_discount,
  COALESCE(SUM(ci.subtotal), 0) as items_subtotal_after_discount,
  
  -- Cart-level discount
  calculate_sale_discount(
    COALESCE(SUM(ci.subtotal), 0),
    c.discount_type,
    c.discount_value
  ) as cart_discount_amount

FROM sales s
JOIN carts c ON s.cart_id = c.id
LEFT JOIN cart_items ci ON c.id = ci.cart_id
GROUP BY s.id, s.cart_id, s.customer_id, s.total_amount, s.payment_method, 
         s.status, s.sale_date, s.notes, s.business_id, s.created_by, s.created_at,
         s.sale_discount_type, s.sale_discount_value, s.sale_discount_amount, s.subtotal_before_discount,
         c.discount_type, c.discount_value, c.delivery_cost;