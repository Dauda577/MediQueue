import { supabase } from './supabase';
import type { StaffMember } from '../types';

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
// After sign in, fetch the staff_members row linked to the logged-in user
export async function getCurrentStaff(): Promise<StaffMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data;
}

// ── Listen for auth state changes
// Call once at app startup — fires on sign in, sign out, and invite link clicks
export function onAuthStateChange(callback: (staff: StaffMember | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
      callback(null);
      return;
    }

    const staff = await getCurrentStaff();
    callback(staff);
  });
}