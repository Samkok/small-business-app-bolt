/*
# Tell the owner when web orders spike

Security assessment 2026-09-21, finding 10: nothing alerted anyone when orders flooded in.
Once a day, any business that received more than 50 web orders in the previous 24 hours gets one
notification (and therefore one push) for its owner. It is a tripwire, not a block: the
per-phone, per-IP and per-business limits in create_web_order() still do the blocking.

The notification reuses the type 'web_order_received' (so no app release is needed to display
it) but carries no cart_id, which makes a tap land on Sales, Active Carts.
The owner's "Online orders" notification preference is respected.
*/
CREATE OR REPLACE FUNCTION public.notify_web_order_spikes(p_threshold integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  r record;
  v_sent integer := 0;
BEGIN
  FOR r IN
    SELECT b.id AS business_id, b.business_name, b.owner_user_id, count(*)::integer AS orders
      FROM public.web_order_log l
      JOIN public.businesses b ON b.id = l.business_id
     WHERE l.created_at > now() - interval '24 hours'
       AND b.owner_user_id IS NOT NULL
     GROUP BY b.id, b.business_name, b.owner_user_id
    HAVING count(*) > p_threshold
  LOOP
    IF COALESCE((SELECT np.web_orders_enabled FROM public.notification_preferences np WHERE np.user_id = r.owner_user_id), true) THEN
      INSERT INTO public.notifications (user_id, business_id, type, title, message, data)
      VALUES (
        r.owner_user_id, r.business_id, 'web_order_received',
        'Unusual number of online orders',
        r.business_name || ' received ' || r.orders || ' online orders in the last 24 hours. If that is not expected, check Active Carts, block the numbers that are abusing it, or switch the menu off for a while.',
        jsonb_build_object('business_id', r.business_id, 'business_name', r.business_name, 'orders_24h', r.orders, 'kind', 'spike')
      );
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_web_order_spikes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_web_order_spikes(integer) TO service_role;

SELECT cron.schedule(
  'web-order-spike-alert',
  '5 1 * * *', -- 01:05 UTC = 08:05 Phnom Penh
  $$SELECT public.notify_web_order_spikes(50)$$
);
