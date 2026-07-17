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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Server misconfiguration: missing service role key' }, 500);
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller's identity using their JWT
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) {
      return json({ error: 'Not authenticated' }, 401);
    }
    const caller = await userRes.json();

    // Check caller is an admin using service role
    const staffRes = await fetch(
      `${supabaseUrl}/rest/v1/staff_members?user_id=eq.${caller.id}&select=role`,
      { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } }
    );
    const staff = await staffRes.json();
    if (!staff?.[0] || staff[0].role !== 'admin') {
      return json({ error: 'Only admins can invite staff' }, 403);
    }

    const body = await req.json();
    const { email, name, role, department, station } = body;
    if (!email || !name || !role || !department) {
      return json({ error: 'email, name, role, and department are required' }, 400);
    }

    // Invite user via Auth Admin API
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';
    const inviteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        email,
        password: crypto.randomUUID(),
        email_confirm: false,
        confirmation_success_url: `${siteUrl}/accept-invite`,
      }),
    });

    if (!inviteRes.ok) {
      const err = await inviteRes.json();
      return json({ error: err.msg || 'Failed to create user' }, 400);
    }

    const invited = await inviteRes.json();

    // Create staff_members record
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/staff_members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: invited.id,
        name,
        role,
        department,
        station: station ?? null,
        is_active: true,
      }),
    });

    if (!insertRes.ok) {
      // Roll back - delete the auth user
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${invited.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      });
      return json({ error: 'Failed to create staff record' }, 400);
    }

    return json({ success: true, user_id: invited.id }, 200);
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
