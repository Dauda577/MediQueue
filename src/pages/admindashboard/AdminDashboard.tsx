import { useState, useEffect } from 'react'
import { queueService } from '../../services/queueService'
import { supabase } from '../../lib/supabase'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { useRealtimeAlerts } from '../../hooks/useRealtimeAlerts'
import { announcePatient } from '../../lib/announce'
import { useAuth } from '../../context/AuthContext'
import type { QueueEntry, CallAlert, Stage, StaffRole, StaffMember } from '../../types'
import './AdminDashboard.css'

type Tab = 'queue' | 'reports' | 'staff'

const DEPARTMENTS: Stage[] = ['OPD', 'Lab', 'Pharmacy', 'Maternity']
const STAFF_ROLES: StaffRole[] = ['nurse', 'doctor', 'pharmacist', 'lab_tech']

export default function AdminDashboard() {
  const { staff: currentStaff } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('queue')
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDept, setSelectedDept] = useState<Stage>('OPD')
  const [currentServing, setCurrentServing] = useState<QueueEntry | null>(null)
  const [stats, setStats] = useState({ served: 0, avgWait: 0, doctorsOnline: 0 })
  const [recentAlert, setRecentAlert] = useState<CallAlert | null>(null)

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'nurse' as StaffRole, department: 'OPD' as Stage, station: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Staff list
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  // Reports data
  const [reportData, setReportData] = useState<{
    deptBreakdown: { dept: Stage; count: number }[]
    statusBreakdown: { status: string; count: number }[]
    priorityBreakdown: { priority: string; count: number }[]
    hourlyTrend: { hour: string; count: number }[]
    totalToday: number
  } | null>(null)

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const [queueData, dashboardStats, { count: servedCount }] = await Promise.all([
        queueService.getQueueByDepartment(selectedDept),
        queueService.getDashboardStats(),
        supabase.from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'done')
          .gte('checked_in_at', today),
      ])
      setQueue(queueData)
      setStats({
        served: servedCount ?? 0,
        avgWait: dashboardStats.avg_wait_minutes,
        doctorsOnline: dashboardStats.physicians_active,
      })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async () => {
    const today = new Date().toISOString().split('T')[0]

    try {
      const [
        deptResult,
        statusResult,
        priorityResult,
        allToday,
        hourlyResult,
      ] = await Promise.all([
        supabase.from('patients').select('current_stage').gte('checked_in_at', today),
        supabase.from('patients').select('status').gte('checked_in_at', today),
        supabase.from('patients').select('priority').gte('checked_in_at', today).eq('status', 'waiting'),
        supabase.from('patients').select('id', { count: 'exact', head: true }).gte('checked_in_at', today),
        (async () => {
          const { data: hData, error: hError } = await supabase.rpc('get_hourly_checkins', { date: today })
          return hError ? [] : (hData ?? [])
        })(),
      ])

      const deptMap = new Map<string, number>()
      deptResult.data?.forEach((p: { current_stage: string }) => {
        deptMap.set(p.current_stage, (deptMap.get(p.current_stage) || 0) + 1)
      })

      const statusMap = new Map<string, number>()
      statusResult.data?.forEach((p: { status: string }) => {
        statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1)
      })

      const priorityMap = new Map<string, number>()
      priorityResult.data?.forEach((p: { priority: string }) => {
        priorityMap.set(p.priority, (priorityMap.get(p.priority) || 0) + 1)
      })

      const hourly = hourlyTrend as { hour: string; count: number }[]

      setReportData({
        deptBreakdown: DEPARTMENTS.map(d => ({ dept: d, count: deptMap.get(d) || 0 })),
        statusBreakdown: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
        priorityBreakdown: Array.from(priorityMap.entries()).map(([priority, count]) => ({ priority, count })),
        hourlyTrend: hourly,
        totalToday: allToday.count ?? 0,
      })
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    }
  }

  const fetchStaff = async () => {
    try {
      const data = await queueService.getStaffMembers()
      setStaffMembers(data)
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    }
  }

  useEffect(() => {
    if (activeTab === 'reports') fetchReports()
    if (activeTab === 'staff') fetchStaff()
  }, [activeTab])

  useEffect(() => { fetchQueue() }, [selectedDept])

  useRealtimeQueue({
    department: selectedDept,
    onUpdate: fetchQueue,
  })

  useRealtimeAlerts({
    onNewAlert: (alert: CallAlert) => {
      setRecentAlert(alert)
      playAudio()
      setTimeout(() => setRecentAlert(null), 5000)
    },
  })

  const handleCallNext = async () => {
    try {
      const next = await queueService.callNextPatient(selectedDept)
      setCurrentServing(next)
      announcePatient(next.queue_number, selectedDept, next.full_name)
      playAudio()
    } catch (error) {
      console.error('Failed to call next:', error)
    }
  }

  const handleMarkServed = async () => {
    if (!currentServing) return
    try {
      await queueService.markAsServed(currentServing.id)
      setCurrentServing(null)
    } catch (error) {
      console.error('Failed to mark served:', error)
    }
  }

  const handleToggleEmergency = async (queueId: string, currentPriority: string) => {
    try {
      const newPriority = currentPriority === 'emergency' ? 'normal' : 'emergency'
      await queueService.markAsEmergency(queueId, newPriority as any)
    } catch (error) {
      console.error('Failed to toggle emergency:', error)
    }
  }

  const handleInvite = async () => {
    setInviteError(null)
    setInviteSuccess(null)
    setInviting(true)

    try {
      const { error } = await supabase.functions.invoke('invite-staff', {
        body: {
          name: inviteForm.name,
          email: inviteForm.email,
          role: inviteForm.role,
          department: inviteForm.department,
          station: inviteForm.station || null,
        },
      })

      if (error) throw new Error(error.message || 'Failed to invite staff')

      setInviteSuccess(`Invitation sent to ${inviteForm.email}`)
      setInviteForm({ name: '', email: '', role: 'nurse', department: 'OPD', station: '' })
      fetchStaff()
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite staff member')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="ad-page">
      <nav className="ad-nav">
        <div className="ad-nav-inner">
          <div className="ad-brand">
            <span className="ad-brand-icon">⚕️</span>
            <span className="ad-brand-name">MediQueue Admin</span>
          </div>
          <div className="ad-nav-tabs">
            <button
              className={`ad-nav-tab ${activeTab === 'queue' ? 'ad-nav-tab-active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Queue
            </button>
            <button
              className={`ad-nav-tab ${activeTab === 'reports' ? 'ad-nav-tab-active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              Reports
            </button>
            <button
              className={`ad-nav-tab ${activeTab === 'staff' ? 'ad-nav-tab-active' : ''}`}
              onClick={() => setActiveTab('staff')}
            >
              Staff
            </button>
          </div>
          <div className="ad-nav-user">
            <span className="ad-nav-user-name">{currentStaff?.name}</span>
          </div>
        </div>
      </nav>

      {activeTab === 'queue' && (
        <div className="ad-body">
          <div>
            <div className="ad-header">
              <h1 className="ad-title">Queue Management</h1>
              <p className="ad-subtitle">Real-time patient queue management</p>
            </div>

            {recentAlert && (
              <div className="ad-alert-notification">
                <span className="ad-alert-icon">🔔</span>
                <div className="ad-alert-content">
                  <p className="ad-alert-title">New Call Alert</p>
                  <p className="ad-alert-text">Patient #{recentAlert.queue_number} called to station</p>
                </div>
              </div>
            )}

            <div className="ad-dept-selector">
              <label className="ad-dept-label">Department:</label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value as Stage)}
                className="ad-dept-select"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d === 'OPD' ? 'Outpatient (OPD)' : d}</option>
                ))}
              </select>
            </div>

            {currentServing && (
              <div className="ad-serving-card">
                <h3 className="ad-serving-title">Now Serving</h3>
                <div className="ad-serving-info">
                  <div className="ad-serving-item">
                    <span className="ad-serving-label">Name</span>
                    <span className="ad-serving-value">{currentServing.full_name}</span>
                  </div>
                  <div className="ad-serving-item">
                    <span className="ad-serving-label">Queue #</span>
                    <span className="ad-serving-value">#{currentServing.queue_number}</span>
                  </div>
                  <div className="ad-serving-item">
                    <span className="ad-serving-label">Position</span>
                    <span className="ad-serving-value">{currentServing.position}</span>
                  </div>
                  <div className="ad-serving-item">
                    <span className="ad-serving-label">Wait Time</span>
                    <span className="ad-serving-value">{currentServing.wait_time_minutes}m</span>
                  </div>
                </div>
                <div className="ad-serving-actions">
                  <button onClick={handleMarkServed} className="ad-btn ad-btn-success">✓ Mark as Served</button>
                  <button onClick={() => setCurrentServing(null)} className="ad-btn ad-btn-ghost">Cancel</button>
                </div>
              </div>
            )}

            <div className="ad-call-section">
              <button onClick={handleCallNext} disabled={loading} className="ad-btn ad-btn-primary ad-call-btn">
                {loading ? <><span className="ad-spinner" /> Loading...</> : <>📞 Call Next Patient</>}
              </button>
            </div>

            <div className="ad-queue-card">
              <div className="ad-queue-head">
                <h2 className="ad-queue-title">Queue List</h2>
                <span className="ad-queue-count">{queue.length} patients</span>
              </div>
              <div className="ad-queue-body">
                {queue.length === 0 ? (
                  <div className="ad-empty-state">
                    <div className="ad-empty-icon">📭</div>
                    <p className="ad-empty-text">No patients in queue</p>
                  </div>
                ) : (
                  <table className="ad-queue-table">
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Name</th>
                        <th>Queue #</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Wait</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((entry) => (
                        <tr key={entry.id}>
                          <td><span className="ad-queue-position">{entry.position}</span></td>
                          <td>{entry.full_name}</td>
                          <td><span className="ad-queue-number">#{entry.queue_number}</span></td>
                          <td>
                            <span className={`ad-status-badge ad-status-${entry.status}`}>
                              {entry.status === 'waiting' && '⏳ Waiting'}
                              {entry.status === 'in_consultation' && '🔄 Consulting'}
                              {entry.status === 'done' && '✓ Done'}
                              {entry.status === 'in_lab' && '🧪 Lab'}
                              {entry.status === 'in_pharmacy' && '💊 Pharmacy'}
                            </span>
                          </td>
                          <td>
                            <span className={`ad-priority-badge ad-priority-${entry.priority}`}>
                              {entry.priority === 'emergency' && '⚡ Emergency'}
                              {entry.priority === 'priority' && '⭐ Priority'}
                              {entry.priority === 'normal' && 'Normal'}
                            </span>
                          </td>
                          <td>{entry.wait_time_minutes}m</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => setCurrentServing(entry)} className="ad-action-btn ad-action-select">Select</button>
                              <button
                                onClick={() => handleToggleEmergency(entry.id, entry.priority)}
                                className={`ad-btn ${entry.priority === 'emergency' ? 'ad-btn-emergency' : 'ad-btn-emergency-off'}`}
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                              >
                                {entry.priority === 'emergency' ? '⚡' : '○'}
                              </button>
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

          <div className="ad-sidebar">
            <div className="ad-sidebar-card">
              <h3 className="ad-sidebar-title">Today's Stats</h3>
              <div className="ad-sidebar-stat">
                <span className="ad-sidebar-stat-label">Patients Served</span>
                <span className="ad-sidebar-stat-value">{stats.served}</span>
              </div>
              <div className="ad-sidebar-item">
                <span className="ad-sidebar-label">Avg. Wait Time</span>
                <span className="ad-sidebar-value">{stats.avgWait} min</span>
              </div>
              <div className="ad-sidebar-item">
                <span className="ad-sidebar-label">Doctors Online</span>
                <span className="ad-sidebar-value">{stats.doctorsOnline} active</span>
              </div>
              <div className="ad-sidebar-item">
                <span className="ad-sidebar-label">Department</span>
                <span className="ad-sidebar-value">{selectedDept}</span>
              </div>
              <div className="ad-sidebar-item">
                <span className="ad-sidebar-label">Queue Length</span>
                <span className="ad-sidebar-value">{queue.length}</span>
              </div>
            </div>

            <div className="ad-sidebar-card">
              <h3 className="ad-sidebar-title">Connection Status</h3>
              <div className="ad-status-indicator">
                <span className="ad-status-dot">🟢</span>
                <span className="ad-status-text">Real-time Connected</span>
              </div>
              <p className="ad-status-info">Queue updates in real-time via Supabase</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="ad-body ad-body-full">
          <div>
            <div className="ad-header">
              <h1 className="ad-title">Reports</h1>
              <p className="ad-subtitle">Patient statistics and analytics for today</p>
            </div>

            <div className="ad-reports-grid">
              <div className="ad-report-card">
                <h3 className="ad-report-card-title">Patients Today</h3>
                <p className="ad-report-card-value">{reportData?.totalToday ?? '—'}</p>
                <p className="ad-report-card-sub">Total check-ins</p>
              </div>
              <div className="ad-report-card">
                <h3 className="ad-report-card-title">Waiting Now</h3>
                <p className="ad-report-card-value">{queue.length}</p>
                <p className="ad-report-card-sub">Across all departments</p>
              </div>
              <div className="ad-report-card">
                <h3 className="ad-report-card-title">Served</h3>
                <p className="ad-report-card-value">{stats.served}</p>
                <p className="ad-report-card-sub">Completed today</p>
              </div>
            </div>

            <div className="ad-chart-section">
              <div className="ad-chart-card">
                <h3 className="ad-chart-title">By Department</h3>
                <div className="ad-chart-bars">
                  {(reportData?.deptBreakdown ?? []).map(({ dept, count }) => {
                    const max = Math.max(...(reportData?.deptBreakdown.map(d => d.count) ?? [1]), 1)
                    return (
                      <div key={dept} className="ad-chart-bar-item">
                        <span className="ad-chart-bar-label">{dept}</span>
                        <div className="ad-chart-bar-track">
                          <div
                            className="ad-chart-bar-fill ad-chart-bar-fill-primary"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                        <span className="ad-chart-bar-count">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="ad-chart-card">
                <h3 className="ad-chart-title">By Status</h3>
                <div className="ad-chart-bars">
                  {(reportData?.statusBreakdown ?? []).map(({ status, count }) => {
                    const max = Math.max(...(reportData?.statusBreakdown.map(s => s.count) ?? [1]), 1)
                    return (
                      <div key={status} className="ad-chart-bar-item">
                        <span className="ad-chart-bar-label">{status.replace('_', ' ')}</span>
                        <div className="ad-chart-bar-track">
                          <div
                            className="ad-chart-bar-fill ad-chart-bar-fill-success"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                        <span className="ad-chart-bar-count">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="ad-chart-card">
                <h3 className="ad-chart-title">Waiting Priority</h3>
                <div className="ad-chart-bars">
                  {(reportData?.priorityBreakdown ?? []).map(({ priority, count }) => {
                    const max = Math.max(...(reportData?.priorityBreakdown.map(p => p.count) ?? [1]), 1)
                    return (
                      <div key={priority} className="ad-chart-bar-item">
                        <span className="ad-chart-bar-label">{priority}</span>
                        <div className="ad-chart-bar-track">
                          <div
                            className={`ad-chart-bar-fill ${priority === 'emergency' ? 'ad-chart-bar-fill-danger' : priority === 'priority' ? 'ad-chart-bar-fill-warning' : 'ad-chart-bar-fill-primary'}`}
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                        <span className="ad-chart-bar-count">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {reportData?.hourlyTrend && reportData.hourlyTrend.length > 0 && (
                <div className="ad-chart-card ad-chart-card-wide">
                  <h3 className="ad-chart-title">Check-ins by Hour</h3>
                  <div className="ad-chart-bars ad-chart-bars-horizontal">
                    {reportData.hourlyTrend.map(({ hour, count }) => {
                      const max = Math.max(...reportData.hourlyTrend.map(h => h.count), 1)
                      return (
                        <div key={hour} className="ad-chart-bar-item ad-chart-bar-item-inline">
                          <span className="ad-chart-bar-label">{hour}</span>
                          <div className="ad-chart-bar-track">
                            <div
                              className="ad-chart-bar-fill ad-chart-bar-fill-info"
                              style={{ width: `${(count / max) * 100}%` }}
                            />
                          </div>
                          <span className="ad-chart-bar-count">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="ad-body ad-body-full">
          <div>
            <div className="ad-header">
              <h1 className="ad-title">Staff Management</h1>
              <p className="ad-subtitle">Manage staff members and send invitations</p>
            </div>

            <div className="ad-staff-toolbar">
              <button className="ad-btn ad-btn-primary" onClick={() => setShowInviteModal(true)}>
                ✉️ Invite Staff Member
              </button>
            </div>

            <div className="ad-staff-card">
              <div className="ad-staff-head">
                <h2 className="ad-staff-title">Active Staff</h2>
                <span className="ad-staff-count">{staffMembers.length} members</span>
              </div>
              <div className="ad-staff-body">
                {staffMembers.length === 0 ? (
                  <div className="ad-empty-state">
                    <div className="ad-empty-icon">👥</div>
                    <p className="ad-empty-text">No staff members found</p>
                  </div>
                ) : (
                  <table className="ad-queue-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Station</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffMembers.map(member => (
                        <tr key={member.id}>
                          <td><strong>{member.name}</strong></td>
                          <td><span className="ad-staff-role-badge">{member.role.replace('_', ' ')}</span></td>
                          <td>{member.department}</td>
                          <td>{member.station || '—'}</td>
                          <td>
                            <span className={`ad-staff-status ${member.is_active ? 'ad-staff-status-active' : 'ad-staff-status-inactive'}`}>
                              {member.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="ad-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-head">
              <h2 className="ad-modal-title">Invite Staff Member</h2>
              <button className="ad-modal-close" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            <div className="ad-modal-body">
              {inviteSuccess && <div className="ad-toast ad-toast-success">{inviteSuccess}</div>}
              {inviteError && <div className="ad-toast ad-toast-error">{inviteError}</div>}

              <div className="ad-field">
                <label className="ad-field-label">Full Name</label>
                <input
                  type="text"
                  className="ad-field-input"
                  placeholder="e.g. Jane Smith"
                  value={inviteForm.name}
                  onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="ad-field">
                <label className="ad-field-label">Email Address</label>
                <input
                  type="email"
                  className="ad-field-input"
                  placeholder="e.g. jane@hospital.com"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="ad-field-row">
                <div className="ad-field">
                  <label className="ad-field-label">Role</label>
                  <select
                    className="ad-field-select"
                    value={inviteForm.role}
                    onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as StaffRole }))}
                  >
                    {STAFF_ROLES.map(r => (
                      <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="ad-field">
                  <label className="ad-field-label">Department</label>
                  <select
                    className="ad-field-select"
                    value={inviteForm.department}
                    onChange={e => setInviteForm(f => ({ ...f, department: e.target.value as Stage }))}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d === 'OPD' ? 'Outpatient (OPD)' : d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ad-field">
                <label className="ad-field-label">Station <span className="ad-field-optional">(optional)</span></label>
                <input
                  type="text"
                  className="ad-field-input"
                  placeholder="e.g. Reception, Consultation Room 3"
                  value={inviteForm.station}
                  onChange={e => setInviteForm(f => ({ ...f, station: e.target.value }))}
                />
              </div>
            </div>
            <div className="ad-modal-actions">
              <button className="ad-btn ad-btn-ghost" onClick={() => setShowInviteModal(false)}>Cancel</button>
              <button
                className="ad-btn ad-btn-primary"
                onClick={handleInvite}
                disabled={inviting || !inviteForm.name || !inviteForm.email}
              >
                {inviting ? <><span className="ad-spinner" /> Sending...</> : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function playAudio() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch (e) {
    console.error('Audio failed:', e)
  }
}
