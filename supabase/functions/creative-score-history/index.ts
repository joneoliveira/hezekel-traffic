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
    const url = new URL(req.url);
    const ad_id = url.searchParams.get('ad_id') || '';
    const adset_id = url.searchParams.get('adset_id') || '';

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().split('T')[0];

    const { data: history } = await supabase
      .from('creative_scores')
      .select('date, score, status')
      .eq('ad_id', ad_id)
      .gte('date', sinceStr)
      .order('date', { ascending: true });

    const { data: adsetRaw } = await supabase
      .from('creative_scores')
      .select('date, score')
      .eq('adset_id', adset_id)
      .gte('date', sinceStr)
      .order('date', { ascending: true });

    // Média do adset por dia
    const adsetByDate = new Map<string, number[]>();
    for (const row of (adsetRaw || [])) {
      if (!adsetByDate.has(row.date)) adsetByDate.set(row.date, []);
      adsetByDate.get(row.date)!.push(row.score);
    }
    const adset_history = Array.from(adsetByDate.entries()).map(([date, scores]) => ({
      date, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));

    return new Response(JSON.stringify({ history: history || [], adset_history }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
