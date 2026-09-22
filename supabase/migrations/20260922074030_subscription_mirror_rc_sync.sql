-- The app now reads the signed-in user's plan from RevenueCat directly. user_subscriptions
-- is a mirror kept for monitoring and server-side checks. Besides the webhook, the
-- sync-subscription function corrects the mirror after verifying with RevenueCat's API;
-- its writes are tagged 'rc_sync' so both sources stay distinguishable.

ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_updated_by_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_updated_by_check
  CHECK (updated_by = ANY (ARRAY['webhook'::text, 'client'::text, 'system'::text, 'rc_sync'::text]));

COMMENT ON COLUMN public.user_subscriptions.updated_by IS
  'webhook = RevenueCat event; rc_sync = sync-subscription verified with the RevenueCat API; client/system = legacy';
COMMENT ON COLUMN public.user_subscriptions.last_validated_at IS
  'Last time sync-subscription confirmed this row against RevenueCat';
