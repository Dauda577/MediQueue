import { supabase } from '../lib/supabase';
import type {
  Patient,
  QueueEntry,
  StaffMember,
  CallAlert,
  OverrideLog,
  DashboardStats,
} from '../types'

type Department = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

export const queueService = {

  async getDepartments() {
    const { data, error } = await supabase
      .from('patients')
      .select('current_stage')
    if (error) throw error
    const unique = [...new Set(data.map((r: { current_stage: string }) => r.current_stage))]
    return unique
  },

  async findActiveByPhone(phone: string): Promise<Patient | null> {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', phone)
      .not('status', 'in', '("done","cancelled")')
      .gte('checked_in_at', today)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async checkInPatient(
    fullName: string,
    department: Department,
    options?: { phone?: string; priority?: 'normal' | 'priority' | 'emergency' }
  ): Promise<Patient> {
    const { data, error } = await supabase.rpc('check_in_patient', {
      p_full_name: fullName,
      p_department: department,
      p_phone: options?.phone || undefined,
      p_priority: options?.priority ?? 'normal',
    })

    if (error) throw error
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('No patient data returned from server.')
    }

    return data[0] as unknown as Patient
  },

  async getQueueByDepartment(department: Department): Promise<QueueEntry[]> {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('patients')
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .eq('current_stage', department)
      .eq('status', 'waiting')
      .gte('checked_in_at', today)
      .order('priority', { ascending: true })
      .order('position', { ascending: true })

    if (error) throw error

    return data.map((p) => ({
      ...p,
      wait_time_minutes: p.position * 4,
    })) as unknown as QueueEntry[]
  },

  async callNextPatient(department: Department): Promise<QueueEntry> {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('patients')
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .eq('current_stage', department)
      .eq('status', 'waiting')
      .gte('checked_in_at', today)
      .order('priority', { ascending: true })
      .order('position', { ascending: true })
      .limit(1)
      .single()

    if (error) throw new Error('No patients in queue')

    const { error: updateError } = await supabase
      .from('patients')
      .update({ status: 'in_consultation', called_at: new Date().toISOString() })
      .eq('id', data.id)

    if (updateError) throw updateError

    await queueService.recordCallAlert(data.id, data.queue_number, department)

    return { ...data, status: 'in_consultation', wait_time_minutes: 0 } as QueueEntry
  },

  async markAsServed(queueId: string): Promise<QueueEntry> {
    const { data, error } = await supabase
      .from('patients')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', queueId)
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .single()

    if (error) throw error
    return { ...data, wait_time_minutes: 0 } as QueueEntry
  },

  async markAsEmergency(queueId: string, priority: 'normal' | 'priority' | 'emergency'): Promise<QueueEntry> {
    const { data, error } = await supabase
      .from('patients')
      .update({ priority })
      .eq('id', queueId)
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .single()

    if (error) throw error
    return { ...data, wait_time_minutes: 0 } as QueueEntry
  },

  async getStaffMembers(): Promise<StaffMember[]> {
    const { data, error } = await supabase.from('staff_members').select('*')
    if (error) throw error
    return data
  },

  async getStaffByDepartment(department: Department): Promise<StaffMember[]> {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('department', department)
      .eq('is_active', true)
    if (error) throw error
    return data
  },

  async assignPatientToStaff(patientId: string, staffId: string): Promise<void> {
    const { error } = await supabase
      .from('patients')
      .update({ assigned_to: staffId } as never)
      .eq('id', patientId)
    if (error) throw error
  },

  async movePatientToStage(patientId: string, stage: string, status: string): Promise<QueueEntry> {
    const { data, error } = await supabase
      .from('patients')
      .update({ current_stage: stage, status } as never)
      .eq('id', patientId)
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .single()
    if (error) throw error
    return { ...data, wait_time_minutes: 0 } as QueueEntry
  },

  async requeuePatient(patientId: string): Promise<QueueEntry> {
    const { data, error } = await supabase
      .from('patients')
      .update({ status: 'waiting' } as never)
      .eq('id', patientId)
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .single()
    if (error) throw error
    return { ...data, wait_time_minutes: data.position * 4 } as QueueEntry
  },

  async recordCallAlert(patientId: string, queueNumber: number, department: string): Promise<CallAlert> {
    const { data, error } = await supabase
      .from('call_alerts')
      .insert({ patient_id: patientId, queue_number: queueNumber, department: department as 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity', acknowledged: false })
      .select().single()
    if (error) throw error
    return data
  },

  async acknowledgeCallAlert(alertId: string): Promise<CallAlert> {
    const { data, error } = await supabase
      .from('call_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId)
      .select().single()
    if (error) throw error
    return data
  },

  async logEmergencyOverride(patientId: string, patientName: string, staffId: string, reason: string): Promise<OverrideLog> {
    const { data: staff } = await supabase.from('staff_members').select('name').eq('id', staffId).single()
    const authorizedBy = staff?.name ?? 'Staff Member'
    const { data, error } = await supabase
      .from('override_logs')
      .insert({ patient_id: patientId, patient_name: patientName, staff_id: staffId, authorized_by: authorizedBy, reason })
      .select().single()
    if (error) throw error
    return data
  },

  async updatePatientStatus(queueId: string, status: string): Promise<QueueEntry> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('patients')
      .update({ status: status as QueueEntry['status'], ...(status === 'done' ? { done_at: now } : {}), ...(status === 'in_consultation' ? { called_at: now } : {}) } as never)
      .eq('id', queueId)
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .single()
    if (error) throw error
    return { ...data, wait_time_minutes: 0 } as QueueEntry
  },

  async updatePatientPriority(queueId: string, priority: 'normal' | 'priority' | 'emergency'): Promise<QueueEntry> {
    const { data, error } = await supabase
      .from('patients')
      .update({ priority })
      .eq('id', queueId)
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .single()
    if (error) throw error
    return { ...data, wait_time_minutes: 0 } as QueueEntry
  },

  async callPatientToConsult(queueId: string, queueNumber: number, department: Department): Promise<QueueEntry> {
    const result = await queueService.updatePatientStatus(queueId, 'in_consultation')
    await queueService.recordCallAlert(queueId, queueNumber, department)
    return result
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date().toISOString().split('T')[0]
    const [{ count: totalToday }, { data: waiting }, { data: activeStaff }] = await Promise.all([
      supabase.from('patients').select('*', { count: 'exact', head: true }).gte('checked_in_at', today),
      supabase.from('patients').select('current_stage').eq('status', 'waiting').gte('checked_in_at', today),
      supabase.from('staff_members').select('role, is_active'),
    ])
    const activeQueues = new Set(waiting?.map((p: { current_stage: string }) => p.current_stage) ?? []).size
    const doctors = activeStaff?.filter((s: { role: string }) => s.role === 'doctor') ?? []
    const nurses = activeStaff?.filter((s: { role: string }) => s.role === 'nurse') ?? []
    return {
      total_patients_today: totalToday ?? 0,
      active_queues: activeQueues,
      avg_wait_minutes: 0,
      physicians_active: doctors.filter((d: { is_active: boolean }) => d.is_active).length,
      physicians_total: doctors.length,
      nursing_active: nurses.filter((n: { is_active: boolean }) => n.is_active).length,
      nursing_total: nurses.length,
    }
  },
}
