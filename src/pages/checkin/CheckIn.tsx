import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Phone, ChevronRight, Zap, Clock, AlertCircle } from 'lucide-react'
import CountUp from '../../components/reactbits/CountUp'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService } from '../../services/queueService'
import { supabase } from '../../lib/supabase'
import './CheckIn.css'

type DepartmentId = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

interface DepartmentConfig {
  id: DepartmentId; label: string; sub: string; icon: string
  avgMinsPerPatient: number; color: string
}

interface QueueStats { waiting: number; avgWaitMins: number }
type DepartmentStats = Record<DepartmentId, QueueStats>

const DEPARTMENTS: DepartmentConfig[] = [
  { id: 'OPD', label: 'Outpatient', sub: 'General Consultation', icon: '🩺', avgMinsPerPatient: 4, color: '#0077B6' },
  { id: 'Lab', label: 'Laboratory', sub: 'Blood Work & Scans', icon: '🔬', avgMinsPerPatient: 2, color: '#7C5CFC' },
  { id: 'Pharmacy', label: 'Pharmacy', sub: 'Prescriptions', icon: '💊', avgMinsPerPatient: 1, color: '#00A896' },
  { id: 'Maternity', label: 'Maternity', sub: 'Maternal Care', icon: '🤱', avgMinsPerPatient: 6, color: '#E8457A' },
]

function cleanPhone(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, '')
  if (digits.startsWith('0')) return '+233' + digits.slice(1)
  if (digits.startsWith('233')) return '+' + digits
  return digits
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return 'Phone number is required.'
  const cleaned = phone.replace(/[\s\-().]/g, '')
  if (!/^(\+233|0)\d{9}$/.test(cleaned)) return 'Enter a valid Ghanaian number, e.g. 024 XXX XXXX'
  return null
}

async function sendSms(phone: string, message: string) {
  try {
    await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': 'bUZZcmpZZkt6RVNMSmxhdXdVYlA' },
      body: JSON.stringify({
        sender: 'MediQueue',
        recipients: [cleanPhone(phone)],
        message,
      }),
    })
  } catch { }
}

export default function CheckIn() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState<DepartmentId | null>(null)
  const [isPriority, setIsPriority] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({})
  const [existingToken, setExistingToken] = useState<string | null>(null)
  const [deptStats, setDeptStats] = useState<DepartmentStats>({
    OPD: { waiting: 0, avgWaitMins: 0 }, Lab: { waiting: 0, avgWaitMins: 0 },
    Pharmacy: { waiting: 0, avgWaitMins: 0 }, Maternity: { waiting: 0, avgWaitMins: 0 },
  })

  const fetchDeptStats = useCallback(async () => {
    const entries = await Promise.all(DEPARTMENTS.map(async (dept) => {
      const queue = await queueService.getQueueByDepartment(dept.id)
      return { id: dept.id, waiting: queue.length }
    }))
    setDeptStats(prev => {
      const updated = { ...prev }
      for (const { id, waiting } of entries) {
        const avgMins = DEPARTMENTS.find(d => d.id === id)?.avgMinsPerPatient ?? 4
        updated[id] = { waiting, avgWaitMins: waiting * avgMins }
      }
      return updated
    })
  }, [])

  useRealtimeQueue({ onUpdate: fetchDeptStats })
  useEffect(() => { fetchDeptStats() }, [fetchDeptStats])

  const redirectGuard = useRef(false)
  useEffect(() => {
    if (redirectGuard.current) return
    const stored = localStorage.getItem('activeToken')
    if (!stored) return
    redirectGuard.current = true
    supabase.from('patients').select('token_id, status').eq('token_id', stored).maybeSingle().then(({ data }) => {
      if (data && data.status !== 'done' && data.status !== 'cancelled') navigate(`/queue/${data.token_id}`, { replace: true })
      else localStorage.removeItem('activeToken')
    })
  }, [navigate])

  const checkExisting = useCallback(async (phoneNumber: string) => {
    const cleaned = cleanPhone(phoneNumber)
    if (cleaned.length < 12) return
    try {
      const existing = await queueService.findActiveByPhone(cleaned)
      if (existing) {
        setExistingToken(existing.token_id)
        setError('')
      } else {
        setExistingToken(null)
      }
    } catch { }
  }, [])

  const validate = useCallback((): boolean => {
    const errors: { name?: string; phone?: string } = {}
    if (!fullName.trim()) errors.name = 'Full name is required.'
    const phoneErr = validatePhone(phone)
    if (phoneErr) errors.phone = phoneErr
    if (!department) { setError('Please select a department.'); setFieldErrors(errors); return false }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) { setError('Please fix the errors above.'); return false }
    return true
  }, [fullName, phone, department])

  const handleSubmit = async () => {
    setError('')
    if (!validate()) return
    if (existingToken) {
      navigate(`/queue/${existingToken}`, { replace: true })
      return
    }
    setLoading(true)
    try {
      const cleanedPhone = cleanPhone(phone)
      const patient = await queueService.checkInPatient(fullName.trim(), department!, {
        phone: cleanedPhone, priority: isPriority ? 'priority' : 'normal',
      })
      localStorage.setItem('activeToken', patient.token_id)

      const station = department === 'OPD' ? 'Room 3, West Wing'
        : department === 'Lab' ? 'Lab-1, East Wing'
        : department === 'Pharmacy' ? 'Counter 2, Main Hall'
        : 'Ward 1, East Wing'
      const waitMins = (deptStats[department!]?.avgWaitMins ?? 0) + (DEPARTMENTS.find(d => d.id === department)?.avgMinsPerPatient ?? 4)
      sendSms(cleanedPhone, `MediQueue: Your token is ${patient.token_id}. Est. wait ~${waitMins} min. ${station}.`)

      navigate(`/queue/${patient.token_id}`, { replace: true, state: {
        fullName: patient.full_name, phone: patient.phone, department: patient.initial_department,
        isPriority: patient.priority !== 'normal', tokenId: patient.token_id,
      }})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const selectedDept = department ? DEPARTMENTS.find(d => d.id === department) : null

  return (
    <div className="checkin">
      <div className="checkin__content">
        <motion.div className="checkin__hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="checkin__title">Welcome to<br />Central Medical</h1>
          <p className="checkin__subtitle">Please provide your details to join the queue.</p>
        </motion.div>
        <CheckinForm />
      </div>
    </div>
  )
}
