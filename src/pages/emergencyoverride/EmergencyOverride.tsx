import { useState, useCallback } from 'react'
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService } from '../../services/queueService'

export default function EmergencyOverride() {
  const [department] = useState<'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'>('OPD')

  const fetchQueue = useCallback(async () => {
    await queueService.getQueueByDepartment(department)
  }, [department])

  useRealtimeQueue({ department, onUpdate: fetchQueue })

  return <div>EmergencyOverride</div>
}
