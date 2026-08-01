import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Pause, Play, Search, X, Check, Zap, Star,
  ChevronUp, ChevronDown, Download, Users, Phone, Inbox,
  UserCircle, AlertTriangle, AlertCircle, Info,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { queueService } from '../../services/queueService'
import type {
  QueueEntry,
  StaffMember,
  DashboardStats,
  Stage,
  QueueStatus,
  PatientPriority,
  StaffRole,
} from '../../types'
import './AdminDashboard.css'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'queue' | 'reports' | 'staff'

type QStatus = QueueStatus
type QPri = PatientPriority

interface Entry extends QueueEntry {
  department: Stage
  age?: number
  complaint?: string
  arrived_at: string
}

type Staff = Omit<StaffMember, 'created_at' | 'user_id'> & {
  patients_today: number
}

interface QAlert { id: string; type: 'critical'|'warning'|'info'; message: string; dept: string; time: string }

const STAGES: Stage[] = ['OPD','Lab','Pharmacy','Maternity']
const ALL_ROLES: StaffRole[] = ['nurse','doctor','pharmacist','lab_tech']
const WEEKLY: {d: string; i: number; o: number}[] = [
  { d: 'Mon', i: 34, o: 28 },
  { d: 'Tue', i: 26, o: 22 },
  { d: 'Wed', i: 29, o: 25 },
  { d: 'Thu', i: 33, o: 27 },
  { d: 'Fri', i: 31, o: 29 },
  { d: 'Sat', i: 18, o: 15 },
  { d: 'Sun', i: 12, o: 10 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sLabel = (s:QStatus) => ({waiting:'Waiting',in_consultation:'Consulting',done:'Done',in_lab:'In Lab',in_pharmacy:'Pharmacy',cancelled:'Cancelled'}[s])
const sCls   = (s:QStatus) => ({waiting:'s-waiting',in_consultation:'s-consult',done:'s-done',in_lab:'s-lab',in_pharmacy:'s-pharmacy',cancelled:'s-cancelled'}[s])
const pCls   = (p:QPri)    => ({normal:'p-normal',priority:'p-priority',emergency:'p-emergency'}[p])
const avCls  = (r:StaffRole)=> ({doctor:'av-doctor',nurse:'av-nurse',pharmacist:'av-pharmacist',lab_tech:'av-lab_tech',admin:'av-admin'}[r])
const rbCls  = (r:StaffRole)=> ({doctor:'rb-doctor',nurse:'rb-nurse',pharmacist:'rb-pharmacist',lab_tech:'rb-lab_tech',admin:'rb-admin'}[r])
const rLabel = (r:StaffRole)=> ({doctor:'Doctor',nurse:'Nurse',pharmacist:'Pharmacist',lab_tech:'Lab Tech',admin:'Admin'}[r])
const ini    = (n:string)   => n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()
const wCls   = (m:number)   => m>40?'wait-bad':m>25?'wait-warn':'wait-ok'
const priOrder:Record<QPri,number> = {emergency:0,priority:1,normal:2}

function exportCSV(q:Entry[], dept:Stage) {
  const rows = ['Pos,Queue#,Name,Age,Status,Priority,Wait(min),Arrived,Complaint',
    ...q.map(e=>`${e.position},${e.queue_number},"${e.full_name}",${e.age},${e.status},${e.priority},${Math.round(e.wait_time_minutes)},${e.arrived_at},"${e.complaint}"`)
  ].join('\n')
  const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([rows],{type:'text/csv'})),download:`queue-${dept}-${new Date().toISOString().slice(0,10)}.csv`})
  a.click()
}

