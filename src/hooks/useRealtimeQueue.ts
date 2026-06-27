import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Stage } from '../types'

interface UseRealtimeQueueOptions {
  department?: Stage       
  onUpdate: () => void     
}

export function useRealtimeQueue({ department, onUpdate }: UseRealtimeQueueOptions) {
  useEffect(() => {
    const channel = supabase
      .channel(`queue-changes-${department ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'patients',
          ...(department ? { filter: `current_stage=eq.${department}` } : {}),
        },
        () => {
          onUpdate() 
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [department, onUpdate])
}