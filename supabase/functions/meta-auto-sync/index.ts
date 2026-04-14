import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function syncAccount(supabaseUrl: string, serviceKey: string, account_id: string, date_preset: string) {
  const res = await fetch(`${supabaseUrl}/functions/v1/meta-sync-creative-intelligence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify({ account_id, date_preset }),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Always sync both today and last_30d regardless of what's passed
    const presets = ['today', 'last_30d'];

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
      for (const preset of presets) {
        try {
          const result = await syncAccount(supabaseUrl, serviceKey, account.ad_account_id, preset);
          results.push({
            account_id:   account.ad_account_id,
            account_name: account.name,
            date_preset:  preset,
            success:      !result.error,
            error:        result.error ?? null,
            synced_rows:  result.synced_insights_rows ?? 0,
            unique_ads:   result.unique_ads ?? 0,
          });
        } catch (e: any) {
          results.push({
            account_id:   account.ad_account_id,
            account_name: account.name,
            date_preset:  preset,
            success:      false,
            error:        e.message,
            synced_rows:  0,
            unique_ads:   0,
          });
        }
      }
    }

    const total_synced = results.reduce((s, r) => s + r.synced_rows, 0);
    const total_ads    = results.reduce((s, r) => s + r.unique_ads, 0);

    return new Response(JSON.stringify({
      presets_synced:     presets,
      accounts_processed: accounts.length,
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
