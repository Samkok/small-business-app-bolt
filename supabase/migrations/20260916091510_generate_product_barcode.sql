/*
  # Auto-generated product barcodes

  generate_product_barcode(business) returns a barcode that no product or unit
  variant in that business uses. Format: EAN-13 style, '2' prefix (the GS1 range
  reserved for in-store codes) + 11 random digits + check digit, so it scans on
  any retail scanner and encodes compactly.

  Uniqueness is checked against products(barcode, business_id) and
  product_unit_prices(business_id, barcode), the two unique indexes that
  guard barcodes today. Caller must be a member of the business.
*/

CREATE OR REPLACE FUNCTION public.generate_product_barcode(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_body text;
  v_candidate text;
  v_sum int;
  v_check int;
  v_attempts int := 0;
  i int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM businesses WHERE id = p_business_id AND owner_user_id = v_caller
    UNION ALL
    SELECT 1 FROM user_business_roles WHERE business_id = p_business_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'You are not a member of this business';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Could not find a free barcode';
    END IF;

    v_body := '2' || lpad(floor(random() * 100000000000)::bigint::text, 11, '0');

    -- EAN-13 check digit: weights 1,3,1,3,... over the 12 leading digits
    v_sum := 0;
    FOR i IN 1..12 LOOP
      v_sum := v_sum + substr(v_body, i, 1)::int * (CASE WHEN i % 2 = 1 THEN 1 ELSE 3 END);
    END LOOP;
    v_check := (10 - (v_sum % 10)) % 10;
    v_candidate := v_body || v_check::text;

    IF NOT EXISTS (SELECT 1 FROM products WHERE business_id = p_business_id AND barcode = v_candidate)
       AND NOT EXISTS (SELECT 1 FROM product_unit_prices WHERE business_id = p_business_id AND barcode = v_candidate)
    THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_product_barcode(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.generate_product_barcode(uuid) TO authenticated;
