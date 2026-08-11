import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Pause, Play, Search, X, Check, Zap, Download, Users, Phone, LogOut, BarChart3, List, UserCog, Copy } from 'lucide-react'
import AppLogo from '../../components/AppLogo'
import CountUp from '../../components/reactbits/CountUp'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { signOut, inviteStaffMember } from '../../lib/auth'
import { queueService } from '../../services/queueService'
import type { QueueEntry, StaffMember, DashboardStats, Stage, QueueStatus, PatientPriority, StaffRole } from '../../types'
import './AdminDashboard.css'

type Tab = 'queue' | 'reports' | 'staff'
type QStatus = QueueStatus
type QPri = PatientPriority

interface Entry extends QueueEntry { department: Stage; arrived_at: string }
type Staff = Omit<StaffMember, 'created_at' | 'user_id'> & { patients_today: number }

const STAGES: Stage[] = ['OPD', 'Lab', 'Pharmacy', 'Maternity']
const ALL_ROLES: StaffRole[] = ['nurse', 'doctor', 'pharmacist', 'lab_tech']
const DEPT_LABELS: Record<Stage, string> = { OPD: 'Outpatient', Lab: 'Laboratory', Pharmacy: 'Pharmacy', Maternity: 'Maternity' }
const sLabel = (s: QStatus) => ({ waiting: 'Waiting', in_consultation: 'Consulting', done: 'Done', in_lab: 'In Lab', in_pharmacy: 'Pharmacy', cancelled: 'Cancelled' }[s])
const sCls = (s: QStatus) => ({ waiting: 'badge-blue', in_consultation: 'badge-purple', done: 'badge-green', in_lab: 'badge-amber', in_pharmacy: 'badge-teal', cancelled: 'badge-red' }[s])
const pCls = (p: QPri) => ({ normal: 'badge-gray', priority: 'badge-amber', emergency: 'badge-red' }[p])
const ini = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const priOrder: Record<QPri, number> = { emergency: 0, priority: 1, normal: 2 }
const WEEKLY = [{ d: 'Mon', i: 34, o: 28 }, { d: 'Tue', i: 26, o: 22 }, { d: 'Wed', i: 29, o: 25 }, { d: 'Thu', i: 33, o: 27 }, { d: 'Fri', i: 31, o: 29 }, { d: 'Sat', i: 18, o: 15 }, { d: 'Sun', i: 12, o: 10 }]

function exportCSV(q: Entry[], dept: Stage) {
  const r = ['Pos,Queue#,Name,Status,Priority,Wait(min),Arrived', ...q.map(e => `${e.position},${e.queue_number},"${e.full_name}",${e.status},${e.priority},${Math.round(e.wait_time_minutes)},${e.arrived_at}`)].join('\n')
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([r], { type: 'text/csv' })), download: `queue-${dept}-${new Date().toISOString().slice(0, 10)}.csv` }).click()
}

function beep() {
  try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 820; g.gain.setValueAtTime(.25, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .45); o.start(c.currentTime); o.stop(c.currentTime + .45) } catch { /* */ }
}

