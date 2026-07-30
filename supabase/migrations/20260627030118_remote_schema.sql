-- Create enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage') THEN
    CREATE TYPE public.stage AS ENUM ('OPD', 'Lab', 'Pharmacy', 'Maternity');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
    CREATE TYPE public.staff_role AS ENUM ('doctor', 'nurse', 'pharmacist', 'lab_tech', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
    CREATE TYPE public.queue_status AS ENUM ('waiting', 'in_consultation', 'in_lab', 'in_pharmacy', 'done', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_priority') THEN
    CREATE TYPE public.patient_priority AS ENUM ('normal', 'priority', 'emergency');
  END IF;
END;
$$;

-- Create staff_members table
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role public.staff_role NOT NULL,
  department public.stage NOT NULL,
  station TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_members_user_id ON public.staff_members(user_id);

-- Create call_alerts table
CREATE TABLE IF NOT EXISTS public.call_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  department public.stage NOT NULL,
  queue_number INTEGER NOT NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false
);

-- Create override_logs table
CREATE TABLE IF NOT EXISTS public.override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  staff_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  authorized_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
