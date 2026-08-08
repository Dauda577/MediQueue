-- Add staff assignment column to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES staff_members(id) ON DELETE SET NULL;

-- Allow authenticated users to insert staff members (for invite flow)
CREATE POLICY "auth_insert_staff_members"
  ON staff_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anon to insert staff members too (for invite flow from admin panel)
CREATE POLICY "anon_insert_staff_members"
  ON staff_members
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to update staff members (activate/deactivate)
CREATE POLICY "auth_update_staff_members"
  ON staff_members
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon to update staff members
CREATE POLICY "anon_update_staff_members"
  ON staff_members
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
