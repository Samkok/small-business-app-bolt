/*
# Remove overly permissive business-images storage policies

## Problem
Two old storage policies on `business-images` bucket allow ANY authenticated user
to update/delete ANY object without an ownership check:
- "Users can update their business images" (no owner check)
- "Users can delete their business images" (no owner check)

These are superseded by properly scoped policies:
- "Users can update own business images" (checks auth.uid() = owner)
- "Users can delete own business images" (checks auth.uid() = owner)

## Fix
Drop the two overly permissive policies. The owner-scoped policies remain.
*/

DROP POLICY IF EXISTS "Users can update their business images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their business images" ON storage.objects;
