import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Phone, ChevronRight, Zap, Clock, AlertCircle } from 'lucide-react'
import CountUp from '../../components/reactbits/CountUp'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService, isTokenExpired } from '../../services/queueService'
import { supabase } from '../../lib/supabase'
import { sendSms } from '../../lib/sms'
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
    supabase.from('patients').select('token_id, status, checked_in_at').eq('token_id', stored).maybeSingle().then(({ data }) => {
      if (data && data.status !== 'done' && data.status !== 'cancelled' && !isTokenExpired(data.checked_in_at)) {
        navigate(`/queue/${data.token_id}`, { replace: true })
      } else {
        localStorage.removeItem('activeToken')
      }
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
    } catch { /* ignore */ }
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
      sendSms(cleanedPhone, `MediQueue: Your token is ${patient.token_id}. Est. wait ~${waitMins} min. ${station}. Valid for 24 hours.`)

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

        <div className="checkin__grid">
          <motion.div className="checkin__card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
            <div className="checkin__card-header"><User size={18} /><span>Patient Information</span></div>
            <div className="checkin__field">
              <label className="checkin__label">Full Name <span className="checkin__required">*</span></label>
              <input className={`checkin__input${fieldErrors.name ? ' checkin__input--error' : ''}`} type="text"
                placeholder="Enter your full legal name" value={fullName}
                onChange={e => { setFullName(e.target.value); setFieldErrors(p => ({ ...p, name: undefined })) }} />
              <AnimatePresence>
                {fieldErrors.name && <motion.p className="checkin__field-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{fieldErrors.name}</motion.p>}
              </AnimatePresence>
            </div>
            <div className="checkin__field">
              <label className="checkin__label">Phone Number <span className="checkin__required">*</span></label>
              <div className="checkin__input-wrap">
                <Phone size={16} className="checkin__input-icon" />
                <input className={`checkin__input checkin__input--icon${fieldErrors.phone ? ' checkin__input--error' : ''}`}
                  type="tel" placeholder="+233 XX XXX XXXX" value={phone}
                  onChange={e => { setPhone(e.target.value); setFieldErrors(p => ({ ...p, phone: undefined })); checkExisting(e.target.value) }} />
              </div>
              <AnimatePresence>
                {fieldErrors.phone ? (
                  <motion.p className="checkin__field-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{fieldErrors.phone}</motion.p>
                ) : existingToken ? (
                  <motion.div className="checkin__existing" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <AlertCircle size={16} />
                    <span>You have an active token: <strong>{existingToken}</strong>. Continue tracking?</span>
                    <button onClick={() => navigate(`/queue/${existingToken}`, { replace: true })}>Track →</button>
                  </motion.div>
                ) : (
                  <p className="checkin__hint">We'll send your token and queue updates via SMS.</p>
                )}
              </AnimatePresence>
            </div>
            <button type="button" className={`checkin__priority${isPriority ? ' checkin__priority--active' : ''}`} onClick={() => setIsPriority(p => !p)}>
              <span className="checkin__priority-icon"><Zap size={20} /></span>
              <div className="checkin__priority-text"><span>Emergency / Priority</span><span>Select if you need urgent attention</span></div>
              <span className={`checkin__priority-check${isPriority ? ' checkin__priority-check--on' : ''}`}>
                {isPriority && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </span>
            </button>
          </motion.div>

          <motion.div className="checkin__card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
            <div className="checkin__card-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Select Department</span>
            </div>
            <div className="checkin__depts">
              {DEPARTMENTS.map((dept, i) => {
                const stats = deptStats[dept.id]
                const isActive = department === dept.id
                return (
                  <motion.button key={dept.id} className={`checkin__dept${isActive ? ' checkin__dept--active' : ''}`}
                    style={{ '--dept-color': dept.color } as React.CSSProperties}
                    onClick={() => { setDepartment(dept.id); setError('') }}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                    <span className="checkin__dept-emoji">{dept.icon}</span>
                    <span className="checkin__dept-name">{dept.label}</span>
                    <span className="checkin__dept-sub">{dept.sub}</span>
                    <span className={`checkin__dept-wait${stats.waiting === 0 ? ' checkin__dept-wait--clear' : ''}`}>
                      {stats.waiting === 0 ? 'No wait' : <span className="checkin__dept-wait-flex"><Clock size={11} />~{stats.waiting} patient{stats.waiting !== 1 ? 's' : ''}</span>}
                    </span>
                    <AnimatePresence>
                      {isActive && <motion.span className="checkin__dept-check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </motion.span>}
                    </AnimatePresence>
                  </motion.button>
                )
              })}
            </div>
            <AnimatePresence>
              {selectedDept && (
                <motion.div className="checkin__dept-info" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Clock size={14} />
                  <span>{deptStats[department!].waiting === 0 ? `${selectedDept.label} queue is clear — you'll be seen almost immediately.` : `Current wait for ${selectedDept.label}: ~${deptStats[department!].avgWaitMins} min with ${deptStats[department!].waiting} ahead.`}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {error && <motion.div className="checkin__error" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>{error}</motion.div>}
          </AnimatePresence>

          <motion.div className="checkin__submit-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <button className="checkin__submit" onClick={handleSubmit} disabled={loading}>
              {loading ? <span className="checkin__submit-loading"><span className="checkin__spinner" />Processing</span>
                : <span className="checkin__submit-text">{existingToken ? 'Track Existing Token' : 'Get Queue Number'} <ChevronRight size={20} /></span>}
            </button>
          </motion.div>

          <div className="checkin__stats">
            {DEPARTMENTS.map(dept => (
              <div key={dept.id} className="checkin__stat" style={{ '--dept-color': dept.color } as React.CSSProperties}>
                <span className="checkin__stat-icon">{dept.icon}</span>
                <span className="checkin__stat-label">{dept.label}</span>
                <span className="checkin__stat-count">{deptStats[dept.id].waiting > 0 ? <CountUp to={deptStats[dept.id].waiting} duration={1} /> : '0'}</span>
                <span className="checkin__stat-sub">waiting</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
