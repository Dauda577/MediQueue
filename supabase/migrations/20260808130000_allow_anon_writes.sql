CREATE POLICY "anon_update_patients" ON patients FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert_call_alerts" ON call_alerts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_call_alerts" ON call_alerts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_call_alerts" ON call_alerts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert_override_logs" ON override_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_override_logs" ON override_logs FOR SELECT TO anon USING (true);
