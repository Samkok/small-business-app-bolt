/*
# Web orders nobody handled in 7 days are marked abandoned

A web order arrives as an active cart. If the shop never checks it out or deletes it, it would
sit in Active Carts forever. After 7 days it is marked 'abandoned': it leaves Active Carts
(getActiveCarts selects status = 'active') and the customer's status page reads "cancelled".
Only carts.source = 'web' are touched; carts made in the app are never expired.

Checked on 2026-09-20: no function, trigger, policy or app code treats 'abandoned' specially,
and no cart has ever had that status. pg_cron is installed (two jobs already run at 02:00 UTC).
*/
SELECT cron.schedule(
  'abandon-stale-web-carts',
  '17 19 * * *', -- 19:17 UTC = 02:17 Phnom Penh
  $$UPDATE public.carts
      SET status = 'abandoned', updated_at = now()
    WHERE source = 'web' AND status = 'active'
      AND created_at < now() - interval '7 days'$$
);
