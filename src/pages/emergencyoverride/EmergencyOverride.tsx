import { useState, useCallback } from 'react'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService } from '../../services/queueService'
import type { QueueEntry } from '../../types'

export default function EmergencyOverride() {
  const [department] = useState<'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'>('OPD')
  const [queue, setQueue] = useState<QueueEntry[]>([])

  const fetchQueue = useCallback(async () => {
    const data = await queueService.getQueueByDepartment(department)
    setQueue(data)
  }, [department])

  useRealtimeQueue({ department, onUpdate: fetchQueue })

  return <div>EmergencyOverride</div>
}
