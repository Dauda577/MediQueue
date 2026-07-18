-- Fix queue number generation: use MAX(queue_number) instead of today's COUNT
-- to avoid unique constraint violations on token_id when legacy rows exist.

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
  v_max integer;
  v_queue_number integer;
  v_token_id text;
BEGIN
  -- Use MAX(queue_number) so new numbers never conflict with existing rows
  SELECT COALESCE(MAX(queue_number), 0) INTO v_max
  FROM public.patients
  WHERE initial_department = p_department;

  v_queue_number := v_max + 1;

  -- Generate token ID
  v_token_id := CASE p_department
    WHEN 'OPD'      THEN 'MQ-'
    WHEN 'Lab'      THEN 'LB-'
    WHEN 'Maternity' THEN 'MT-'
    WHEN 'Pharmacy' THEN 'PH-'
  END || LPAD(v_queue_number::text, 5, '0');

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
