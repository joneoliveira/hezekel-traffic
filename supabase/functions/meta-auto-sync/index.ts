import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const supabaseUrl   = Deno.env.get('SUPABASE_URL')!;
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));
    const date_preset = body.date_preset || 'yesterday';

    // Busca todas as contas ativas
    const { data: accounts, error: accErr } = await supabase
      .from('meta_accounts')
      .select('id, name, ad_account_id, is_active')
      .eq('is_active', true);

    if (accErr) throw new Error('Erro ao buscar contas: ' + accErr.message);
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma conta ativa encontrada', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const account of accounts) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/meta-sync-creative-intelligence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
          body: JSON.stringify({
            account_id: account.ad_account_id,
            date_preset,
          }),
        });

        const result = await res.json();

        results.push({
          account_id:  account.ad_account_id,
          account_name: account.name,
          success:     !result.error,
          error:       result.error ?? null,
          synced_rows: result.synced_insights_rows ?? 0,
          unique_ads:  result.unique_ads ?? 0,
        });
      } catch (e: any) {
        results.push({
          account_id:  account.ad_account_id,
          account_name: account.name,
          success:     false,
          error:       e.message,
          synced_rows: 0,
          unique_ads:  0,
        });
      }
    }

    const total_synced = results.reduce((s, r) => s + r.synced_rows, 0);
    const total_ads    = results.reduce((s, r) => s + r.unique_ads, 0);

    return new Response(JSON.stringify({
      date_preset,
      accounts_processed: results.length,
      total_synced_rows:  total_synced,
      total_unique_ads:   total_ads,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
