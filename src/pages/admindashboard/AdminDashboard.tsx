import { useState, useCallback } from 'react'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService } from '../../services/queueService'
import type { DashboardStats } from '../../types'

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  const fetchStats = useCallback(async () => {
    const data = await queueService.getDashboardStats()
    setStats(data)
  }, [])

  useRealtimeQueue({ onUpdate: fetchStats })

  return <div>AdminDashboard</div>
}
