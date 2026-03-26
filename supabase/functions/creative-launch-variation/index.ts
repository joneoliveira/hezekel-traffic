import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { adId, adsetId, adName, generatedImageUrl } = await req.json();
    const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['meta_access_token', 'meta_ad_account_id']);
    const accessToken = settings?.find((r: any) => r.key === 'meta_access_token')?.value;
    const adAccountId = settings?.find((r: any) => r.key === 'meta_ad_account_id')?.value;

    if (!accessToken || !adAccountId) throw new Error('Credenciais Meta não configuradas.');

    const BASE = 'https://graph.facebook.com/v20.0';
    const accountId = adAccountId.replace('act_', '');

    // Criar criativo com a nova imagem
    const creativeRes = await fetch(`${BASE}/act_${accountId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `[IA] ${adName}`,
        object_story_spec: { link_data: { image_url: generatedImageUrl, link: 'https://example.com' } },
        access_token: accessToken,
      }),
    });
    const creative = await creativeRes.json();
    if (creative.error) throw new Error(creative.error.message);

    // Criar o ad
    const newAdName = `[IA] ${adName}`;
    const adRes = await fetch(`${BASE}/act_${accountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newAdName,
        adset_id: adsetId,
        creative: { creative_id: creative.id },
        status: 'PAUSED',
        access_token: accessToken,
      }),
    });
    const adData = await adRes.json();
    if (adData.error) throw new Error(adData.error.message);

    return new Response(JSON.stringify({ newAdId: adData.id, newAdName, adsetId, status: 'PAUSED' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
