import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Clock, MapPin, User, Bell, ClipboardCheck, Hourglass, Stethoscope, FlaskConical, Pill, CircleCheck } from 'lucide-react'
import CountUp from '../../components/reactbits/CountUp'
import { useRealtimeAlerts } from '../../hooks/useRealtimeAlerts'
import { announcePatient } from '../../lib/announce'
import { supabase } from '../../lib/supabase'
import './QueueTracker.css'

const STAGES = [
  { key: 'checkin',         label: 'Check-in',   icon: ClipboardCheck },
  { key: 'waiting',         label: 'Waiting',    icon: Hourglass },
  { key: 'in_consultation', label: 'Consult',    icon: Stethoscope },
  { key: 'in_lab',          label: 'Lab',        icon: FlaskConical },
  { key: 'in_pharmacy',     label: 'Pharmacy',   icon: Pill },
  { key: 'done',            label: 'Done',       icon: CircleCheck },
]

const STATION_MAP: Record<string, { room: string; wing: string }> = {
  OPD: { room: 'Room 3', wing: 'Ground Floor, West Wing' },
  Lab: { room: 'Lab-1', wing: 'Ground Floor, East Wing' },
  Pharmacy: { room: 'Counter 2', wing: 'Ground Floor, Main Hall' },
  Maternity: { room: 'Ward 1', wing: 'First Floor, East Wing' },
}

function deriveStage(status: string): string {
  if (status === 'waiting') return 'waiting'
  if (status === 'in_consultation') return 'in_consultation'
  if (status === 'in_lab') return 'in_lab'
  if (status === 'in_pharmacy') return 'in_pharmacy'
  if (status === 'done') return 'done'
  return 'checkin'
}

function stageIndex(key: string) { return STAGES.findIndex(s => s.key === key) }

function playAlert(type = 'notify') {
  try {
    const Ctor = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext | undefined
    if (!Ctor) return
    const ctx = new Ctor()
    const notes = type === 'urgent' ? [880, 1100, 880] : [660, 880]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine'; osc.frequency.value = freq
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.22)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.3)
      osc.start(ctx.currentTime + i * 0.22); osc.stop(ctx.currentTime + i * 0.22 + 0.35)
    })
  } catch { /* silent */ }
}

interface QueueData {
  tokenId: string; fullName: string; department: string; isPriority: boolean
  position: number; total: number; stage: string; stationRoom: string; stationWing: string; status: string
}

