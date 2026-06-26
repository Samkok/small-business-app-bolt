-- Add cost_per_unit column to cart_items to snapshot the product cost at time of sale
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS cost_per_unit numeric(10,2) DEFAULT 0;

-- Add index for performance on profit calculations
CREATE INDEX IF NOT EXISTS idx_cart_items_cost_per_unit ON cart_items(cost_per_unit) WHERE cost_per_unit > 0;
