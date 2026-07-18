-- SECURITY DEFINER function to check in a patient.
-- Runs with the privileges of the function owner (the database user who created it),
-- bypassing RLS entirely. The public can only EXECUTE this function (no table access).
--
-- Usage: SELECT * FROM check_in_patient('John Doe', 'OPD', '+233501234567', 'normal');

CREATE OR REPLACE FUNCTION check_in_patient(
  p_full_name text,
  p_department public.stage,
  p_phone text DEFAULT NULL,
  p_priority public.patient_priority DEFAULT 'normal'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_count bigint;
  v_queue_number integer;
  v_token_id text;
  v_patient public.patients;
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

  -- Insert the patient
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
  RETURNING * INTO v_patient;

  -- Return as JSON so the caller gets back id, token_id, queue_number, etc.
  RETURN row_to_json(v_patient);
END;
$$;

-- Grant execute to the anon role (and authenticated) so the check-in page can call it
GRANT EXECUTE ON FUNCTION check_in_patient TO anon, authenticated, service_role;

-- Revoke direct table access from anon — no longer needed
-- (Policies are kept for other flows but anon no longer needs SELECT/INSERT on patients)
