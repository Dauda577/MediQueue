// ── Enums / Unions

export type Stage = 'OPD' | 'Lab' | 'Pharmacy';

export type QueueStatus =
  | 'waiting'
  | 'in_consultation'
  | 'in_lab'
  | 'in_pharmacy'
  | 'done'
  | 'cancelled';

export type PatientPriority = 'normal' | 'priority' | 'emergency';

export type UserRole = 'patient' | 'staff' | 'admin';

export type StaffRole = 'doctor' | 'nurse' | 'pharmacist' | 'lab_tech' | 'admin';


// ── Patient 
// Represents a full patient record as stored in the DB.
// user_id links to Supabase auth.users (optional: patients may check in without an account).

export interface Patient {
  id: string;
  user_id?: string;           // links to auth.users if patient has an account
  full_name: string;
  phone?: string;
  token_id: string;
  initial_department: Stage;  // where the patient first checked in
  current_stage: Stage;       // where the patient currently is in the journey
  status: QueueStatus;
  priority: PatientPriority;
  position: number;
  queue_number: number;
  assigned_station?: string;
  checked_in_at: string;
  called_at?: string;
  done_at?: string;
  created_at: string;
}


// ── Queue Entry 
// Lighter shape used for list views and realtime queue display.
// Not a separate DB table — derived from Patient via query or view.

export interface QueueEntry {
  id: string;
  token_id: string;
  full_name: string;
  queue_number: number;
  current_stage: Stage;
  status: QueueStatus;
  priority: PatientPriority;
  position: number;
  wait_time_minutes: number;
  checked_in_at: string;
}


// ── Staff 
// user_id is required for staff — they authenticate via Supabase Auth.

export interface StaffMember {
  id: string;
  user_id: string;            // required — links to auth.users
  name: string;
  role: StaffRole;
  department: Stage;
  station?: string;
  is_active: boolean;
}


// ── Emergency Override 
// Audit log for priority/emergency queue overrides authorized by staff.

export interface OverrideLog {
  id: string;
  patient_id: string;
  patient_name: string;
  authorized_by: string;      // staff name for display
  staff_id: string;           // links to StaffMember.id
  reason: string;
  created_at: string;
}


// ── Call Alert 
// Tracks when a patient was called to a station (drives Web Audio API alerts).
// Persisted so missed calls can trigger auto re-queue logic.

export interface CallAlert {
  id: string;
  patient_id: string;
  queue_number: number;
  department: Stage;
  called_at: string;
  acknowledged: boolean;      // true once patient responds or timeout fires
}


// ── Admin Stats 
// Computed shape — NOT a Supabase table.
// Will be derived via query or Postgres function on the backend.

export interface DashboardStats {
  total_patients_today: number;
  active_queues: number;
  avg_wait_minutes: number;
  physicians_active: number;
  physicians_total: number;
  nursing_active: number;
  nursing_total: number;
}


// ── Realtime Payload 
// Shape of Supabase realtime change events for queue updates.

export interface QueueUpdatePayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: QueueEntry;
}