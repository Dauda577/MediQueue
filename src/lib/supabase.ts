import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function isMockSupabaseConfig(url?: string, key?: string) {
  if (!url || !key) return true;

  const normalizedUrl = url.trim().toLowerCase();
  const normalizedKey = key.trim().toLowerCase();

  return normalizedUrl.includes('mock.supabase.co')
    || normalizedUrl.includes('example.supabase.co')
    || normalizedKey.includes('mock')
    || normalizedKey.includes('example');
}

function createFallbackSupabaseClient() {
  let currentUser: { id: string; email: string } | null = null;
  const listeners: Array<(event: string, session: unknown) => void> = [];

  const createQueryBuilder = () => ({
    select: () => createQueryBuilder(),
    eq: () => createQueryBuilder(),
    gte: () => createQueryBuilder(),
    order: () => createQueryBuilder(),
    limit: () => createQueryBuilder(),
    single: async () => {
      if (!currentUser) {
        return { data: null, error: new Error('No active session') };
      }

      return {
        data: {
          id: 'demo-staff-1',
          name: 'Demo Staff',
          role: 'admin',
          department: 'OPD',
          is_active: true,
          station: 'Reception',
          user_id: currentUser.id,
          created_at: new Date().toISOString(),
        },
        error: null,
      };
    },
    maybeSingle: async () => {
      if (!currentUser) {
        return { data: null, error: new Error('No active session') };
      }

      return {
        data: {
          id: 'demo-staff-1',
          name: 'Demo Staff',
          role: 'admin',
          department: 'OPD',
          is_active: true,
          station: 'Reception',
          user_id: currentUser.id,
          created_at: new Date().toISOString(),
        },
        error: null,
      };
    },
  });

  const channel = {
    on: () => channel,
    subscribe: async () => channel,
    unsubscribe: async () => channel,
  };

  return {
    auth: {
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (!email || !password) {
          return { data: null, error: new Error('Email and password are required') };
        }

        currentUser = { id: 'demo-staff-1', email };
        const session = { access_token: 'demo-token', user: currentUser };

        listeners.forEach((listener) => listener('SIGNED_IN', session));

        return { data: { user: currentUser, session }, error: null };
      },
      signOut: async () => {
        currentUser = null;
        listeners.forEach((listener) => listener('SIGNED_OUT', null));
        return { error: null };
      },
      getUser: async () => ({ data: { user: currentUser }, error: null }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        listeners.push(callback);

        return {
          subscription: {
            unsubscribe: () => {
              const index = listeners.indexOf(callback);
              if (index >= 0) listeners.splice(index, 1);
            },
          },
        };
      },
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

const shouldUseFallbackClient = isMockSupabaseConfig(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabase = shouldUseFallbackClient
  ? createFallbackSupabaseClient()
  : createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });