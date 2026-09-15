/*
  # Make sales.returned_amount track what was actually refunded

  `update_sale_returned_amount` added the gross return `amount` to `sales.returned_amount`,
  while every report subtracts `sale_actions.adjusted_amount` (the cash refunded after the
  deduction the business keeps). `current_total_amount` is generated from `returned_amount`,
  so Top Customers and customer spending disagreed with the income statement, and three
  sales went negative when a refund computed on the gross item price exceeded a sale total
  that is net of the courier fee.

  1. Trigger now adds COALESCE(adjusted_amount, amount).
  2. Backfill returned_amount from existing return actions using the same rule.
*/

CREATE OR REPLACE FUNCTION public.update_sale_returned_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF NEW.action_type = 'return' THEN
    UPDATE sales
    SET returned_amount = COALESCE(returned_amount, 0) + COALESCE(NEW.adjusted_amount, NEW.amount, 0)
    WHERE id = NEW.sale_id;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE sales s
SET returned_amount = r.refunded
FROM (
  SELECT sale_id, SUM(COALESCE(adjusted_amount, amount, 0)) AS refunded
  FROM sale_actions
  WHERE action_type = 'return'
  GROUP BY sale_id
) r
WHERE s.id = r.sale_id
  AND COALESCE(s.returned_amount, 0) IS DISTINCT FROM r.refunded;

-- Sales with no return actions keep 0.
UPDATE sales s
SET returned_amount = 0
WHERE COALESCE(s.returned_amount, 0) <> 0
  AND NOT EXISTS (SELECT 1 FROM sale_actions a WHERE a.sale_id = s.id AND a.action_type = 'return');
