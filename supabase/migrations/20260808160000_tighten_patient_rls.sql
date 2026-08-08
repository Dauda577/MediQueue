-- Tighten RLS to match actual data access patterns for MediQueue demo.
--
-- The client app runs on the anon key for all demo/staff operations, so we
-- CANNOT lock patients down to the `authenticated` role. Instead we:
--
--   1. Drop the direct `anon` INSERT on `patients` — the only write path is
--      the SECURITY DEFINER `check_in_patient` RPC, which bypasses anon RLS.
--      This stops an attacker from inserting rows with attacker-chosen values
--      for `queue_number` / `position` / `priority`.
--   2. Scope `anon` UPDATE on `patients` to today's rows only. The app never
--      modifies anything outside "today" (all queries filter
--      `checked_in_at >= today`). Prevents rewriting historical PHI.
--   3. Scope `anon` SELECT on `patients` to today's rows only, so the anon key
--      can no longer bulk-read the entire patient/phone history.
--   4. Restrict `anon` UPDATE on `call_alerts` to only the "acknowledge"
--      operation, which is the sole mutation the app performs
--      (`queueService.acknowledgeCallAlert`).
--
-- Admin/staff real accounts (via the invite flow) use the `authenticated`
-- role and keep their existing broad policies untouched.
-- ---------------------------------------------------------------------------

-- ── 1. Remove unused direct anon insert; queue_number/position are computed
--    server-side in check_in_patient only.
DROP POLICY IF EXISTS "anon_insert_patients" ON public.patients;

-- ── 2. anon UPDATE restricted to today's rows (all adapter mutations are
--    today-scoped; see queueService).
DROP POLICY IF EXISTS "anon_update_patients" ON public.patients;

CREATE POLICY "anon_update_patients_today"
  ON public.patients
  FOR UPDATE
  TO anon
  USING (checked_in_at::date = CURRENT_DATE)
  WITH CHECK (checked_in_at::date = CURRENT_DATE);

-- ── 3. anon SELECT restricted to today's rows. Readiness: every read the app
--    performs (queue, dashboard, tracker) filters `checked_in_at >= today`.
DROP POLICY IF EXISTS "anon_select_patients" ON public.patients;

CREATE POLICY "anon_select_patients_today"
  ON public.patients
  FOR SELECT
  TO anon
  USING (checked_in_at::date = CURRENT_DATE);

-- ── 4. anon UPDATE on call_alerts only allowed to acknowledge
--    (the sole app mutation — queueService.acknowledgeCallAlert).
DROP POLICY IF EXISTS "anon_update_call_alerts" ON public.call_alerts;

CREATE POLICY "anon_acknowledge_call_alerts"
  ON public.call_alerts
  FOR UPDATE
  TO anon
  USING (acknowledged = false)
  WITH CHECK (acknowledged = true);