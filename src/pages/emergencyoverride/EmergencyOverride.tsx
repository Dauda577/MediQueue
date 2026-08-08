import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Search, Zap, CheckCircle2, Clock3, UserRound, Stethoscope } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService } from '../../services/queueService'
import type { QueueEntry } from '../../types'
import './EmergencyOverride.css'

type Department = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'
const DEPTS: Department[] = ['OPD','Lab','Pharmacy','Maternity']
const DEPT_LABELS: Record<Department,string> = { OPD:'Outpatient',Lab:'Laboratory',Pharmacy:'Pharmacy',Maternity:'Maternity' }
const PRIORITY_ORDER: Record<string,number> = { emergency:0,priority:1,normal:2 }
function getInitials(n: string) { return n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('') }

export default function EmergencyOverride() {
  const navigate = useNavigate(); const { staff } = useAuth()
  const [department, setDepartment] = useState<Department>('OPD'); const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true); const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QueueEntry|null>(null)
  const [reason, setReason] = useState(''); const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string|null>(null); const [success, setSuccess] = useState<string|null>(null)

  const fetchQueue = useCallback(async () => { try { setLoading(true); setSelected(null); const d = await queueService.getQueueByDepartment(department); setQueue(d) } catch { } finally { setLoading(false) } }, [department])
  useRealtimeQueue({ department, onUpdate: fetchQueue })
  useEffect(() => { fetchQueue() }, [fetchQueue])

  const filtered = queue.filter(e => { if (!search) return true; const q = search.toLowerCase(); return e.full_name.toLowerCase().includes(q) || String(e.queue_number).includes(q) }).sort((a,b) => PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority] || a.position-b.position)

  const handleOverride = async () => { if (!selected || !staff || !reason.trim()) return; setSubmitting(true); setError(null); setSuccess(null); try { await queueService.markAsEmergency(selected.id, 'emergency'); await queueService.logEmergencyOverride(selected.id, selected.full_name, staff.id, reason.trim()); setSuccess(`${selected.full_name} (#${selected.queue_number}) flagged as emergency.`); setSelected(null); setReason(''); fetchQueue() } catch (err) { setError(err instanceof Error ? err.message : 'Failed to process.'); } finally { setSubmitting(false) } }

  if (!staff) return <div className="eo-page"><div className="eo-empty">Please sign in to access emergency override.</div></div>

  return <div className="eo-page">
    <nav className="eo-nav"><button className="eo-back" onClick={()=>navigate(-1)}><ArrowLeft size={18}/></button><div className="eo-nav-title"><AlertTriangle size={18} className="eo-nav-icon"/><span>Emergency Override</span></div><div className="eo-nav-spacer"/></nav>
    <div className="eo-body"><div className="eo-header"><h1 className="eo-title">Emergency Override</h1><p className="eo-subtitle">Flag a patient as emergency to move them to the front of the queue. This action is logged.</p></div>
    <AnimatePresence>{error&&<motion.div className="eo-toast eo-toast-err" initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}>{error}</motion.div>}{success&&<motion.div className="eo-toast eo-toast-ok" initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}><CheckCircle2 size={16}/>{success}</motion.div>}</AnimatePresence>
    <div className="eo-dept-tabs">{DEPTS.map(d=><button key={d} className={`eo-dept-tab${department===d?' active':''}`} onClick={()=>setDepartment(d)}>{DEPT_LABELS[d]}</button>)}</div>
    <div className="eo-search"><Search size={16} className="eo-search-icon"/><input placeholder="Search by name, queue number..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {loading?<div className="eo-empty">Loading patients...</div>:filtered.length===0?<div className="eo-empty"><UserRound size={32} className="eo-empty-icon"/><p>No patients found in {DEPT_LABELS[department]}</p></div>:<div className="eo-grid">{filtered.map(entry=><motion.button key={entry.id} className={`eo-card${selected?.id===entry.id?' selected':''}${entry.priority==='emergency'?' already-emergency':''}`} onClick={()=>{setSelected(selected?.id===entry.id?null:entry);setError(null)}} whileHover={{y:-2}} whileTap={{scale:.98}} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}><div className="eo-card-left"><div className="eo-avatar">{getInitials(entry.full_name)}</div><div className="eo-card-info"><p className="eo-card-name">{entry.full_name}</p><p className="eo-card-meta">#{entry.queue_number} · {entry.token_id}</p></div></div><div className="eo-card-right">{entry.priority==='emergency'?<span className="eo-badge eo-badge-emergency"><Zap size={12}/>Already Emergency</span>:entry.priority==='priority'?<span className="eo-badge eo-badge-priority">Priority</span>:<span className="eo-badge eo-badge-normal">Normal</span>}<div className="eo-card-meta-right"><Clock3 size={12}/><span>{entry.wait_time_minutes}m wait</span></div></div></motion.button>)}</div>}
    <AnimatePresence>{selected&&selected.priority!=='emergency'&&<motion.div className="eo-action-panel" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}><div className="eo-action-header"><Stethoscope size={18}/><div><p className="eo-action-title">Set Emergency for {selected.full_name}</p><p className="eo-action-sub">#{selected.queue_number} · {DEPT_LABELS[department]}</p></div></div><div className="eo-reason-field"><label className="eo-label">Reason for override (required)</label><textarea className="eo-textarea" placeholder="Describe why this patient needs emergency priority..." value={reason} onChange={e=>setReason(e.target.value)} rows={3}/></div><div className="eo-action-buttons"><button className="eo-cancel-btn" onClick={()=>{setSelected(null);setReason('')}}>Cancel</button><button className="eo-confirm-btn" onClick={handleOverride} disabled={submitting||!reason.trim()}>{submitting?'Processing...':<><Zap size={16}/>Confirm Emergency Override</>}</button></div></motion.div>}</AnimatePresence></div>
  </div>
}
