import { supabase } from '../lib/supabase';
import type {
  Patient,
  QueueEntry,
  StaffMember,
  CallAlert,
  DashboardStats,
} from '../types'
import {
  mockPatients,
  mockQueueEntries,
  mockStaffMembers,
  mockCallAlerts,
  mockDashboardStats,
  mockDepartments,
} from '../data/mockData'

const USE_MOCK_DATA = true // flip to false when ready to go live

type Department = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

export const queueService = {

  // DEPARTMENT / STAGE METHODS

  async getDepartments() {
    if (USE_MOCK_DATA) {
      return new Promise(resolve => setTimeout(() => resolve(mockDepartments), 500))
    }

    const { data, error } = await supabase
      .from('patients')
      .select('current_stage')
    if (error) throw error
    const unique = [...new Set(data.map(r => r.current_stage))]
    return unique
  },


  // PATIENT CHECK-IN


  async checkInPatient(
    fullName: string,
    department: Department
  ): Promise<Patient> {
    if (USE_MOCK_DATA) {
      const newPatient: Patient = {
        id: `patient_${Date.now()}`,
        full_name: fullName,
        token_id: `TOKEN_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        initial_department: department,
        current_stage: department,
        status: 'waiting',
        priority: 'normal',
        position: mockQueueEntries.length + 1,
        queue_number: Math.floor(Math.random() * 1000),
        checked_in_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        assigned_station: null,
        called_at: null,
        done_at: null,
        phone: null,
        user_id: null,
      }
      mockPatients.push(newPatient)
      return new Promise(resolve => setTimeout(() => resolve(newPatient), 300))
    }

    // Get today's count for this department to assign queue number
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
        initial_department: department,
        current_stage: department,
        status: 'waiting',
        priority: 'normal',
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
    if (USE_MOCK_DATA) {
      const filtered = mockQueueEntries.filter(q => q.current_stage === department)
      return new Promise(resolve => setTimeout(() => resolve(filtered), 300))
    }

    const { data, error } = await supabase
      .from('patients')
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .eq('current_stage', department)
      .eq('status', 'waiting')
      .order('priority', { ascending: true })
      .order('position', { ascending: true })

    if (error) throw error

    return data.map(p => ({
      ...p,
      wait_time_minutes: p.position * 4,
    })) as QueueEntry[]
  },

  async getPatientQueue(patientId: string): Promise<QueueEntry | null> {
    if (USE_MOCK_DATA) {
      const entry = mockQueueEntries.find(q => q.id === patientId)
      return new Promise(resolve => setTimeout(() => resolve(entry || null), 200))
    }

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
    if (USE_MOCK_DATA) {
      const sorted = mockQueueEntries
        .filter(q => q.current_stage === department && q.status === 'waiting')
        .sort((a, b) => {
          const priorityOrder = { emergency: 0, priority: 1, normal: 2 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        })
      if (sorted.length === 0) throw new Error('No patients in queue')
      const next = sorted[0]
      next.status = 'in_consultation'
      return new Promise(resolve => setTimeout(() => resolve(next), 200))
    }

    const { data, error } = await supabase
      .from('patients')
      .select('id, token_id, full_name, queue_number, current_stage, status, priority, position, checked_in_at')
      .eq('current_stage', department)
      .eq('status', 'waiting')
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
    if (USE_MOCK_DATA) {
      const entry = mockQueueEntries.find(q => q.id === queueId)
      if (!entry) throw new Error('Queue entry not found')
      entry.status = 'done'
      return new Promise(resolve => setTimeout(() => resolve(entry), 200))
    }

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
    if (USE_MOCK_DATA) {
      const entry = mockQueueEntries.find(q => q.id === queueId)
      if (!entry) throw new Error('Queue entry not found')
      entry.priority = priority
      return new Promise(resolve => setTimeout(() => resolve(entry), 200))
    }

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
    if (USE_MOCK_DATA) {
      return new Promise(resolve => setTimeout(() => resolve(mockStaffMembers), 300))
    }

    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('is_active', true)

    if (error) throw error
    return data
  },

  async getStaffByDepartment(department: Department): Promise<StaffMember[]> {
    if (USE_MOCK_DATA) {
      const filtered = mockStaffMembers.filter(s => s.department === department)
      return new Promise(resolve => setTimeout(() => resolve(filtered), 200))
    }

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
    if (USE_MOCK_DATA) {
      const alert: CallAlert = {
        id: `call_${Date.now()}`,
        patient_id: patientId,
        queue_number: queueNumber,
        department: department as 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity',
        called_at: new Date().toISOString(),
        acknowledged: false,
      }
      mockCallAlerts.push(alert)
      return new Promise(resolve => setTimeout(() => resolve(alert), 100))
    }

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
    if (USE_MOCK_DATA) {
      const alert = mockCallAlerts.find(a => a.id === alertId)
      if (!alert) throw new Error('Alert not found')
      alert.acknowledged = true
      return new Promise(resolve => setTimeout(() => resolve(alert), 100))
    }

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
    if (USE_MOCK_DATA) {
      return new Promise(resolve => setTimeout(() => resolve(mockDashboardStats), 500))
    }

    const today = new Date().toISOString().split('T')[0]

    const [{ count: totalToday }, { data: waiting }, { data: activeStaff }] = await Promise.all([
      supabase.from('patients').select('*', { count: 'exact', head: true }).gte('checked_in_at', today),
      supabase.from('patients').select('current_stage').eq('status', 'waiting').gte('checked_in_at', today),
      supabase.from('staff_members').select('role, is_active'),
    ])

    const activeQueues = new Set(waiting?.map(p => p.current_stage) ?? []).size
    const doctors = activeStaff?.filter(s => s.role === 'doctor') ?? []
    const nurses = activeStaff?.filter(s => s.role === 'nurse') ?? []

    return {
      total_patients_today: totalToday ?? 0,
      active_queues: activeQueues,
      avg_wait_minutes: 0,
      physicians_active: doctors.filter(d => d.is_active).length,
      physicians_total: doctors.length,
      nursing_active: nurses.filter(n => n.is_active).length,
      nursing_total: nurses.length,
    }
  },
}