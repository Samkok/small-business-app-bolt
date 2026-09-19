/*
  # Receipts: running receipt numbers and the business details printed on them

  ## businesses (new nullable columns, shown in the receipt header / footer)
  - receipt_phone, receipt_address, receipt_page_name, receipt_footer

  ## sales.receipt_number
  A running number per business (1, 2, 3, ...), assigned when the sale row is
  inserted and never reused: a voided sale keeps its number. Sales created before
  this migration stay NULL and keep showing their short id on the receipt; no
  historical row is rewritten.

  The number is assigned by a BEFORE INSERT trigger rather than inside
  complete_sale_atomic, so every path that creates a sale gets one (checkout,
  offline sync, sales import) without touching that function. The per-business
  counter row is locked by the upsert, so two sales completing at once get
  consecutive numbers; if the sale insert rolls back, so does the counter, which
  means no gaps from failed checkouts.

  ## Security
  - business_receipt_counters has RLS enabled and no policies: only the
    SECURITY DEFINER trigger function reads or writes it.
*/

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS receipt_phone text,
  ADD COLUMN IF NOT EXISTS receipt_address text,
  ADD COLUMN IF NOT EXISTS receipt_page_name text,
  ADD COLUMN IF NOT EXISTS receipt_footer text;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS receipt_number integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_unique_receipt_number_per_business
  ON public.sales (business_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.business_receipt_counters (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_receipt_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assign_sale_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF NEW.receipt_number IS NULL AND NEW.business_id IS NOT NULL THEN
    INSERT INTO public.business_receipt_counters AS c (business_id, last_number)
    VALUES (NEW.business_id, 1)
    ON CONFLICT (business_id)
      DO UPDATE SET last_number = c.last_number + 1, updated_at = now()
    RETURNING c.last_number INTO NEW.receipt_number;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_sale_receipt_number() FROM public;

DROP TRIGGER IF EXISTS assign_sale_receipt_number_trigger ON public.sales;
CREATE TRIGGER assign_sale_receipt_number_trigger
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sale_receipt_number();
