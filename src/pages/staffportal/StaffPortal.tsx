import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService } from '../../services/queueService'
import type { QueueEntry } from '../../types'
import './StaffPortal.css'

type Department = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

export default function StaffPortal() {
  const { staff, loading: authLoading } = useAuth()
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [department, setDepartment] = useState<Department>('OPD')
  const [currentServing, setCurrentServing] = useState<QueueEntry | null>(null)

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

  const handleCallNext = async () => {
    try {
      const nextPatient = await queueService.callNextPatient(department)
      setCurrentServing(nextPatient)
    } catch (error) {
      console.error('Failed to call next patient:', error)
    }
  }

  const highPriorityCount = queue.filter((entry) => entry.priority === 'emergency' || entry.priority === 'priority').length
  const avgWait = queue.length > 0 ? Math.round(queue.reduce((sum, entry) => sum + entry.wait_time_minutes, 0) / queue.length) : 0
  const seenToday = 0

  const handleMarkServed = async () => {
    if (!currentServing) return

    try {
      await queueService.markAsServed(currentServing.id)
      setCurrentServing(null)
    } catch (error) {
      console.error('Failed to mark patient as served:', error)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="staff-portal-loading">
        Loading staff dashboard...
      </div>
    )
  }

  if (!staff) {
    return <div className="staff-portal-message">Please sign in to continue.</div>
  }

  if (staff.role === 'admin') {
    return <div className="staff-portal-message">Admins use the separate admin dashboard.</div>
  }

  return (
    <div className="staff-portal-page">
      <div className="staff-portal-shell">
        <section className="staff-portal-hero card">
          <div className="hero-top">
            <div>
              <p className="staff-portal-subtitle">Queue Dashboard</p>
              <h1>Welcome back, {staff.name}</h1>
              <p className="staff-portal-userline">
                {staff.role.charAt(0).toUpperCase() + staff.role.slice(1).replace('_', ' ')} • Department: {department}
              </p>
            </div>
            <div className="hero-chip">Realtime queue</div>
          </div>

          <div className="hero-stats">
            <div className="hero-stat-card">
              <p className="hero-stat-title">Now waiting</p>
              <p className="hero-stat-number">{queue.length}</p>
            </div>
            <div className="hero-stat-card">
              <p className="hero-stat-title">Average wait</p>
              <p className="hero-stat-number">{avgWait} min</p>
            </div>
            <div className="hero-stat-card">
              <p className="hero-stat-title">Urgent</p>
              <p className="hero-stat-number">{highPriorityCount}</p>
            </div>
          </div>
        </section>

        <section className="staff-portal-metrics">
          <article className="metric-card metric-call">
            <p className="metric-card-title">Call Next Patient</p>
            <h2 className="metric-card-value-medium">Start the next consultation</h2>
            <button className="staff-btn staff-btn-primary" onClick={handleCallNext}>
              📞 Call Next Patient
            </button>
          </article>
          <article className="metric-card">
            <p className="metric-card-title">Waiting Today</p>
            <p className="metric-card-value">{queue.length}</p>
            <p className="metric-card-note">Patients currently in the queue</p>
          </article>
          <article className="metric-card">
            <p className="metric-card-title">High Priority</p>
            <p className="metric-card-value">{highPriorityCount}</p>
            <p className="metric-card-note">Emergency or priority cases</p>
          </article>
          <article className="metric-card">
            <p className="metric-card-title">Seen Today</p>
            <p className="metric-card-value">{seenToday}</p>
            <p className="metric-card-note">Updated in real time</p>
          </article>
        </section>

        <div className="staff-portal-grid">
          <section className="card staff-portal-current">
            <div className="staff-portal-section-head">
              <h2>Current Patient</h2>
              <span>Live service status</span>
            </div>

            {currentServing ? (
              <div className="staff-portal-serving-card">
                <p className="staff-portal-label">Now Serving</p>
                <h3>{currentServing.full_name}</h3>
                <div className="patient-details-grid">
                  <div className="detail-item">
                    <span>Queue #</span>
                    <strong>#{currentServing.queue_number}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Priority</span>
                    <strong>{currentServing.priority}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Position</span>
                    <strong>{currentServing.position}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Wait time</span>
                    <strong>{currentServing.wait_time_minutes} min</strong>
                  </div>
                </div>
                <button className="staff-btn staff-btn-success" onClick={handleMarkServed}>
                  Mark Served
                </button>
              </div>
            ) : (
              <div className="staff-portal-empty-state">
                <p className="empty-title">Ready for the next patient</p>
                <p>Use the button above to call the next person in line.</p>
              </div>
            )}
          </section>

          <aside className="card staff-portal-summary">
            <div className="staff-portal-section-head">
              <h2>Summary</h2>
              <span>Department snapshot</span>
            </div>
            <div className="staff-portal-summary-list">
              <div className="staff-portal-summary-item">
                <span>Waiting</span>
                <strong>{queue.length}</strong>
              </div>
              <div className="staff-portal-summary-item">
                <span>Average wait</span>
                <strong>{avgWait} min</strong>
              </div>
              <div className="staff-portal-summary-item">
                <span>Urgent patients</span>
                <strong>{highPriorityCount}</strong>
              </div>
              <div className="staff-portal-summary-item">
                <span>Seen today</span>
                <strong>{seenToday}</strong>
              </div>
            </div>
          </aside>
        </div>

        <section className="card staff-portal-table-card">
          <div className="staff-portal-section-head">
            <h2>Waiting Patients</h2>
            <span>{queue.length} patient{queue.length === 1 ? '' : 's'} waiting</span>
          </div>

          {queue.length === 0 ? (
            <div className="staff-portal-empty-table">
              <p className="empty-title">Queue is clear</p>
              <p>There are no waiting patients in your department.</p>
            </div>
          ) : (
            <table className="staff-portal-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Queue #</th>
                  <th>Priority</th>
                  <th>Wait</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => (
                  <tr key={entry.id} className={currentServing?.id === entry.id ? 'selected-row' : ''}>
                    <td>{entry.full_name}</td>
                    <td>#{entry.queue_number}</td>
                    <td>{entry.priority}</td>
                    <td>{entry.wait_time_minutes}m</td>
                    <td>
                      <button
                        className="staff-btn staff-btn-secondary"
                        onClick={() => setCurrentServing(entry)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
