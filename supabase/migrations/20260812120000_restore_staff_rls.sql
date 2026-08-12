-- Restore a working RLS model for MediQueue after the tighten chain
-- (20260808160000/1700/1800) dropped every open write path. A later, incomplete
-- attempt in the live DB created a get_staff_role() helper with the WRONG
-- return type plus the staff policies that depend on it; because the function
-- is broken, every policy check silently fails and the admin dashboard swallows
-- the errors (empty catch blocks), so all patient mutations appear dead.
--
-- Fix strategy (idempotent):
--   * DROP FUNCTION ... CASCADE — drops the broken helper AND every policy that
--     depends on it in one shot (the live DB already has the "staff can ..."
--     policy names, so they must be recreated, not just dropped)
--   * CREATE the corrected helper with a stable contract (RETURNS text)
--   * DROP POLICY IF EXISTS for every known legacy name, then recreate the
--     staff-scoped policies the app needs — INCLUDING the admin-delete policies
--     that exist live and would otherwise be lost to CASCADE
-- It does NOT modify check_in_patient(), get_hourly_checkins(), or any other
-- existing function.

-- ── 0. Helper: current user's staff role (NULL when not linked to staff) ──
-- The live DB already defines get_staff_role() with a different return type
-- (42P13) and every staff policy depends on it (2BP01), so CASCADE drops them
-- all; they are recreated below with the correct function.
DROP FUNCTION IF EXISTS public.get_staff_role() CASCADE;
CREATE FUNCTION public.get_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.staff_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_role() TO anon, authenticated, service_role;

-- ── 1. patients ────────────────────────────────────────────────────────────
-- Drop every legacy open write path (only some may exist if the tighten
-- migrations were applied in a different order / partially).
DROP POLICY IF EXISTS "anon_insert_patients" ON public.patients;
DROP POLICY IF EXISTS "anon_update_patients" ON public.patients;
DROP POLICY IF EXISTS "anon_update_patients_today" ON public.patients;
DROP POLICY IF EXISTS "auth_update_patients" ON public.patients;

-- Any staff-linked user can view and update all patients. This is the core fix:
-- it restores the UPDATE path used by updatePatientStatus / updatePatientPriority
-- / markAsServed / movePatientToStage / requeuePatient / assignPatientToStaff.
DROP POLICY IF EXISTS "patients: staff can view all" ON public.patients;
CREATE POLICY "patients: staff can view all"
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "patients: staff can update" ON public.patients;
CREATE POLICY "patients: staff can update"
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (public.get_staff_role() IS NOT NULL)
  WITH CHECK (public.get_staff_role() IS NOT NULL);

-- Recreate the admin-delete policy that existed live (dropped by CASCADE above).
DROP POLICY IF EXISTS "patients: admin can delete" ON public.patients;
CREATE POLICY "patients: admin can delete"
  ON public.patients
  FOR DELETE
  TO authenticated
  USING (public.get_staff_role() = 'admin');

-- Public queue tracker still reads today's rows on the anon key.
DROP POLICY IF EXISTS "anon_select_patients" ON public.patients;
DROP POLICY IF EXISTS "anon_select_patients_today" ON public.patients;
CREATE POLICY "anon_select_patients_today"
  ON public.patients
  FOR SELECT
  TO anon
  USING (checked_in_at::date = CURRENT_DATE);

-- ── 2. staff_members ──────────────────────────────────────────────────────
-- Remove every legacy open policy (some may remain if 1700/1800 never ran).
DROP POLICY IF EXISTS "anon_insert_staff_members" ON public.staff_members;
DROP POLICY IF EXISTS "anon_update_staff_members" ON public.staff_members;
DROP POLICY IF EXISTS "auth_insert_staff_members" ON public.staff_members;
DROP POLICY IF EXISTS "auth_update_staff_members" ON public.staff_members;
DROP POLICY IF EXISTS "auth_select_staff_members" ON public.staff_members;

