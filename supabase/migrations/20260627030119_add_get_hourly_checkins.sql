CREATE OR REPLACE FUNCTION get_hourly_checkins(date date)
RETURNS TABLE(hour text, count bigint)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    TO_CHAR(checked_in_at, 'HH24:00')::text AS hour,
    COUNT(*)::bigint AS count
  FROM patients
  WHERE checked_in_at::date = $1
  GROUP BY TO_CHAR(checked_in_at, 'HH24:00')
  ORDER BY hour;
$$;
