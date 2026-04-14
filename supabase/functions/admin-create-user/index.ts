import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Decode JWT to get caller user ID
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

    // Verify caller is super_admin
    const { data: roleRow } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .single();
    if (roleRow?.role !== 'super_admin') throw new Error('Apenas o super admin pode criar usuários.');

    const { email, password, role, client_id } = await req.json();
    if (!email || !password || !role) throw new Error('email, password e role são obrigatórios.');

    // Create auth user via direct REST call (avoids supabase-js auth.admin issues in Deno)
    let userId: string;
    const authHeaders = {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    };

    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    const createData = await createRes.json();

    if (!createRes.ok) {
      // Check if email is already registered (status 422 or error code/message)
      const isAlreadyRegistered =
        createRes.status === 422 ||
        createData?.msg?.toLowerCase().includes('already registered') ||
        createData?.message?.toLowerCase().includes('already registered') ||
        createData?.code === 'email_exists';

      if (isAlreadyRegistered) {
        // Look up existing user_id from user_roles table by email
        const { data: existingRole } = await adminClient
          .from('user_roles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (existingRole?.user_id) {
          userId = existingRole.user_id;
        } else {
          // Not in user_roles — find via Auth Admin list
          const listRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
            { headers: authHeaders }
          );
          const listData = await listRes.json();
          const existing = (listData?.users ?? []).find((u: any) => u.email === email);
          if (!existing) throw new Error(`Email já registrado mas usuário não encontrado. Erro original: ${createData?.msg ?? createData?.message}`);
          userId = existing.id;
        }
      } else {
        throw new Error(createData?.msg ?? createData?.message ?? `Erro ao criar usuário (${createRes.status})`);
      }
    } else {
      userId = createData.id;
    }

    // Assign role (upsert to handle re-runs)
    const { error: roleErr } = await adminClient
      .from('user_roles')
      .upsert({ user_id: userId, role, email }, { onConflict: 'user_id' });
    if (roleErr) throw roleErr;

    // Link to client if provided (ignore duplicate)
    if (client_id) {
      const { error: linkErr } = await adminClient
        .from('client_users')
        .insert({ client_id, user_id: userId });
      if (linkErr && !linkErr.message?.includes('duplicate') && !linkErr.code?.includes('23505')) {
        throw new Error(`Usuário criado mas erro ao vincular ao cliente: ${linkErr.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
