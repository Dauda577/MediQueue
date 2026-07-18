-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE override_logs ENABLE ROW LEVEL SECURITY;

-- ── patients table ──

-- Anonymous users can insert new patients (check-in flow)
CREATE POLICY "anon_insert_patients"
  ON patients
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anonymous users can read patients (count for queue number, queue tracker)
CREATE POLICY "anon_select_patients"
  ON patients
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated staff can read all patients
CREATE POLICY "auth_select_patients"
  ON patients
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated staff can update patients (status, priority, etc.)
CREATE POLICY "auth_update_patients"
  ON patients
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── staff_members table ──

-- Authenticated staff can read staff members (admin dashboard)
CREATE POLICY "auth_select_staff_members"
  ON staff_members
  FOR SELECT
  TO authenticated
  USING (true);

-- ── call_alerts table ──

-- Authenticated staff can read call alerts
CREATE POLICY "auth_select_call_alerts"
  ON call_alerts
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated staff can insert call alerts (when calling next patient)
CREATE POLICY "auth_insert_call_alerts"
  ON call_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated staff can update call alerts (acknowledge)
CREATE POLICY "auth_update_call_alerts"
  ON call_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── override_logs table ──

-- Authenticated staff can read override logs
CREATE POLICY "auth_select_override_logs"
  ON override_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated staff can insert override logs
CREATE POLICY "auth_insert_override_logs"
  ON override_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for the patients table (for live queue updates)
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
