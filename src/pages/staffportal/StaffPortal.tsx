import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Clock3, LogOut, Users, AlertTriangle, UserRound, AlertCircle } from 'lucide-react'
import AppLogo from '../../components/AppLogo'
import CountUp from '../../components/reactbits/CountUp'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { announcePatient } from '../../lib/announce'
import { signOut } from '../../lib/auth'
import { sendSms } from '../../lib/sms'
import { supabase } from '../../lib/supabase'
import { queueService } from '../../services/queueService'
import type { QueueEntry } from '../../types'
import './StaffPortal.css'

type Department = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

const DEPT_LABELS: Record<Department, string> = { OPD: 'Outpatient', Lab: 'Lab', Pharmacy: 'Pharmacy', Maternity: 'Maternity' }
const priorityRank: Record<QueueEntry['priority'], number> = { emergency: 0, priority: 1, normal: 2 }

function getInitials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') }
function formatClock(value: Date) { return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
function formatDate(value: Date) { return value.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) }
function formatTimeLabel(value: string) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }

export default function StaffPortal() {
  const navigate = useNavigate()
  const { staff, loading: authLoading } = useAuth()
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [department, setDepartment] = useState<Department>('OPD')
  const [currentServing, setCurrentServing] = useState<QueueEntry | null>(null)
  const [seenToday, setSeenToday] = useState(0)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sessionTime, setSessionTime] = useState(new Date())
  const [consultElapsed, setConsultElapsed] = useState(0)

  useEffect(() => { if (staff?.department) setDepartment(staff.department as Department) }, [staff?.department])

  const fetchQueue = useCallback(async () => {
    if (!department) return
    try { const data = await queueService.getQueueByDepartment(department); setQueue(data) }
    catch (err) { console.error('[StaffPortal] fetchQueue failed:', err) }
    finally { setLoading(false) }
  }, [department])

  useRealtimeQueue({ department, onUpdate: fetchQueue })
  useEffect(() => { fetchQueue() }, [fetchQueue])

  useEffect(() => { const i = window.setInterval(() => setSessionTime(new Date()), 60000); return () => window.clearInterval(i) }, [])
  useEffect(() => {
    if (!currentServing) { setConsultElapsed(0); return }
    const i = window.setInterval(() => setConsultElapsed(p => p + 1), 30000); return () => window.clearInterval(i)
  }, [currentServing])

  const sortedQueue = useMemo(() => [...queue].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.wait_time_minutes - a.wait_time_minutes), [queue])
  const urgentCount = queue.filter(e => e.priority === 'emergency').length
  const avgWait = queue.length > 0 ? Math.round(queue.reduce((s, e) => s + e.wait_time_minutes, 0) / queue.length) : 0

  const showAnnouncement = useCallback((msg: string) => { setAnnouncement(msg); window.setTimeout(() => setAnnouncement(null), 4500) }, [])
  const showError = useCallback((msg: string) => { setActionError(msg); window.setTimeout(() => setActionError(null), 5000) }, [])

  const handleCallNext = async () => {
    if (queue.length === 0) return
    try {
      const np = await queueService.callNextPatient(department)
      if (staff?.id) await queueService.assignPatientToStaff(np.id, staff.id)

      const { data: patient } = await supabase.from('patients').select('phone').eq('id', np.id).single()
      if (patient?.phone) {
        const station = department === 'OPD' ? 'Room 3, West Wing' : department === 'Lab' ? 'Lab-1, East Wing' : department === 'Pharmacy' ? 'Counter 2, Main Hall' : 'Ward 1, East Wing'
        const { ok } = await sendSms(patient.phone, `MediQueue: Your turn now! Please proceed to ${station}.`)
        if (!ok) console.warn('[StaffPortal] SMS not delivered for', patient.phone)
      }
      setQueue(p => p.filter(e => e.id !== np.id)); setCurrentServing(np); setConsultElapsed(0)
      announcePatient(np.queue_number, department, np.full_name)
      showAnnouncement(`Now calling ${np.full_name} • #${np.queue_number}`)
    } catch (err) { console.error('[StaffPortal] callNext failed:', err); showError('Could not call the next patient. Please try again.') }
  }

  const handleSelectPatient = async (entry: QueueEntry) => {
    if (staff?.id) await queueService.assignPatientToStaff(entry.id, staff.id).catch(() => {})
    setQueue(p => { const n = [...p]; if (currentServing) n.push(currentServing); return n.filter(i => i.id !== entry.id) })
    setCurrentServing(entry); setConsultElapsed(0)
    showAnnouncement(`Selected ${entry.full_name} • #${entry.queue_number}`)
  }

  const handleRequeue = async () => {
    if (!currentServing) return
    try {
      await queueService.requeuePatient(currentServing.id)
      showAnnouncement(`${currentServing.full_name} re-queued — no show`)
      setCurrentServing(null)
      setConsultElapsed(0)
      fetchQueue()
    } catch (err) { console.error('[StaffPortal] requeue failed:', err); showError('Could not re-queue the patient.') }
  }

  const handleMoveStage = async (stage: string, status: string) => {
    if (!currentServing) return
    try {
      const stageLabels: Record<string, string> = { Lab: 'Lab', Pharmacy: 'Pharmacy' }
      await queueService.movePatientToStage(currentServing.id, stage, status)
      showAnnouncement(`${currentServing.full_name} sent to ${stageLabels[stage] || stage}`)
      setCurrentServing(null)
      setConsultElapsed(0)
      fetchQueue()
    } catch (err) { console.error('[StaffPortal] moveStage failed:', err); showError('Could not move the patient. Please try again.') }
  }

  const handleMarkDone = async () => {
    if (!currentServing) return
    try {
      await queueService.markAsServed(currentServing.id)
      showAnnouncement(`${currentServing.full_name} visit complete`)
      setCurrentServing(null)
      setSeenToday(p => p + 1)
      setConsultElapsed(0)
      fetchQueue()
    } catch (err) { console.error('[StaffPortal] markDone failed:', err); showError('Could not complete the visit. Please try again.') }
  }

  const handleSignOut = async () => { await signOut(); navigate('/staff/login', { replace: true }) }

  if (authLoading || loading) return <div className="sp-loading">Loading staff dashboard...</div>
  if (!staff) return <div className="sp-loading">Please sign in to continue.</div>

  return (
    <div className="sp-page">
      <header className="sp-header">
        <div className="sp-header-left">
          <span className="sp-logo"><AppLogo size={26} /></span>
          <div><h1 className="sp-title">Central Medical</h1><p className="sp-subtitle">{DEPT_LABELS[department]} Department</p></div>
        </div>
        <div className="sp-header-right">
          <div className="sp-clock"><span className="sp-clock-time">{formatClock(sessionTime)}</span><span className="sp-clock-date">{formatDate(sessionTime)}</span></div>
          <button className="sp-signout-btn" onClick={handleSignOut}><LogOut size={16} /></button>
        </div>
      </header>

      {announcement && (
        <motion.div className="sp-announce" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>{announcement}</motion.div>
      )}

      {actionError && (
        <motion.div className="sp-error" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <AlertCircle size={16} /><span>{actionError}</span>
        </motion.div>
      )}

      <div className="sp-body">
        <div className="sp-metrics">
          {[
            { label: 'Waiting', value: queue.length, icon: Users, color: '#0077B6' },
            { label: 'Avg Wait', value: `${avgWait}m`, icon: Clock3, color: avgWait > 30 ? '#E8453C' : '#F2A900' },
            { label: 'Urgent', value: urgentCount, icon: AlertTriangle, color: urgentCount > 0 ? '#E8453C' : '#6B8A93' },
            { label: 'Seen Today', value: seenToday, icon: CheckCircle2, color: '#02C39A' },
          ].map(m => (
            <div key={m.label} className="sp-metric" style={{ '--metric-color': m.color } as React.CSSProperties}>
              <div className="sp-metric-icon" style={{ background: `${m.color}15`, color: m.color }}><m.icon size={16} /></div>
              <div className="sp-metric-info">
                <span className="sp-metric-label">{m.label}</span>
                <span className="sp-metric-value">{typeof m.value === 'number' ? <CountUp to={m.value} duration={0.8} /> : m.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="sp-panels">
          <div className="sp-panel sp-current">
            <div className="sp-panel-header"><h2>Current Patient</h2>{currentServing && <span className={`sp-priority-badge ${currentServing.priority}`}>{currentServing.priority}</span>}</div>
            {currentServing ? (
              <div className="sp-current-card">
                <div className="sp-current-avatar">{getInitials(currentServing.full_name)}</div>
                <div className="sp-current-info"><h3>{currentServing.full_name}</h3><p>Consultation in progress</p></div>
                <div className="sp-current-stats">
                  <div><span>Queue No.</span><strong>#{currentServing.queue_number}</strong></div>
                  <div><span>Waited</span><strong>{currentServing.wait_time_minutes}m</strong></div>
                  <div><span>In Consult</span><strong>{consultElapsed < 1 ? '0m' : `${consultElapsed}m`}</strong></div>
                </div>
                <div className="sp-current-footer"><span>Arrived {formatTimeLabel(currentServing.checked_in_at)}</span><span>{currentServing.current_stage}</span></div>
              </div>
            ) : (
              <div className="sp-empty-state"><UserRound size={24} /><p>No patient in consultation</p><span>Call the next patient to begin.</span></div>
            )}
          </div>

          <div className="sp-actions">
            <button className="sp-action sp-action-call" onClick={handleCallNext} disabled={queue.length === 0}>
              <ArrowRight size={18} /><div><p>Call Next Patient</p><span>{sortedQueue[0] ? `${sortedQueue[0].full_name} • #${sortedQueue[0].queue_number}` : 'Queue is empty'}</span></div>
            </button>
            <button className={`sp-action sp-action-serve${!currentServing ? ' disabled' : ''}`} onClick={handleMarkDone} disabled={!currentServing}>
              <CheckCircle2 size={18} /><div><p>Mark as Done</p><span>{currentServing ? `${currentServing.full_name} • #${currentServing.queue_number}` : 'No active patient'}</span></div>
            </button>

            {currentServing && (
              <div className="sp-stage-actions">
                <button className="sp-stage-btn sp-stage-btn--lab" onClick={() => handleMoveStage('Lab', 'in_lab')}>
                  🔬 Send to Lab
                </button>
                <button className="sp-stage-btn sp-stage-btn--pharmacy" onClick={() => handleMoveStage('Pharmacy', 'in_pharmacy')}>
                  💊 Send to Pharmacy
                </button>
                <button className="sp-stage-btn sp-stage-btn--done" onClick={handleMarkDone}>
                  ✅ Complete Visit
                </button>
              </div>
            )}

            <button className={`sp-action sp-action-requeue${!currentServing ? ' disabled' : ''}`} onClick={handleRequeue} disabled={!currentServing}>
              <Clock3 size={18} /><div><p>No Show / Re-queue</p><span>Patient did not respond — send back to waiting</span></div>
            </button>
            <div className="sp-up-next">
              <p className="sp-up-next-label">Up Next</p>
              {sortedQueue.slice(0, 2).map(e => (
                <div key={e.id} className="sp-up-next-row">
                  <div><p className="sp-up-next-num">#{e.queue_number}</p><p className="sp-up-next-name">{e.full_name}</p></div>
                  <span className={`sp-priority-pill ${e.priority}`}>{e.priority}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sp-queue-panel">
          <div className="sp-queue-header"><h2>Waiting Patients</h2><span className="sp-queue-count">{queue.length} active</span></div>
          <div className="sp-queue-list">
            {sortedQueue.map(e => (
              <div key={e.id} className={`sp-queue-row${currentServing?.id === e.id ? ' serving' : ''}`} onClick={() => handleSelectPatient(e)}>
                <span className="sp-queue-pos">#{e.position}</span>
                <div className="sp-queue-patient"><div className="sp-queue-avatar">{getInitials(e.full_name)}</div><div><p className="sp-queue-name">{e.full_name}</p><span className="sp-queue-meta">#{e.queue_number}</span></div></div>
                <span className={`sp-priority-pill ${e.priority}`}>{e.priority}</span>
                <span className="sp-queue-wait">{e.wait_time_minutes}m</span>
                <span className="sp-queue-arrived">{formatTimeLabel(e.checked_in_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
