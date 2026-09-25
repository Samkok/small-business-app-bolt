-- The checkout choices a cart remembers while it is still open: PAID or COD and the payment
-- method. Written as soon as they are picked and by "Save draft", read back when the cart is
-- opened again. Copied onto the sale by the app at completion as before.
ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_payment_status_check;
ALTER TABLE public.carts ADD CONSTRAINT carts_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('paid', 'cod'));
ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_payment_method_check;
ALTER TABLE public.carts ADD CONSTRAINT carts_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'transfer', 'other'));
COMMENT ON COLUMN public.carts.payment_status IS 'Draft PAID / COD choice made at checkout before the sale is completed';
COMMENT ON COLUMN public.carts.payment_method IS 'Draft payment method chosen at checkout before the sale is completed';
