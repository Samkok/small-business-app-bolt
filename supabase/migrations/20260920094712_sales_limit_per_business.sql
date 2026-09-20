/*
# Free sales limit: one rule, per business

Two rules disagreed for owners on the free plan:

  - can_user_create_sale and get_full_subscription_state (what the app shows):
    the limit applies to EACH business, and it is 50 plus the owner's referral credits.
  - check_sales_subscription_limit (BEFORE INSERT trigger on sales): a flat 50 across
    ALL the owner's businesses added together.

So an owner whose Pro plan lapsed (1,898 sales across three businesses, 9 in the one
still active) was told "41 sales remaining" and then had every sale refused.

## Change
check_sales_subscription_limit now applies the per-business rule:
  - free plan: refuse when THIS business's counter >= get_effective_sales_limit(owner)
    (50 + referral credits). How the plan is determined is unchanged.
  - any plan: refuse a business that is read_only_sales or owner_disabled, as
    can_user_create_sale already does. Without this the per-business count would let a
    free owner keep selling in a read-only business that has fewer than 50 sales.

Error text keeps the SUBSCRIPTION_LIMIT_REACHED / BUSINESS_READ_ONLY prefixes the app uses.
Signature unchanged, so CREATE OR REPLACE keeps the existing grants.
*/

CREATE OR REPLACE FUNCTION public.check_sales_subscription_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_owner_user_id uuid;
v_access_state text;
v_business_sales_count integer;
v_effective_limit integer;
v_tier text;
v_subscription_status text;
v_subscription_expiration timestamptz;
BEGIN
-- Look up the business owner
SELECT owner_user_id, access_state INTO v_owner_user_id, v_access_state
FROM businesses
WHERE id = NEW.business_id;

IF v_owner_user_id IS NULL THEN
RAISE EXCEPTION 'Business with id % not found', NEW.business_id;
END IF;

-- A business outside the owner's plan takes no new sales, whatever the plan
IF v_access_state = 'read_only_sales' THEN
RAISE EXCEPTION 'BUSINESS_READ_ONLY: This business is read-only under the owner''s current plan. Choose it as an active business or upgrade to continue.'
USING HINT = 'businesses.access_state is read_only_sales';
END IF;

IF v_access_state = 'owner_disabled' THEN
RAISE EXCEPTION 'BUSINESS_OWNER_DISABLED: The owner has disabled this business.'
USING HINT = 'businesses.access_state is owner_disabled';
END IF;

-- Get the owner's subscription tier and status
SELECT
tier,
subscription_status,
subscription_expiration_date
INTO
v_tier,
v_subscription_status,
v_subscription_expiration
FROM user_subscriptions
WHERE user_id = v_owner_user_id
ORDER BY updated_at DESC
LIMIT 1;

-- Set defaults if no subscription found
IF v_tier IS NULL THEN
v_tier := 'free';
v_subscription_status := 'trial';
END IF;

-- Only enforce limits for free tier users
IF v_tier = 'free' THEN
-- The limit applies to THIS business: 50 plus the owner's referral credits,
-- the same rule as can_user_create_sale and get_full_subscription_state
SELECT sales_count INTO v_business_sales_count
FROM user_sales_counts
WHERE user_id = v_owner_user_id AND business_id = NEW.business_id;

v_effective_limit := get_effective_sales_limit(v_owner_user_id);

IF COALESCE(v_business_sales_count, 0) >= v_effective_limit THEN
RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: This business has reached the free plan limit of % sales. Please upgrade to continue.', v_effective_limit
USING HINT = 'Business has reached the maximum number of sales allowed on the free tier';
END IF;
END IF;

RETURN NEW;
END;
$function$;
