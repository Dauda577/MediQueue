-- Atomic claim functions for the queue.
--
-- Why: the previous flow (select next waiting patient, then update status,
-- then insert a call alert) was three separate statements. Two staff members
-- in the same department could both read the same "next" patient and both
-- claim it, and handleSelectPatient assigned a staff member without updating
-- status/called_at — leaving patients stuck in 'waiting' while assigned.
--
-- Fix: a single SECURITY DEFINER function per operation, running as one
-- transaction. claim_next_patient() locks the chosen row with
-- FOR UPDATE SKIP LOCKED so concurrent callers can never claim the same
-- patient; claim_patient() claims a specific patient and returns an empty
-- set if it is no longer waiting.
--
-- Usage:
--   SELECT * FROM claim_next_patient('OPD', '0f7b...', 'Room 3, West Wing');
--   SELECT * FROM claim_patient('<patient-id>', '0f7b...', 'Room 3, West Wing');

CREATE OR REPLACE FUNCTION public.claim_next_patient(
  p_department public.stage,
  p_staff_id uuid DEFAULT NULL,
  p_station text DEFAULT NULL
)
RETURNS SETOF public.patients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient public.patients;
BEGIN
  -- Atomically pick the next waiting patient in this department.
  -- FOR UPDATE SKIP LOCKED: a concurrent claim (even the exact same query)
  -- will skip rows already locked, so only one caller wins.
  SELECT *
  INTO v_patient
  FROM public.patients
  WHERE current_stage = p_department
    AND status = 'waiting'
    AND checked_in_at >= now() - interval '24 hours'
  ORDER BY
    CASE priority WHEN 'emergency' THEN 0 WHEN 'priority' THEN 1 ELSE 2 END,
    position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN; -- empty set => nothing waiting
  END IF;

  -- Claim the patient: mark in-consultation, stamp called_at, assign staff.
  UPDATE public.patients
  SET status = 'in_consultation',
      called_at = now(),
      assigned_to = COALESCE(p_staff_id, assigned_to),
      assigned_station = COALESCE(p_station, assigned_station)
  WHERE id = v_patient.id;

  -- Record the call alert in the same transaction.
  INSERT INTO public.call_alerts (patient_id, department, queue_number)
  VALUES (v_patient.id, p_department, v_patient.queue_number);

  RETURN QUERY SELECT * FROM public.patients WHERE id = v_patient.id;
END;
$$;

-- Claims a specific patient (used by "select patient" and admin "Call to
-- Consult"). Only succeeds while the patient is still waiting; returns an
-- empty set otherwise so the caller can react to a lost race.
CREATE OR REPLACE FUNCTION public.claim_patient(
  p_patient_id uuid,
  p_staff_id uuid DEFAULT NULL,
  p_station text DEFAULT NULL
)
RETURNS SETOF public.patients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.patients
  SET status = 'in_consultation',
      called_at = now(),
      assigned_to = COALESCE(p_staff_id, assigned_to),
      assigned_station = COALESCE(p_station, assigned_station)
  WHERE id = p_patient_id
    AND status = 'waiting'
    AND checked_in_at >= now() - interval '24 hours'
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_patient TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_patient TO anon, authenticated, service_role;
