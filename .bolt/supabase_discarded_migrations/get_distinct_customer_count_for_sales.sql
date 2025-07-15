CREATE OR REPLACE FUNCTION get_distinct_customer_count_for_sales(
  business_id_param uuid,
  start_date_param timestamptz,
  end_date_param timestamptz
)
RETURNS bigint AS $$
  SELECT COUNT(DISTINCT customer_id)
  FROM sales
  WHERE business_id = business_id_param
    AND sale_date >= start_date_param
    AND sale_date <= end_date_param;
$$ LANGUAGE sql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION get_distinct_customer_count_for_sales(uuid, timestamptz, timestamptz) TO authenticated;
