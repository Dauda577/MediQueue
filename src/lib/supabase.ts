import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function createFallbackSupabaseClient() {
  const createQueryBuilder = () => ({
    select: () => createQueryBuilder(),
    eq: () => createQueryBuilder(),
    gte: () => createQueryBuilder(),
    order: () => createQueryBuilder(),
    limit: () => createQueryBuilder(),
    single: async () => ({ data: null, error: new Error('Supabase is not configured') }),
    maybeSingle: async () => ({ data: null, error: new Error('Supabase is not configured') }),
  });

  const channel = {
    on: () => channel,
    subscribe: async () => channel,
    unsubscribe: async () => channel,
  };

  return {
    auth: {
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase is not configured') }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => () => undefined,
    },
    from: () => ({
      select: () => createQueryBuilder(),
      insert: () => createQueryBuilder(),
      update: () => createQueryBuilder(),
    }),
    channel: () => channel,
    removeChannel: () => undefined,
  } as any;
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createFallbackSupabaseClient();