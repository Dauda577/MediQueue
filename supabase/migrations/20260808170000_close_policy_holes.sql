-- Close legacy public/anon policy holes that survived the RLS tightening.

-- 1. Remove the public INSERT backdoor on patients. The app check-in path
--    goes through the check_in_patient RPC (SECURITY DEFINER); no client
--    code inserts directly into patients anymore.
DROP POLICY IF EXISTS "patients: open check-in" ON patients;

-- 2. Remove anon insert/update of staff_members. Staff management (invite,
--    activate/deactivate) only happens for authenticated admin/staff users.
DROP POLICY IF EXISTS "anon_insert_staff_members" ON staff_members;
DROP POLICY IF EXISTS "anon_update_staff_members" ON staff_members;

-- 3. Restrict authenticated staff insert/update to admins (invite-only).
DROP POLICY IF EXISTS "auth_insert_staff_members" ON staff_members;
CREATE POLICY "auth_insert_staff_members"
  ON staff_members
  FOR INSERT
  TO authenticated
  WITH CHECK (get_staff_role() = 'admin');

DROP POLICY IF EXISTS "auth_update_staff_members" ON staff_members;
CREATE POLICY "auth_update_staff_members"
  ON staff_members
  FOR UPDATE
  TO authenticated
  USING (get_staff_role() = 'admin')
  WITH CHECK (get_staff_role() = 'admin');