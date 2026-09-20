/*
# Delivery fee the CUSTOMER pays (carts.delivery_charge)

Until now a delivery amount always meant "the shop pays the courier": carts.delivery_cost is
deducted from the sale (sales.total_amount is net of it), reported as a fee, and the receipt
says delivery is FREE.

The checkout now asks who pays:
  - Shop pays (free delivery): unchanged. The amount goes in delivery_cost.
  - Customer pays (charge delivery): the amount goes in the NEW column delivery_charge.
    Nothing is deducted from the shop, so revenue, profit, fees, refunds and every report are
    exactly what they are today with a delivery cost of zero. The receipt adds the fee as its
    own line and includes it in the TOTAL the customer pays.

Keeping the two amounts in separate columns is deliberate: delivery_cost is read in dozens of
places (reports, profit, refunds, the cart total view, complete_sale_atomic) that must not
change. delivery_charge is read only by the checkout screens and the receipt.

A cart has one payer, so both amounts cannot be positive at once. Every checkout creates a
cart row (cart checkout, quick checkout and the offline sync all do), and a sale has exactly
one cart, so the receipt reads the charge through sales.cart_id.
*/
ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS delivery_charge numeric(10,2);

ALTER TABLE public.carts
  ADD CONSTRAINT carts_delivery_charge_non_negative
    CHECK (delivery_charge IS NULL OR delivery_charge >= 0),
  ADD CONSTRAINT carts_delivery_one_payer
    CHECK (NOT (COALESCE(delivery_cost, 0) > 0 AND COALESCE(delivery_charge, 0) > 0));

COMMENT ON COLUMN public.carts.delivery_charge IS
  'Delivery fee the CUSTOMER pays on top of the items (shown on the receipt, never deducted from the shop). The shop-paid fee is delivery_cost; only one of the two may be positive.';

NOTIFY pgrst, 'reload schema';
