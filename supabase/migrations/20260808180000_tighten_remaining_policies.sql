-- Close the remaining policy holes on call_alerts / override_logs / patients /
-- staff_members.
--
-- Principle: the app only ever touches these tables from pages that require a
-- real staff login (StaffPortal, AdminDashboard, EmergencyOverride) or from the
-- public QueueTracker/CheckIn pages which run on the anon key. All writes go
-- through the `authenticated` role; the public QueueTracker reads via anon.
--
-- 1. call_alerts
--    - anon NEVER inserts call_alerts (only authenticated staff do, via
--      queueService.recordCallAlert from StaffPortal/AdminDashboard), so the
--      anon INSERT policy is dropped.
--    - The public QueueTracker subscribes to realtime INSERT on call_alerts
--      (hooks/useRealtimeAlerts) and Realtime only delivers rows the
--      subscriber's role can SELECT, so anon keeps a SELECT — scoped to today,
--      since alerts are only ever same-day (called_at defaults to now()).
--    - The authenticated INSERT/SELECT/UPDATE policies are dropped as over-broad;
--      staff inserts/views/updates are covered by the public role policies
--      ("alerts: staff can insert/view/update").
--    - anon "acknowledge" is dropped: queueService.acknowledgeCallAlert has no
--      page callers, and staff acknowledgement is covered by
--      "alerts: staff can update".
--
-- 2. override_logs
--    - Only EmergencyOverride.tsx (staff-gated) writes override_logs, so anon
--      INSERT/SELECT and authenticated INSERT/SELECT are dropped. Staff access
--      is covered by "overrides: staff can insert/view" (public role).
--
-- 3. patients
--    - "auth_select_patients" / "auth_update_patients" (true) let ANY
--      authenticated non-staff user read/rewrite every patient record. Staff
--      reads/updates are covered by the public policies
--      ("patients: staff can view all / staff can update") and patients' own
--      record by "patients: own record", so the auth-wide policies are dropped.
--    - "anon_update_patients_today" is dropped: no page writes patients on the
--      anon key — the only patient insert is the check_in_patient RPC
--      (SECURITY DEFINER) and all updates run as authenticated staff.
--      anon SELECT today is kept (queue tracker + check-in reads).
--
-- 4. staff_members
--    - "auth_select_staff_members" (true) let any authenticated user read the
--      full staff roster. Admins read the roster via "staff: admin can view
--      all"; every staff member reads their own row via "staff: own record"
--      (getCurrentStaff, logEmergencyOverride name lookup). The auth-wide
--      policy is therefore dropped.
-- ---------------------------------------------------------------------------

-- ── 1. call_alerts ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_call_alerts" ON public.call_alerts;

DROP POLICY IF EXISTS "anon_select_call_alerts" ON public.call_alerts;

CREATE POLICY "anon_select_call_alerts_today"
  ON public.call_alerts
  FOR SELECT
  TO anon
  USING ((called_at)::date = CURRENT_DATE);

DROP POLICY IF EXISTS "anon_acknowledge_call_alerts" ON public.call_alerts;

DROP POLICY IF EXISTS "auth_insert_call_alerts" ON public.call_alerts;

DROP POLICY IF EXISTS "auth_select_call_alerts" ON public.call_alerts;

DROP POLICY IF EXISTS "auth_update_call_alerts" ON public.call_alerts;

-- ── 2. override_logs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_override_logs" ON public.override_logs;

DROP POLICY IF EXISTS "anon_select_override_logs" ON public.override_logs;

DROP POLICY IF EXISTS "auth_insert_override_logs" ON public.override_logs;

DROP POLICY IF EXISTS "auth_select_override_logs" ON public.override_logs;

-- ── 3. patients ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_select_patients" ON public.patients;

DROP POLICY IF EXISTS "auth_update_patients" ON public.patients;

DROP POLICY IF EXISTS "anon_update_patients_today" ON public.patients;

-- ── 4. staff_members ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_select_staff_members" ON public.staff_members;