export default function App() {
  const navigate = useNavigate()
  const { staff: currentStaff } = useAuth()
  const [tab, setTab] = useState<Tab>('queue'); const [dept, setDept] = useState<Stage>('OPD')
  const [queue, setQueue] = useState<Entry[]>([]); const [serving, setServing] = useState<Entry | null>(null)
  const [paused, setPaused] = useState(false); const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('all'); const [fPri, setFPri] = useState('all')
  const [sel, setSel] = useState<Set<string>>(new Set()); const [modal, setModal] = useState<Entry | null>(null)
  const [served, setServed] = useState(0); const [staff, setStaff] = useState<Staff[]>([])
  const [invite, setInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'nurse' as StaffRole, department: 'OPD' as Stage, station: '' })
  const [inviting, setInviting] = useState(false); const [invMsg, setInvMsg] = useState<{ ok: boolean; txt: string; tempPass?: string } | null>(null)
  const [sSearch, setSSearch] = useState(''); const [sFilter, setSFilter] = useState('all')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [deptData, setDeptData] = useState<{ dept: Stage; c: number }[]>([]); const [statusData, setStatusData] = useState<{ s: string; c: number }[]>([])
  const [priorityData, setPriorityData] = useState<{ p: string; c: number }[]>([]); const [hourlyData, setHourlyData] = useState<{ h: string; c: number }[]>([])

  const fetchQueue = useCallback(async () => { try { const d = await queueService.getQueueByDepartment(dept); setQueue(d.map(q => ({ ...q, department: q.current_stage, arrived_at: q.checked_in_at }))) } catch { /* */ } }, [dept])
  const fetchStaff = useCallback(async () => { try { const d = await queueService.getStaffMembers(); setStaff(d.map(s => ({ ...s, patients_today: 0 }))) } catch { /* */ } }, [])
  const fetchReports = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const [ds, dr, sr, pr, hr] = await Promise.all([
        queueService.getDashboardStats(),
        supabase.from('patients').select('current_stage').gte('checked_in_at', today),
        supabase.from('patients').select('status').gte('checked_in_at', today),
        supabase.from('patients').select('priority').gte('checked_in_at', today),
        supabase.rpc('get_hourly_checkins', { date: today }),
      ])
      const dc = new Map<string, number>(); dr.data?.forEach((r: { current_stage: string }) => dc.set(r.current_stage, (dc.get(r.current_stage) || 0) + 1))
      const sc = new Map<string, number>(); sr.data?.forEach((r: { status: string }) => sc.set(r.status, (sc.get(r.status) || 0) + 1))
      const pc = new Map<string, number>(); pr.data?.forEach((r: { priority: string }) => pc.set(r.priority, (pc.get(r.priority) || 0) + 1))
      setStats(ds); setDeptData(STAGES.map(d => ({ dept: d, c: dc.get(d) || 0 })))
      setStatusData(Array.from(sc.entries()).map(([s, c]) => ({ s, c })))
      setPriorityData(Array.from(pc.entries()).map(([p, c]) => ({ p, c })))
      setHourlyData(((hr.data as { hour: string; count: number }[] | null) ?? []).map(i => ({ h: i.hour, c: i.count })))
    } catch { /* */ }
  }, [])

  useEffect(() => { fetchQueue(); fetchStaff() }, [fetchQueue, fetchStaff])
  useEffect(() => { if (tab === 'reports') fetchReports() }, [tab, fetchReports])

  // Department-scoped KPIs
  const dq = queue.filter(e => e.department === dept)
  const deptWaiting = dq.filter(e => e.status === 'waiting').length
  const deptConsult = dq.filter(e => e.status === 'in_consultation').length
  const wDept = dq.filter(e => e.status === 'waiting')
  const avgWait = wDept.length ? Math.round(wDept.reduce((s, e) => s + e.wait_time_minutes, 0) / wDept.length) : 0

  const filtered = dq.filter(e => {
    const ms = search === '' || e.full_name.toLowerCase().includes(search.toLowerCase()) || String(e.queue_number).includes(search)
    return ms && (fStatus === 'all' || e.status === fStatus) && (fPri === 'all' || e.priority === fPri)
  }).sort((a, b) => priOrder[a.priority] - priOrder[b.priority] || a.position - b.position)

  const filteredStaff = staff.filter(s => {
    const ms = sSearch === '' || s.name.toLowerCase().includes(sSearch.toLowerCase())
    return ms && (sFilter === 'all' || s.role === sFilter || (sFilter === 'active' && s.is_active) || (sFilter === 'inactive' && !s.is_active))
  })

  const callNext = useCallback(async () => {
    const n = [...dq].filter(e => e.status === 'waiting').sort((a, b) => priOrder[a.priority] - priOrder[b.priority] || a.position - b.position)[0]
    if (!n) return
    try {
      await queueService.callPatientToConsult(n.id, n.queue_number, dept)
      if (currentStaff?.id) await queueService.assignPatientToStaff(n.id, currentStaff.id)
      setServing(n); beep(); fetchQueue()
    } catch { /* */ }
  }, [dq, dept, fetchQueue, currentStaff])

  const markServed = useCallback(async () => { if (!serving) return; try { await queueService.markAsServed(serving.id); setServed(c => c + 1); setServing(null); fetchQueue() } catch { /* */ } }, [serving, fetchQueue])
  const toggleEmg = useCallback(async (id: string, cur: QPri) => { try { await queueService.updatePatientPriority(id, cur === 'emergency' ? 'normal' : 'emergency'); fetchQueue() } catch { /* */ } }, [fetchQueue])
  const moveStage = useCallback(async (id: string, stage: string, status: string) => { try { await queueService.movePatientToStage(id, stage, status); setServing(null); fetchQueue() } catch { /* */ } }, [fetchQueue])
  const requeuePatient = useCallback(async (id: string) => { try { await queueService.requeuePatient(id); setServing(null); fetchQueue() } catch { /* */ } }, [fetchQueue])
  const batchServe = useCallback(async () => { for (const id of sel) { try { await queueService.markAsServed(id) } catch { /* */ } } setServed(c => c + sel.size); setSel(new Set()); fetchQueue() }, [sel, fetchQueue])
  const batchEmg = useCallback(async () => { for (const id of sel) { try { await queueService.updatePatientPriority(id, 'emergency') } catch { /* */ } } setSel(new Set()); fetchQueue() }, [sel, fetchQueue])
  const toggleSel = useCallback((id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const toggleAll = useCallback(() => setSel(p => p.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id))), [filtered])

  const sendInvite = useCallback(async () => {
    if (!form.name || !form.email || !form.station.trim()) return
    if (inviting) return
    setInviting(true); setInvMsg(null)
    try {
      const result = await inviteStaffMember({
        email: form.email, name: form.name, role: form.role,
        department: form.department, station: form.station || undefined,
      })
      setInvMsg({ ok: true, txt: `${form.name} has been invited.`, tempPass: result.tempPassword })
      setForm({ name: '', email: '', role: 'nurse', department: 'OPD', station: '' })
      fetchStaff()
    } catch (err: unknown) {
      setInvMsg({ ok: false, txt: err instanceof Error ? err.message : 'Failed to invite staff.' })
    } finally { setInviting(false) }
  }, [form, fetchStaff])

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text).catch(() => {}) }

  const handleSignOut = async () => { await signOut(); navigate('/admin/login', { replace: true }) }

  return (
    <div className="ad-page">
      <header className="ad-header">
        <div className="ad-header-left"><span className="ad-header-logo"><AppLogo size={22} /></span><span className="ad-header-title">MediQueue Admin</span></div>
        <div className="ad-tabs">
          {[{ key: 'queue' as Tab, icon: List, label: 'Queue' }, { key: 'reports' as Tab, icon: BarChart3, label: 'Reports' }, { key: 'staff' as Tab, icon: UserCog, label: 'Staff' }].map(t => (
            <button key={t.key} className={`ad-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}><t.icon size={16} /><span>{t.label}</span></button>
          ))}
        </div>
        <div className="ad-header-right">
          <button className={`ad-pause${paused ? ' paused' : ''}`} onClick={() => setPaused(p => !p)}>{paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</button>
          <button className="ad-signout" onClick={handleSignOut}><LogOut size={16} /></button>
        </div>
      </header>

      {tab === 'queue' && (
        <div className="ad-body">
          <div className="ad-main">
            <div className="ad-row"><h1 className="ad-page-title">Queue Management — {DEPT_LABELS[dept]}</h1>{paused && <span className="ad-paused-badge">⏸ Paused</span>}</div>

            <div className="ad-kpis">
              {[
                { l: 'Waiting', v: deptWaiting, c: '#0077B6' },
                { l: 'In Consult', v: deptConsult, c: '#7C5CFC' },
                { l: 'Served Today', v: served, c: '#02C39A' },
                { l: 'Avg Wait', v: `${avgWait}m`, c: avgWait > 30 ? '#E8453C' : '#F2A900' },
              ].map(k => (
                <div key={k.l} className="ad-kpi"><span className="ad-kpi-label">{k.l}</span><span className="ad-kpi-value" style={{ color: k.c }}>{typeof k.v === 'number' ? <CountUp to={k.v} duration={1} /> : k.v}</span></div>
              ))}
            </div>

            <div className="ad-dept-tabs">{STAGES.map(s => <button key={s} className={`ad-dept-tab${dept === s ? ' active' : ''}`} onClick={() => { setDept(s); setSearch(''); setSel(new Set()); setFStatus('all'); setFPri('all') }}>{DEPT_LABELS[s]} <span className="ad-dept-count">{queue.filter(e => e.department === s && e.status === 'waiting').length}</span></button>)}</div>

            <div className="ad-toolbar">
              <div className="ad-search"><Search size={14} /><input placeholder="Search name or #..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="all">All statuses</option><option value="waiting">Waiting</option><option value="in_consultation">Consulting</option><option value="done">Done</option></select>
              <select value={fPri} onChange={e => setFPri(e.target.value)}><option value="all">All priorities</option><option value="emergency">Emergency</option><option value="priority">Priority</option><option value="normal">Normal</option></select>
              <button onClick={() => exportCSV(dq, dept)}><Download size={14} /> Export</button>
            </div>

            <button className="ad-call-btn" onClick={callNext} disabled={paused || wDept.length === 0}><Phone size={18} /> Call Next Patient</button>

            {serving && (
              <motion.div className="ad-serving" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="ad-serving-info"><span className="ad-serving-label">Now Serving</span><span className="ad-serving-name">{serving.full_name} — #{serving.queue_number}</span></div>
                <div className="ad-serving-actions">
                  <button onClick={markServed}><Check size={14} /> Done</button>
                  <button onClick={() => moveStage(serving.id, 'Lab', 'in_lab')}>🔬 Lab</button>
                  <button onClick={() => moveStage(serving.id, 'Pharmacy', 'in_pharmacy')}>💊 Pharmacy</button>
                  <button onClick={() => requeuePatient(serving.id)}>↩ Re-queue</button>
                  <button onClick={() => setServing(null)}><X size={14} /> Cancel</button>
                </div>
              </motion.div>
            )}

            {sel.size > 0 && (
              <div className="ad-batch"><span>{sel.size} selected</span><button onClick={batchServe}><Check size={13} /> Served</button><button onClick={batchEmg}><Zap size={13} /> Emergency</button><button onClick={() => setSel(new Set())}><X size={13} /> Clear</button></div>
            )}

            <div className="ad-table-wrap">
              <table className="ad-table"><thead><tr><th><input type="checkbox" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th><th>Pos</th><th>Patient</th><th>#</th><th>Status</th><th>Priority</th><th>Wait</th><th>Assigned</th><th></th></tr></thead>
                <tbody>{filtered.map(e => {
                  const assignedStaff = staff.find(s => s.id === (e as any).assigned_to)
                  return (
                    <tr key={e.id} className={`${sel.has(e.id) ? 'selected' : ''}${e.priority === 'emergency' ? ' emergency' : ''}`} onClick={() => setModal(e)}>
                      <td onClick={ev => ev.stopPropagation()}><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggleSel(e.id)} /></td>
                      <td>{e.position}</td><td><span className="ad-patient-name">{e.full_name}</span></td><td>#{e.queue_number}</td>
                      <td><span className={`ad-badge ${sCls(e.status)}`}>{sLabel(e.status)}</span></td>
                      <td><span className={`ad-badge ${pCls(e.priority)}`}>{e.priority === 'emergency' && <Zap size={9} />}{e.priority}</span></td>
                      <td><span className={e.wait_time_minutes > 40 ? 'ad-wait-danger' : e.wait_time_minutes > 20 ? 'ad-wait-warn' : 'ad-wait-ok'}>{Math.round(e.wait_time_minutes)}m</span></td>
                      <td><span className="ad-assigned-to">{assignedStaff ? ini(assignedStaff.name) : '—'}</span></td>
                      <td onClick={ev => ev.stopPropagation()}><button className="ad-icon-btn" onClick={() => toggleEmg(e.id, e.priority)} title="Toggle emergency"><Zap size={12} /></button></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="ad-body"><div className="ad-main">
          <h1 className="ad-page-title">Reports & Analytics — {DEPT_LABELS[dept]}</h1>
          <div className="ad-kpis">{[{ l: 'Total Today', v: stats?.total_patients_today ?? 0 }, { l: `${DEPT_LABELS[dept]} Waiting`, v: deptWaiting }, { l: 'Served Today', v: served }, { l: 'Avg Wait', v: `${avgWait}m` }].map(k => (
            <div key={k.l} className="ad-kpi"><span className="ad-kpi-label">{k.l}</span><span className="ad-kpi-value">{typeof k.v === 'number' ? <CountUp to={k.v} duration={1} /> : k.v}</span></div>
          ))}</div>
          <div className="ad-charts">
            {[{ title: 'By Department', data: deptData, key: 'dept', val: 'c', color: '#0077B6' }, { title: 'By Status', data: statusData, key: 's', val: 'c', color: '#02C39A' }, { title: 'By Priority', data: priorityData, key: 'p', val: 'c', color: '#F2A900' }].map(chart => {
              const mx = Math.max(...chart.data.map((x: Record<string, unknown>) => x[chart.val] as number), 1)
              return <div key={chart.title} className="ad-chart-card"><h3>{chart.title}</h3>{chart.data.map((item: Record<string, unknown>) => (
                <div key={item[chart.key] as string} className="ad-bar-row"><span className="ad-bar-label">{item[chart.key] as string}</span><div className="ad-bar-track"><div className="ad-bar-fill" style={{ width: `${((item[chart.val] as number) / mx) * 100}%`, background: chart.color }} /></div><span className="ad-bar-val">{item[chart.val] as number}</span></div>
              ))}</div>
            })}
            <div className="ad-chart-card ad-chart-wide"><h3>Check-ins by Hour</h3><div className="ad-weekly">{hourlyData.map(({ h, c }) => { const mx = Math.max(...hourlyData.map(x => x.c), 1); return <div key={h} className="ad-weekly-col"><div className="ad-weekly-bars"><div className="ad-weekly-in" style={{ height: `${(c / mx) * 80}px`, background: '#7C5CFC' }} /></div><span>{h}</span></div> })}</div></div>
            <div className="ad-chart-card ad-chart-wide"><h3>Weekly Throughput</h3><div className="ad-weekly">{WEEKLY.map(({ d, i, o }) => { const mx = Math.max(...WEEKLY.map(w => w.i), 1); return <div key={d} className="ad-weekly-col"><div className="ad-weekly-bars"><div className="ad-weekly-in" style={{ height: `${(i / mx) * 80}px` }} /><div className="ad-weekly-out" style={{ height: `${(o / mx) * 80}px` }} /></div><span>{d}</span></div> })}</div></div>
          </div>
        </div></div>
      )}

      {tab === 'staff' && (
        <div className="ad-body"><div className="ad-main">
          <div className="ad-row"><h1 className="ad-page-title">Staff Management</h1><button className="ad-invite-btn" onClick={() => { setInvite(true); setInvMsg(null) }}><Users size={15} /> Invite Staff</button></div>
          <div className="ad-toolbar"><div className="ad-search"><Search size={14} /><input placeholder="Search staff..." value={sSearch} onChange={e => setSSearch(e.target.value)} /></div>
            <select value={sFilter} onChange={e => setSFilter(e.target.value)}><option value="all">All</option><option value="doctor">Doctors</option><option value="nurse">Nurses</option><option value="pharmacist">Pharmacists</option><option value="lab_tech">Lab Techs</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </div>
          <div className="ad-staff-grid">{filteredStaff.map(s => (
            <div key={s.id} className="ad-staff-card"><div className="ad-staff-avatar">{ini(s.name)}</div><div className="ad-staff-info"><p className="ad-staff-name">{s.name}</p><p className="ad-staff-role">{s.role.replace('_', ' ')} · {s.department}</p></div><span className={`ad-staff-status${s.is_active ? ' active' : ''}`}>{s.is_active ? 'Active' : 'Inactive'}</span></div>
          ))}</div>
        </div></div>
      )}

      {modal && (
        <div className="ad-overlay" onClick={() => setModal(null)}>
          <motion.div className="ad-modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <div className="ad-modal-header"><h2>Patient #{modal.queue_number}</h2><button onClick={() => setModal(null)}><X size={18} /></button></div>
            <div className="ad-modal-body">
              <div className="ad-detail-grid">{[['Name', modal.full_name], ['Queue #', `#${modal.queue_number}`], ['Position', String(modal.position)], ['Department', DEPT_LABELS[modal.department]], ['Status', sLabel(modal.status)], ['Priority', modal.priority], ['Wait', `${Math.round(modal.wait_time_minutes)} min`], ['Arrived', modal.arrived_at]].map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>
              <div className="ad-modal-actions">
                <button className="ad-btn-green" onClick={async () => { try { await queueService.callPatientToConsult(modal.id, modal.queue_number, dept); if (currentStaff?.id) await queueService.assignPatientToStaff(modal.id, currentStaff.id); setServing(modal); beep() } catch { /* */ } setModal(null); fetchQueue() }}><Phone size={14} /> Call to Consult</button>
                <button className="ad-btn-amber" onClick={async () => { await toggleEmg(modal.id, modal.priority); setModal(null) }}><Zap size={14} /> {modal.priority === 'emergency' ? 'Remove Emergency' : 'Set Emergency'}</button>
                {modal.status !== 'done' && <button className="ad-btn-red" onClick={async () => { try { await queueService.markAsServed(modal.id); setServed(c => c + 1) } catch { /* */ } setModal(null); fetchQueue() }}><Check size={14} /> Mark Served</button>}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {invite && (
        <div className="ad-overlay" onClick={() => setInvite(false)}>
          <motion.div className="ad-modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <div className="ad-modal-header"><h2>Invite Staff Member</h2><button onClick={() => setInvite(false)}><X size={18} /></button></div>
            <div className="ad-modal-body">
              {invMsg && (
                <div className={invMsg.ok ? 'ad-msg-ok' : 'ad-msg-err'}>
                  {invMsg.txt}
                  {invMsg.tempPass && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ background: 'rgba(0,0,0,0.06)', padding: '4px 8px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 700 }}>{invMsg.tempPass}</code>
                      <button onClick={() => { copyToClipboard(invMsg.tempPass!) }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: '0.6875rem' }}>
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="ad-field"><label>Full Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" /></div>
              <div className="ad-field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@hospital.com" /></div>
              <div className="ad-field-row">
                <div className="ad-field"><label>Role</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffRole }))}>{ALL_ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></div>
                <div className="ad-field"><label>Department</label><select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value as Stage }))}>{STAGES.map(s => <option key={s} value={s}>{DEPT_LABELS[s]}</option>)}</select></div>
              </div>
              <div className="ad-field"><label>Station <span className="ad-field-req">*</span></label><input value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))} placeholder="e.g. Consult Room 3, Ground Floor, East Wing" /></div>
            </div>
            <div className="ad-modal-footer"><button onClick={() => setInvite(false)}>Cancel</button><button className="ad-btn-primary" onClick={sendInvite} disabled={inviting || !form.name || !form.email || !form.station.trim()}>{inviting ? 'Sending...' : 'Send Invitation'}</button></div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
