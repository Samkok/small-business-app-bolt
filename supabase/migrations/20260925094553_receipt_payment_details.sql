-- Payment details printed on the receipt: a QR image (bank / KHQR) and a free-text note
-- such as account name and number. Both optional, edited by the business owner in settings.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS receipt_payment_note text,
  ADD COLUMN IF NOT EXISTS receipt_payment_qr_url text;
COMMENT ON COLUMN public.businesses.receipt_payment_note IS 'Printed under "Pay to" on receipts: bank name, account name and number';
COMMENT ON COLUMN public.businesses.receipt_payment_qr_url IS 'Public URL of the payment QR image printed on receipts';
