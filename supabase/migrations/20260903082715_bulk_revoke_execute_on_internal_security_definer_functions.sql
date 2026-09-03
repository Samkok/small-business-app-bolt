/*
# Bulk revoke EXECUTE from public/anon/authenticated on internal SECURITY DEFINER functions

## Problem
- Many SECURITY DEFINER functions that are only meant to be called by triggers,
  pg_cron, or service-role are callable by any user (including anonymous).

## Changes
- REVOKE EXECUTE on all internal/trigger-only functions.
- Uses DO blocks with exception handling to skip functions that don't exist.
*/

-- Trigger functions
REVOKE EXECUTE ON FUNCTION public.auto_create_default_currency() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_email_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preserve_user_display_names_before_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.populate_batch_importer_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.populate_cart_creator_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.populate_expense_creator_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.populate_sale_creator_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_role_assigned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_sale_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_sale_voided() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_sales_count_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_subscription_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_push_notification_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_subscription_push_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_user_notifications_on_business_removal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_sales_count_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_sales_count_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_subscription_status_change() FROM PUBLIC, anon, authenticated;

-- pg_cron / admin functions (with correct signatures)
REVOKE EXECUTE ON FUNCTION public.reconcile_all_sales_counts(boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_sales_count(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_scheduled_reconciliation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_manual_reconciliation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_credits() FROM PUBLIC, anon, authenticated;

-- Webhook-internal functions (use DO blocks for safety)
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.log_webhook_error(text, text, uuid, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.mark_webhook_event_processed(text, text, uuid, bigint, integer, jsonb) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_webhook_event_processed(text) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_recent_webhook_update(uuid) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.cleanup_old_webhook_records() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Sales subscription limit check (trigger)
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.check_sales_subscription_limit() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Admin/debug functions
REVOKE EXECUTE ON FUNCTION public.get_sales_count_discrepancies() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_sales_count_with_verification(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_user_sales_count(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Referral internal functions
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.increment_referral_code_signups(text) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.increment_referral_code_signups(uuid) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.increment_referral_conversions(text) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- auto_increment_sales_count trigger
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.auto_increment_sales_count() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
