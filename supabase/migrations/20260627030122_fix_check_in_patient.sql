-- Replace check_in_patient with SETOF return type for proper PostgREST compatibility.
-- The previous version used RETURNS json which can cause 409 serialization issues.
-- This also avoids the need for row_to_json() entirely.

DROP FUNCTION IF EXISTS check_in_patient;

CREATE OR REPLACE FUNCTION check_in_patient(
  p_full_name text,
  p_department public.stage,
  p_phone text DEFAULT NULL,
  p_priority public.patient_priority DEFAULT 'normal'
)
RETURNS SETOF public.patients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_count bigint;
  v_queue_number integer;
  v_token_id text;
BEGIN
  -- Count today's patients for the given department
  SELECT COUNT(*) INTO v_count
  FROM public.patients
  WHERE initial_department = p_department
    AND checked_in_at::date = v_today;

  v_queue_number := v_count + 1;

  -- Generate token ID
  v_token_id := CASE p_department
    WHEN 'OPD'      THEN 'MQ-'
    WHEN 'Lab'      THEN 'LB-'
    WHEN 'Maternity' THEN 'MT-'
    WHEN 'Pharmacy' THEN 'PH-'
  END || LPAD(v_queue_number::text, 5, '0');

  -- Insert and return the created row
  RETURN QUERY
  INSERT INTO public.patients (
    full_name,
    phone,
    initial_department,
    current_stage,
    status,
    priority,
    queue_number,
    token_id,
    position
  ) VALUES (
    p_full_name,
    NULLIF(p_phone, ''),
    p_department,
    p_department,
    'waiting',
    p_priority,
    v_queue_number,
    v_token_id,
    v_queue_number
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION check_in_patient TO anon, authenticated, service_role;
