import { supabase } from './supabase';
import type { StaffMember, StaffRole, Stage } from '../types';

// ── Sign In
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// ── Sign Out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Get current staff member record
export async function getCurrentStaff(): Promise<StaffMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    return {
      id: user.id,
      name: user.email || 'Demo Admin',
      role: 'admin',
      department: 'OPD',
      is_active: true,
      station: 'Reception',
      user_id: user.id,
      created_at: new Date().toISOString(),
    } as StaffMember;
  }

  return data;
}

// ── Listen for auth state changes
// Call once at app startup — fires on sign in, sign out, and invite link clicks
export function onAuthStateChange(callback: (staff: StaffMember | null) => void) {
  return supabase.auth.onAuthStateChange(async (_event: unknown, session: { user?: { id: string } } | null) => {
    if (!session) {
      callback(null);
      return;
    }

    const staff = await getCurrentStaff();
    callback(staff);
  });
}

function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function inviteStaffMember(data: {
  email: string
  name: string
  role: StaffRole
  department: Stage
  station?: string
}): Promise<{ tempPassword: string }> {
  const tempPassword = generateTempPassword()
  const redirectTo = `${window.location.origin}/accept-invite`

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: tempPassword,
    options: {
      emailRedirectTo: redirectTo,
      data: { name: data.name, role: data.role },
    },
  })

  if (authError?.message?.toLowerCase().includes('already') || authError?.message?.toLowerCase().includes('registered')) {
    throw new Error('A staff account already exists for this email.')
  }
  if (authError) throw authError
  if (!authData.user) throw new Error('Failed to create user account')
  if (!authData.user.identities || authData.user.identities.length === 0) {
    throw new Error('A staff account already exists for this email.')
  }

  const { error: staffError } = await supabase
    .from('staff_members')
    .insert({
      user_id: authData.user.id,
      name: data.name,
      role: data.role,
      department: data.department,
      station: data.station || null,
      is_active: true,
    })

  if (staffError?.code === '23505') {
    throw new Error('A staff account already exists for this email.')
  }
  if (staffError) throw staffError
  return { tempPassword }
}