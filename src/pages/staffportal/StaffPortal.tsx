import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  LogOut,
  UserRound,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { announcePatient } from '../../lib/announce'
import { queueService } from '../../services/queueService'
import type { QueueEntry } from '../../types'
import './StaffPortal.css'

type Department = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

const priorityRank: Record<QueueEntry['priority'], number> = {
  emergency: 0,
  priority: 1,
  normal: 2,
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function formatClock(value: Date) {
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value: Date) {
  return value.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function StaffPortal() {
  const { staff, loading: authLoading } = useAuth()
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [department, setDepartment] = useState<Department>('OPD')
  const [currentServing, setCurrentServing] = useState<QueueEntry | null>(null)
  const [seenToday, setSeenToday] = useState(0)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [sessionTime, setSessionTime] = useState(new Date())
  const [consultElapsed, setConsultElapsed] = useState(0)

  useEffect(() => {
    if (staff?.department) {
      setDepartment(staff.department as Department)
    }
  }, [staff?.department])

  const fetchQueue = useCallback(async () => {
    if (!department) return

    try {
      const data = await queueService.getQueueByDepartment(department)
      setQueue(data)
    } catch (error) {
      console.error('Failed to fetch staff queue:', error)
    } finally {
      setLoading(false)
    }
  }, [department])

  useRealtimeQueue({ department, onUpdate: fetchQueue })

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSessionTime(new Date())
      setQueue((prev) => prev.map((entry) => ({ ...entry, wait_time_minutes: entry.wait_time_minutes + 1 })))
    }, 60000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!currentServing) {
      setConsultElapsed(0)
      return
    }

    const interval = window.setInterval(() => {
      setConsultElapsed((prev) => prev + 1)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [currentServing])

  const sortedQueue = useMemo(() => {
    return [...queue].sort((left, right) => {
      const priorityDiff = priorityRank[left.priority] - priorityRank[right.priority]
      if (priorityDiff !== 0) return priorityDiff
      return right.wait_time_minutes - left.wait_time_minutes
    })
  }, [queue])

  const urgentCount = queue.filter((entry) => entry.priority === 'emergency').length
  const avgWait = queue.length > 0 ? Math.round(queue.reduce((sum, entry) => sum + entry.wait_time_minutes, 0) / queue.length) : 0

  const showAnnouncement = useCallback((message: string) => {
    setAnnouncement(message)
    window.setTimeout(() => setAnnouncement(null), 4500)
  }, [])

  const handleCallNext = async () => {
    if (queue.length === 0) return

    try {
      const nextPatient = await queueService.callNextPatient(department)
      setQueue((prev) => prev.filter((entry) => entry.id !== nextPatient.id))
      setCurrentServing(nextPatient)
      setConsultElapsed(0)
      announcePatient(nextPatient.queue_number, department, nextPatient.full_name)
      showAnnouncement(`Now calling ${nextPatient.full_name} • #${nextPatient.queue_number}`)
    } catch (error) {
      console.error('Failed to call next patient:', error)
    }
  }

  const handleSelectPatient = (entry: QueueEntry) => {
    setQueue((prev) => {
      const nextQueue = [...prev]
      if (currentServing) {
        nextQueue.push(currentServing)
      }
      return nextQueue.filter((item) => item.id !== entry.id)
    })

    setCurrentServing(entry)
    setConsultElapsed(0)
    showAnnouncement(`Selected ${entry.full_name} • #${entry.queue_number}`)
  }

  const handleMarkServed = async () => {
    if (!currentServing) return

    try {
      await queueService.markAsServed(currentServing.id)
      setCurrentServing(null)
      setSeenToday((prev) => prev + 1)
      setConsultElapsed(0)
      showAnnouncement(`${currentServing.full_name} marked as served`)
    } catch (error) {
      console.error('Failed to mark patient as served:', error)
    }
  }

  if (authLoading || loading) {
    return <div className="staff-portal-loading">Loading staff dashboard...</div>
  }

  if (!staff) {
    return <div className="staff-portal-message">Please sign in to continue.</div>
  }

  return (
    <div className="staff-portal-page">
      <div className="staff-portal-shell">
        <aside className="staff-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <div className="sidebar-logo-inner">
                <Users size={18} />
              </div>
            </div>
            <div>
              <p className="sidebar-title">MediQueue</p>
              <p className="sidebar-subtitle">Staff Portal</p>
            </div>
          </div>

          <div className="sidebar-profile">
            <div className="sidebar-avatar">{getInitials(staff.name)}</div>
            <div>
              <p className="sidebar-profile-name">{staff.name}</p>
              <p className="sidebar-profile-role">{(staff.role || 'staff').replace('_', ' ')}</p>
            </div>
            <div className="sidebar-badge">
              <span>Department</span>
              <strong>{department}</strong>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-head">
              <span className="live-dot" />
              <span>Live Queue</span>
            </div>
            <div className="sidebar-stat-row">
              <span>Waiting</span>
              <strong>{queue.length}</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>Avg wait</span>
              <strong>{avgWait}m</strong>
            </div>
            <div className="sidebar-stat-row">
              <span>Urgent</span>
              <strong>{urgentCount}</strong>
            </div>
          </div>

          <div className="sidebar-clock">
            <p className="clock-time">{formatClock(sessionTime)}</p>
            <p className="clock-date">{formatDate(sessionTime)}</p>
          </div>

          <button className="sidebar-signout" type="button">
            <LogOut size={15} />
            Sign out
          </button>
        </aside>

        <main className="staff-main">
          <header className="staff-main-header">
            <div>
              <h1>Staff Dashboard — {department}</h1>
              <p>Welcome back, {staff.name.split(' ')[0] || staff.name}</p>
            </div>
            {announcement ? (
              <div className="announcement-toast">
                <Download size={13} />
                <span>{announcement}</span>
              </div>
            ) : null}
          </header>

          <div className="staff-content">
            <section className="metric-grid">
              <article className="metric-card">
                <div className="metric-card-head">
                  <span>Waiting</span>
                  <div className="metric-icon teal">
                    <Users size={16} />
                  </div>
                </div>
                <p className="metric-number">{queue.length}</p>
                <p className="metric-label">Patients waiting</p>
              </article>
              <article className="metric-card">
                <div className="metric-card-head">
                  <span>Avg Wait</span>
                  <div className="metric-icon amber">
                    <Clock3 size={16} />
                  </div>
                </div>
                <p className={`metric-number ${avgWait > 30 ? 'danger' : ''}`}>{avgWait}m</p>
                <p className="metric-label">Average wait time</p>
              </article>
              <article className="metric-card">
                <div className="metric-card-head">
                  <span>Urgent</span>
                  <div className="metric-icon danger">
                    <AlertTriangle size={16} />
                  </div>
                </div>
                <p className={`metric-number ${urgentCount > 0 ? 'danger' : ''}`}>{urgentCount}</p>
                <p className="metric-label">High priority cases</p>
              </article>
              <article className="metric-card">
                <div className="metric-card-head">
                  <span>Seen Today</span>
                  <div className="metric-icon green">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <p className="metric-number green">{seenToday}</p>
                <p className="metric-label">Patients served</p>
              </article>
            </section>

            <section className="consult-grid">
              <article className="panel current-patient-panel">
                <div className="panel-head">
                  <h2>Current Patient</h2>
                  {currentServing ? (
                    <span className={`priority-badge ${currentServing.priority}`}>{currentServing.priority.toUpperCase()}</span>
                  ) : null}
                </div>

                {currentServing ? (
                  <div className="current-patient-card">
                    <div className="patient-avatar">{getInitials(currentServing.full_name)}</div>
                    <div className="patient-info">
                      <h3>{currentServing.full_name}</h3>
                      <p>Consultation in progress</p>
                    </div>
                    <div className="patient-stats">
                      <div className="stat-cell">
                        <span>Queue No.</span>
                        <strong>#{currentServing.queue_number}</strong>
                      </div>
                      <div className="stat-cell">
                        <span>Priority</span>
                        <strong>{currentServing.priority}</strong>
                      </div>
                      <div className="stat-cell">
                        <span>Waited</span>
                        <strong>{currentServing.wait_time_minutes}m</strong>
                      </div>
                      <div className="stat-cell">
                        <span>In Consult</span>
                        <strong>{consultElapsed < 1 ? '0m' : `${consultElapsed}m`}</strong>
                      </div>
                    </div>
                    <div className="patient-footer">
                      <span>Arrived {formatTimeLabel(currentServing.checked_in_at)}</span>
                      <span>{department}</span>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <UserRound size={20} />
                    </div>
                    <p>No patient in consultation</p>
                    <span>Call the next patient to begin the next visit.</span>
                  </div>
                )}
              </article>

              <div className="action-stack">
                <button
                  className={`action-card teal ${queue.length === 0 ? 'disabled' : ''}`}
                  type="button"
                  onClick={handleCallNext}
                  disabled={queue.length === 0}
                >
                  <div className="action-icon">
                    <ArrowRight size={16} />
                  </div>
                  <div>
                    <p>Call Next Patient</p>
                    <span>{sortedQueue[0] ? `${sortedQueue[0].full_name} • #${sortedQueue[0].queue_number}` : 'Queue is empty'}</span>
                  </div>
                </button>

                <button
                  className={`action-card green ${!currentServing ? 'disabled' : ''}`}
                  type="button"
                  onClick={handleMarkServed}
                  disabled={!currentServing}
                >
                  <div className="action-icon">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p>Mark as Served</p>
                    <span>{currentServing ? `${currentServing.full_name} • #${currentServing.queue_number}` : 'No active patient'}</span>
                  </div>
                </button>

                <div className="up-next-card">
                  <p className="up-next-label">Up Next</p>
                  {sortedQueue.slice(0, 2).map((entry) => (
                    <div key={entry.id} className="up-next-row">
                      <div>
                        <p className="up-next-number">#{entry.queue_number}</p>
                        <p className="up-next-name">{entry.full_name}</p>
                      </div>
                      <span className={`priority-pill ${entry.priority}`}>{entry.priority.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="table-card">
              <div className="table-head">
                <div>
                  <h2>Waiting Patients</h2>
                  <span className="table-count">{queue.length} active</span>
                </div>
                <div className="table-status">
                  <span className="live-dot" />
                  <span>LIVE</span>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Queue No.</th>
                      <th>Patient</th>
                      <th>Priority</th>
                      <th>Position</th>
                      <th>Wait</th>
                      <th>Arrived</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQueue.map((entry) => (
                      <tr key={entry.id} className={currentServing?.id === entry.id ? 'serving-row' : ''}>
                        <td className="queue-number">#{entry.queue_number}</td>
                        <td>
                          <div className="patient-cell">
                            <div className="cell-avatar">{getInitials(entry.full_name)}</div>
                            <div>
                              <p>{entry.full_name}</p>
                              <span>{department}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`priority-pill ${entry.priority}`}>{entry.priority.toUpperCase()}</span>
                        </td>
                        <td className="mono-cell">#{entry.position}</td>
                        <td className={`mono-cell ${entry.wait_time_minutes > 40 ? 'danger' : entry.wait_time_minutes > 20 ? 'amber' : ''}`}>
                          {entry.wait_time_minutes}m
                        </td>
                        <td className="mono-cell">{formatTimeLabel(entry.checked_in_at)}</td>
                        <td>
                          <button className="select-btn" type="button" onClick={() => handleSelectPatient(entry)}>
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
