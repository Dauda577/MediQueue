import { supabase } from './supabase';
import type { StaffMember } from '../types';

const DEMO_STAFF = {
  'staff@demo.com': {
    id: 'demo-staff',
    name: 'Demo Nurse',
    role: 'nurse' as const,
    department: 'OPD' as const,
    is_active: true,
    station: 'Reception',
    user_id: 'demo-staff',
    created_at: new Date().toISOString(),
  },
  'doctor@demo.com': {
    id: 'demo-doctor',
    name: 'Demo Doctor',
    role: 'doctor' as const,
    department: 'OPD' as const,
    is_active: true,
    station: 'Consultation',
    user_id: 'demo-doctor',
    created_at: new Date().toISOString(),
  },
  'pharmacist@demo.com': {
    id: 'demo-pharmacist',
    name: 'Demo Pharmacist',
    role: 'pharmacist' as const,
    department: 'Pharmacy' as const,
    is_active: true,
    station: 'Dispensary',
    user_id: 'demo-pharmacist',
    created_at: new Date().toISOString(),
  },
  'lab@demo.com': {
    id: 'demo-lab',
    name: 'Demo Lab Tech',
    role: 'lab_tech' as const,
    department: 'Lab' as const,
    is_active: true,
    station: 'Lab',
    user_id: 'demo-lab',
    created_at: new Date().toISOString(),
  },
} satisfies Record<string, StaffMember>;

function getDemoStaff(email: string, password: string): StaffMember | null {
  const normalizedEmail = email.toLowerCase() as keyof typeof DEMO_STAFF;
  const record = DEMO_STAFF[normalizedEmail];
  const passwordMap: Record<string, string> = {
    'staff@demo.com': 'staff1234',
    'doctor@demo.com': 'doctor1234',
    'pharmacist@demo.com': 'pharma1234',
    'lab@demo.com': 'lab1234',
  };

  return record && passwordMap[normalizedEmail] === password ? record : null;
}

// ── Sign In
export async function signIn(email: string, password: string) {
  const demoStaff = getDemoStaff(email, password);
  if (demoStaff) {
    localStorage.setItem('demo_staff', JSON.stringify(demoStaff));
    return { user: { id: demoStaff.user_id } };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// ── Sign Out
export async function signOut() {
  localStorage.removeItem('demo_staff');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Get current staff member record
export async function getCurrentStaff(): Promise<StaffMember | null> {
  const demoStaff = localStorage.getItem('demo_staff');
  if (demoStaff) {
    return JSON.parse(demoStaff) as StaffMember;
  }

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