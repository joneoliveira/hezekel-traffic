import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    let { accessToken, adAccountId } = body;

    // Se não veio no body, busca do banco
    if (!accessToken || !adAccountId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['meta_access_token', 'meta_ad_account_id']);
      accessToken = data?.find(r => r.key === 'meta_access_token')?.value;
      adAccountId = data?.find(r => r.key === 'meta_ad_account_id')?.value;
    }

    if (!accessToken || !adAccountId) {
      return new Response(JSON.stringify({ success: false, error: 'Credenciais não configuradas.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const accountId = adAccountId.replace('act_', '');
    const url = `https://graph.facebook.com/v20.0/act_${accountId}?fields=name,currency,account_status&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return new Response(JSON.stringify({ success: false, error: data.error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, accountName: data.name, currency: data.currency }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
