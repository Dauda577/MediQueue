import { supabase } from '../lib/supabase';
import type { Patient } from '../types';

// ── Check in a new patient
export async function checkInPatient(payload: {
  full_name: string;
  phone?: string;
  initial_department: 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity';
  priority?: 'normal' | 'priority' | 'emergency';
}): Promise<Patient> {
  // Get next queue number for the department
  const { count } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('initial_department', payload.initial_department)
    .gte('checked_in_at', new Date().toISOString().split('T')[0]); // today only

  const queueNumber = (count ?? 0) + 1;

  // Generate token e.g. OPD-00012
  const prefix = payload.initial_department === 'OPD' ? 'MQ'
    : payload.initial_department === 'Lab' ? 'LB'
    : payload.initial_department === 'Maternity' ? 'MT'
    : 'PH';
  const tokenId = `${prefix}-${String(queueNumber).padStart(5, '0')}`;

  const { data, error } = await supabase
    .from('patients')
    .insert({
      full_name: payload.full_name,
      phone: payload.phone ?? null,
      initial_department: payload.initial_department,
      current_stage: payload.initial_department,
      priority: payload.priority ?? 'normal',
      status: 'waiting',
      queue_number: queueNumber,
      token_id: tokenId,
      position: queueNumber,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Get live queue stats per department
export async function getDepartmentStats() {
  const { data, error } = await supabase
    .from('patients')
    .select('current_stage, status')
    .eq('status', 'waiting')
    .gte('checked_in_at', new Date().toISOString().split('T')[0]);

  if (error) throw error;

  const stats = {
    OPD:       { waiting: 0 },
    Lab:       { waiting: 0 },
    Pharmacy:  { waiting: 0 },
    Maternity: { waiting: 0 },
  };

  data.forEach((row) => {
    const dept = row.current_stage as keyof typeof stats;
    if (stats[dept] !== undefined) stats[dept].waiting++;
  });

  return stats;
}

// ── Get a single patient by token
export async function getPatientByToken(tokenId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('token_id', tokenId)
    .single();

  if (error) return null;
  return data;
}