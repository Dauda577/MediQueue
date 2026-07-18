import { supabase } from '../lib/supabase';
import type {
  Patient,
  QueueEntry,
  StaffMember,
  CallAlert,
  DashboardStats,
} from '../types'

type Department = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

export const queueService = {

  // DEPARTMENT / STAGE METHODS

  async getDepartments() {
    const { data, error } = await supabase
      .from('patients')
      .select('current_stage')
    if (error) throw error
    const unique = [...new Set(data.map((r: { current_stage: string }) => r.current_stage))]
    return unique
  },


  // PATIENT CHECK-IN


  async checkInPatient(
    fullName: string,
    department: Department,
    options?: { phone?: string; priority?: 'normal' | 'priority' | 'emergency' }
  ): Promise<Patient> {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('initial_department', department)
      .gte('checked_in_at', today)

    const queueNumber = (count ?? 0) + 1
    const prefix = department === 'OPD' ? 'MQ'
      : department === 'Lab' ? 'LB'
      : department === 'Maternity' ? 'MT'
      : 'PH'
    const tokenId = `${prefix}-${String(queueNumber).padStart(5, '0')}`

    const { data, error } = await supabase
      .from('patients')
      .insert({
        full_name: fullName,
        phone: options?.phone ?? null,
        initial_department: department,
        current_stage: department,
        status: 'waiting',
        priority: options?.priority ?? 'normal',
        queue_number: queueNumber,
        token_id: tokenId,
        position: queueNumber,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },


  // QUEUE OPERATIONS


  async getQueueByDepartment(
    department: Department
  ): Promise<QueueEntry[]> {
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

  async getPatientQueue(patientId: string): Promise<QueueEntry | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .eq('id', patientId)
      .single()

    if (error) return null
    return { ...data, wait_time_minutes: data.position * 4 } as QueueEntry
  },

  async callNextPatient(
    department: Department
  ): Promise<QueueEntry> {
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


  // STAFF & ADMIN


  async getStaffMembers(): Promise<StaffMember[]> {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('is_active', true)

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


  // CALL ALERTS


  async recordCallAlert(patientId: string, queueNumber: number, department: string): Promise<CallAlert> {
    const { data, error } = await supabase
      .from('call_alerts')
      .insert({
        patient_id: patientId,
        queue_number: queueNumber,
        department: department as 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity',
        acknowledged: false,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async acknowledgeCallAlert(alertId: string): Promise<CallAlert> {
    const { data, error } = await supabase
      .from('call_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId)
      .select()
      .single()

    if (error) throw error
    return data
  },


  // DASHBOARD STATS


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
