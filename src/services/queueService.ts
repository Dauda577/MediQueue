import type {
  Patient,
  QueueEntry,
  StaffMember,
  //OverrideLog,
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

// Flag to toggle between mock and real data
const USE_MOCK_DATA = true

export const queueService = {

  // DEPARTMENT / STAGE METHODS
 

  async getDepartments() {
    if (USE_MOCK_DATA) {
      return new Promise(resolve =>
        setTimeout(() => resolve(mockDepartments), 500)
      )
    }
    throw new Error('Backend API not connected yet')
  },

  
  // PATIENT CHECK-IN
 

  async checkInPatient(
    fullName: string,
    department: 'OPD' | 'Lab' | 'Pharmacy'
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
      }
      mockPatients.push(newPatient)
      return new Promise(resolve => setTimeout(() => resolve(newPatient), 300))
    }
    throw new Error('Backend API not connected yet')
  },

  
  // QUEUE OPERATIONS
  

  async getQueueByDepartment(
    department: 'OPD' | 'Lab' | 'Pharmacy'
  ): Promise<QueueEntry[]> {
    if (USE_MOCK_DATA) {
      const filtered = mockQueueEntries.filter(q => q.current_stage === department)
      return new Promise(resolve => setTimeout(() => resolve(filtered), 300))
    }
    throw new Error('Backend API not connected yet')
  },

  async getPatientQueue(patientId: string): Promise<QueueEntry | null> {
    if (USE_MOCK_DATA) {
      const entry = mockQueueEntries.find(q => q.id === patientId)
      return new Promise(resolve => setTimeout(() => resolve(entry || null), 200))
    }
    throw new Error('Backend API not connected yet')
  },

  async callNextPatient(
    department: 'OPD' | 'Lab' | 'Pharmacy'
  ): Promise<QueueEntry> {
    if (USE_MOCK_DATA) {
      // Sort by emergency/priority, then position
      const sorted = mockQueueEntries
        .filter(q => q.current_stage === department && q.status === 'waiting')
        .sort((a, b) => {
          const priorityOrder = { emergency: 0, priority: 1, normal: 2 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        })

      if (sorted.length === 0) {
        throw new Error('No patients in queue')
      }

      const next = sorted[0]
      next.status = 'in_consultation'
      return new Promise(resolve => setTimeout(() => resolve(next), 200))
    }
    throw new Error('Backend API not connected yet')
  },

  async markAsServed(queueId: string): Promise<QueueEntry> {
    if (USE_MOCK_DATA) {
      const entry = mockQueueEntries.find(q => q.id === queueId)
      if (!entry) throw new Error('Queue entry not found')

      entry.status = 'done'
      return new Promise(resolve => setTimeout(() => resolve(entry), 200))
    }
    throw new Error('Backend API not connected yet')
  },

  async markAsEmergency(queueId: string, priority: 'normal' | 'priority' | 'emergency'): Promise<QueueEntry> {
    if (USE_MOCK_DATA) {
      const entry = mockQueueEntries.find(q => q.id === queueId)
      if (!entry) throw new Error('Queue entry not found')

      entry.priority = priority
      return new Promise(resolve => setTimeout(() => resolve(entry), 200))
    }
    throw new Error('Backend API not connected yet')
    
  },

 
  // STAFF & ADMIN
  

  async getStaffMembers(): Promise<StaffMember[]> {
    if (USE_MOCK_DATA) {
      return new Promise(resolve => setTimeout(() => resolve(mockStaffMembers), 300))
    }
    throw new Error('Backend API not connected yet')
  },

  async getStaffByDepartment(department: 'OPD' | 'Lab' | 'Pharmacy'): Promise<StaffMember[]> {
    if (USE_MOCK_DATA) {
      const filtered = mockStaffMembers.filter(s => s.department === department)
      return new Promise(resolve => setTimeout(() => resolve(filtered), 200))
    }
    throw new Error('Backend API not connected yet')
  },

  
  // CALL ALERTS
  

  async recordCallAlert(patientId: string, queueNumber: number, department: string): Promise<CallAlert> {
    if (USE_MOCK_DATA) {
      const alert: CallAlert = {
        id: `call_${Date.now()}`,
        patient_id: patientId,
        queue_number: queueNumber,
        department: department as 'OPD' | 'Lab' | 'Pharmacy',
        called_at: new Date().toISOString(),
        acknowledged: false,
      }
      mockCallAlerts.push(alert)
      return new Promise(resolve => setTimeout(() => resolve(alert), 100))
    }
    throw new Error('Backend API not connected yet')
  },

  async acknowledgeCallAlert(alertId: string): Promise<CallAlert> {
    if (USE_MOCK_DATA) {
      const alert = mockCallAlerts.find(a => a.id === alertId)
      if (!alert) throw new Error('Alert not found')

      alert.acknowledged = true
      return new Promise(resolve => setTimeout(() => resolve(alert), 100))
    }
    throw new Error('Backend API not connected yet')
  },

 
  // DASHBOARD STATS
 

  async getDashboardStats(): Promise<DashboardStats> {
    if (USE_MOCK_DATA) {
      return new Promise(resolve => setTimeout(() => resolve(mockDashboardStats), 500))
    }
    throw new Error('Backend API not connected yet')
   
  },
}