import type {
  Patient,
  QueueEntry,
  StaffMember,
  OverrideLog,
  CallAlert,
  DashboardStats,
  QueueUpdatePayload,
} from '../types'


// Mock Patients

export const mockPatients: Patient[] = [
  {
    id: 'patient_1',
    user_id: 'user_1',
    full_name: 'Kwesi Mensah',
    phone: '+233501234567',
    token_id: 'TOKEN_001',
    initial_department: 'OPD',
    current_stage: 'OPD',
    status: 'in_consultation',
    priority: 'normal',
    position: 1,
    queue_number: 1,
    assigned_station: 'Station_A',
    checked_in_at: new Date(Date.now() - 10 * 60000).toISOString(), // 10 mins ago
    called_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 mins ago
    created_at: new Date().toISOString(),
    done_at: null
  },
  {
    id: 'patient_2',
    user_id: 'user_2',
    full_name: 'Ama Osei',
    phone: '+233502345678',
    token_id: 'TOKEN_002',
    initial_department: 'OPD',
    current_stage: 'OPD',
    status: 'waiting',
    priority: 'emergency',
    position: 2,
    queue_number: 2,
    checked_in_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 mins ago
    created_at: new Date().toISOString(),
    assigned_station: null,
    called_at: null,
    done_at: null
  },
  {
    id: 'patient_3',
    full_name: 'John Doe',
    phone: '+233503456789',
    token_id: 'TOKEN_003',
    initial_department: 'Lab',
    current_stage: 'Lab',
    status: 'in_lab',
    priority: 'normal',
    position: 1,
    queue_number: 101,
    checked_in_at: new Date(Date.now() - 20 * 60000).toISOString(),
    created_at: new Date().toISOString(),
    assigned_station: null,
    called_at: null,
    done_at: null,
    user_id: null
  },
  {
    id: 'patient_4',
    full_name: 'Grace Asante',
    phone: '+233504567890',
    token_id: 'TOKEN_004',
    initial_department: 'Pharmacy',
    current_stage: 'Pharmacy',
    status: 'waiting',
    priority: 'priority',
    position: 1,
    queue_number: 201,
    checked_in_at: new Date(Date.now() - 2 * 60000).toISOString(),
    created_at: new Date().toISOString(),
    assigned_station: null,
    called_at: null,
    done_at: null,
    user_id: null
  },
]


// Mock Queue Entries (derived from Patients)

export const mockQueueEntries: QueueEntry[] = [
  {
    id: 'patient_1',
    token_id: 'TOKEN_001',
    full_name: 'Kwesi Mensah',
    queue_number: 1,
    current_stage: 'OPD',
    status: 'in_consultation',
    priority: 'normal',
    position: 1,
    wait_time_minutes: 10,
    checked_in_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'patient_2',
    token_id: 'TOKEN_002',
    full_name: 'Ama Osei',
    queue_number: 2,
    current_stage: 'OPD',
    status: 'waiting',
    priority: 'emergency',
    position: 2,
    wait_time_minutes: 5,
    checked_in_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'patient_3',
    token_id: 'TOKEN_003',
    full_name: 'John Doe',
    queue_number: 101,
    current_stage: 'Lab',
    status: 'in_lab',
    priority: 'normal',
    position: 1,
    wait_time_minutes: 20,
    checked_in_at: new Date(Date.now() - 20 * 60000).toISOString(),
  },
]


// Mock Staff Members

export const mockStaffMembers: StaffMember[] = [
  {
    id: 'staff_1',
    user_id: 'user_staff_1',
    name: 'Dr. Kwame Boateng',
    role: 'doctor',
    department: 'OPD',
    station: 'Station_A',
    is_active: true,
    created_at: ''
  },
  {
    id: 'staff_2',
    user_id: 'user_staff_2',
    name: 'Nurse Abena',
    role: 'nurse',
    department: 'OPD',
    station: 'Station_B',
    is_active: true,
    created_at: ''
  },
  {
    id: 'staff_3',
    user_id: 'user_staff_3',
    name: 'Lab Tech Kofi',
    role: 'lab_tech',
    department: 'Lab',
    station: 'Lab_Station_1',
    is_active: true,
    created_at: ''
  },
  {
    id: 'staff_4',
    user_id: 'user_staff_4',
    name: 'Pharmacist Ama',
    role: 'pharmacist',
    department: 'Pharmacy',
    station: 'Pharmacy_Counter_1',
    is_active: true,
    created_at: ''
  },
  {
    id: 'staff_5',
    user_id: 'user_staff_5',
    name: 'Admin John',
    role: 'admin',
    department: 'OPD',
    is_active: true,
    created_at: '',
    station: null
  },
]


// Mock Override Logs (Emergency Overrides)

export const mockOverrideLogs: OverrideLog[] = [
  {
    id: 'override_1',
    patient_id: 'patient_2',
    patient_name: 'Ama Osei',
    authorized_by: 'Dr. Kwame Boateng',
    staff_id: 'staff_1',
    reason: 'Critical condition - priority queue jump',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
]

// Mock Call Alerts (Who was called and when)

export const mockCallAlerts: CallAlert[] = [
  {
    id: 'call_1',
    patient_id: 'patient_1',
    queue_number: 1,
    department: 'OPD',
    called_at: new Date(Date.now() - 5 * 60000).toISOString(),
    acknowledged: true,
  },
  {
    id: 'call_2',
    patient_id: 'patient_2',
    queue_number: 2,
    department: 'OPD',
    called_at: new Date(Date.now() - 2 * 60000).toISOString(),
    acknowledged: false,
  },
]


// Mock Dashboard Stats (Computed Data)

export const mockDashboardStats: DashboardStats = {
  total_patients_today: 47,
  active_queues: 3,
  avg_wait_minutes: 12,
  physicians_active: 2,
  physicians_total: 5,
  nursing_active: 3,
  nursing_total: 6,
}


// Mock Queue Update Payload (Realtime Events)

export const mockQueueUpdatePayload: QueueUpdatePayload = {
  type: 'UPDATE',
  record: mockQueueEntries[0],
}


// Departments (Stages)

export const mockDepartments = ['OPD', 'Lab', 'Pharmacy'] as const