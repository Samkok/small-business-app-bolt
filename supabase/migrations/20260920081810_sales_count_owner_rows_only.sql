/*
# Sales counters belong to the business owner only

Sales are counted once per business, on the OWNER's row in user_sales_counts:
the sale trigger increments it, the free-tier limit sums it, and the nightly
reconciliation only ever visits (owner, business). A row for anyone else is never
incremented or reconciled, so it sits at 0 with last_reconciled_at NULL forever.
One such row existed (a staff member of Fresh Flow). It could be created in two ways:

  1. get_or_create_sales_count(user, business) inserted a zero row for WHOEVER was
     signed in, so a team member opening the business made one.
  2. update_user_sales_count_on_status_change() adjusted the row of the person who
     CREATED the sale (sales.created_by). Un-voiding a team member's sale would insert
     a row for them, and voiding one never reduced the owner's count.

## Changes
  - get_or_create_sales_count: only the owner gets (or creates) a row. A team member
    of the business is given the owner's figure; anyone else gets 0. Neither creates a row.
  - update_user_sales_count_on_status_change: void / un-void adjust the owner's row.
  - Remove counter rows that do not belong to the business owner.
  - New trigger enforce_sales_count_owner: the table refuses any row whose user is not
    the owner of the business, so no future code path can bring this back.

Signatures are unchanged, so CREATE OR REPLACE keeps the existing grants
(no anon access; see 20260919104338).
*/

-- 1. Owner-only get-or-create
CREATE OR REPLACE FUNCTION public.get_or_create_sales_count(p_user_id uuid, p_business_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_count integer;
v_owner_user_id uuid;
BEGIN
  PERFORM public.require_self_or_service(p_user_id);
IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
RAISE EXCEPTION 'Cannot access another user''s sales count';
END IF;

SELECT owner_user_id INTO v_owner_user_id
FROM businesses
WHERE id = p_business_id;

IF v_owner_user_id IS NULL THEN
RETURN 0;
END IF;

-- Sales are counted once per business, on the owner's row. A team member is given
-- the owner's figure and never a row of their own; anyone else learns nothing.
IF v_owner_user_id != p_user_id THEN
IF NOT EXISTS (
SELECT 1 FROM user_business_roles
WHERE user_id = p_user_id AND business_id = p_business_id
) THEN
RETURN 0;
END IF;

SELECT sales_count INTO v_count
FROM user_sales_counts
WHERE user_id = v_owner_user_id AND business_id = p_business_id;

RETURN COALESCE(v_count, 0);
END IF;

SELECT sales_count INTO v_count
FROM user_sales_counts
WHERE user_id = p_user_id AND business_id = p_business_id;

IF NOT FOUND THEN
INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_counted_at, updated_at)
VALUES (p_user_id, p_business_id, 0, now(), now())
ON CONFLICT (user_id, business_id) DO NOTHING;

SELECT sales_count INTO v_count
FROM user_sales_counts
WHERE user_id = p_user_id AND business_id = p_business_id;
END IF;

RETURN COALESCE(v_count, 0);
END;
$function$;

-- 2. Void / un-void adjust the owner's row, whoever created the sale
CREATE OR REPLACE FUNCTION public.update_user_sales_count_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_owner_user_id uuid;
BEGIN
SELECT owner_user_id INTO v_owner_user_id
FROM businesses
WHERE id = NEW.business_id;

IF v_owner_user_id IS NULL THEN
RETURN NEW;
END IF;

-- If sale is being voided, decrement the count
IF OLD.status != 'voided' AND NEW.status = 'voided' THEN
UPDATE user_sales_counts
SET
sales_count = GREATEST(sales_count - 1, 0),
last_counted_at = now(),
updated_at = now()
WHERE user_id = v_owner_user_id AND business_id = NEW.business_id;
END IF;

-- If sale is being unvoided (changed from voided to something else), increment the count
IF OLD.status = 'voided' AND NEW.status != 'voided' THEN
INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_counted_at)
VALUES (v_owner_user_id, NEW.business_id, 1, now())
ON CONFLICT (user_id, business_id)
DO UPDATE SET
sales_count = user_sales_counts.sales_count + 1,
last_counted_at = now(),
updated_at = now();
END IF;

RETURN NEW;
END;
$function$;

-- 3. Remove counter rows that are not the owner's (one zero row on 2026-09-20)
DELETE FROM public.user_sales_counts c
USING public.businesses b
WHERE b.id = c.business_id
AND c.user_id IS DISTINCT FROM b.owner_user_id;

-- 4. The table itself refuses non-owner rows from now on
CREATE OR REPLACE FUNCTION public.enforce_sales_count_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_owner_user_id uuid;
BEGIN
SELECT owner_user_id INTO v_owner_user_id
FROM businesses
WHERE id = NEW.business_id;

IF v_owner_user_id IS DISTINCT FROM NEW.user_id THEN
RAISE EXCEPTION 'user_sales_counts holds one row per business, for its owner: user % does not own business %', NEW.user_id, NEW.business_id
USING ERRCODE = '23514';
END IF;

RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_sales_count_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_sales_count_owner ON public.user_sales_counts;
CREATE TRIGGER enforce_sales_count_owner
BEFORE INSERT OR UPDATE OF user_id, business_id ON public.user_sales_counts
FOR EACH ROW EXECUTE FUNCTION public.enforce_sales_count_owner();
