// src/types/index.ts
// Single source of truth for all MediQueue types.
// DB-backed types are derived from the generated schema.
// Non-DB types are defined here manually.

import type { Database } from './database.types';

// ── DB-backed types (auto-generated, always in sync with schema)
export type Patient     = Database['public']['Tables']['patients']['Row'];
export type StaffMember = Database['public']['Tables']['staff_members']['Row'];
export type CallAlert   = Database['public']['Tables']['call_alerts']['Row'];
export type OverrideLog = Database['public']['Tables']['override_logs']['Row'];

// ── Enums (derived from DB)
export type Stage           = Database['public']['Enums']['stage'];
export type QueueStatus     = Database['public']['Enums']['queue_status'];
export type PatientPriority = Database['public']['Enums']['patient_priority'];
export type StaffRole       = Database['public']['Enums']['staff_role'];

// ── Non-DB types (manual, no DB table behind them)

export type UserRole = 'patient' | 'staff' | 'admin';

// Lighter shape for queue list views and realtime display
// Derived from Patient via query — not a separate table
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

// Computed shape for admin dashboard — derived via query or Postgres function
export interface DashboardStats {
  total_patients_today: number;
  active_queues: number;
  avg_wait_minutes: number;
  physicians_active: number;
  physicians_total: number;
  nursing_active: number;
  nursing_total: number;
}

// Supabase realtime change event shape
export interface QueueUpdatePayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: QueueEntry;
}