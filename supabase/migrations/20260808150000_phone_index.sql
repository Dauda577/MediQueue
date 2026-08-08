CREATE INDEX IF NOT EXISTS idx_patients_phone_status ON patients(phone, status, checked_in_at);
