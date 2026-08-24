/*
# Add owner_disabled to businesses_access_state_check constraint

## Problem
The CHECK constraint on businesses.access_state only allows 'active' and 'read_only_sales'.
The new 'owner_disabled' state is rejected by this constraint.

## Fix
Drop and recreate the constraint to include 'owner_disabled' as a valid value.
*/

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_access_state_check;

ALTER TABLE businesses ADD CONSTRAINT businesses_access_state_check
  CHECK (access_state = ANY (ARRAY['active'::text, 'read_only_sales'::text, 'owner_disabled'::text]));
