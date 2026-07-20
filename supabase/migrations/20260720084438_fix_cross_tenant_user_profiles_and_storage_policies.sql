/*
# Fix Cross-Tenant Data Exposure: user_profiles RLS + Storage Policies

## Summary
Fixes two critical cross-tenant data leaks:
1. D1: user_profiles admin-read policy was uncorrelated — any business admin could
   read ALL user profiles. Now correlates through shared business membership.
2. D6: Storage UPDATE/DELETE policies only checked bucket_id — any authenticated user
   could overwrite/delete any tenant's images. Now scoped to file owner.

## Changes

### user_profiles
- DROP the existing uncorrelated admin-read policy.
- CREATE new correlated policy: users read own profile OR profiles of users
  who share at least one business (via user_business_roles join).

### Storage (business-images, product-images, profile-images)
- DROP existing UPDATE/DELETE policies on all three buckets.
- CREATE new owner-scoped UPDATE/DELETE policies.

## Security Impact
- D1: Business admins can only read profiles of shared-business members.
- D6: Users can only modify/delete files they uploaded.
*/

-- ============================================================
-- D1: Fix user_profiles admin-read policy
-- ============================================================
DROP POLICY IF EXISTS "Users can read own profile or admins can read for invitations" ON user_profiles;

CREATE POLICY "Users can read own profile or shared business members"
  ON user_profiles FOR SELECT TO authenticated
  USING (
    ((select auth.uid()) = user_id)
    OR EXISTS (
      SELECT 1 FROM user_business_roles ubr_caller
      JOIN user_business_roles ubr_target
        ON ubr_caller.business_id = ubr_target.business_id
      WHERE ubr_caller.user_id = (select auth.uid())
        AND ubr_caller.role = 'admin'
        AND ubr_target.user_id = user_profiles.user_id
    )
  );

-- ============================================================
-- D6: Fix storage UPDATE/DELETE — scope to file owner
-- ============================================================

-- business-images
DROP POLICY IF EXISTS "Users can update business images" ON storage.objects;
CREATE POLICY "Users can update own business images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-images' AND (select auth.uid()) = owner);

DROP POLICY IF EXISTS "Users can delete business images" ON storage.objects;
CREATE POLICY "Users can delete own business images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-images' AND (select auth.uid()) = owner);

-- product-images
DROP POLICY IF EXISTS "Users can update product images" ON storage.objects;
CREATE POLICY "Users can update own product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (select auth.uid()) = owner);

DROP POLICY IF EXISTS "Users can delete product images" ON storage.objects;
CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (select auth.uid()) = owner);

-- profile-images
DROP POLICY IF EXISTS "Users can update profile images" ON storage.objects;
CREATE POLICY "Users can update own profile images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-images' AND (select auth.uid()) = owner);

DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;
CREATE POLICY "Users can delete own profile images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-images' AND (select auth.uid()) = owner);
