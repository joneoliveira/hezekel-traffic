import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Decode JWT to verify caller is super_admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    let callerId: string;
    try {
      const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = raw.padEnd(raw.length + (4 - raw.length % 4) % 4, '=');
      const payload = JSON.parse(atob(padded));
      callerId = payload.sub;
      if (!callerId) throw new Error();
    } catch {
      throw new Error('Não autenticado.');
    }

    const { data: roleRow } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .single();
    if (roleRow?.role !== 'super_admin') throw new Error('Acesso negado.');

    // List all auth users
    const { data: authData, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;

    // Get all roles
    const { data: roles, error: rolesErr } = await adminClient
      .from('user_roles')
      .select('user_id, role');
    if (rolesErr) throw rolesErr;

    const roleMap: Record<string, string> = {};
    for (const r of roles ?? []) roleMap[r.user_id] = r.role;

    const users = (authData.users ?? []).map(u => ({
      id: u.id,
      email: u.email ?? '',
      role: roleMap[u.id] ?? 'none',
      created_at: u.created_at,
    }));

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
