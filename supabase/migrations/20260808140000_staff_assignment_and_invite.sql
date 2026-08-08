ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES staff_members(id) ON DELETE SET NULL;
CREATE POLICY "auth_insert_staff_members" ON staff_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "anon_insert_staff_members" ON staff_members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_staff_members" ON staff_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_staff_members" ON staff_members FOR UPDATE TO anon USING (true) WITH CHECK (true);
