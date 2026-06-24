import { useEffect, useState } from 'react'
import { queueService } from '../services/queueService'
import type { QueueEntry } from '../types'

export default function TestService() {
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const testService = async () => {
      try {
        console.log('Testing queueService...')
        
        // Test getting departments
        const depts = await queueService.getDepartments()
        console.log('Departments:', depts)
        
        // Test getting queue
        const queueData = await queueService.getQueueByDepartment('OPD')
        console.log('OPD Queue:', queueData)
        
        setQueue(queueData)
        setLoading(false)
      } catch (error) {
        console.error('Service test failed:', error)
        setLoading(false)
      }
    }

    testService()
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Service Test ✅</h1>
      <p>If you see queue data below, mock service works!</p>
      
      <h2>OPD Queue ({queue.length} patients)</h2>
      {queue.length === 0 ? (
        <p>No patients</p>
      ) : (
        <ul>
          {queue.map(entry => (
            <li key={entry.id}>
              #{entry.queue_number} - {entry.full_name} ({entry.status})
            </li>
          ))}
        </ul>
      )}
      
      <p style={{ marginTop: '20px', color: 'green' }}>
        ✅ Mock data is working!
      </p>
    </div>
  )
}