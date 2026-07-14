// supabase/functions/invite-staff/index.ts
//
// Admin-only Edge Function. Invites a new staff member by email and
// creates their matching `staff_members` row once the auth user exists.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    // Client scoped to the *caller's* JWT — used only to verify who's asking
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return json({ error: 'Not authenticated' }, 401);
    }

    // Admin client — service role, full privileges, never exposed to the browser
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Confirm the caller is an admin
    const { data: callerStaff, error: staffError } = await adminClient
      .from('staff_members')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    if (staffError || callerStaff?.role !== 'admin') {
      return json({ error: 'Only admins can invite staff' }, 403);
    }

    const body = await req.json();
    const { email, name, role, department, station } = body as {
      email?: string;
      name?: string;
      role?: string;
      department?: string;
      station?: string;
    };

    if (!email || !name || !role || !department) {
      return json({ error: 'email, name, role, and department are required' }, 400);
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${siteUrl}/accept-invite` }
    );

    if (inviteError || !invited?.user) {
      return json({ error: inviteError?.message ?? 'Failed to send invite' }, 400);
    }

    const { error: insertError } = await adminClient.from('staff_members').insert({
      user_id: invited.user.id,
      name,
      role,
      department,
      station: station ?? null,
      is_active: true,
    });

    if (insertError) {
      // Roll back the invited auth user so we don't leave an orphaned account
      await adminClient.auth.admin.deleteUser(invited.user.id);
      return json({ error: `Failed to create staff record: ${insertError.message}` }, 400);
    }

    return json({ success: true, user_id: invited.user.id }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}