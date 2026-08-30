/*
# Drop old 3-arg calculate_cogs overload

## Problem
The previous migration added a 4-arg calculate_cogs(uuid, timestamp, timestamp, uuid DEFAULT NULL).
The old 3-arg version still exists, causing "function is not unique" errors when called with 3 args
because Postgres cannot choose between the two.

## Fix
Drop the old 3-arg signature. The 4-arg version with DEFAULT NULL handles all existing callers.
*/

DROP FUNCTION IF EXISTS calculate_cogs(uuid, timestamp, timestamp);