-- Admins manage the roster; every staff member reads their own row
-- (getCurrentStaff / logEmergencyOverride / admin staff tab).
DROP POLICY IF EXISTS "staff: admin can view all" ON public.staff_members;
CREATE POLICY "staff: admin can view all"
  ON public.staff_members
  FOR SELECT
  TO authenticated
  USING (public.get_staff_role() = 'admin');

DROP POLICY IF EXISTS "staff: own record" ON public.staff_members;
CREATE POLICY "staff: own record"
  ON public.staff_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff: admin can insert" ON public.staff_members;
CREATE POLICY "staff: admin can insert"
  ON public.staff_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_staff_role() = 'admin');

DROP POLICY IF EXISTS "staff: admin can update" ON public.staff_members;
CREATE POLICY "staff: admin can update"
  ON public.staff_members
  FOR UPDATE
  TO authenticated
  USING (public.get_staff_role() = 'admin')
  WITH CHECK (public.get_staff_role() = 'admin');

-- Recreate the admin-delete policy that existed live (dropped by CASCADE above).
DROP POLICY IF EXISTS "staff: admin can delete" ON public.staff_members;
CREATE POLICY "staff: admin can delete"
  ON public.staff_members
  FOR DELETE
  TO authenticated
  USING (public.get_staff_role() = 'admin');

-- ── 3. call_alerts ────────────────────────────────────────────────────────
-- Staff insert/view/acknowledge alerts (queueService.recordCallAlert +
-- callPatientToConsult); the public tracker reads today's rows as anon.
DROP POLICY IF EXISTS "anon_insert_call_alerts" ON public.call_alerts;
DROP POLICY IF EXISTS "anon_update_call_alerts" ON public.call_alerts;
DROP POLICY IF EXISTS "anon_acknowledge_call_alerts" ON public.call_alerts;
DROP POLICY IF EXISTS "auth_insert_call_alerts" ON public.call_alerts;
DROP POLICY IF EXISTS "auth_select_call_alerts" ON public.call_alerts;
DROP POLICY IF EXISTS "auth_update_call_alerts" ON public.call_alerts;

DROP POLICY IF EXISTS "alerts: staff can insert" ON public.call_alerts;
CREATE POLICY "alerts: staff can insert"
  ON public.call_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "alerts: staff can view" ON public.call_alerts;
CREATE POLICY "alerts: staff can view"
  ON public.call_alerts
  FOR SELECT
  TO authenticated
  USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "alerts: staff can update" ON public.call_alerts;
CREATE POLICY "alerts: staff can update"
  ON public.call_alerts
  FOR UPDATE
  TO authenticated
  USING (public.get_staff_role() IS NOT NULL)
  WITH CHECK (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "anon_select_call_alerts" ON public.call_alerts;
DROP POLICY IF EXISTS "anon_select_call_alerts_today" ON public.call_alerts;
CREATE POLICY "anon_select_call_alerts_today"
  ON public.call_alerts
  FOR SELECT
  TO anon
  USING (called_at::date = CURRENT_DATE);

-- ── 4. override_logs ──────────────────────────────────────────────────────
-- Staff log/view emergency overrides (EmergencyOverride page).
DROP POLICY IF EXISTS "anon_insert_override_logs" ON public.override_logs;
DROP POLICY IF EXISTS "anon_select_override_logs" ON public.override_logs;
DROP POLICY IF EXISTS "auth_insert_override_logs" ON public.override_logs;
DROP POLICY IF EXISTS "auth_select_override_logs" ON public.override_logs;

DROP POLICY IF EXISTS "overrides: staff can insert" ON public.override_logs;
CREATE POLICY "overrides: staff can insert"
  ON public.override_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "overrides: staff can view" ON public.override_logs;
CREATE POLICY "overrides: staff can view"
  ON public.override_logs
  FOR SELECT
  TO authenticated
  USING (public.get_staff_role() IS NOT NULL);
