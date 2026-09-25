-- Older sales carried the courier fee only on their cart. Copy it onto the sale so the sale
-- row is complete on its own; the app already read the cart as a fallback, so totals do not change.
-- Applied 2026-09-25: 888 sales updated.
UPDATE public.sales s
   SET delivery_cost = c.delivery_cost
  FROM public.carts c
 WHERE c.id = s.cart_id
   AND s.delivery_cost IS NULL
   AND c.delivery_cost > 0;
