/*
  # Security hardening: dedupe storage policies, add policies to webhook/push tables

  1. Storage policy cleanup
    - Drops duplicate public SELECT policies on storage.objects for three buckets
      (business-images, product-images, profile-images). Each bucket keeps a
      single public read policy so images remain serveable by URL without
      allowing multiple overlapping policy evaluations.

  2. Webhook + push token tables
    - processed_webhook_events, push_token, and webhook_errors are server-only
      tables written by edge functions using the service role (which bypasses
      RLS). They must not be readable or writable by client roles.
    - Adds explicit deny-all policies for the authenticated and anon roles so
      the tables are provably locked down (and the "RLS enabled, no policies"
      linter warning is resolved).

  3. Important notes
    - service_role continues to bypass RLS and is unaffected.
    - No data is modified.
*/

-- 1. Drop duplicate public SELECT policies on storage.objects
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Profile Images" ON storage.objects;

-- 2. Lock down server-only tables for client roles.
--    Each table has RLS enabled already; we add explicit deny policies so
--    authenticated and anonymous users cannot read or modify any rows.

-- processed_webhook_events
DROP POLICY IF EXISTS "Deny all client access to processed_webhook_events" ON public.processed_webhook_events;
CREATE POLICY "Deny all client access to processed_webhook_events"
  ON public.processed_webhook_events
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- push_token
DROP POLICY IF EXISTS "Deny all client access to push_token" ON public.push_token;
CREATE POLICY "Deny all client access to push_token"
  ON public.push_token
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- webhook_errors
DROP POLICY IF EXISTS "Deny all client access to webhook_errors" ON public.webhook_errors;
CREATE POLICY "Deny all client access to webhook_errors"
  ON public.webhook_errors
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
