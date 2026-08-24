/*
# Remove old permissive product-images and profile-images storage policies

## Problem
Old storage policies on product-images and profile-images check only bucket_id
and folder name, but do NOT check ownership (auth.uid() = owner). They allow any
authenticated user to update/delete any file in these buckets.

Properly scoped owner-based policies already exist:
- "Users can update own product images"
- "Users can delete own product images"
- "Users can update own profile images"
- "Users can delete own profile images"

## Fix
Drop the four old overly permissive policies.
*/

DROP POLICY IF EXISTS "Users can update their business product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their business product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
