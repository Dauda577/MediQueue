import { useState, useEffect } from 'react'
import { queueService } from '../../services/queueService'
import { supabase } from '../../lib/supabase'
import type { QueueEntry, StaffRole, Stage } from '../../types'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDept, setSelectedDept] = useState<'OPD' | 'Lab' | 'Pharmacy'>('OPD')
  const [currentServing, setCurrentServing] = useState<QueueEntry | null>(null)
  const [stats, setStats] = useState({ served: 0, avgWait: 0, doctorsOnline: 0 })

  // Invite staff form
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<StaffRole>('nurse')
  const [inviteDept, setInviteDept] = useState<Stage>('OPD')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  async function handleInviteStaff() {
    setInviteError(null)
    setInviteSuccess(null)
    setInviteLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const { data, error } = await supabase.functions.invoke('invite-staff', {
        body: {
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
          department: inviteDept,
        },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setInviteSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteName('')
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  // Fetch queue on mount and when department changes
  useEffect(() => {
    const fetchQueue = async () => {
      setLoading(true)
      try {
        const data = await queueService.getQueueByDepartment(selectedDept)
        setQueue(data)
        
        // Simulate stats (will come from backend later)
        setStats({
          served: Math.floor(Math.random() * 20) + 8,
          avgWait: Math.floor(Math.random() * 20) + 10,
          doctorsOnline: Math.floor(Math.random() * 3) + 1,
        })
      } catch (error) {
        console.error('Failed to fetch queue:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchQueue()

    // Poll every 5 seconds (will be real-time via Supabase later)
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [selectedDept])

  const handleCallNext = async () => {
    try {
      const next = await queueService.callNextPatient(selectedDept)
      setCurrentServing(next)
      console.log('Called patient:', next)
      
      // Play audio alert
      playAudio()
      
      // Refresh queue
      const updated = await queueService.getQueueByDepartment(selectedDept)
      setQueue(updated)
    } catch (error) {
      console.error('Failed to call next:', error)
    }
  }

  const handleMarkServed = async () => {
    if (!currentServing) return

    try {
      await queueService.markAsServed(currentServing.id)
      setCurrentServing(null)
      
      // Refresh queue
      const updated = await queueService.getQueueByDepartment(selectedDept)
      setQueue(updated)
    } catch (error) {
      console.error('Failed to mark served:', error)
    }
  }

  const handleToggleEmergency = async (queueId: string, currentPriority: string) => {
    try {
      const newPriority = currentPriority === 'emergency' ? 'normal' : 'emergency'
      await queueService.markAsEmergency(queueId, newPriority as any)
      
      // Refresh queue
      const updated = await queueService.getQueueByDepartment(selectedDept)
      setQueue(updated)
    } catch (error) {
      console.error('Failed to toggle emergency:', error)
    }
  }

  return (
    <div className="ad-page">
      {/* Navigation */}
      <nav className="ad-nav">
        <div className="ad-nav-inner">
          <div className="ad-brand">
            <span className="ad-brand-icon">⚕️</span>
            <span className="ad-brand-name">MediQueue Admin</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="ad-body">
        {/* Left Column */}
        <div>
          {/* Header */}
          <div className="ad-header">
            <h1 className="ad-title">Queue Management</h1>
            <p className="ad-subtitle">Manage patient queues and prioritization</p>
          </div>

          {/* Department Selector */}
          <div className="ad-dept-selector">
            <label className="ad-dept-label">Department:</label>
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value as any)}
              className="ad-dept-select"
            >
              <option value="OPD">Outpatient (OPD)</option>
              <option value="Lab">Laboratory</option>
              <option value="Pharmacy">Pharmacy</option>
            </select>
          </div>

          {/* Currently Serving Card */}
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
                <button 
                  onClick={handleMarkServed}
                  className="ad-btn ad-btn-success"
                >
                  ✓ Mark as Served
                </button>
                <button 
                  onClick={() => setCurrentServing(null)}
                  className="ad-btn ad-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Call Next Section */}
          <div className="ad-call-section">
            <button 
              onClick={handleCallNext}
              disabled={loading}
              className="ad-btn ad-btn-primary ad-call-btn"
            >
              {loading ? (
                <>
                  <span className="ad-spinner" />
                  Loading...
                </>
              ) : (
                <>
                  📞 Call Next Patient
                </>
              )}
            </button>
          </div>

          {/* Queue Table */}
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
                        <td>
                          <span className="ad-queue-position">{entry.position}</span>
                        </td>
                        <td>{entry.full_name}</td>
                        <td>
                          <span className="ad-queue-number">#{entry.queue_number}</span>
                        </td>
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
                            <button
                              onClick={() => setCurrentServing(entry)}
                              className="ad-action-btn ad-action-select"
                            >
                              Select
                            </button>
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

        {/* Right Sidebar */}
        <div className="ad-sidebar">
          {/* Stats Card */}
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

          {/* Quick Actions */}
          <div className="ad-sidebar-card">
            <h3 className="ad-sidebar-title">Quick Actions</h3>
            <button className="ad-btn ad-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              📊 View Reports
            </button>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="ad-btn ad-btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            >
              ✉️ Invite Staff
            </button>
          </div>

          {/* Invite Staff Form */}
          {showInvite && (
            <div className="ad-sidebar-card">
              <h3 className="ad-sidebar-title">Invite Staff Member</h3>

              {inviteError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.8125rem', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '0.8125rem', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                  {inviteSuccess}
                </div>
              )}

              <div style={{ marginBottom: '0.6rem' }}>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                  className="ad-dept-select"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '0.6rem' }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@hospital.com"
                  className="ad-dept-select"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '0.6rem' }}>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as StaffRole)}
                  className="ad-dept-select"
                  style={{ width: '100%' }}
                >
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="lab_tech">Lab Tech</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <select
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value as Stage)}
                  className="ad-dept-select"
                  style={{ width: '100%' }}
                >
                  <option value="OPD">OPD</option>
                  <option value="Lab">Lab</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Maternity">Maternity</option>
                </select>
              </div>

              <button
                onClick={handleInviteStaff}
                disabled={inviteLoading || !inviteName || !inviteEmail}
                className="ad-btn ad-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {inviteLoading ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Simple audio alert
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