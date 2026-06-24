export type Department = 'OPD' | 'Lab' | 'Pharmacy';

export type QueueStatus =
  | 'waiting'
  | 'in_consultation'
  | 'in_lab'
  | 'in_pharmacy'
  | 'done'
  | 'cancelled';

export type PatientPriority = 'normal' | 'priority' | 'emergency';

export type UserRole = 'patient' | 'staff' | 'admin';

// ── Patient ──
export interface Patient {
  id: string;
  full_name: string;
  phone?: string;
  token_id: string;
  department: Department;
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

// ── Queue Entry (lighter shape for list views) ──
export interface QueueEntry {
  id: string;
  token_id: string;
  full_name: string;
  queue_number: number;
  department: Department;
  status: QueueStatus;
  priority: PatientPriority;
  position: number;
  wait_time_minutes: number;
  checked_in_at: string;
}

// ── Staff ──
export interface StaffMember {
  id: string;
  name: string;
  role: 'doctor' | 'nurse' | 'pharmacist' | 'lab_tech' | 'admin';
  department: Department;
  station?: string;
  is_active: boolean;
}

// ── Emergency Override ──
export interface OverrideLog {
  id: string;
  patient_id: string;
  patient_name: string;
  authorized_by: string;
  staff_id: string;
  reason: string;
  created_at: string;
}

// ── Admin Stats ──
export interface DashboardStats {
  total_patients_today: number;
  active_queues: number;
  avg_wait_minutes: number;
  physicians_active: number;
  physicians_total: number;
  nursing_active: number;
  nursing_total: number;
}

// ── Realtime Queue Update Payload ──
export interface QueueUpdatePayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: QueueEntry;
}