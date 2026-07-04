import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { CallAlert } from '../types'

interface UseRealtimeAlertsOptions {
  onNewAlert: (alert: CallAlert) => void
}

export function useRealtimeAlerts({ onNewAlert }: UseRealtimeAlertsOptions) {
  useEffect(() => {
    const channel = supabase
      .channel('call-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // only care about new alerts
          schema: 'public',
          table: 'call_alerts',
        },
        (payload: { new: CallAlert }) => {
          onNewAlert(payload.new as CallAlert)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onNewAlert])
}