export default function QueueTracker() {
  const { tokenId: paramToken } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const token = (state as Record<string, string> | null)?.tokenId || paramToken || ''

  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const alertFiredRef = useRef(false)

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000) }, [])

  const fetchData = useCallback(async (tokenId: string) => {
    if (!tokenId) return
    const today = new Date().toISOString().split('T')[0]
    const patientRes = await supabase.from('patients').select('*').eq('token_id', tokenId).maybeSingle()
    if (patientRes.error || !patientRes.data) { setLoading(false); return }
    const p = patientRes.data; const dept = p.initial_department
    const queueRes = await supabase.from('patients').select('id', { count: 'exact', head: true })
      .eq('current_stage', dept).eq('status', 'waiting').gte('checked_in_at', today)
    setQueueData({
      tokenId: p.token_id, fullName: p.full_name, department: p.initial_department,
      isPriority: p.priority !== 'normal', position: p.position, total: queueRes.count ?? 0,
      stage: deriveStage(p.status), stationRoom: STATION_MAP[dept]?.room ?? 'Reception',
      stationWing: STATION_MAP[dept]?.wing ?? 'Main Building', status: p.status,
    })
    setLoading(false)
  }, [])

  useEffect(() => { if (token) fetchData(token) }, [token, fetchData])

  useEffect(() => {
    if (!queueData) return
    const channel = supabase.channel(`queue:${queueData.tokenId}`)
      .on('postgres_changes' as never, { event: '*', schema: 'public', table: 'patients', filter: `token_id=eq.${queueData.tokenId}` },
        (payload: { new: { status: string; queue_number: number; full_name: string; initial_department: string } }) => {
          if (payload.new.status === 'done' || payload.new.status === 'cancelled') localStorage.removeItem('activeToken')
          if (payload.new.status === 'in_consultation') {
            announcePatient(payload.new.queue_number, payload.new.initial_department, payload.new.full_name)
          }
          fetchData(queueData.tokenId)
        }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queueData?.tokenId, fetchData])

  useEffect(() => {
    if (!queueData) return
    if (queueData.position <= 2 && !alertFiredRef.current) {
      alertFiredRef.current = true; playAlert(queueData.isPriority ? 'urgent' : 'notify')
      showToast("You're almost up! Please make your way to the station.")
    }
    if (queueData.position > 2) alertFiredRef.current = false
  }, [queueData?.position, queueData?.isPriority, showToast])

  useRealtimeAlerts({ onNewAlert: (alert) => { playAlert('notify'); showToast(`Patient ${alert.queue_number} called to ${alert.department}`) } })

  if (loading) return <div className="qt-page"><div className="qt-loading">Loading your queue...</div></div>

  if (!queueData) return (
    <div className="qt-page"><div className="qt-empty"><p>Queue not found</p><button onClick={() => navigate('/checkin')}>Go to Check-in</button></div></div>
  )

  const currentIdx = stageIndex(queueData.stage)
  const isDone = queueData.stage === 'done'
  const waitMins = isDone ? 0 : Math.max(1, queueData.position * 4)
  const progressPercent = isDone ? 100 : Math.max(5, ((queueData.total - queueData.position) / Math.max(queueData.total, 1)) * 100)

  return (
    <div className="qt-page">
      <AnimatePresence>
        {toast && (
          <motion.div className="qt-toast" initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            <Bell size={16} /><span>{toast}</span><button onClick={() => setToast(null)}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="qt-content">
        <nav className="qt-nav">
          <button className="qt-nav-back" onClick={() => navigate('/checkin')}><ArrowLeft size={20} /></button>
          <div className="qt-nav-brand"><span>⚕</span><span>MediQueue</span></div>
          <div style={{ width: 40 }} />
        </nav>

        {isDone ? (
          <motion.div className="qt-done" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
            <span className="qt-done-icon">✅</span>
            <h2>All Done!</h2>
            <p>Your visit is complete. Thank you for using MediQueue.</p>
            <button onClick={() => { localStorage.removeItem('activeToken'); navigate('/checkin', { replace: true }) }}>New Check-in</button>
          </motion.div>
        ) : (
          <>
            <motion.div className="qt-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="qt-identity">
                <div className="qt-avatar">{queueData.fullName.charAt(0).toUpperCase()}</div>
                <div><h1 className="qt-name">{queueData.fullName}</h1><p className="qt-dept">{queueData.department} Department</p></div>
                {queueData.isPriority && <span className="qt-priority-badge">⚡ Priority</span>}
              </div>
              <div className="qt-token"><span className="qt-token-label">Your Token</span><span className="qt-token-value">{queueData.tokenId}</span></div>
            </motion.div>

            <motion.div className="qt-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="qt-position-hero">
                <div className="qt-position-circle">
                  <svg viewBox="0 0 120 120" className="qt-ring">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#D8EFE8" strokeWidth="6" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#002147" strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 52}`}
                      strokeDashoffset={`${2 * Math.PI * 52 * (1 - progressPercent / 100)}`}
                      strokeLinecap="round" transform="rotate(-90 60 60)" className="qt-ring-progress" />
                  </svg>
                  <div className="qt-position-inner">
                    <CountUp to={queueData.position} duration={1.5} className="qt-position-number" />
                    <span className="qt-position-total">/ {queueData.total}</span>
                  </div>
                </div>
                <div className="qt-position-label">Your position in {queueData.department} queue</div>
              </div>
              <div className="qt-info-grid">
                <div className="qt-info-item"><Clock size={16} /><div><span>Est. Wait</span><strong>~{waitMins} min</strong></div></div>
                <div className="qt-info-item"><MapPin size={16} /><div><span>Room</span><strong>{queueData.stationRoom}</strong></div></div>
                <div className="qt-info-item"><User size={16} /><div><span>Wing</span><strong>{queueData.stationWing}</strong></div></div>
              </div>
            </motion.div>

            <motion.div className="qt-stages" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              {STAGES.map((stage, idx) => {
                const isCurrent = idx === currentIdx; const isPassed = idx < currentIdx; const isFuture = idx > currentIdx
                const Icon = stage.icon
                return (
                  <div key={stage.key} className={`qt-stage${isCurrent ? ' qt-stage--current' : ''}${isPassed ? ' qt-stage--passed' : ''}${isFuture ? ' qt-stage--future' : ''}`}>
                    <div className="qt-stage-icon-wrap">
                      <Icon size={18} className="qt-stage-icon" />
                      {isCurrent && <div className="qt-stage-icon-glow" />}
                    </div>
                    {idx < STAGES.length - 1 && <div className={`qt-stage-line${isPassed ? ' qt-stage-line--done' : ''}`} />}
                    <span className="qt-stage-label">{stage.label}</span>
                  </div>
                )
              })}
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