function beep() {
  try {
    const c=new (window.AudioContext||(window as any).webkitAudioContext)(),o=c.createOscillator(),g=c.createGain()
    o.connect(g);g.connect(c.destination);o.frequency.value=820
    g.gain.setValueAtTime(.25,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.45)
    o.start(c.currentTime);o.stop(c.currentTime+.45)
  } catch{}
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,      setTab]      = useState<Tab>('queue')
  const [dept,     setDept]     = useState<Stage>('OPD')
  const [queue, setQueue] = useState<Entry[]>([])
  const [serving, setServing] = useState<Entry | null>(null)
  const [alerts, setAlerts] = useState<QAlert[]>([])
  const [paused, setPaused] = useState(false)
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [fPri, setFPri] = useState('all')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<Entry | null>(null)
  const [served, setServed] = useState(0)
  const [staff, setStaff] = useState<Staff[]>([])
  const [invite, setInvite] = useState(false)
  const [form, setForm] = useState({name:'',email:'',role:'nurse' as StaffRole,department:'OPD' as Stage,station:''})
  const [inviting, setInviting] = useState(false)
  const [invMsg, setInvMsg] = useState<{ok:boolean,txt:string}|null>(null)
  const [sSearch, setSSearch] = useState('')
  const [sFilter, setSFilter] = useState('all')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [deptData, setDeptData] = useState<{dept: Stage; c: number}[]>([])
  const [statusData, setStatusData] = useState<{s: string; c: number}[]>([])
  const [priorityData, setPriorityData] = useState<{p: string; c: number}[]>([])
  const [hourlyData, setHourlyData] = useState<{h: string; c: number}[]>([])

  const fetchQueue = useCallback(async () => {
    try {
      const queueData = await queueService.getQueueByDepartment(dept)
      setQueue(queueData.map((q) => ({
        ...q,
        department: q.current_stage,
        arrived_at: q.checked_in_at,
      })))
    } catch (error) {
      console.error('Failed to load queue:', error)
    }
  }, [dept])

  const fetchStaff = useCallback(async () => {
    try {
      const staffData = await queueService.getStaffMembers()
      setStaff(staffData.map((s) => ({ ...s, patients_today: 0 })))
    } catch (error) {
      console.error('Failed to load staff:', error)
    }
  }, [])

  const fetchReports = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]

    try {
      const [dashboardStats, deptResult, statusResult, priorityResult, hourlyResult] = await Promise.all([
        queueService.getDashboardStats(),
        supabase.from('patients').select('current_stage').gte('checked_in_at', today),
        supabase.from('patients').select('status').gte('checked_in_at', today),
        supabase.from('patients').select('priority').gte('checked_in_at', today),
        supabase.rpc('get_hourly_checkins', { date: today }),
      ])

      const deptCounts = new Map<string, number>()
      deptResult.data?.forEach((row: { current_stage: string }) => {
        deptCounts.set(row.current_stage, (deptCounts.get(row.current_stage) || 0) + 1)
      })

      const statusCounts = new Map<string, number>()
      statusResult.data?.forEach((row: { status: string }) => {
        statusCounts.set(row.status, (statusCounts.get(row.status) || 0) + 1)
      })

      const priorityCounts = new Map<string, number>()
      priorityResult.data?.forEach((row: { priority: string }) => {
        priorityCounts.set(row.priority, (priorityCounts.get(row.priority) || 0) + 1)
      })

      setStats(dashboardStats)
      setDeptData(STAGES.map((d) => ({ dept: d, c: deptCounts.get(d) || 0 })))
      setStatusData(Array.from(statusCounts.entries()).map(([s, c]) => ({ s, c })))
      setPriorityData(Array.from(priorityCounts.entries()).map(([p, c]) => ({ p, c })))
      setHourlyData(((hourlyResult.data as { hour: string; count: number }[] | null) ?? []).map((item) => ({ h: item.hour, c: item.count })))
    } catch (error) {
      console.error('Failed to load reports:', error)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    fetchStaff()
  }, [fetchQueue, fetchStaff])

  useEffect(() => {
    if (tab === 'reports') fetchReports()
  }, [tab, fetchReports])

  // Real-time wait ticker
  useEffect(()=>{
    const t=setInterval(()=>{ if(!paused) setQueue(p=>p.map(e=>e.status==='waiting'?{...e,wait_time_minutes:e.wait_time_minutes+0.5}:e)) },30000)
    return ()=>clearInterval(t)
  },[paused])

  // Derived
  const dq      = queue.filter(e=>e.department===dept)
  const waiting = queue.filter(e=>e.status==='waiting').length
  const consult = queue.filter(e=>e.status==='in_consultation').length
  const wDept   = dq.filter(e=>e.status==='waiting')
  const avgWait = wDept.length ? Math.round(wDept.reduce((s,e)=>s+e.wait_time_minutes,0)/wDept.length) : 0

  const filtered = dq.filter(e=>{
    const ms = search===''||e.full_name.toLowerCase().includes(search.toLowerCase())||String(e.queue_number).includes(search)
    const mst= fStatus==='all'||e.status===fStatus
    const mp = fPri==='all'||e.priority===fPri
    return ms&&mst&&mp
  }).sort((a,b)=>priOrder[a.priority]-priOrder[b.priority]||a.position-b.position)

  const filteredStaff = staff.filter(s=>{
    const ms=sSearch===''||s.name.toLowerCase().includes(sSearch.toLowerCase())
    const mf=sFilter==='all'||s.role===sFilter||(sFilter==='active'&&s.is_active)||(sFilter==='inactive'&&!s.is_active)
    return ms&&mf
  })

  // Handlers
  const callNext = useCallback(()=>{
    const next=[...dq].filter(e=>e.status==='waiting').sort((a,b)=>priOrder[a.priority]-priOrder[b.priority]||a.position-b.position)[0]
    if(!next)return
    setQueue(p=>p.map(e=>e.id===next.id?{...e,status:'in_consultation'}:e))
    setServing(next);beep()
  },[dq])

  const markServed = useCallback(()=>{
    if(!serving)return
    setQueue(p=>p.map(e=>e.id===serving.id?{...e,status:'done'}:e))
    setServed(c=>c+1);setServing(null)
  },[serving])

  const toggleEmg = useCallback((id:string,cur:QPri)=>{
    setQueue(p=>p.map(e=>e.id===id?{...e,priority:cur==='emergency'?'normal':'emergency'}:e))
  },[])

  const moveUp = useCallback((id:string)=>{
    setQueue(prev=>{
      const d=[...prev.filter(e=>e.department===dept)].sort((a,b)=>a.position-b.position)
      const i=d.findIndex(e=>e.id===id);if(i<=0)return prev
      ;[d[i-1],d[i]]=[d[i],d[i-1]];d.forEach((e,j)=>{e.position=j+1})
      return prev.map(e=>{const f=d.find(x=>x.id===e.id);return f??e})
    })
  },[dept])

  const moveDown = useCallback((id:string)=>{
    setQueue(prev=>{
      const d=[...prev.filter(e=>e.department===dept)].sort((a,b)=>a.position-b.position)
      const i=d.findIndex(e=>e.id===id);if(i<0||i>=d.length-1)return prev
      ;[d[i],d[i+1]]=[d[i+1],d[i]];d.forEach((e,j)=>{e.position=j+1})
      return prev.map(e=>{const f=d.find(x=>x.id===e.id);return f??e})
    })
  },[dept])

  const batchServe = useCallback(()=>{
    setQueue(p=>p.map(e=>sel.has(e.id)?{...e,status:'done'}:e))
    setServed(c=>c+sel.size);setSel(new Set())
  },[sel])

  const batchEmg = useCallback(()=>{
    setQueue(p=>p.map(e=>sel.has(e.id)?{...e,priority:'emergency'}:e))
    setSel(new Set())
  },[sel])

  const toggleSel = useCallback((id:string)=>{
    setSel(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})
  },[])

  const toggleAll = useCallback(()=>{
    setSel(p=>p.size===filtered.length?new Set():new Set(filtered.map(e=>e.id)))
  },[filtered])

  const sendInvite = useCallback(()=>{
    if(!form.name||!form.email)return
    setInviting(true)
    setTimeout(()=>{
      setStaff(p=>[...p,{id:`s${Date.now()}`,name:form.name,role:form.role,department:form.department,station:form.station||'—',is_active:false,patients_today:0}])
      setInvMsg({ok:true,txt:`Invitation sent to ${form.email}`})
      setForm({name:'',email:'',role:'nurse',department:'OPD',station:''})
      setInviting(false)
    },800)
  },[form])

  // ── Alert Icon helper ────────────────────────────────────────────────────────
  const AIcon=({type}:{type:QAlert['type']})=>{
    if(type==='critical')return<AlertCircle size={14} color="white"/>
    if(type==='warning') return<AlertTriangle size={14} color="white"/>
    return<Info size={14} color="white"/>
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="ad-page">

      {/* ═══ NAV ═══ */}
      <nav className="ad-nav">
        <div className="ad-nav-inner">
          <div className="ad-brand">
            <div className="ad-brand-icon" aria-label="Medical icon">
              <span aria-hidden="true">⚕️</span>
            </div>
            <span className="ad-brand-name">MediQueue Admin</span>
          </div>

          <div className="ad-nav-tabs">
            {(['queue','reports','staff'] as Tab[]).map(t=>(
              <button key={t} className={`ad-nav-tab${tab===t?' active':''}`} onClick={()=>setTab(t)}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          <div className="ad-nav-right">
            <button className={`ad-pause-btn${paused?' paused':''}`} onClick={()=>setPaused(p=>!p)}>
              {paused?<><Play size={12}/>Resume</>:<><Pause size={12}/>Pause Queue</>}
            </button>
            <div className="ad-bell">
              <Bell size={15}/>
              {alerts.length>0&&<span className="ad-bell-dot"/>}
            </div>
            <div className="ad-nav-user">
              <div className="ad-avatar">AD</div>
              <span className="ad-nav-name">Admin</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ QUEUE TAB ═══ */}
      {tab==='queue'&&(
        <div className="ad-body">
          <div>
            <div className="ad-header">
              <h1 className="ad-title">Queue Management</h1>
              <p className="ad-subtitle">{paused?'⏸ Queue paused — not accepting new patients':`Live queue · ${dept==='OPD'?'Outpatient (OPD)':dept}`}</p>
            </div>

            {/* KPI */}
            <div className="ad-kpi-row">
              <div className={`ad-kpi kpi-waiting${paused?' kpi-paused':''}`}>
                <div className="ad-kpi-label">Waiting Now</div>
                <div className="ad-kpi-val">{waiting}</div>
                <div className="ad-kpi-sub">all departments</div>
              </div>
              <div className="ad-kpi kpi-consult">
                <div className="ad-kpi-label">In Consultation</div>
                <div className="ad-kpi-val">{consult}</div>
                <div className="ad-kpi-sub">currently active</div>
              </div>
              <div className="ad-kpi kpi-served">
                <div className="ad-kpi-label">Served Today</div>
                <div className="ad-kpi-val">{served}</div>
                <div className="ad-kpi-sub">completed visits</div>
              </div>
              <div className="ad-kpi kpi-wait">
                <div className="ad-kpi-label">Avg Wait · {dept}</div>
                <div className="ad-kpi-val">{avgWait}<span style={{fontSize:16,fontWeight:500}}> min</span></div>
                <div className="ad-kpi-sub">this department</div>
              </div>
            </div>

            {/* Alerts */}
            {alerts.map(a=>(
              <div key={a.id} className={`ad-alert alert-${a.type}`}>
                <div className="ad-alert-ico"><AIcon type={a.type}/></div>
                <div className="ad-alert-body">
                  <div className="ad-alert-head">{a.dept} · {a.time}</div>
                  <div className="ad-alert-msg">{a.message}</div>
                </div>
                <button className="ad-alert-close" onClick={()=>setAlerts(p=>p.filter(x=>x.id!==a.id))}>
                  <X size={14}/>
                </button>
              </div>
            ))}

            {/* Dept tabs */}
            <div className="ad-dept-row">
              <span className="ad-dept-lbl">Dept</span>
              <div className="ad-dept-tabs">
                {STAGES.map(s=>(
                  <button key={s} className={`ad-dept-tab${dept===s?' active':''}`}
                    onClick={()=>{setDept(s);setSearch('');setSel(new Set());setFStatus('all');setFPri('all')}}>
                    {s==='OPD'?'Outpatient':s}
                    <span style={{marginLeft:5,fontSize:10,opacity:.7}}>({queue.filter(e=>e.department===s&&e.status==='waiting').length})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toolbar */}
            <div className="ad-toolbar">
              <div className="ad-search">
                <span className="ad-search-ico"><Search size={13}/></span>
                <input placeholder="Search name or queue number…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <select className="ad-sel" value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="waiting">Waiting</option>
                <option value="in_consultation">Consulting</option>
                <option value="in_lab">In Lab</option>
                <option value="in_pharmacy">Pharmacy</option>
                <option value="done">Done</option>
              </select>
              <select className="ad-sel" value={fPri} onChange={e=>setFPri(e.target.value)}>
                <option value="all">All priorities</option>
                <option value="emergency">Emergency</option>
                <option value="priority">Priority</option>
                <option value="normal">Normal</option>
              </select>
              <button className="btn btn-ghost btn-sm" onClick={()=>exportCSV(dq,dept)}>
                <Download size={13}/>Export CSV
              </button>
            </div>

            {/* Now Serving */}
            {serving&&(
              <div className="ad-serving">
                <div className="ad-serving-hd"><div className="ad-pulse"/><span className="ad-serving-lbl">Now Serving</span></div>
                <div className="ad-serving-grid">
                  <div><div className="ad-si-label">Name</div>    <div className="ad-si-val">{serving.full_name}</div></div>
                  <div><div className="ad-si-label">Queue #</div>  <div className="ad-si-val">#{serving.queue_number}</div></div>
                  <div><div className="ad-si-label">Position</div> <div className="ad-si-val">{serving.position}</div></div>
                  <div><div className="ad-si-label">Wait</div>     <div className="ad-si-val">{Math.round(serving.wait_time_minutes)} min</div></div>
                </div>
                <div className="ad-serving-acts">
                  <button className="btn btn-success" onClick={markServed}><Check size={14}/>Mark as Served</button>
                  <button className="btn btn-ghost"   onClick={()=>setServing(null)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Call Next */}
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <button className="btn btn-primary btn-full" onClick={callNext}
                disabled={paused||wDept.length===0}>
                {paused?<><Pause size={14}/>Queue Paused</>:<><Phone size={14}/>Call Next Patient</>}
              </button>
            </div>

            {/* Batch bar */}
            {sel.size>0&&(
              <div className="ad-batch">
                <span className="ad-batch-ct">{sel.size} patient{sel.size>1?'s':''} selected</span>
                <button className="btn btn-success btn-sm" onClick={batchServe}><Check size={12}/>Mark Served</button>
                <button className="btn btn-danger  btn-sm" onClick={batchEmg}><Zap size={12}/>Set Emergency</button>
                <button className="btn btn-ghost   btn-sm" onClick={()=>setSel(new Set())}><X size={12}/>Clear</button>
              </div>
            )}

            {/* Queue table */}
            <div className="ad-card">
              <div className="ad-card-hd">
                <span className="ad-card-title">Queue List</span>
                <span className="ad-pill">{filtered.length} patient{filtered.length!==1?'s':''}</span>
              </div>
              <div className="ad-card-body">
                {filtered.length===0?(
                  <div className="ad-empty">
                    <div className="ad-empty-icon"><Inbox size={22}/></div>
                    <p className="ad-empty-text">{search?'No patients match your search':'No patients in queue'}</p>
                  </div>
                ):(
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th style={{width:36}}>
                          <input type="checkbox" className="ad-cb"
                            checked={sel.size===filtered.length&&filtered.length>0}
                            onChange={toggleAll}/>
                        </th>
                        <th>Pos</th><th>Name</th><th>Queue #</th>
                        <th>Status</th><th>Priority</th><th>Wait</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(e=>(
                        <tr key={e.id}
                          className={[e.priority==='emergency'?'row-emergency':'',sel.has(e.id)?'row-selected':''].join(' ')}
                          onClick={()=>setModal(e)}>
                          <td onClick={ev=>ev.stopPropagation()}>
                            <input type="checkbox" className="ad-cb"
                              checked={sel.has(e.id)} onChange={()=>toggleSel(e.id)}/>
                          </td>
                          <td><span className="ad-pos">{e.position}</span></td>
                          <td style={{fontWeight:500}}>{e.full_name}</td>
                          <td><span className="ad-qnum">#{e.queue_number}</span></td>
                          <td><span className={`badge ${sCls(e.status)}`}>{sLabel(e.status)}</span></td>
                          <td>
                            <span className={`badge ${pCls(e.priority)}`}>
                              {e.priority==='emergency'&&<Zap size={9}/>}
                              {e.priority==='priority'&&<Star size={9}/>}
                              {e.priority==='emergency'?'Emergency':e.priority==='priority'?'Priority':'Normal'}
                            </span>
                          </td>
                          <td><span className={`ad-wait ${wCls(e.wait_time_minutes)}`}>{Math.round(e.wait_time_minutes)}m</span></td>
                          <td onClick={ev=>ev.stopPropagation()}>
                            <div style={{display:'flex',gap:4}}>
                              <button className={`btn ${e.priority==='emergency'?'btn-emg-on':'btn-emg-off'}`}
                                onClick={()=>toggleEmg(e.id,e.priority)} title="Toggle emergency"><Zap size={11}/></button>
                              <button className="btn btn-ghost btn-sm" onClick={()=>moveUp(e.id)}   title="Move up"><ChevronUp size={12}/></button>
                              <button className="btn btn-ghost btn-sm" onClick={()=>moveDown(e.id)} title="Move down"><ChevronDown size={12}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="ad-sidebar">
            <div className="ad-sc">
              <p className="ad-sc-title">Today's Stats</p>
              <div className="ad-stat-hero">
                <div className="ad-stat-hero-lbl">Patients Served</div>
                <div className="ad-stat-hero-val">{served}</div>
              </div>
              <div className="ad-kv"><span className="ad-kv-k">Avg Wait · {dept}</span><span className="ad-kv-v">{avgWait} min</span></div>
              <div className="ad-kv"><span className="ad-kv-k">Active Staff</span><span className="ad-kv-v">{staff.filter(s=>s.is_active).length}</span></div>
              <div className="ad-kv"><span className="ad-kv-k">Department</span><span className="ad-kv-v">{dept}</span></div>
              <div className="ad-kv"><span className="ad-kv-k">Queue Length</span><span className="ad-kv-v">{wDept.length} waiting</span></div>
            </div>

            <div className="ad-sc">
              <p className="ad-sc-title">Connection</p>
              <div className={`ad-conn${paused?' paused':''}`}>
                <div className="ad-conn-dot"/>
                <span className="ad-conn-txt">{paused?'Queue Paused':'Real-time Connected'}</span>
              </div>
              <p className="ad-conn-sub">{paused?'Resume to accept new patients.':'Live updates via Supabase realtime.'}</p>
            </div>

            <div className="ad-sc">
              <p className="ad-sc-title">Staff Workload</p>
              {staff.filter(s=>s.is_active).slice(0,5).map(s=>{
                const mx=Math.max(...staff.map(x=>x.patients_today),1)
                const pct=Math.round((s.patients_today/mx)*100)
                const col=pct>80?'#dc2626':pct>50?'#d97706':'#16a34a'
                return(
                  <div key={s.id} className="ad-wl-row">
                    <div>
                      <div className="ad-wl-name">{s.name.split(' ').slice(-1)[0]}</div>
                      <div className="ad-wl-sub">{rLabel(s.role)}</div>
                    </div>
                    <div className="ad-wl-bar"><div className="ad-wl-fill" style={{width:`${pct}%`,background:col}}/></div>
                    <span className="ad-wl-ct">{s.patients_today}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ REPORTS TAB ═══ */}
      {tab==='reports'&&(
        <div className="ad-body ad-body-full">
          <div>
            <div className="ad-header">
              <h1 className="ad-title">Reports & Analytics</h1>
              <p className="ad-subtitle">Patient statistics and performance data for today</p>
            </div>

            <div className="ad-rpt-kpi">
              {[
                {l:'Total Today',   v:stats?.total_patients_today ?? 0, sub:'check-ins',      c:'kpi-waiting'},
                {l:'Waiting Now',   v:waiting,   sub:'all departments', c:'kpi-wait'},
                {l:'Served Today',  v:served,    sub:'completed',       c:'kpi-served'},
                {l:'Avg Wait',      v:`${stats?.avg_wait_minutes ?? avgWait}m`, sub:'current dept', c:'kpi-consult'},
              ].map(k=>(
                <div key={k.l} className={`ad-kpi ${k.c}`}>
                  <div className="ad-kpi-label">{k.l}</div>
                  <div className="ad-kpi-val">{k.v}</div>
                  <div className="ad-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="ad-charts">
              {/* By Dept */}
              <div className="ad-cc">
                <h3 className="ad-cc-title">By Department</h3>
                <div className="ad-bars">
                  {deptData.map(({dept:d,c})=>{
                    const mx=Math.max(...deptData.map(x=>x.c),1)
                    return(
                      <div key={d} className="ad-bar-row">
                        <span className="ad-bar-lbl">{d}</span>
                        <div className="ad-bar-track"><div className="ad-bar-fill f-primary" style={{width:`${(c/mx)*100}%`}}/></div>
                        <span className="ad-bar-ct">{c}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By Status */}
              <div className="ad-cc">
                <h3 className="ad-cc-title">By Status</h3>
                <div className="ad-bars">
                  {statusData.map(({s,c})=>{
                    const mx=Math.max(...statusData.map(x=>x.c),1)
                    return(
                      <div key={s} className="ad-bar-row">
                        <span className="ad-bar-lbl">{s}</span>
                        <div className="ad-bar-track"><div className="ad-bar-fill f-success" style={{width:`${(c/mx)*100}%`}}/></div>
                        <span className="ad-bar-ct">{c}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By Priority */}
              <div className="ad-cc">
                <h3 className="ad-cc-title">Waiting by Priority</h3>
                <div className="ad-bars">
                  {priorityData.map(({p,c})=>{
                    const mx=Math.max(...priorityData.map(x=>x.c),1)
                    const f=p==='emergency'?'f-danger':p==='priority'?'f-warning':'f-primary'
                    return(
                      <div key={p} className="ad-bar-row">
                        <span className="ad-bar-lbl">{p}</span>
                        <div className="ad-bar-track"><div className={`ad-bar-fill ${f}`} style={{width:`${(c/mx)*100}%`}}/></div>
                        <span className="ad-bar-ct">{c}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Hourly */}
              <div className="ad-cc">
                <h3 className="ad-cc-title">Check-ins by Hour</h3>
                <div className="ad-vchart">
                  {hourlyData.map(({h,c})=>{
                    const mx=Math.max(...hourlyData.map(x=>x.c),1)
                    return(
                      <div key={h} className="ad-vc-col">
                        <div className="ad-vc-bar-wrap">
                          <div className="ad-vc-bar" style={{height:`${(c/mx)*100}%`}}/>
                        </div>
                        <span className="ad-vc-val">{c}</span>
                        <span className="ad-vc-lbl">{h}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Weekly throughput */}
              <div className="ad-cc ad-cc-wide">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <h3 className="ad-cc-title" style={{margin:0}}>Weekly Throughput</h3>
                  <div style={{display:'flex',gap:14}}>
                    {[{c:'#002147',l:'Admitted'},{c:'#16a34a',l:'Discharged'}].map(({c,l})=>(
                      <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--on-muted)'}}>
                        <span style={{width:10,height:10,background:c,borderRadius:2,display:'inline-block'}}/>{l}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ad-tp">
                  {WEEKLY.map(({d,i,o})=>{
                    const mx=Math.max(...WEEKLY.map(w=>w.i),1)
                    return(
                      <div key={d} className="ad-tp-col">
                        <div className="ad-tp-bars">
                          <div className="ad-tp-bar tp-in"  style={{height:`${(i/mx)*96}px`}}/>
                          <div className="ad-tp-bar tp-out" style={{height:`${(o/mx)*96}px`}}/>
                        </div>
                        <span className="ad-tp-lbl">{d}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STAFF TAB ═══ */}
      {tab==='staff'&&(
        <div className="ad-body ad-body-full">
          <div>
            <div className="ad-header">
              <h1 className="ad-title">Staff Management</h1>
              <p className="ad-subtitle">Manage staff, availability and send invitations</p>
            </div>

            <div className="ad-staff-tb">
              <button className="btn btn-primary" onClick={()=>{setInvite(true);setInvMsg(null)}}>
                <Users size={14}/>Invite Staff Member
              </button>
              <div className="ad-search" style={{maxWidth:240}}>
                <span className="ad-search-ico"><Search size={13}/></span>
                <input placeholder="Search staff…" value={sSearch} onChange={e=>setSSearch(e.target.value)}/>
              </div>
              <select className="ad-sel" value={sFilter} onChange={e=>setSFilter(e.target.value)}>
                <option value="all">All roles</option>
                <option value="doctor">Doctors</option>
                <option value="nurse">Nurses</option>
                <option value="pharmacist">Pharmacists</option>
                <option value="lab_tech">Lab Techs</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive</option>
              </select>
              <span style={{marginLeft:'auto',fontSize:13,color:'var(--on-muted)',fontWeight:500}}>
                {staff.filter(s=>s.is_active).length} active · {staff.length} total
              </span>
            </div>

            {filteredStaff.length===0?(
              <div className="ad-empty">
                <div className="ad-empty-icon"><UserCircle size={22}/></div>
                <p className="ad-empty-text">No staff members found</p>
              </div>
            ):(
              <div className="ad-staff-grid">
                {filteredStaff.map(s=>{
                  const mx=Math.max(...staff.map(x=>x.patients_today),1)
                  const pct=Math.round((s.patients_today/mx)*100)
                  const col=pct>80?'#dc2626':pct>50?'#d97706':'#16a34a'
                  return(
                    <div key={s.id} className="ad-staff-card">
                      <div className={`ad-stf-av ${avCls(s.role)}`}>{ini(s.name)}</div>
                      <div className="ad-stf-info">
                        <div className="ad-stf-name">{s.name}</div>
                        <div className="ad-stf-meta">
                          <span className={`ad-role-b ${rbCls(s.role)}`}>{rLabel(s.role)}</span>
                          <span className="ad-stf-dept">{s.department}</span>
                          <span>{s.station}</span>
                        </div>
                        {s.is_active&&(
                          <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
                            <div style={{flex:1,height:4,background:'var(--surface-3)',borderRadius:9999,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${pct}%`,background:col,borderRadius:9999,transition:'width .6s'}}/>
                            </div>
                            <span style={{fontSize:11,color:'var(--on-muted)',fontWeight:600,whiteSpace:'nowrap'}}>{s.patients_today} pts</span>
                          </div>
                        )}
                      </div>
                      <span className={`ad-stf-status ${s.is_active?'ss-on':'ss-off'}`}>
                        {s.is_active?'Active':'Inactive'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ PATIENT MODAL ═══ */}
      {modal&&(
        <div className="ad-overlay" onClick={()=>setModal(null)}>
          <div className="ad-modal" onClick={e=>e.stopPropagation()}>
            <div className="ad-modal-hd">
              <h2 className="ad-modal-title">Patient #{modal.queue_number}</h2>
              <button className="ad-modal-close" onClick={()=>setModal(null)}><X size={16}/></button>
            </div>
            <div className="ad-modal-body">
              <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
                <span className={`badge ${sCls(modal.status)}`}>{sLabel(modal.status)}</span>
                <span className={`badge ${pCls(modal.priority)}`}>
                  {modal.priority==='emergency'&&<Zap size={9}/>}
                  {modal.priority==='priority'&&<Star size={9}/>}
                  {modal.priority==='emergency'?'Emergency':modal.priority==='priority'?'Priority':'Normal'}
                </span>
              </div>
              <div className="ad-detail-grid">
                <div className="ad-di"><span className="ad-di-lbl">Full Name</span>  <span className="ad-di-val">{modal.full_name}</span></div>
                <div className="ad-di"><span className="ad-di-lbl">Age</span>         <span className="ad-di-val">{modal.age} years</span></div>
                <div className="ad-di"><span className="ad-di-lbl">Queue #</span>     <span className="ad-di-val">#{modal.queue_number}</span></div>
                <div className="ad-di"><span className="ad-di-lbl">Position</span>    <span className="ad-di-val">{modal.position}</span></div>
                <div className="ad-di"><span className="ad-di-lbl">Department</span>  <span className="ad-di-val">{modal.department==='OPD'?'Outpatient (OPD)':modal.department}</span></div>
                <div className="ad-di"><span className="ad-di-lbl">Arrived At</span>  <span className="ad-di-val">{modal.arrived_at}</span></div>
                <div className="ad-di"><span className="ad-di-lbl">Wait Time</span>   <span className="ad-di-val">{Math.round(modal.wait_time_minutes)} min</span></div>
                <div className="ad-di"><span className="ad-di-lbl">Status</span>      <span className="ad-di-val">{sLabel(modal.status)}</span></div>
                <div className="ad-di ad-di-wide"><span className="ad-di-lbl">Chief Complaint</span><span className="ad-di-val">{modal.complaint}</span></div>
              </div>
              <div className="ad-modal-acts">
                <button className="btn btn-success" onClick={()=>{setQueue(p=>p.map(e=>e.id===modal.id?{...e,status:'in_consultation'}:e));setServing(modal);beep();setModal(null)}}>
                  <Phone size={13}/>Call to Consult
                </button>
                <button className="btn btn-warn" onClick={()=>{toggleEmg(modal.id,modal.priority);setModal(null)}}>
                  <Zap size={13}/>{modal.priority==='emergency'?'Remove Emergency':'Set Emergency'}
                </button>
                {modal.status!=='done'&&(
                  <button className="btn btn-ghost" onClick={()=>{setQueue(p=>p.map(e=>e.id===modal.id?{...e,status:'done'}:e));setServed(c=>c+1);setModal(null)}}>
                    <Check size={13}/>Mark Served
                  </button>
                )}
              </div>
            </div>
            <div className="ad-modal-ft">
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INVITE MODAL ═══ */}
      {invite&&(
        <div className="ad-overlay" onClick={()=>setInvite(false)}>
          <div className="ad-modal" onClick={e=>e.stopPropagation()}>
            <div className="ad-modal-hd">
              <h2 className="ad-modal-title">Invite Staff Member</h2>
              <button className="ad-modal-close" onClick={()=>setInvite(false)}><X size={16}/></button>
            </div>
            <div className="ad-modal-body" style={{display:'flex',flexDirection:'column',gap:16}}>
              {invMsg&&<div className={`ad-toast ${invMsg.ok?'toast-ok':'toast-err'}`}>{invMsg.txt}</div>}
              <div className="ad-fg">
                <label className="ad-fl">Full Name</label>
                <input className="ad-fi" placeholder="e.g. Jane Smith" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
              </div>
              <div className="ad-fg">
                <label className="ad-fl">Email Address</label>
                <input className="ad-fi" type="email" placeholder="e.g. jane@hospital.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
              </div>
              <div className="ad-frow">
                <div className="ad-fg">
                  <label className="ad-fl">Role</label>
                  <select className="ad-fs" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as StaffRole}))}>
                    {ALL_ROLES.map(r=><option key={r} value={r}>{rLabel(r)}</option>)}
                  </select>
                </div>
                <div className="ad-fg">
                  <label className="ad-fl">Department</label>
                  <select className="ad-fs" value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value as Stage}))}>
                    {STAGES.map(s=><option key={s} value={s}>{s==='OPD'?'Outpatient (OPD)':s}</option>)}
                  </select>
                </div>
              </div>
              <div className="ad-fg">
                <label className="ad-fl">Station <span className="ad-fopt">(optional)</span></label>
                <input className="ad-fi" placeholder="e.g. Consult Room 3" value={form.station} onChange={e=>setForm(f=>({...f,station:e.target.value}))}/>
              </div>
            </div>
            <div className="ad-modal-ft">
              <button className="btn btn-ghost" onClick={()=>setInvite(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendInvite} disabled={inviting||!form.name||!form.email}>
                {inviting?<><span className="spinner"/>Sending…</>:'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
